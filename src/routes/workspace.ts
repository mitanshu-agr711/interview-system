import {Router} from 'express';
import{
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    getWorkspaces,
    getWorkspaceById,
    shareWorkspace,
    unshareWorkspace,
    getSharedWorkspaceByToken,
} from '../controllers/workspace.controller.js';
import {verifyToken} from '../middleware/verifyToken.js';
const router=Router();

router.get('/shared/:token', getSharedWorkspaceByToken);
router.use(verifyToken);
router.post('/create',createWorkspace);
router.put('/:id/rename',renameWorkspace);
router.delete('/:id/delete',deleteWorkspace);
router.post('/:id/share', shareWorkspace);
router.post('/:id/unshare', unshareWorkspace);
router.get('/',getWorkspaces);
router.get('/:id',getWorkspaceById);
export default router;