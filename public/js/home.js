import {
  apiRequest, confirmAction, createAvatar, createPostText, logout, openMediaPreview, requireAuth,
  setButtonLoading, setupUserSearch, showMessage, showToast
} from './auth.js';

const isAuthenticated = requireAuth();

const feed = document.getElementById('posts-feed');
const loading = document.getElementById('feed-loading');
const message = document.getElementById('home-message');
const postForm = document.getElementById('post-form');
const postContent = document.getElementById('post-content');
const mediaInput = document.getElementById('post-media');
const mediaSelection = document.getElementById('media-selection');
const mediaPreview = document.getElementById('media-preview');
const selectedFilename = document.getElementById('selected-filename');
let currentUser = null;
let selectedFile = null;
let previewUrl = '';

const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const videoExtensions = ['mp4', 'webm', 'mov'];

const formatDate = (date) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(date));

const makeButton = (label, className, handler) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', handler);
  return element;
};

const makeProfileLink = (user, label = user.name, className = '') => {
  const link = document.createElement('a');
  link.href = `profile.html?username=${encodeURIComponent(user.username)}`;
  link.className = className;
  link.textContent = label;
  return link;
};

const clearSelectedMedia = () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  selectedFile = null;
  mediaInput.value = '';
  selectedFilename.textContent = '';
  mediaPreview.replaceChildren();
  mediaSelection.classList.add('hidden');
};

const selectMedia = (file) => {
  if (!file) return clearSelectedMedia();
  const extension = file.name.split('.').pop().toLowerCase();
  const isImage = file.type.startsWith('image/') && imageExtensions.includes(extension);
  const isVideo = (file.type.startsWith('video/') || file.type === 'application/octet-stream') && videoExtensions.includes(extension);
  if (!isImage && !isVideo) {
    showToast('Use JPG, JPEG, PNG, WEBP, GIF, MP4, WEBM, or MOV.', 'error');
    return clearSelectedMedia();
  }
  const limit = isImage ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
  if (file.size > limit) {
    showToast(`${isImage ? 'Image' : 'Video'} exceeds the ${isImage ? '5' : '25'} MB limit.`, 'error');
    return clearSelectedMedia();
  }

  clearSelectedMedia();
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  selectedFilename.textContent = file.name;
  const preview = document.createElement(isVideo ? 'video' : 'img');
  preview.src = previewUrl;
  preview.className = 'composer-media-preview';
  if (isVideo) {
    preview.controls = true;
    preview.preload = 'metadata';
  } else {
    preview.alt = `Preview of ${file.name}`;
  }
  mediaPreview.append(preview);
  mediaSelection.classList.remove('hidden');
};

const renderComments = async (postId, list, status, updateCount) => {
  status.replaceChildren();
  const spinner = document.createElement('span');
  spinner.className = 'spinner spinner-small';
  status.append(spinner, document.createTextNode('Loading comments...'));
  try {
    const { comments } = await apiRequest(`/api/comments/${postId}`);
    list.replaceChildren();
    updateCount(comments.length);
    status.textContent = comments.length ? '' : 'No comments yet. Start the conversation!';
    comments.forEach((comment) => {
      const item = document.createElement('article');
      item.className = 'comment';
      const avatarLink = makeProfileLink(comment.user, '', 'comment-avatar-link');
      avatarLink.append(createAvatar(comment.user, 'avatar-small'));
      const body = document.createElement('div');
      body.className = 'comment-body';
      const top = document.createElement('div');
      top.className = 'comment-top';
      const identity = document.createElement('div');
      const author = makeProfileLink(comment.user, comment.user.name, 'comment-author');
      const handle = document.createElement('span');
      handle.className = 'comment-meta';
      handle.textContent = `@${comment.user.username} · ${formatDate(comment.createdAt)}`;
      identity.append(author, handle);
      top.append(identity);
      if (String(comment.user._id) === String(currentUser._id)) {
        top.append(makeButton('Delete', 'button button-danger button-small', async (event) => {
          if (!(await confirmAction('This comment will be permanently deleted.'))) return;
          event.currentTarget.disabled = true;
          try {
            await apiRequest(`/api/comments/${comment._id}`, { method: 'DELETE' });
            await renderComments(postId, list, status, updateCount);
            showToast('Comment deleted.');
          } catch (error) {
            showToast(error.message, 'error');
            event.currentTarget.disabled = false;
          }
        }));
      }
      const text = document.createElement('p');
      text.className = 'comment-text';
      text.textContent = comment.text;
      body.append(top, text);
      item.append(avatarLink, body);
      list.append(item);
    });
  } catch (error) {
    status.textContent = error.message;
  }
};

