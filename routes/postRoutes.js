import { Router } from 'express';
import { createPost, deletePost, getPosts, toggleLike } from '../controllers/postController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { uploadPostMedia } from '../middleware/uploadMiddleware.js';

const router = Router();

router.get('/', authMiddleware, getPosts);
router.post('/', authMiddleware, uploadPostMedia.single('media'), createPost);
router.delete('/:postId', authMiddleware, deletePost);
router.post('/:postId/like', authMiddleware, toggleLike);

export default router;
