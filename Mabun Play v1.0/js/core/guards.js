// js/core/guards.js

// Public pages that anyone can access
export const PUBLIC_PAGES = [
  'index.html',
  'login.html',
  'register.html',
  'forgot-password.html',
  'reset-password.html',
  'complete-profile.html',
  'privacy.html',
  'terms.html',
  'support.html'
];

/**
 * Wait for Supabase session to be ready
 * Returns the logged-in user object or null
 */
export async function waitForUser(maxRetries = 20, intervalMs = 100) {
  let retries = 0;
  let user = null;

  while (!user && retries < maxRetries) {
    try {
      const { data, error } = await window.supabaseClient.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
        break;
      }
      user = data;
      if (user) break;
    } catch (err) {
      console.error('Auth fetch error:', err);
    }
    retries++;
    await new Promise(r => setTimeout(r, intervalMs));
  }

  return user;
}

/**
 * Sets up the auth guard for private pages
 * Redirects to login.html if user not logged in
 */
export async function setupAuthGuard() {
  // Prevent multiple guard executions
  if (window.__authGuardInitialized) return;
  window.__authGuardInitialized = true;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // Public pages → allow
  if (PUBLIC_PAGES.includes(currentPath)) return;

  // Private pages → wait for user
  const user = await waitForUser();
  if (!user) {
    console.warn('No active session → redirecting to login');
    window.location.href = `login.html?redirect=${currentPath}`;
    return;
  }

  console.log('✅ Auth guard passed for user:', user.id);
}
