import { setupAuthGuard } from './guards.js';
import { supabase } from './supabase.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator && !isLocal) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

document.addEventListener('DOMContentLoaded', () => {
  setupAuthGuard();

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.history.back();
    });
  });
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    localStorage.setItem('mabun_user', JSON.stringify(session.user));
    localStorage.setItem('mabun_token', session.access_token);
  } else {
    localStorage.removeItem('mabun_user');
    localStorage.removeItem('mabun_token');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.app-bar');
  const main = document.querySelector('.main-content');
  if (header && main) {
    const firstChild = main.children[1];
    if (firstChild) firstChild.style.marginTop = '0';
  }
});