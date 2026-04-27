import { Request, Response } from 'express';
import { Interview } from '../model/interview.model.js';
import { Question } from '../model/question.model.js';
import { Answer } from '../model/answer.model.js';
import { InterviewAttempt } from '../model/interviewattempt.js';
import { Workspace } from '../model/workspace.model.js';
import { evaluateAnswer, generateInterviewQuestions } from '../utils/gemini.js';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const canAccessInterview = async (interviewId: string, userId: string) => {
  const interview = await Interview.findById(interviewId)
    .populate('workspaceId', 'createdBy isShared')
    .exec();

  if (!interview) {
    return { interview: null, allowed: false };
  }

  const workspace = interview.workspaceId as unknown as {
    createdBy: mongoose.Types.ObjectId;
    isShared?: boolean;
  };

  const isOwner = String(workspace.createdBy) === userId;
  const isShared = Boolean(workspace.isShared);

  return { interview, allowed: isOwner || isShared };
};

const updateAttemptAnalytics = async (
  attempt: any,
  totalQuestions: number
) => {
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
export const createInterview = async (req: Request, res: Response) :Promise<void> => {
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

 
   
    const questionsToSave =  await generateInterviewQuestions(topic);

    const savedQuestions = await Question.insertMany(
      questionsToSave.map(q => ({
        topic,
        question: q.question,
        correctAnswer: q.correctAnswer,
        interviewId: interview._id,
        createdBy: userId,
      })),
      { session }
    );

    interview.totalQuestions = savedQuestions.length;
    await interview.save({ session });

    
    workspace.Interviews.push(interview._id as mongoose.Types.ObjectId);
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
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating interview:', error);
        res.status(500).json({ error: 'Failed to create interview' });
        return;
  } finally {
    session.endSession();
  }
};

/* Mark interview as in-progress
 */
export const startInterview = async (req: Request, res: Response) :Promise<void>=> {
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

    // First, check if there's already an in-progress attempt
    let attempt = await InterviewAttempt.findOne({ 
      interviewId, 
      userId: new mongoose.Types.ObjectId(userId),
      status: 'in-progress'
    });

    // If no in-progress attempt exists, check for completed attempts
    if (!attempt) {
      try {
        attempt = await InterviewAttempt.create({
          attemptId: uuidv4(),
          interviewId,
          userId: new mongoose.Types.ObjectId(userId),
          status: 'in-progress',
          startedAt: new Date(),
          totalQuestions: interview.totalQuestions,
        });
      } catch (err) {
        // If duplicate key error, fetch the existing attempt
        if (err.code === 11000) {
          attempt = await InterviewAttempt.findOne({
            interviewId,
            userId: new mongoose.Types.ObjectId(userId),
            status: 'in-progress'
          });
        } else {
          throw err; // rethrow other errors
        }
      }
    }

    
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
  } catch (error) {
    console.error('Error starting interview:', error);
    res.status(500).json({ error: 'Failed to start interview' });
    return;
  }
};

/*
  User submits answer for a question
 */
export const submitAnswer = async (req: Request, res: Response) :Promise<void>=> {
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

    let attempt = await InterviewAttempt.findOne({ 
      interviewId, 
      userId: new mongoose.Types.ObjectId(userId),
      status: 'in-progress'
    }).sort({ createdAt: -1 });
    
    if (!attempt) {
      res.status(400).json({ error: 'Start the interview first before submitting answers' });
      return;
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

    const evaluation = await evaluateAnswer(
      question.question,
      question.correctAnswer,
      userAnswer
    );

    // Update existing answer or create new one
    let answer = await Answer.findOneAndUpdate(
      { 
        attemptId: attempt._id,
        questionId, 
      },
      {
        userAnswer,
        isCorrect: evaluation.is_correct,
        shortReason: evaluation.short_reason,
        correctedAnswer: evaluation.corrected_answer,
        timeTaken,
      },
      { new: true, upsert: true } // Create if doesn't exist
    );


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
  } catch (error) {
    console.error('Error submitting answer:', error);
     res.status(500).json({ error: 'Failed to submit answer' });
     return;
  }
};

/*
 Mark interview as completed
 */
