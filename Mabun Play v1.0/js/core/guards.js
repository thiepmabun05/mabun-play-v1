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
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const supabase = window.supabaseClient;
  if (!supabase) {
    console.warn('Supabase client not available for guard');
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  // Get current redirect parameter to avoid loops
  const urlParams = new URLSearchParams(window.location.search);
  const currentRedirect = urlParams.get('redirect');

  // If not logged in and not on a public page, redirect to login
  if (!user && !PUBLIC_PAGES.includes(currentPath)) {
    // Avoid redirect loop if already on login with the same redirect
    if (currentPath === 'login.html' && currentRedirect === currentPath) {
      console.log('Already on login with redirect, avoiding loop');
      return;
    }
    const redirect = encodeURIComponent(currentPath);
    window.location.href = `login.html?redirect=${redirect}`;
    return;
  }

  // If logged in and on a public page (except landing, privacy, terms, support), redirect to dashboard
  if (user && PUBLIC_PAGES.includes(currentPath) && !['index.html', 'privacy.html', 'terms.html', 'support.html'].includes(currentPath)) {
    window.location.href = 'dashboard.html';
    return;
  }
}
