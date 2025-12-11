import { Router } from 'express';
import {
  createInterviewQuestions,
  submitAnswer,
  getInterviewSummary,
  getUserInterviewSessions,
} from '../controllers/answer.controller.js';
import { verifyToken } from '../middleware/verifyToken.js';

import rateLimit from 'express-rate-limit';


export const submitAnswerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 10, 
  message: 'Too many answer submissions, please try again later'
})

const router = Router();

// All routes require authentication
router.use(verifyToken);

// Generate interview questions
router.post('/generate-questions', createInterviewQuestions);

// Submit and evaluate an answer
router.post('/submit-answer', submitAnswerLimiter,submitAnswer);

// Get summary of an interview session
router.get('/summary/:interviewSessionId', getInterviewSummary);

// Get all interview sessions for the authenticated user
router.get('/sessions', getUserInterviewSessions);

export default router;