export const completeInterview = async (req: Request, res: Response) :Promise<void>=> {
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

    const attempt = await InterviewAttempt.findOne({ 
      interviewId, 
      userId: new mongoose.Types.ObjectId(userId),
      status: 'in-progress'
    }).sort({ createdAt: -1 });

    if (!attempt) {
      res.status(404).json({ error: 'Interview attempt not found. Start interview first.' });
      return;
    }

    // Prevent completion if no answers submitted
    if ((attempt.answeredQuestions ?? 0) === 0) {
      res.status(400).json({ error: 'You must answer at least one question before completing the interview.' });
      return;
    }

    attempt.status = 'completed';
    attempt.completedAt = new Date();
    await updateAttemptAnalytics(attempt, access.interview.totalQuestions);

    // Calculate total time taken in seconds
    let totalTimeTaken = null;
    if (attempt.startedAt && attempt.completedAt) {
      totalTimeTaken = Math.floor((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000);
    }

    res.status(200).json({
      success: true,
      message: 'Interview completed successfully',
      analytics: {
        totalQuestions: attempt.totalQuestions,
        answeredQuestions: attempt.answeredQuestions,
        correctAnswers: attempt.correctAnswers,
        wrongAnswers: attempt.wrongAnswers,
        scorePercentage: attempt.scorePercentage,
        totalTimeTakenSeconds: totalTimeTaken,
      },
    });
    return;
  } catch (error) {
    console.error('Error completing interview:', error);
    res.status(500).json({ error: 'Failed to complete interview' });
    return;
  }
};

/*
 Fetch interview with all questions and answers
 */
export const getInterviewDetails = async (req: Request, res: Response) => {
  const { attemptId } = req.params;

  if (!mongoose.isValidObjectId(attemptId)) {
    return res.status(400).json({ error: "Invalid attemptId" });
  }

  const attempt = await InterviewAttempt.findById(attemptId)
    .populate("interviewId")
    .lean();

  if (!attempt) {
    return res.status(404).json({ error: "Attempt not found" });
  }

  const interview = attempt.interviewId as any;

  const questions = await Question.find({ interviewId: interview._id }).lean();

  const answers = await Answer.find({ attemptId }).lean();

  const answerMap = new Map(
    answers.map(a => [String(a.questionId), a])
  );

  const questionsWithAnswers = questions.map(q => {
    const answer = answerMap.get(String(q._id));
    return {
      questionId: q._id,
      question: q.question,
      correctAnswer: q.correctAnswer,
      userAnswer: answer?.userAnswer || null,
      isCorrect: answer?.isCorrect || false,
      explanation: answer?.shortReason || null,
      timeTaken: answer?.timeTaken || null,
      answered: !!answer,
    };
  });

  // Calculate total time taken in seconds
  let totalTimeTaken = null;
  if (attempt.startedAt && attempt.completedAt) {
    totalTimeTaken = Math.floor((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000);
  }

  res.json({
    interview: {
      id: interview._id,
      attemptId: attempt._id,
      title: interview.title,
      topic: interview.topic,
      status: attempt.status,
      createdAt: interview.createdAt,
    },
    analytics: {
      totalQuestions: attempt.totalQuestions,
      answeredQuestions: attempt.answeredQuestions,
      correctAnswers: attempt.correctAnswers,
      wrongAnswers: attempt.wrongAnswers,
      scorePercentage: attempt.scorePercentage,
      totalTimeTakenSeconds: totalTimeTaken,
    },
    questionsWithAnswers,
  });
};

/*
  Fetch all interviews in a workspace
 */
export const getWorkspaceInterviews = async (req: Request, res: Response) :Promise<void>=> {
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
  } catch (error) {
    console.error('Error fetching workspace interviews:', error);
     res.status(500).json({ error: 'Failed to fetch interviews' });
     return;
  }
};

/*
 Get analytics across all user interviews
 */
export const getUserAnalytics = async (req: Request, res: Response) :Promise<void>=> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const attempts = await InterviewAttempt.find({ userId: new mongoose.Types.ObjectId(userId) })
      .populate('interviewId', 'title topic createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const totalInterviews = attempts.length;
    const completedInterviews = attempts.filter(i => i.status === 'completed').length;
    const inProgressInterviews = attempts.filter(i => i.status === 'in-progress').length;

    const totalQuestions = attempts.reduce((sum, i: any) => sum + (i.totalQuestions || 0), 0);
    const totalAnswered = attempts.reduce((sum, i: any) => sum + (i.answeredQuestions || 0), 0);
    const totalCorrect = attempts.reduce((sum, i: any) => sum + (i.correctAnswers || 0), 0);
    const totalWrong = attempts.reduce((sum, i: any) => sum + (i.wrongAnswers || 0), 0);
    
    const overallScore = totalQuestions > 0 
      ? Math.round((totalCorrect / totalQuestions) * 100) 
      : 0;

    const topicAccumulator = new Map<string, {
      totalInterviews: number;
      scoreSum: number;
      totalCorrect: number;
      totalWrong: number;
    }>();

    for (const attempt of attempts as any[]) {
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
        avgScore:
          stats.totalInterviews > 0
            ? Math.round((stats.scoreSum / stats.totalInterviews) * 100) / 100
            : 0,
        totalCorrect: stats.totalCorrect,
        totalWrong: stats.totalWrong,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

  
    const recentInterviews = (attempts as any[])
      .slice(0, 5)
      .map((attempt) => ({
          attemptId: attempt._id,
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
  } catch (error) {
    console.error('Error fetching user analytics:', error);
     res.status(500).json({ error: 'Failed to fetch analytics' });
     return;
  }
};
