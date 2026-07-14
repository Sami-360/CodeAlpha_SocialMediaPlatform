import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';

export const getComments = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }
    if (!(await Post.exists({ _id: req.params.postId }))) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const comments = await Comment.find({ post: req.params.postId })
      .sort({ createdAt: 1 })
      .populate('user', 'name username profilePicture');
    return res.json({ comments });
  } catch (error) {
    return next(error);
  }
};

export const addComment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    if (text.trim().length > 500) {
      return res.status(400).json({ message: 'Comment cannot exceed 500 characters' });
    }
    if (!(await Post.exists({ _id: req.params.postId }))) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const comment = await Comment.create({
      post: req.params.postId,
      user: req.user._id,
      text: text.trim()
    });
    await comment.populate('user', 'name username profilePicture');
    return res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    return next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.commentId)) {
      return res.status(400).json({ message: 'Invalid comment ID' });
    }
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (!comment.user.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can delete only your own comments' });
    }
    await comment.deleteOne();
    return res.json({ message: 'Comment deleted' });
  } catch (error) {
    return next(error);
  }
};
