const TOKEN_KEY = 'connectly_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);
export const getAuthHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const requireAuth = () => {
  if (!getToken()) {
    window.location.replace('login.html');
    return false;
  }
  return true;
};

export const logout = () => {
  removeToken();
  window.location.replace('login.html');
};

export const apiRequest = async (url, options = {}) => {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && getToken() && !url.endsWith('/auth/login')) {
    removeToken();
    window.location.replace('login.html');
    throw new Error('Your session has expired. Please log in again.');
  }
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const showMessage = (element, message = '', type = 'error') => {
  if (!element) return;
  element.textContent = message;
  element.className = message ? `message visible ${type}` : 'message';
};

export const showToast = (message, type = 'success') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.append(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = type === 'error' ? '!' : type === 'info' ? 'i' : '✓';
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(icon, text);
  container.append(toast);
  window.setTimeout(() => toast.classList.add('toast-visible'), 10);
  window.setTimeout(() => {
    toast.classList.remove('toast-visible');
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
};

export const setButtonLoading = (button, loading, idleLabel) => {
  button.disabled = loading;
  button.replaceChildren();
  if (loading) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner spinner-small';
    spinner.setAttribute('aria-hidden', 'true');
    button.append(spinner, document.createTextNode('Please wait...'));
  } else {
    button.textContent = idleLabel;
  }
};

export const createAvatar = (user, className = '') => {
  const avatar = document.createElement('div');
  avatar.className = `avatar ${className}`.trim();
  if (user?.profilePicture) {
    const image = document.createElement('img');
    image.src = user.profilePicture;
    image.alt = `${user.name || user.username}'s profile picture`;
    avatar.append(image);
  } else {
    const initial = (user?.name || user?.username || '?').trim().charAt(0).toUpperCase();
    avatar.textContent = initial || '?';
    avatar.setAttribute('aria-label', `${user?.name || user?.username || 'User'} avatar`);
  }
  return avatar;
};

export const createPostText = (content, { collapsible = true } = {}) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'post-text-wrapper';
  const paragraph = document.createElement('p');
  paragraph.className = 'post-content';
  const parts = content.split(/(#[\p{L}\p{N}_]+)/gu);
  parts.forEach((part) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
      const hashtag = document.createElement('span');
      hashtag.className = 'hashtag';
      hashtag.textContent = part;
      paragraph.append(hashtag);
    } else {
      paragraph.append(document.createTextNode(part));
    }
  });
  wrapper.append(paragraph);

  const needsCollapse = collapsible && (content.length > 320 || content.split('\n').length > 5);
  if (needsCollapse) {
    paragraph.classList.add('post-content-collapsed');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'see-more-button';
    toggle.textContent = 'See more';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const expanded = paragraph.classList.toggle('post-content-expanded');
      paragraph.classList.toggle('post-content-collapsed', !expanded);
      toggle.textContent = expanded ? 'See less' : 'See more';
      toggle.setAttribute('aria-expanded', String(expanded));
    });
    wrapper.append(toggle);
  }
  return wrapper;
};

export const openMediaPreview = (mediaUrl, mediaType) => {
  const backdrop = document.createElement('div');
  backdrop.className = 'media-lightbox';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lightbox-close';
  close.textContent = 'Close';
  const media = document.createElement(mediaType === 'video' ? 'video' : 'img');
  media.className = 'lightbox-media';
  media.src = mediaUrl;
  if (mediaType === 'video') {
    media.controls = true;
    media.preload = 'metadata';
  } else {
    media.alt = 'Full-size post media';
  }
  backdrop.append(close, media);
  document.body.append(backdrop);
  const dismiss = () => {
    document.removeEventListener('keydown', onKeydown);
    if (mediaType === 'video') media.pause();
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

export const confirmAction = (message, confirmLabel = 'Delete') => new Promise((resolve) => {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const title = document.createElement('h2');
  title.textContent = 'Are you sure?';
  const description = document.createElement('p');
  description.textContent = message;
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button button-ghost';
  cancel.textContent = 'Cancel';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'button button-danger-solid';
  confirm.textContent = confirmLabel;
  actions.append(cancel, confirm);
  dialog.append(title, description, actions);
  backdrop.append(dialog);
  document.body.append(backdrop);
  const finish = (result) => {
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    resolve(result);
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') finish(false);
  };
  cancel.addEventListener('click', () => finish(false));
  confirm.addEventListener('click', () => finish(true));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) finish(false);
  });
  document.addEventListener('keydown', onKeydown);
  confirm.focus();
});

