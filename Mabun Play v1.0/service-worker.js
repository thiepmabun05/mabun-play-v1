// service-worker.js – SAFE version (no HTML caching, no auth conflicts)

const CACHE_NAME = 'mabun-static-v2';

// Only cache STATIC assets (NO HTML pages)
const STATIC_ASSETS = [
  '/css/main.css',
  '/css/auth.css',
  '/css/dashboard.css',
  '/css/community.css',
  '/css/history.css',
  '/css/leaderboard.css',
  '/css/notifications.css',
  '/css/profile.css',
  '/css/quiz.css',
  '/css/results.css',
  '/css/settings.css',
  '/css/wallet.css',
  '/css/transactions.css',
  '/css/info-pages.css',
  '/css/responsive.css',
  '/css/core/reset.css',
  '/css/core/variables.css',
  '/css/core/typography.css',
  '/css/core/layout.css',
  '/css/components/buttons.css',
  '/css/components/forms.css',
  '/css/components/cards.css',
  '/css/components/modals.css',
  '/css/components/loaders.css',
  '/css/components/toasts.css',

  '/js/core/app.js',
  '/js/core/config.js',
  '/js/core/storage.js',
  '/js/core/guards.js',

  '/js/features/login.js',
  '/js/features/register.js',
  '/js/features/forgot-password.js',
  '/js/features/otp.js',
  '/js/features/reset-password.js',
  '/js/features/complete-profile.js',
  '/js/features/dashboard.js',
  '/js/features/quiz.js',
  '/js/features/leaderboard.js',
  '/js/features/wallet.js',
  '/js/features/deposit.js',
  '/js/features/withdraw.js',
  '/js/features/transactions.js',
  '/js/features/profile.js',
  '/js/features/settings.js',
  '/js/features/achievements.js',
  '/js/features/community.js',
  '/js/features/notifications.js',
  '/js/features/history.js',
  '/js/features/results.js',
  '/js/features/support.js',

  '/js/utils/modal.js',
  '/js/utils/password-toggle.js',
  '/js/utils/validation.js',
  '/js/utils/formatters.js',
  '/js/utils/helpers.js',

  '/assets/images/logo.png',
  '/assets/images/default-avatar.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

// ✅ INSTALL — cache only static files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ✅ ACTIVATE — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ✅ FETCH — SAFE STRATEGY
self.addEventListener('fetch', event => {
  const request = event.request;

  // ❌ NEVER cache Supabase or external APIs
  if (request.url.includes('supabase')) {
    return; // let browser handle it
  }

  // ❌ NEVER cache HTML pages (prevents reload loops)
  if (request.headers.get('accept')?.includes('text/html')) {
    return; // always fetch fresh page
  }

  // ✅ Cache only static assets
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});
