import { Request, Response } from 'express';
import { Question } from '../model/question.model.js';
import { Answer } from '../model/answer.model.js';
import { evaluateAnswer, generateInterviewQuestions } from '../utils/gemini.js';



export const createInterviewQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { topic } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!topic) {
      res.status(400).json({ 
        error: 'Topic is required' 
      });
      return;
    }

 
    const generatedQuestions = await generateInterviewQuestions(topic);

    let questionsArray;

    if (Array.isArray(generatedQuestions)) {
      questionsArray = generatedQuestions;
    } 
    else if (generatedQuestions && typeof generatedQuestions === 'object') {
      const questionsObj = generatedQuestions as any;
      questionsArray = questionsObj.questions || 
                       questionsObj.data || 
                       questionsObj.items ||
                       Object.values(questionsObj)[0];
    }
    
    if (!Array.isArray(questionsArray)) {
      console.error("Invalid response structure:", generatedQuestions);
      throw new Error("Generated questions is not an array");
    }

    const interviewSessionId = new Date().getTime().toString();

    const savedQuestions = await Promise.all(
      questionsArray.map(async (q) => {
        const question = new Question({
          topic,
          question: q.question,
          correctAnswer: q.correctAnswer,
          createdBy: userId,
          interviewSessionId,
        });
        return await question.save();
      })
    );

    res.status(201).json({
      success: true,
      interviewSessionId,
      questions: savedQuestions.map(q => ({
        id: q._id,
        question: q.question,
      })),
    });
    return;
  } catch (error) {
    console.error('Error creating interview questions:', error);
    res.status(500).json({ 
      error: 'Failed to create interview questions' 
    });
    return;
  }
};


// Submit and evaluate a user's answer
export const submitAnswer = async (req: Request, res: Response): Promise<void> => {

  try {
   
    const { questionId, userAnswer } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!questionId || !userAnswer) {
      res.status(400).json({ 
        error: 'Question ID and user answer are required' 
      });
      return;
    }

   
    if (typeof userAnswer !== 'string' || userAnswer.trim().length === 0) {
      res.status(400).json({ 
        error: 'User answer cannot be empty' 
      });
      return;
    }

   
    if (!questionId.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({ 
        error: 'Invalid question ID format' 
      });
      return;
    }

    
    const question = await Question.findById(questionId);
    
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

   
    const existingAnswer = await Answer.findOne({ 
      questionId, 
      answeredBy: userId 
    });

    if (existingAnswer) {
      res.status(409).json({ 
        error: 'You have already answered this question',
        previousAnswer: {
          userAnswer: existingAnswer.userAnswer,
          isCorrect: existingAnswer.isCorrect,
          shortReason: existingAnswer.shortReason
        }
      });
      return;
    }

   
    const evaluation = await evaluateAnswer(
      question.question,
      question.correctAnswer,
      userAnswer.trim()
    );

    
    if (!evaluation || typeof evaluation.is_correct !== 'boolean') {
      throw new Error('Invalid evaluation response from AI');
    }

   
    const answer = new Answer({
      questionId,
      answeredBy: userId,
      userAnswer: userAnswer.trim(),
      isCorrect: evaluation.is_correct,
      shortReason: evaluation.short_reason,
      correctedAnswer: evaluation.corrected_answer,
      interviewSessionId: question.interviewSessionId,
    });

    await answer.save();

 
    res.status(200).json({
      success: true,
      correct: evaluation.is_correct,
      explanation: evaluation.short_reason,
      correctAnswer: evaluation.corrected_answer,
      answerId: answer._id,
    });
    return;
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ 
      error: 'Failed to evaluate answer',
      
      ...(process.env.NODE_ENV === 'development' && { 
        details: (error as Error).message 
      })
    });
    return;
  }
};


// Get summary/results for an interview session
export const getInterviewSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { interviewSessionId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!interviewSessionId) {
        res.status(400).json({ error: 'Interview session ID is required' });
        return;
    }

    // Get all questions for this session
    const questions = await Question.find({ 
      interviewSessionId,
      createdBy: userId 
    });

    if (questions.length === 0) {
     res.status(404).json({ error: 'Interview session not found' });
         return;
    }

    // Get all answers for this session
    const answers = await Answer.find({ 
      interviewSessionId,
      answeredBy: userId 
    }).populate('questionId');

    // Calculate statistics
    const totalQuestions = questions.length;
    const answeredQuestions = answers.length;
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const wrongAnswers = answeredQuestions - correctAnswers;
    const scorePercentage = totalQuestions > 0 
      ? Math.round((correctAnswers / totalQuestions) * 100) 
      : 0;

    // Prepare detailed results
    const results = questions.map(question => {
      const answer = answers.find(
        a => a.questionId._id.toString() === (question._id as any).toString()
      );

      return {
        questionId: question._id,
        question: question.question,
        correctAnswer: question.correctAnswer,
        userAnswer: answer?.userAnswer || null,
        isCorrect: answer?.isCorrect || false,
        explanation: answer?.shortReason || null,
        correctedAnswer: answer?.correctedAnswer || null,
        answered: !!answer,
      };
    });

    // // Identify weak concepts (questions answered incorrectly)
    // const weakConcepts = results
    //   .filter(r => r.answered && !r.isCorrect)
    //   .map(r => r.question);

   res.status(200).json({
      success: true,
      summary: {
        totalQuestions,
        answeredQuestions,
        correctAnswers,
        wrongAnswers,
        unansweredQuestions: totalQuestions - answeredQuestions,
        scorePercentage,
        topic: questions[0].topic,
 
      },
      results,

    });
    return;
  } catch (error) {
    console.error('Error getting interview summary:', error);
    res.status(500).json({ 
      error: 'Failed to get interview summary' 
    });
    return;
  }
};

// Get all interview sessions for a user
export const getUserInterviewSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get unique interview session IDs
    const sessions = await Question.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: '$interviewSessionId',
          topic: { $first: '$topic' },
          questionCount: { $sum: 1 },
          createdAt: { $first: '$createdAt' },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    // Get answer counts for each session
    const sessionsWithStats = await Promise.all(
      sessions.map(async (session) => {
        const answers = await Answer.find({
          interviewSessionId: session._id,
          answeredBy: userId,
        });

        const correctCount = answers.filter(a => a.isCorrect).length;

        return {
          interviewSessionId: session._id,
          topic: session.topic,    
          totalQuestions: session.questionCount,
          answeredQuestions: answers.length,
          correctAnswers: correctCount,
          scorePercentage: session.questionCount > 0
            ? Math.round((correctCount / session.questionCount) * 100)
            : 0,
          createdAt: session.createdAt,
        };
      })
    );

   res.status(200).json({
      success: true,
      sessions: sessionsWithStats,
    });
    return;
  } catch (error) {
    console.error('Error getting user interview sessions:', error);
    res.status(500).json({ 
      error: 'Failed to get interview sessions' 
    });
    return;
  }
};
