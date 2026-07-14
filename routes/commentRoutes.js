import { Router } from 'express';
import { addComment, deleteComment, getComments } from '../controllers/commentController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:postId', authMiddleware, getComments);
router.post('/:postId', authMiddleware, addComment);
router.delete('/:commentId', authMiddleware, deleteComment);

export default router;
