import { Router } from 'express';
import {
  createInterview,
  startInterview,
  submitAnswer,
  completeInterview,
  getInterviewDetails,
  getWorkspaceInterviews,
  getUserAnalytics,
} from '../controllers/interview.controller.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = Router();

router.use(verifyToken);

router.post('/create', createInterview);

router.post('/:interviewId/start', startInterview);

router.post('/submit-answer', submitAnswer);  

router.post('/:interviewId/complete', completeInterview);

router.get('/workspace/:workspaceId', getWorkspaceInterviews);

router.get('/analytics/user', getUserAnalytics);

router.get('/:interviewId', getInterviewDetails);

export default router;