const createPostMedia = (post) => {
  if (!post.mediaUrl || !post.mediaType) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'post-media';
  if (post.mediaType === 'video') {
    const video = document.createElement('video');
    video.src = post.mediaUrl;
    video.controls = true;
    video.preload = 'metadata';
    video.className = 'post-video';
    wrapper.append(video);
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'post-image-button';
    button.setAttribute('aria-label', 'Open full-size image');
    const image = document.createElement('img');
    image.src = post.mediaUrl;
    image.alt = `Image posted by ${post.user.name}`;
    image.loading = 'lazy';
    button.append(image);
    button.addEventListener('click', () => openMediaPreview(post.mediaUrl, 'image'));
    wrapper.append(button);
  }
  return wrapper;
};

const createPostCard = (post) => {
  const card = document.createElement('article');
  card.className = 'card post-card';
  const header = document.createElement('header');
  header.className = 'post-header';
  const identity = document.createElement('div');
  identity.className = 'post-identity';
  const avatarLink = makeProfileLink(post.user, '', 'avatar-link');
  avatarLink.append(createAvatar(post.user));
  const authorBlock = document.createElement('div');
  const author = document.createElement('h2');
  author.className = 'post-author';
  author.append(makeProfileLink(post.user));
  const meta = document.createElement('div');
  meta.className = 'post-username';
  meta.append(
    makeProfileLink(post.user, `@${post.user.username}`),
    document.createTextNode(` · ${formatDate(post.createdAt)}`)
  );
  authorBlock.append(author, meta);
  identity.append(avatarLink, authorBlock);
  header.append(identity);
  if (String(post.user._id) === String(currentUser._id)) {
    header.append(makeButton('Delete post', 'button button-danger button-small', async (event) => {
      if (!(await confirmAction('This post, its media, and all comments will be permanently deleted.'))) return;
      const deleteButton = event.currentTarget;
      deleteButton.disabled = true;
      try {
        await apiRequest(`/api/posts/${post._id}`, { method: 'DELETE' });
        card.remove();
        if (!feed.children.length) renderEmptyFeed();
        showToast('Post deleted.');
      } catch (error) {
        showToast(error.message, 'error');
        deleteButton.disabled = false;
      }
    }));
  }

  card.append(header);
  if (post.content) {
    card.append(createPostText(post.content));
  }
  const media = createPostMedia(post);
  if (media) card.append(media);

  const actions = document.createElement('div');
  actions.className = 'post-actions';
  let liked = post.likes.some((id) => String(id) === String(currentUser._id));
  const likeButton = makeButton(liked ? 'Unlike' : 'Like', 'button button-ghost button-small', async () => {
    likeButton.disabled = true;
    try {
      const result = await apiRequest(`/api/posts/${post._id}/like`, { method: 'POST' });
      liked = result.isLiked;
      likeButton.textContent = liked ? 'Unlike' : 'Like';
      likeCount.textContent = `${result.likeCount} ${result.likeCount === 1 ? 'like' : 'likes'}`;
      showToast(liked ? 'Post liked!' : 'Like removed.', liked ? 'success' : 'info');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      likeButton.disabled = false;
    }
  });
  const likeCount = document.createElement('span');
  likeCount.className = 'like-count';
  likeCount.textContent = `${post.likes.length} ${post.likes.length === 1 ? 'like' : 'likes'}`;
  const commentCount = document.createElement('span');
  commentCount.className = 'like-count';
  const setCommentCount = (count) => {
    commentCount.textContent = `${count} ${count === 1 ? 'comment' : 'comments'}`;
    commentsTitle.textContent = `Comments (${count})`;
  };
  actions.append(likeButton, likeCount, commentCount);

  const commentsSection = document.createElement('section');
  commentsSection.className = 'comments';
  const commentsTitle = document.createElement('h3');
  commentsTitle.className = 'comments-title';
  const commentsList = document.createElement('div');
  commentsList.className = 'comments-list';
  const commentsStatus = document.createElement('p');
  commentsStatus.className = 'muted comments-status';
  const commentForm = document.createElement('form');
  commentForm.className = 'comment-form';
  const commentInput = document.createElement('input');
  commentInput.placeholder = 'Write a comment...';
  commentInput.maxLength = 500;
  commentInput.required = true;
  commentInput.setAttribute('aria-label', 'Comment text');
  const submitComment = document.createElement('button');
  submitComment.type = 'submit';
  submitComment.className = 'button button-primary button-small';
  submitComment.textContent = 'Comment';
  commentForm.append(commentInput, submitComment);
  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = commentInput.value.trim();
    if (!text) return showToast('Comment cannot be empty.', 'error');
    setButtonLoading(submitComment, true, 'Comment');
    try {
      await apiRequest(`/api/comments/${post._id}`, { method: 'POST', body: JSON.stringify({ text }) });
      commentInput.value = '';
      await renderComments(post._id, commentsList, commentsStatus, setCommentCount);
      showToast('Comment added!');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setButtonLoading(submitComment, false, 'Comment');
    }
  });
  commentsSection.append(commentsTitle, commentsList, commentsStatus, commentForm);
  card.append(actions, commentsSection);
  setCommentCount(post.commentCount || 0);
  renderComments(post._id, commentsList, commentsStatus, setCommentCount);
  return card;
};

