import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import { cleanupRequestFile, deleteUploadedFile, mediaUrlForFile } from '../middleware/uploadMiddleware.js';

export const searchUsers = async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    if (query.length < 1 || query.length > 30) {
      return res.status(400).json({ message: 'Enter a username to search' });
    }

    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({ username: { $regex: `^${safeQuery}`, $options: 'i' } })
      .select('name username bio profilePicture')
      .sort({ username: 1 })
      .limit(8);

    return res.json({ users });
  } catch (error) {
    return next(error);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() })
      .populate('followers', 'name username profilePicture')
      .populate('following', 'name username profilePicture');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'name username profilePicture')
      .lean();
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: posts.map((post) => post._id) } } },
      { $group: { _id: '$post', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(commentCounts.map(({ _id, count }) => [String(_id), count]));
    const postsWithCounts = posts.map((post) => ({
      ...post,
      commentCount: countMap.get(String(post._id)) || 0
    }));
    const isFollowing = req.user.following.some((id) => id.equals(user._id));

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        bio: user.bio,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        postCount: posts.length,
        followerCount: user.followers.length,
        followingCount: user.following.length,
        followers: user.followers.map(({ _id, name, username, profilePicture }) => ({ _id, name, username, profilePicture })),
        following: user.following.map(({ _id, name, username, profilePicture }) => ({ _id, name, username, profilePicture })),
        isFollowing,
        isOwnProfile: req.user._id.equals(user._id)
      },
      posts: postsWithCounts
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  const { name, bio } = req.body;
  if (typeof name !== 'string' || !name.trim()) {
    await cleanupRequestFile(req);
    return res.status(400).json({ message: 'Name is required' });
  }
  const normalizedBio = typeof bio === 'string' ? bio.trim() : '';
  if (name.trim().length > 80 || normalizedBio.length > 300) {
    await cleanupRequestFile(req);
    return res.status(400).json({ message: 'Name may be 80 characters and bio may be 300 characters' });
  }

  const previousPicture = req.user.profilePicture;
  req.user.name = name.trim();
  req.user.bio = normalizedBio;
  if (req.file) req.user.profilePicture = mediaUrlForFile(req.file);

  try {
    await req.user.save();
  } catch (error) {
    await cleanupRequestFile(req).catch(() => {});
    return next(error);
  }

  if (req.file && previousPicture && previousPicture !== req.user.profilePicture) {
    await deleteUploadedFile(previousPicture).catch((error) => {
      console.error(`Unable to remove previous profile picture: ${error.message}`);
    });
  }

  return res.json({
    message: 'Profile updated',
    user: {
      _id: req.user._id,
      name: req.user.name,
      username: req.user.username,
      bio: req.user.bio,
      profilePicture: req.user.profilePicture,
      createdAt: req.user.createdAt
    }
  });
};

export const toggleFollow = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });
    if (req.user._id.equals(targetUser._id)) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const isFollowing = req.user.following.some((id) => id.equals(targetUser._id));
    if (isFollowing) {
      await User.updateOne({ _id: req.user._id }, { $pull: { following: targetUser._id } });
      await User.updateOne({ _id: targetUser._id }, { $pull: { followers: req.user._id } });
    } else {
      await User.updateOne({ _id: req.user._id }, { $addToSet: { following: targetUser._id } });
      await User.updateOne({ _id: targetUser._id }, { $addToSet: { followers: req.user._id } });
    }

    const followerCount = await User.findById(targetUser._id).then((user) => user.followers.length);
    return res.json({ isFollowing: !isFollowing, followerCount });
  } catch (error) {
    return next(error);
  }
};
