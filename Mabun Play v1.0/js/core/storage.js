/**
 * Local storage management for user session and tokens
 */
const USER_KEY = 'mabun_user';
const TOKEN_KEY = 'mabun_token';

/**
 * Store authenticated user and token
 * @param {Object|null} user - User object with token property
 */
export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (user.token) {
      localStorage.setItem(TOKEN_KEY, user.token);
    }
  } else {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Retrieve current user object
 * @returns {Object|null}
 */
export function getCurrentUser() {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

/**
 * Get authentication token
 * @returns {string|null}
 */
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Clear all stored data (logout)
 */
export function clearStorage() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}