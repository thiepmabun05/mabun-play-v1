// js/core/guards.js
const PUBLIC_PAGES = [
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

export async function setupAuthGuard() {
  // Wait for Supabase client
  let retries = 0;
  while (!window.supabaseClient && retries < 20) {
    await new Promise(r => setTimeout(r, 50));
    retries++;
  }
  if (!window.supabaseClient) {
    console.error('Supabase client not available for auth guard');
    return;
  }

  const { data: { session } } = await window.supabaseClient.auth.getSession();
  const user = session?.user;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // If the current page is public, never redirect away (fixes login/register refresh loop)
  if (PUBLIC_PAGES.includes(currentPath)) {
    console.log('Auth guard: staying on public page', currentPath);
    return;
  }

  // If user is not logged in and page is private, redirect to login
  if (!user && !PUBLIC_PAGES.includes(currentPath)) {
    const redirect = encodeURIComponent(currentPath);
    window.location.href = `login.html?redirect=${redirect}`;
    return;
  }

  // If user is logged in and on a private page, do nothing (allow the page to load)
  // The previous version redirected to dashboard even from private pages – that's now removed.
}
