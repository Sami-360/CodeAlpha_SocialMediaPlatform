import mongoose from 'mongoose';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import { cleanupRequestFile, deleteUploadedFile, mediaUrlForFile } from '../middleware/uploadMiddleware.js';

const addCommentCounts = async (posts) => {
  if (!posts.length) return posts;
  const counts = await Comment.aggregate([
    { $match: { post: { $in: posts.map((post) => post._id) } } },
    { $group: { _id: '$post', count: { $sum: 1 } } }
  ]);
  const countMap = new Map(counts.map(({ _id, count }) => [String(_id), count]));
  return posts.map((post) => ({ ...post, commentCount: countMap.get(String(post._id)) || 0 }));
};

export const getPosts = async (_req, res, next) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name username profilePicture')
      .lean();
    return res.json({ posts: await addCommentCounts(posts) });
  } catch (error) {
    return next(error);
  }
};

export const createPost = async (req, res, next) => {
  let createdPost = null;
  try {
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content && !req.file) {
      return res.status(400).json({ message: 'Add text, an image, or a video to create a post' });
    }
    if (content.length > 2000) {
      await cleanupRequestFile(req);
      return res.status(400).json({ message: 'Post content cannot exceed 2000 characters' });
    }
    if (req.file?.validatedMediaType === 'image' && req.file.size > 5 * 1024 * 1024) {
      await cleanupRequestFile(req);
      return res.status(400).json({ message: 'Image is too large. Maximum image size is 5 MB.' });
    }

    createdPost = await Post.create({
      user: req.user._id,
      content,
      mediaUrl: mediaUrlForFile(req.file),
      mediaType: req.file?.validatedMediaType || null
    });
    await createdPost.populate('user', 'name username profilePicture');
    const responsePost = { ...createdPost.toObject(), commentCount: 0 };
    return res.status(201).json({ message: 'Post created', post: responsePost });
  } catch (error) {
    if (createdPost) await Post.deleteOne({ _id: createdPost._id }).catch(() => {});
    await cleanupRequestFile(req).catch(() => {});
    return next(error);
  }
};

export const deletePost = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (!post.user.equals(req.user._id)) {
      return res.status(403).json({ message: 'You can delete only your own posts' });
    }
    await Comment.deleteMany({ post: post._id });
    await post.deleteOne();
    await deleteUploadedFile(post.mediaUrl).catch((error) => {
      console.error(`Unable to remove post media: ${error.message}`);
    });
    return res.json({ message: 'Post deleted' });
  } catch (error) {
    return next(error);
  }
};

export const toggleLike = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const isLiked = post.likes.some((id) => id.equals(req.user._id));
    const update = isLiked ? { $pull: { likes: req.user._id } } : { $addToSet: { likes: req.user._id } };
    const updatedPost = await Post.findByIdAndUpdate(post._id, update, { new: true });
    return res.json({ isLiked: !isLiked, likeCount: updatedPost.likes.length });
  } catch (error) {
    return next(error);
  }
};
