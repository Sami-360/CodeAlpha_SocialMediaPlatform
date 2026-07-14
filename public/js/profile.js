import {
  apiRequest, confirmAction, createAvatar, createPostText, logout, openMediaPreview, requireAuth,
  setButtonLoading, setupUserSearch, showMessage, showToast
} from './auth.js';

const isAuthenticated = requireAuth();

const profileCard = document.getElementById('profile-card');
const postsContainer = document.getElementById('profile-posts');
const editSection = document.getElementById('edit-section');
const editForm = document.getElementById('edit-profile-form');
const pictureInput = document.getElementById('profile-picture-input');
const message = document.getElementById('profile-message');
let currentUser;
let profileData;
let profilePosts = [];
let activeTab = 'posts';
let picturePreviewUrl = '';
let username = new URLSearchParams(window.location.search).get('username');

const formatDate = (date) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date));
const formatDateTime = (date) => new Intl.DateTimeFormat(undefined, {
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

const createConnectionList = (title, users) => {
  const section = document.createElement('section');
  section.className = 'connection-group';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const list = document.createElement('div');
  list.className = 'connection-list';
  if (!users.length) {
    const empty = document.createElement('span');
    empty.className = 'muted';
    empty.textContent = title === 'Followers' ? 'No followers yet.' : 'Not following anyone yet.';
    list.append(empty);
  } else {
    users.forEach((user) => {
      const link = document.createElement('a');
      link.className = 'connection-user';
      link.href = `profile.html?username=${encodeURIComponent(user.username)}`;
      link.append(createAvatar(user, 'avatar-small'));
      const identity = document.createElement('span');
      identity.className = 'connection-identity';
      const name = document.createElement('strong');
      name.textContent = user.name;
      const handle = document.createElement('span');
      handle.textContent = `@${user.username}`;
      identity.append(name, handle);
      link.append(identity);
      list.append(link);
    });
  }
  section.append(heading, list);
  return section;
};

const openEditProfile = () => {
  editSection.classList.remove('hidden');
  editSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const renderProfile = (profile) => {
  const cover = document.createElement('div');
  cover.className = 'profile-cover';
  const header = document.createElement('div');
  header.className = 'profile-header-content';
  const avatar = createAvatar(profile, 'avatar-xlarge profile-avatar');
  const information = document.createElement('div');
  information.className = 'profile-information';
  const top = document.createElement('div');
  top.className = 'profile-title-row';
  const identity = document.createElement('div');
  const name = document.createElement('h1');
  name.className = 'profile-name';
  name.textContent = profile.name;
  const handle = document.createElement('p');
  handle.className = 'profile-handle';
  handle.textContent = `@${profile.username}`;
  identity.append(name, handle);
  const actions = document.createElement('div');
  actions.className = 'profile-actions';

  if (profile.isOwnProfile) {
    actions.append(makeButton('Edit profile', 'button button-primary', openEditProfile));
  } else {
    const followButton = makeButton(
      profile.isFollowing ? 'Following' : 'Follow',
      profile.isFollowing ? 'button button-outline' : 'button button-primary',
      async () => {
        followButton.disabled = true;
        try {
          const result = await apiRequest(`/api/users/${profile._id}/follow`, { method: 'POST' });
          showToast(result.isFollowing ? 'User followed!' : 'User unfollowed.', result.isFollowing ? 'success' : 'info');
          await loadProfile();
        } catch (error) {
          showToast(error.message, 'error');
          followButton.disabled = false;
        }
      }
    );
    actions.append(followButton);
  }
  top.append(identity, actions);

  const bio = document.createElement('p');
  bio.className = 'profile-bio';
  bio.textContent = profile.bio || 'No bio added yet.';
  const joined = document.createElement('p');
  joined.className = 'profile-joined';
  joined.textContent = `Joined ${formatDate(profile.createdAt)}`;
  information.append(top, bio, joined);
  header.append(avatar, information);

  const stats = document.createElement('div');
  stats.className = 'profile-stats profile-stats-wide';
  [
    [profile.postCount, 'Posts'],
    [profile.followerCount, 'Followers'],
    [profile.followingCount, 'Following']
  ].forEach(([number, label]) => {
    const stat = document.createElement('div');
    stat.className = 'stat';
    const strong = document.createElement('strong');
    strong.textContent = number;
    const span = document.createElement('span');
    span.textContent = label;
    stat.append(strong, span);
    stats.append(stat);
  });

  const connections = document.createElement('div');
  connections.className = 'connections-grid';
  connections.append(
    createConnectionList('Followers', profile.followers),
    createConnectionList('Following', profile.following)
  );
  profileCard.replaceChildren(cover, header, stats, connections);

  if (profile.isOwnProfile) {
    document.getElementById('edit-name').value = profile.name;
    document.getElementById('edit-bio').value = profile.bio || '';
    document.getElementById('bio-count').textContent = `${(profile.bio || '').length} / 300`;
    document.getElementById('edit-avatar-preview').replaceWith(createAvatar(profile, 'avatar-xlarge'));
    const avatarPreview = editSection.querySelector('.avatar-xlarge');
    avatarPreview.id = 'edit-avatar-preview';
  } else {
    editSection.classList.add('hidden');
  }
};

const createPostMedia = (post, className = '') => {
  if (!post.mediaUrl || !post.mediaType) return null;
  if (post.mediaType === 'video') {
    const video = document.createElement('video');
    video.src = post.mediaUrl;
    video.controls = true;
    video.preload = 'metadata';
    video.className = className;
    return video;
  }
  const image = document.createElement('img');
  image.src = post.mediaUrl;
  image.alt = `Post image by ${post.user.name}`;
  image.loading = 'lazy';
  image.className = className;
  image.addEventListener('click', () => openMediaPreview(post.mediaUrl, 'image'));
  return image;
};

const openPostDetails = (post) => {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop post-detail-backdrop';
  const modal = document.createElement('article');
  modal.className = 'post-detail-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lightbox-close detail-close';
  close.textContent = 'Close';
  const header = document.createElement('header');
  header.className = 'post-identity';
  header.append(createAvatar(post.user));
  const author = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = post.user.name;
  const meta = document.createElement('div');
  meta.className = 'post-username';
  meta.textContent = `@${post.user.username} · ${formatDateTime(post.createdAt)}`;
  author.append(name, meta);
  header.append(author);
  modal.append(close, header);
  if (post.content) {
    modal.append(createPostText(post.content, { collapsible: false }));
  }
  const media = createPostMedia(post, 'detail-media');
  if (media) modal.append(media);
  const stats = document.createElement('p');
  stats.className = 'post-detail-stats';
  stats.textContent = `${post.likes.length} ${post.likes.length === 1 ? 'like' : 'likes'} · ${post.commentCount || 0} ${post.commentCount === 1 ? 'comment' : 'comments'}`;
  modal.append(stats);
  backdrop.append(modal);
  document.body.append(backdrop);
  const dismiss = () => {
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') dismiss();
  };
  close.addEventListener('click', dismiss);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) dismiss();
  });
  document.addEventListener('keydown', onKeydown);
  close.focus();
};