const renderEmptyFeed = () => {
  const empty = document.createElement('div');
  empty.className = 'card empty-state';
  const icon = document.createElement('span');
  icon.className = 'empty-icon';
  icon.textContent = '✦';
  const title = document.createElement('strong');
  title.textContent = 'No posts yet.';
  const detail = document.createElement('span');
  detail.textContent = 'Be the first to share text, a photo, or a video!';
  empty.append(icon, title, detail);
  feed.replaceChildren(empty);
};

const loadPosts = async () => {
  loading.classList.remove('hidden');
  try {
    const { posts } = await apiRequest('/api/posts');
    feed.replaceChildren();
    if (!posts.length) renderEmptyFeed();
    else posts.forEach((post) => feed.append(createPostCard(post)));
  } catch (error) {
    showMessage(message, error.message);
    showToast(error.message, 'error');
  } finally {
    loading.classList.add('hidden');
  }
};

const initialize = async () => {
  try {
    const { user } = await apiRequest('/api/auth/me');
    currentUser = user;
    document.getElementById('current-name').textContent = user.name;
    document.getElementById('current-username').textContent = `@${user.username}`;
    document.getElementById('nav-user').textContent = `@${user.username}`;
    document.getElementById('sidebar-avatar').replaceWith(createAvatar(user, 'avatar-large'));
    const profileUrl = `profile.html?username=${encodeURIComponent(user.username)}`;
    ['profile-link', 'my-profile-link', 'summary-profile-link'].forEach((id) => {
      document.getElementById(id).href = profileUrl;
    });
    const flash = sessionStorage.getItem('connectly_flash');
    if (flash) {
      sessionStorage.removeItem('connectly_flash');
      showToast(flash);
    }
    await loadPosts();
  } catch (error) {
    showMessage(message, error.message);
    showToast(error.message, 'error');
  }
};

postContent.addEventListener('input', () => {
  const count = document.getElementById('post-count');
  count.textContent = `${postContent.value.length} / 2000`;
  count.classList.toggle('counter-warning', postContent.value.length >= 1800);
});
mediaInput.addEventListener('change', () => selectMedia(mediaInput.files[0]));
document.getElementById('remove-media-button').addEventListener('click', clearSelectedMedia);

postForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = postContent.value.trim();
  if (!content && !selectedFile) {
    showToast('Add text, an image, or a video before posting.', 'error');
    postContent.focus();
    return;
  }
  const button = postForm.querySelector('button[type="submit"]');
  const formData = new FormData();
  formData.append('content', content);
  if (selectedFile) formData.append('media', selectedFile);
  setButtonLoading(button, true, 'Post');
  try {
    await apiRequest('/api/posts', { method: 'POST', body: formData });
    postContent.value = '';
    document.getElementById('post-count').textContent = '0 / 2000';
    clearSelectedMedia();
    showMessage(message, 'Post published.', 'success');
    showToast('Post created!');
    await loadPosts();
  } catch (error) {
    showMessage(message, error.message);
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(button, false, 'Post');
  }
});

document.getElementById('logout-button').addEventListener('click', logout);
if (isAuthenticated) {
  setupUserSearch();
  initialize();
}
