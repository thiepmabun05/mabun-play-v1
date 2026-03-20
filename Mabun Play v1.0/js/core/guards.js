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
  console.log('Auth guard running');
  // Wait for Supabase client to be ready
  let retries = 0;
  while (!window.supabaseClient && retries < 20) {
    await new Promise(r => setTimeout(r, 50));
    retries++;
  }
  if (!window.supabaseClient) {
    console.error('Supabase client not available for auth guard');
    return;
  }

  // Wait for session to be available (if any)
  let sessionRetries = 0;
  let session = null;
  while (!session && sessionRetries < 20) {
    const { data: { session: sess } } = await window.supabaseClient.auth.getSession();
    session = sess;
    if (!session) {
      await new Promise(r => setTimeout(r, 50));
      sessionRetries++;
    }
  }
  const user = session?.user;
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  console.log('Auth guard - path:', currentPath, 'user:', !!user);

  // If user is logged in and on a public page (except landing, privacy, terms, support), redirect to dashboard
  if (user && PUBLIC_PAGES.includes(currentPath) && !['index.html', 'privacy.html', 'terms.html', 'support.html'].includes(currentPath)) {
    console.log('Redirecting from public page to dashboard');
    window.location.href = 'dashboard.html';
    return;
  }

  // If not logged in and on a private page, redirect to login
  if (!user && !PUBLIC_PAGES.includes(currentPath)) {
    // Avoid redirect loop: if already on login page and the redirect parameter is set to a private page, we keep the login page
    if (currentPath === 'login.html') return;
    const redirect = encodeURIComponent(currentPath);
    console.log('Redirecting to login with redirect:', redirect);
    window.location.href = `login.html?redirect=${redirect}`;
  }
}