const deleteProfilePost = async (post, card) => {
  if (!(await confirmAction('This post, its media, and all comments will be permanently deleted.'))) return;
  try {
    await apiRequest(`/api/posts/${post._id}`, { method: 'DELETE' });
    card.remove();
    profilePosts = profilePosts.filter((item) => item._id !== post._id);
    profileData.postCount -= 1;
    showToast('Post deleted.');
    renderProfile(profileData);
    renderPosts();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

const togglePostLike = async (post, likeButton, count) => {
  likeButton.disabled = true;
  try {
    const result = await apiRequest(`/api/posts/${post._id}/like`, { method: 'POST' });
    const currentId = String(currentUser._id);
    post.likes = result.isLiked
      ? [...post.likes.filter((id) => String(id) !== currentId), currentUser._id]
      : post.likes.filter((id) => String(id) !== currentId);
    likeButton.textContent = result.isLiked ? 'Unlike' : 'Like';
    count.textContent = `${result.likeCount} likes · ${post.commentCount || 0} comments`;
    showToast(result.isLiked ? 'Post liked!' : 'Like removed.', result.isLiked ? 'success' : 'info');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    likeButton.disabled = false;
  }
};

const createFeedPost = (post) => {
  const card = document.createElement('article');
  card.className = 'card profile-feed-post';
  const header = document.createElement('header');
  header.className = 'post-header';
  const identity = document.createElement('div');
  identity.className = 'post-identity';
  identity.append(createAvatar(post.user));
  const info = document.createElement('div');
  const author = document.createElement('strong');
  author.textContent = post.user.name;
  const date = document.createElement('div');
  date.className = 'post-date';
  date.textContent = formatDateTime(post.createdAt);
  info.append(author, date);
  identity.append(info);
  header.append(identity);
  if (profileData.isOwnProfile) {
    header.append(makeButton('Delete', 'button button-danger button-small', () => deleteProfilePost(post, card)));
  }
  card.append(header);
  if (post.content) {
    card.append(createPostText(post.content));
  }
  const media = createPostMedia(post, 'profile-feed-media');
  if (media) card.append(media);
  const footer = document.createElement('footer');
  footer.className = 'post-actions';
  const liked = post.likes.some((id) => String(id) === String(currentUser._id));
  const likeButton = makeButton(liked ? 'Unlike' : 'Like', 'button button-ghost button-small', () => togglePostLike(post, likeButton, count));
  const count = document.createElement('span');
  count.className = 'like-count';
  count.textContent = `${post.likes.length} likes · ${post.commentCount || 0} comments`;
  const details = makeButton('View details', 'button button-ghost button-small', () => openPostDetails(post));
  footer.append(likeButton, count, details);
  card.append(footer);
  return card;
};

const createMediaTile = (post) => {
  const tile = document.createElement('article');
  tile.className = 'profile-media-tile';
  const media = createPostMedia(post, 'profile-media-thumbnail');
  tile.append(media);
  const overlay = document.createElement('button');
  overlay.type = 'button';
  overlay.className = 'media-tile-overlay';
  overlay.textContent = `${post.likes.length} likes · ${post.commentCount || 0} comments`;
  overlay.addEventListener('click', () => openPostDetails(post));
  tile.append(overlay);
  return tile;
};

const renderEmptyPosts = (isMedia) => {
  const empty = document.createElement('div');
  empty.className = 'card empty-state';
  const icon = document.createElement('span');
  icon.className = 'empty-icon';
  icon.textContent = isMedia ? '▧' : '✦';
  const title = document.createElement('strong');
  title.textContent = isMedia ? 'No media posts yet.' : 'No posts yet.';
  const detail = document.createElement('span');
  detail.textContent = isMedia ? 'Photos and videos will appear here.' : 'New posts will appear here.';
  empty.append(icon, title, detail);
  postsContainer.replaceChildren(empty);
};

const renderPosts = () => {
  postsContainer.replaceChildren();
  if (activeTab === 'media') {
    const mediaPosts = profilePosts.filter((post) => post.mediaUrl && post.mediaType);
    postsContainer.className = 'profile-posts profile-media-grid';
    if (!mediaPosts.length) return renderEmptyPosts(true);
    mediaPosts.forEach((post) => postsContainer.append(createMediaTile(post)));
  } else {
    postsContainer.className = 'profile-posts profile-post-stream';
    if (!profilePosts.length) return renderEmptyPosts(false);
    profilePosts.forEach((post) => postsContainer.append(createFeedPost(post)));
  }
};

const loadProfile = async () => {
  try {
    const data = await apiRequest(`/api/users/${encodeURIComponent(username)}`);
    profileData = data.user;
    profilePosts = data.posts;
    document.title = `${profileData.name} | Connectly`;
    renderProfile(profileData);
    renderPosts();
  } catch (error) {
    profileCard.replaceChildren();
    showMessage(message, error.message);
    showToast(error.message, 'error');
  }
};

document.getElementById('edit-bio').addEventListener('input', (event) => {
  const count = document.getElementById('bio-count');
  count.textContent = `${event.target.value.length} / 300`;
  count.classList.toggle('counter-warning', event.target.value.length >= 270);
});

pictureInput.addEventListener('change', async () => {
  const file = pictureInput.files[0];
  if (!file) return;
  const extension = file.name.split('.').pop().toLowerCase();
  if (!file.type.startsWith('image/') || !['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
    pictureInput.value = '';
    return showToast('Choose a JPG, JPEG, PNG, WEBP, or GIF image.', 'error');
  }
  if (file.size > 5 * 1024 * 1024) {
    pictureInput.value = '';
    return showToast('Profile picture cannot exceed 5 MB.', 'error');
  }
  if (picturePreviewUrl) URL.revokeObjectURL(picturePreviewUrl);
  picturePreviewUrl = URL.createObjectURL(file);
  const preview = createAvatar({ name: profileData.name, profilePicture: picturePreviewUrl }, 'avatar-xlarge');
  document.getElementById('edit-avatar-preview').replaceWith(preview);
  preview.id = 'edit-avatar-preview';
  document.getElementById('profile-picture-name').textContent = `Uploading ${file.name}...`;

  const formData = new FormData();
  formData.append('name', document.getElementById('edit-name').value.trim() || profileData.name);
  formData.append('bio', document.getElementById('edit-bio').value.trim());
  formData.append('profilePicture', file);
  pictureInput.disabled = true;
  showToast('Uploading profile picture...', 'info');
  try {
    await apiRequest('/api/users/profile', { method: 'PUT', body: formData });
    if (picturePreviewUrl) URL.revokeObjectURL(picturePreviewUrl);
    picturePreviewUrl = '';
    pictureInput.value = '';
    showToast('Profile picture saved!');
    await loadProfile();
    editSection.classList.remove('hidden');
    document.getElementById('profile-picture-name').textContent = 'Profile picture saved. Select another image to replace it.';
  } catch (error) {
    showToast(error.message, 'error');
    pictureInput.value = '';
    await loadProfile();
    editSection.classList.remove('hidden');
    document.getElementById('profile-picture-name').textContent = 'Upload failed. Choose another JPG, PNG, WEBP, or GIF image.';
  } finally {
    pictureInput.disabled = false;
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = editForm.querySelector('button[type="submit"]');
  const name = document.getElementById('edit-name').value.trim();
  const bio = document.getElementById('edit-bio').value.trim();
  if (!name) return showToast('Name cannot be empty.', 'error');
  if (bio.length > 300) return showToast('Bio cannot exceed 300 characters.', 'error');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('bio', bio);
  if (pictureInput.files[0]) formData.append('profilePicture', pictureInput.files[0]);
  setButtonLoading(submit, true, 'Save changes');
  try {
    await apiRequest('/api/users/profile', { method: 'PUT', body: formData });
    if (picturePreviewUrl) URL.revokeObjectURL(picturePreviewUrl);
    picturePreviewUrl = '';
    pictureInput.value = '';
    document.getElementById('profile-picture-name').textContent = 'Select an image to upload it automatically · Max 5 MB';
    showMessage(message, 'Profile updated.', 'success');
    showToast('Profile updated!');
    editSection.classList.add('hidden');
    await loadProfile();
  } catch (error) {
    showMessage(message, error.message);
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(submit, false, 'Save changes');
  }
});

const setActiveTab = (tab) => {
  activeTab = tab;
  const postsTab = document.getElementById('posts-tab');
  const mediaTab = document.getElementById('media-tab');
  postsTab.classList.toggle('active', tab === 'posts');
  mediaTab.classList.toggle('active', tab === 'media');
  postsTab.setAttribute('aria-selected', tab === 'posts');
  mediaTab.setAttribute('aria-selected', tab === 'media');
  renderPosts();
};

document.getElementById('posts-tab').addEventListener('click', () => setActiveTab('posts'));
document.getElementById('media-tab').addEventListener('click', () => setActiveTab('media'));
document.getElementById('close-edit-button').addEventListener('click', () => editSection.classList.add('hidden'));
document.getElementById('logout-button').addEventListener('click', logout);
if (isAuthenticated) setupUserSearch();

const initialize = async () => {
  try {
    ({ user: currentUser } = await apiRequest('/api/auth/me'));
    if (!username) {
      username = currentUser.username;
      window.history.replaceState({}, '', `profile.html?username=${encodeURIComponent(username)}`);
    }
    await loadProfile();
  } catch (error) {
    showMessage(message, error.message);
    showToast(error.message, 'error');
  }
};

if (isAuthenticated) initialize();
