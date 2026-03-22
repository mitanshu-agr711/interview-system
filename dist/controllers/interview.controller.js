import { Interview } from '../model/interview.model.js';
import { Question } from '../model/question.model.js';
import { Answer } from '../model/answer.model.js';
import { InterviewAttempt } from '../model/interviewattempt.js';
import { Workspace } from '../model/workspace.model.js';
import { evaluateAnswer, generateInterviewQuestions } from '../utils/gemini.js';
import mongoose from 'mongoose';
const canAccessInterview = async (interviewId, userId) => {
    const interview = await Interview.findById(interviewId)
        .populate('workspaceId', 'createdBy isShared')
        .exec();
    if (!interview) {
        return { interview: null, allowed: false };
    }
    const workspace = interview.workspaceId;
    const isOwner = String(workspace.createdBy) === userId;
    const isShared = Boolean(workspace.isShared);
    return { interview, allowed: isOwner || isShared };
};
const updateAttemptAnalytics = async (attempt, totalQuestions) => {
    const [stats] = await Answer.aggregate([
        {
            $match: {
                attemptId: new mongoose.Types.ObjectId(String(attempt._id)),
            },
        },
        {
            $group: {
                _id: null,
                answeredQuestions: { $sum: 1 },
                correctAnswers: {
                    $sum: {
                        $cond: [{ $eq: ['$isCorrect', true] }, 1, 0],
                    },
                },
            },
        },
    ]);
    const answeredQuestions = stats?.answeredQuestions ?? 0;
    const correctAnswers = stats?.correctAnswers ?? 0;
    const wrongAnswers = Math.max(answeredQuestions - correctAnswers, 0);
    const scorePercentage = totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    attempt.totalQuestions = totalQuestions;
    attempt.answeredQuestions = answeredQuestions;
    attempt.correctAnswers = correctAnswers;
    attempt.wrongAnswers = wrongAnswers;
    attempt.scorePercentage = scorePercentage;
    await attempt.save();
    return attempt;
};
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
        });
        await interview.save({ session });
        const questionsToSave = await generateInterviewQuestions(topic);
        const savedQuestions = await Question.insertMany(questionsToSave.map(q => ({
            topic,
            question: q.question,
            correctAnswer: q.correctAnswer,
            interviewId: interview._id,
            createdBy: userId,
        })), { session });
        interview.totalQuestions = savedQuestions.length;
        await interview.save({ session });
        workspace.Interviews.push(interview._id);
        await workspace.save({ session });
        await session.commitTransaction();
        res.status(201).json({
            success: true,
            interview: {
                id: interview._id,
                title: interview.title,
                topic: interview.topic,
                status: 'not-started',
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
        if (!mongoose.isValidObjectId(interviewId)) {
            res.status(400).json({ error: 'Invalid interviewId' });
            return;
        }
        const access = await canAccessInterview(interviewId, userId);
        if (!access.interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        if (!access.allowed) {
            res.status(403).json({ error: 'Access denied for this interview' });
            return;
        }
        const interview = access.interview;
        const attempt = await InterviewAttempt.findOneAndUpdate({ interviewId, userId }, {
            $set: { status: 'in-progress' },
            $setOnInsert: {
                startedAt: new Date(),
                totalQuestions: interview.totalQuestions,
            },
        }, { upsert: true, new: true });
        const questions = await Question.find({ interviewId }).select('-correctAnswer');
        res.status(200).json({
            success: true,
            interview: {
                id: interview._id,
                attemptId: attempt._id,
                title: interview.title,
                topic: interview.topic,
                status: attempt.status,
                startedAt: attempt.startedAt,
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
        if (!mongoose.isValidObjectId(interviewId) || !mongoose.isValidObjectId(questionId)) {
            res.status(400).json({ error: 'Invalid interviewId or questionId' });
            return;
        }
        const access = await canAccessInterview(interviewId, userId);
        if (!access.interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        if (!access.allowed) {
            res.status(403).json({ error: 'Access denied for this interview' });
            return;
        }
        const interview = access.interview;
        let attempt = await InterviewAttempt.findOne({ interviewId, userId });
        if (!attempt) {
            attempt = await InterviewAttempt.create({
                interviewId,
                userId,
                status: 'in-progress',
                startedAt: new Date(),
                totalQuestions: interview.totalQuestions,
            });
        }
        if (attempt.status === 'completed') {
            res.status(400).json({ error: 'Interview attempt already completed' });
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
            attemptId: attempt._id,
            questionId,
        });
        if (existingAnswer) {
            res.status(400).json({ error: 'Question already answered' });
            return;
        }
        const evaluation = await evaluateAnswer(question.question, question.correctAnswer, userAnswer);
        const answer = new Answer({
            attemptId: attempt._id,
            questionId,
            userAnswer,
            isCorrect: evaluation.is_correct,
            shortReason: evaluation.short_reason,
            correctedAnswer: evaluation.corrected_answer,
            timeTaken,
        });
        await answer.save();
        await updateAttemptAnalytics(attempt, interview.totalQuestions);
        res.status(200).json({
            success: true,
            correct: evaluation.is_correct,
            explanation: evaluation.short_reason,
            correctAnswer: evaluation.corrected_answer,
            answerId: answer._id,
            analytics: {
                totalQuestions: attempt.totalQuestions,
                answeredQuestions: attempt.answeredQuestions,
                correctAnswers: attempt.correctAnswers,
                wrongAnswers: attempt.wrongAnswers,
                scorePercentage: attempt.scorePercentage,
            },
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
        if (!mongoose.isValidObjectId(interviewId)) {
            res.status(400).json({ error: 'Invalid interviewId' });
            return;
        }
        const access = await canAccessInterview(interviewId, userId);
        if (!access.interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        if (!access.allowed) {
            res.status(403).json({ error: 'Access denied for this interview' });
            return;
        }
        const attempt = await InterviewAttempt.findOne({ interviewId, userId });
        if (!attempt) {
            res.status(404).json({ error: 'Interview attempt not found. Start interview first.' });
            return;
        }
        attempt.status = 'completed';
        attempt.completedAt = new Date();
        await updateAttemptAnalytics(attempt, access.interview.totalQuestions);
        res.status(200).json({
            success: true,
            message: 'Interview completed successfully',
            analytics: {
                totalQuestions: attempt.totalQuestions,
                answeredQuestions: attempt.answeredQuestions,
                correctAnswers: attempt.correctAnswers,
                wrongAnswers: attempt.wrongAnswers,
                scorePercentage: attempt.scorePercentage,
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
        if (!mongoose.isValidObjectId(interviewId)) {
            res.status(400).json({ error: 'Invalid interviewId' });
            return;
        }
        const access = await canAccessInterview(interviewId, userId);
        if (!access.interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        if (!access.allowed) {
            res.status(403).json({ error: 'Access denied for this interview' });
            return;
        }
        const interview = await Interview.findById(interviewId)
            .populate('workspaceId', 'title')
            .populate('createdBy', 'name email username')
            .lean();
        if (!interview) {
            res.status(404).json({ error: 'Interview not found' });
            return;
        }
        const attempt = await InterviewAttempt.findOne({ interviewId, userId }).lean();
        const questions = await Question.find({ interviewId })
            .select('question correctAnswer topic')
            .lean();
        const answers = attempt
            ? await Answer.find({ attemptId: attempt._id }).lean()
            : [];
        const answerMap = new Map(answers.map((answer) => [String(answer.questionId), answer]));
        // Combine questions with answers
        const questionsWithAnswers = questions.map((question) => {
            const answer = answerMap.get(String(question._id));
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
                attemptId: attempt?._id || null,
                title: interview.title,
                description: interview.description,
                topic: interview.topic,
                status: attempt?.status || 'not-started',
                workspace: interview.workspaceId,
                createdBy: interview.createdBy,
                startedAt: attempt?.startedAt || null,
                completedAt: attempt?.completedAt || null,
                createdAt: interview.createdAt,
            },
            analytics: {
                totalQuestions: attempt?.totalQuestions ?? interview.totalQuestions,
                answeredQuestions: attempt?.answeredQuestions ?? 0,
                correctAnswers: attempt?.correctAnswers ?? 0,
                wrongAnswers: attempt?.wrongAnswers ?? 0,
                unansweredQuestions: (attempt?.totalQuestions ?? interview.totalQuestions) -
                    (attempt?.answeredQuestions ?? 0),
                scorePercentage: attempt?.scorePercentage ?? 0,
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
        const attempts = await InterviewAttempt.find({ userId })
            .populate('interviewId', 'title topic createdAt')
            .sort({ createdAt: -1 })
            .lean();
        const totalInterviews = attempts.length;
        const completedInterviews = attempts.filter(i => i.status === 'completed').length;
        const inProgressInterviews = attempts.filter(i => i.status === 'in-progress').length;
        const totalQuestions = attempts.reduce((sum, i) => sum + (i.totalQuestions || 0), 0);
        const totalAnswered = attempts.reduce((sum, i) => sum + (i.answeredQuestions || 0), 0);
        const totalCorrect = attempts.reduce((sum, i) => sum + (i.correctAnswers || 0), 0);
        const totalWrong = attempts.reduce((sum, i) => sum + (i.wrongAnswers || 0), 0);
        const overallScore = totalQuestions > 0
            ? Math.round((totalCorrect / totalQuestions) * 100)
            : 0;
        const topicAccumulator = new Map();
        for (const attempt of attempts) {
            const topic = attempt.interviewId?.topic || 'Unknown';
            const current = topicAccumulator.get(topic) || {
                totalInterviews: 0,
                scoreSum: 0,
                totalCorrect: 0,
                totalWrong: 0,
            };
            current.totalInterviews += 1;
            current.scoreSum += attempt.scorePercentage || 0;
            current.totalCorrect += attempt.correctAnswers || 0;
            current.totalWrong += attempt.wrongAnswers || 0;
            topicAccumulator.set(topic, current);
        }
        const topicStats = Array.from(topicAccumulator.entries())
            .map(([topic, stats]) => ({
            _id: topic,
            totalInterviews: stats.totalInterviews,
            avgScore: stats.totalInterviews > 0
                ? Math.round((stats.scoreSum / stats.totalInterviews) * 100) / 100
                : 0,
            totalCorrect: stats.totalCorrect,
            totalWrong: stats.totalWrong,
        }))
            .sort((a, b) => b.avgScore - a.avgScore);
        const recentInterviews = attempts
            .slice(0, 5)
            .map((attempt) => ({
            title: attempt.interviewId?.title || 'Untitled Interview',
            topic: attempt.interviewId?.topic || 'Unknown',
            scorePercentage: attempt.scorePercentage || 0,
            status: attempt.status,
            createdAt: attempt.createdAt,
        }));
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
