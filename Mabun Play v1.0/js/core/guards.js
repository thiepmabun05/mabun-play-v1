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
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user && !PUBLIC_PAGES.includes(currentPath)) {
    const redirect = encodeURIComponent(currentPath);
    window.location.href = `login.html?redirect=${redirect}`;
  }

  if (user && PUBLIC_PAGES.includes(currentPath) && !['index.html', 'privacy.html', 'terms.html', 'support.html'].includes(currentPath)) {
    window.location.href = 'dashboard.html';
  }
}
