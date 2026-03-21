// js/core/app.js

import { setupAuthGuard } from './guards.js';

// ==============================
// 🔧 CONFIG
// ==============================
const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

// 🚫 Disable Service Worker for now (prevents caching/auth issues)
if ('serviceWorker' in navigator && !isLocal) {
  console.log('Service Worker disabled during development');
  /*
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
  */
}

// ==============================
// 🛑 GLOBAL ERROR HANDLER
// ==============================
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

// ==============================
// ⏳ WAIT FOR SUPABASE CLIENT
// ==============================
function waitForSupabase() {
  return new Promise((resolve) => {
    if (window.supabaseClient) return resolve(window.supabaseClient);

    const interval = setInterval(() => {
      if (window.supabaseClient) {
        clearInterval(interval);
        resolve(window.supabaseClient);
      }
    }, 50);
  });
}

// ==============================
// 📄 PUBLIC PAGES (NO AUTH LOGIC)
// ==============================
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

// ==============================
// 🔐 INIT APP (MAIN ENTRY)
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const supabase = await waitForSupabase();

    const currentPath =
      window.location.pathname.split('/').pop() || 'index.html';

    // 🚀 CRITICAL FIX: Skip ALL auth logic on public pages
    if (PUBLIC_PAGES.includes(currentPath)) {
      console.log('✅ Public page detected, skipping auth guard:', currentPath);
      return;
    }

    // ==============================
    // 🔒 PRIVATE PAGE LOGIC ONLY
    // ==============================
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Error getting session:', error.message);
    }

    // Prevent multiple guard executions
    if (!window.__authGuardInitialized) {
      window.__authGuardInitialized = true;
      await setupAuthGuard();
    }

    // ==============================
    // 🔙 BACK BUTTON HANDLING
    // ==============================
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.history.back();
      });
    });

    // ==============================
    // 📐 FIX HEADER OVERLAP
    // ==============================
    const header = document.querySelector('.app-bar');
    const main = document.querySelector('.main-content');

    if (header && main) {
      const firstChild = main.children[1];
      if (firstChild) firstChild.style.marginTop = '0';
    }

  } catch (err) {
    console.error('App initialization error:', err);
  }
});

// ==============================
// 🔄 AUTH STATE LISTENER
// ==============================
waitForSupabase().then((supabase) => {
  supabase.auth.onAuthStateChange((event, session) => {
    // 🚀 CRITICAL FIX: Ignore initial trigger (prevents refresh loop)
    if (event === 'INITIAL_SESSION') return;

    console.log('Auth event:', event);

    try {
      if (session?.user) {
        localStorage.setItem('mabun_user', JSON.stringify(session.user));
        localStorage.setItem('mabun_token', session.access_token);
      } else {
        localStorage.removeItem('mabun_user');
        localStorage.removeItem('mabun_token');
      }
    } catch (err) {
      console.error('Auth state error:', err);
    }
  });
});
