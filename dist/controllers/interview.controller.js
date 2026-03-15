import { Interview } from '../model/interview.model.js';
import { Question } from '../model/question.model.js';
import { Answer } from '../model/answer.model.js';
import { Workspace } from '../model/workspace.model.js';
import { evaluateAnswer, generateInterviewQuestions } from '../utils/gemini.js';
import mongoose from 'mongoose';
/* Creates a new interview in a workspace
 */
export const createInterview = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { workspaceId, title, description, topic } = req.body;
        const userId = req.userId;
        if (!userId) {
            await session.abortTransaction();
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        if (!workspaceId || !topic) {
            await session.abortTransaction();
            res.status(400).json({
                error: 'workspaceId and topic are required'
            });
            return;
        }
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            createdBy: userId
        }).session(session);
        if (!workspace) {
            await session.abortTransaction();
            res.status(404).json({ error: 'Workspace not found or access denied' });
            return;
        }
        const interview = new Interview({
            title: title || `${topic} Interview`,
            description,
            topic,
            workspaceId,
            createdBy: userId,
            status: 'pending',
        });
        await interview.save({ session });
        const questionsToSave = await generateInterviewQuestions(topic);
        const savedQuestions = await Question.insertMany(questionsToSave.map(q => ({
            topic,
            question: q.question,
            correctAnswer: q.correctAnswer,
            interviewId: interview._id,
            workspaceId,
            createdBy: userId,
        })), { session });
        workspace.Interviews.push(interview._id);
        await workspace.save({ session });
        await session.commitTransaction();
        res.status(201).json({
            success: true,
            interview: {
                id: interview._id,
                title: interview.title,
                topic: interview.topic,
                status: interview.status,
                totalQuestions: savedQuestions.length,
            },
            questions: savedQuestions.map(q => ({
                id: q._id,
                question: q.question,
            })),
        });
        return;
    }
    catch (error) {
        await session.abortTransaction();
        console.error('Error creating interview:', error);
        res.status(500).json({ error: 'Failed to create interview' });
        return;
    }
    finally {
        session.endSession();
    }
};
/* Mark interview as in-progress
 */
export const startInterview = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        const interview = await Interview.findOne({
            _id: interviewId,
            createdBy: userId
        });
        if (!interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        interview.status = 'in-progress';
        interview.startedAt = new Date();
        await interview.save();
        const questions = await Question.find({ interviewId }).select('-correctAnswer');
        res.status(200).json({
            success: true,
            interview: {
                id: interview._id,
                title: interview.title,
                topic: interview.topic,
                status: interview.status,
                startedAt: interview.startedAt,
            },
            questions,
        });
        return;
    }
    catch (error) {
        console.error('Error starting interview:', error);
        res.status(500).json({ error: 'Failed to start interview' });
        return;
    }
};
/*
  User submits answer for a question
 */
export const submitAnswer = async (req, res) => {
    try {
        const { interviewId, questionId, userAnswer, timeTaken } = req.body;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        if (!interviewId || !questionId || !userAnswer) {
            res.status(400).json({
                error: 'interviewId, questionId, and userAnswer are required'
            });
            return;
        }
        const interview = await Interview.findOne({
            _id: interviewId,
            createdBy: userId
        });
        if (!interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        const question = await Question.findOne({
            _id: questionId,
            interviewId
        });
        if (!question) {
            res.status(404).json({ error: 'Question not found in this interview' });
            return;
        }
        const existingAnswer = await Answer.findOne({
            interviewId,
            questionId,
            answeredBy: userId
        });
        if (existingAnswer) {
            res.status(400).json({ error: 'Question already answered' });
            return;
        }
        const evaluation = await evaluateAnswer(question.question, question.correctAnswer, userAnswer);
        const answer = new Answer({
            interviewId,
            questionId,
            answeredBy: userId,
            userAnswer,
            isCorrect: evaluation.is_correct,
            shortReason: evaluation.short_reason,
            correctedAnswer: evaluation.corrected_answer,
            timeTaken,
        });
        await answer.save();
        await interview.updateAnalytics();
        res.status(200).json({
            success: true,
            correct: evaluation.is_correct,
            explanation: evaluation.short_reason,
            correctAnswer: evaluation.corrected_answer,
            answerId: answer._id,
        });
        return;
    }
    catch (error) {
        console.error('Error submitting answer:', error);
        res.status(500).json({ error: 'Failed to submit answer' });
        return;
    }
};
/*
 Mark interview as completed
 */
export const completeInterview = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        const interview = await Interview.findOne({
            _id: interviewId,
            createdBy: userId
        });
        if (!interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        interview.status = 'completed';
        interview.completedAt = new Date();
        await interview.updateAnalytics();
        res.status(200).json({
            success: true,
            message: 'Interview completed successfully',
            analytics: {
                totalQuestions: interview.totalQuestions,
                answeredQuestions: interview.answeredQuestions,
                correctAnswers: interview.correctAnswers,
                wrongAnswers: interview.wrongAnswers,
                scorePercentage: interview.scorePercentage,
            },
        });
        return;
    }
    catch (error) {
        console.error('Error completing interview:', error);
        res.status(500).json({ error: 'Failed to complete interview' });
        return;
    }
};
/*
 Fetch interview with all questions and answers
 */
