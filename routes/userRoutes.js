import { Router } from 'express';
import { getUserProfile, searchUsers, toggleFollow, updateProfile } from '../controllers/userController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import { uploadProfilePicture } from '../middleware/uploadMiddleware.js';

const router = Router();

router.put('/profile', authMiddleware, uploadProfilePicture.single('profilePicture'), updateProfile);
router.get('/search', authMiddleware, searchUsers);
router.post('/:userId/follow', authMiddleware, toggleFollow);
router.get('/:username', authMiddleware, getUserProfile);

export default router;