export const setupUserSearch = () => {
  const form = document.getElementById('user-search-form');
  const input = document.getElementById('user-search-input');
  const results = document.getElementById('user-search-results');
  if (!form || !input || !results) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim().replace(/^@/, '');
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(query)) {
      showToast('Enter a valid username.', 'error');
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    results.classList.remove('hidden');
    results.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'search-status';
    loading.textContent = 'Searching...';
    results.append(loading);
    try {
      const data = await apiRequest(`/api/users/search?q=${encodeURIComponent(query)}`);
      const exact = data.users.find((user) => user.username.toLowerCase() === query.toLowerCase());
      if (exact || data.users.length === 1) {
        const user = exact || data.users[0];
        window.location.href = `profile.html?username=${encodeURIComponent(user.username)}`;
        return;
      }
      results.replaceChildren();
      if (!data.users.length) {
        const empty = document.createElement('div');
        empty.className = 'search-status';
        empty.textContent = 'No users found.';
        results.append(empty);
      } else {
        data.users.forEach((user) => {
          const link = document.createElement('a');
          link.className = 'search-result';
          link.href = `profile.html?username=${encodeURIComponent(user.username)}`;
          const name = document.createElement('strong');
          name.textContent = user.name;
          const handle = document.createElement('span');
          handle.textContent = `@${user.username}`;
          link.append(name, handle);
          results.append(link);
        });
      }
    } catch (error) {
      results.classList.add('hidden');
      showToast(error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener('click', (event) => {
    if (!form.contains(event.target)) results.classList.add('hidden');
  });
};

const handleAuthForm = (form, endpoint) => {
  const message = document.getElementById('auth-message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const fields = Object.fromEntries(new FormData(form).entries());
    fields.email = fields.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(fields.email)) {
      showMessage(message, 'Enter a valid email address.');
      showToast('Enter a valid email address.', 'error');
      return;
    }
    if (fields.password.length < 6) {
      showMessage(message, 'Password must be at least 6 characters long.');
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }
    if (endpoint.endsWith('register')) {
      fields.name = fields.name.trim();
      fields.username = fields.username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,30}$/.test(fields.username)) {
        showMessage(message, 'Username must be 3–30 letters, numbers, or underscores.');
        showToast('Enter a valid username.', 'error');
        return;
      }
    }
    const idleLabel = endpoint.endsWith('register') ? 'Register' : 'Log in';
    setButtonLoading(button, true, idleLabel);
    showMessage(message);
    try {
      const data = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(fields) });
      setToken(data.token);
      showMessage(message, 'Success! Redirecting...', 'success');
      sessionStorage.setItem('connectly_flash', endpoint.endsWith('register') ? 'Account created successfully!' : 'Login successful!');
      showToast(endpoint.endsWith('register') ? 'Account created successfully!' : 'Login successful!');
      window.setTimeout(() => window.location.replace('index.html'), 500);
    } catch (error) {
      showMessage(message, error.message);
      showToast(error.message, 'error');
      setButtonLoading(button, false, idleLabel);
    }
  });
};

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
if ((loginForm || registerForm) && getToken()) window.location.replace('index.html');
if (loginForm) handleAuthForm(loginForm, '/api/auth/login');
if (registerForm) handleAuthForm(registerForm, '/api/auth/register');