export const getInterviewDetails = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        const interview = await Interview.findOne({
            _id: interviewId,
            createdBy: userId
        })
            .populate('workspaceId', 'title')
            .populate('createdBy', 'name email username')
            .lean();
        if (!interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        const questions = await Question.find({ interviewId })
            .select('question correctAnswer topic')
            .lean();
        const answers = await Answer.find({ interviewId, answeredBy: userId })
            .populate('questionId', 'question')
            .lean();
        // Combine questions with answers
        const questionsWithAnswers = questions.map(question => {
            const answer = answers.find(a => a.questionId._id.toString() === question._id.toString());
            return {
                questionId: question._id,
                question: question.question,
                correctAnswer: question.correctAnswer,
                userAnswer: answer?.userAnswer || null,
                isCorrect: answer?.isCorrect || false,
                explanation: answer?.shortReason || null,
                timeTaken: answer?.timeTaken || null,
                answered: !!answer,
            };
        });
        const weakTopics = questionsWithAnswers
            .filter(q => q.answered && !q.isCorrect)
            .map(q => q.question);
        res.status(200).json({
            success: true,
            interview: {
                id: interview._id,
                title: interview.title,
                description: interview.description,
                topic: interview.topic,
                status: interview.status,
                workspace: interview.workspaceId,
                createdBy: interview.createdBy,
                startedAt: interview.startedAt,
                completedAt: interview.completedAt,
                createdAt: interview.createdAt,
            },
            analytics: {
                totalQuestions: interview.totalQuestions,
                answeredQuestions: interview.answeredQuestions,
                correctAnswers: interview.correctAnswers,
                wrongAnswers: interview.wrongAnswers,
                unansweredQuestions: interview.totalQuestions - interview.answeredQuestions,
                scorePercentage: interview.scorePercentage,
            },
            questionsWithAnswers,
            weakTopics,
        });
        return;
    }
    catch (error) {
        console.error('Error fetching interview details:', error);
        res.status(500).json({ error: 'Failed to fetch interview details' });
        return;
    }
};
/*
  Fetch all interviews in a workspace
 */
export const getWorkspaceInterviews = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            createdBy: userId
        })
            .populate({
            path: 'Interviews',
            options: { sort: { createdAt: -1 } }
        })
            .lean();
        if (!workspace) {
            res.status(404).json({ error: 'Workspace not found' });
            return;
        }
        res.status(200).json({
            success: true,
            workspace: {
                id: workspace._id,
                title: workspace.title,
            },
            interviews: workspace.Interviews,
        });
        return;
    }
    catch (error) {
        console.error('Error fetching workspace interviews:', error);
        res.status(500).json({ error: 'Failed to fetch interviews' });
        return;
    }
};
/*
 Get analytics across all user interviews
 */
export const getUserAnalytics = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }
        const interviews = await Interview.find({ createdBy: userId });
        const totalInterviews = interviews.length;
        const completedInterviews = interviews.filter(i => i.status === 'completed').length;
        const inProgressInterviews = interviews.filter(i => i.status === 'in-progress').length;
        const totalQuestions = interviews.reduce((sum, i) => sum + i.totalQuestions, 0);
        const totalAnswered = interviews.reduce((sum, i) => sum + i.answeredQuestions, 0);
        const totalCorrect = interviews.reduce((sum, i) => sum + i.correctAnswers, 0);
        const totalWrong = interviews.reduce((sum, i) => sum + i.wrongAnswers, 0);
        const overallScore = totalQuestions > 0
            ? Math.round((totalCorrect / totalQuestions) * 100)
            : 0;
        const topicStats = await Interview.aggregate([
            { $match: { createdBy: userId } },
            {
                $group: {
                    _id: '$topic',
                    totalInterviews: { $sum: 1 },
                    avgScore: { $avg: '$scorePercentage' },
                    totalCorrect: { $sum: '$correctAnswers' },
                    totalWrong: { $sum: '$wrongAnswers' },
                },
            },
            { $sort: { avgScore: -1 } },
        ]);
        const recentInterviews = await Interview.find({ createdBy: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title topic scorePercentage status createdAt')
            .lean();
        res.status(200).json({
            success: true,
            overall: {
                totalInterviews,
                completedInterviews,
                inProgressInterviews,
                totalQuestions,
                totalAnswered,
                totalCorrect,
                totalWrong,
                overallScore,
            },
            topicStats,
            recentInterviews,
        });
        return;
    }
    catch (error) {
        console.error('Error fetching user analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
        return;
    }
};
