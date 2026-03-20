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
  // Wait for Supabase client to be ready (if not already)
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

  // If user is logged in and on a public page (except landing, privacy, terms, support), redirect to dashboard
  if (user && PUBLIC_PAGES.includes(currentPath) && !['index.html', 'privacy.html', 'terms.html', 'support.html'].includes(currentPath)) {
    window.location.href = 'dashboard.html';
    return;
  }

  // If not logged in and on a private page, redirect to login
  if (!user && !PUBLIC_PAGES.includes(currentPath)) {
    // Avoid redirect loop: if already on login page and the redirect parameter is set to a private page, we keep the login page
    if (currentPath === 'login.html') return;
    const redirect = encodeURIComponent(currentPath);
    window.location.href = `login.html?redirect=${redirect}`;
  }
}
