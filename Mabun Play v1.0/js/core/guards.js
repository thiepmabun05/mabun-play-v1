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
  try {
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

    // Get session safely
    const { data, error } = await window.supabaseClient.auth.getSession();

    if (error) {
      console.error('Error fetching session:', error.message);
      return;
    }

    const session = data?.session;
    const user = session?.user;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    // 🚨 Prevent infinite redirect loops
    const isRedirecting = window.location.search.includes('redirect=');

    // ============================
    // ✅ LOGGED-IN USER LOGIC
    // ============================
    if (user) {
      // If user is on auth pages → redirect to dashboard
      const AUTH_PAGES = [
        'login.html',
        'register.html',
        'forgot-password.html',
        'reset-password.html'
      ];

      if (AUTH_PAGES.includes(currentPath)) {
        // Prevent unnecessary reload
        if (!window.location.href.includes('dashboard.html')) {
          window.location.replace('dashboard.html');
        }
        return;
      }

      // Allow landing and info pages
      return;
    }

    // ============================
    // ❌ NOT LOGGED-IN USER LOGIC
    // ============================
    if (!user) {
      // If already on a public page → allow
      if (PUBLIC_PAGES.includes(currentPath)) {
        return;
      }

      // Prevent redirect loop
      if (currentPath === 'login.html' || isRedirecting) {
        return;
      }

      // Redirect to login with return path
      const redirect = encodeURIComponent(currentPath);
      window.location.replace(`login.html?redirect=${redirect}`);
    }

  } catch (err) {
    console.error('Auth guard error:', err);
  }
}
