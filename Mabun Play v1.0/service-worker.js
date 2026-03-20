const CACHE_NAME = 'mabun-play-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/quiz.html',
  '/leaderboard.html',
  '/wallet.html',
  '/profile.html',
  '/community.html',
  '/notifications.html',
  '/settings.html',
  '/history.html',
  '/results.html',
  '/login.html',
  '/register.html',
  '/otp.html',
  '/complete-profile.html',
  '/forgot-password.html',
  '/reset-password.html',
  '/terms.html',
  '/privacy.html',
  '/support.html',
  '/transactions.html',
  '/deposit.html',
  '/withdraw.html',
  '/achievements.html',
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
  '/js/core/supabase.js',
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
  '/assets/icons/icon-512.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.destination === 'style' ||
      event.request.destination === 'script' ||
      event.request.destination === 'image' ||
      event.request.destination === 'font') {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
            return networkResponse;
          });
        return cached || fetchPromise;
      })
  );
});
