// js/core/app.js
import { setupAuthGuard, waitForUser } from './guards.js';

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

// Function to update header avatar
async function updateHeaderAvatar() {
  const avatarElement = document.querySelector('.profile-avatar');
  if (!avatarElement) return;
  const supabase = window.supabaseClient;
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    avatarElement.innerHTML = '<iconify-icon icon="solar:user-circle-linear"></iconify-icon>';
    return;
  }
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single();
  if (error || !profile || !profile.avatar_url) {
    avatarElement.innerHTML = '<iconify-icon icon="solar:user-circle-linear"></iconify-icon>';
    return;
  }
  avatarElement.innerHTML = `<img src="${profile.avatar_url}" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`;
}

window.updateHeaderAvatar = updateHeaderAvatar;

// Real‑time notifications subscription
let notificationChannel = null;

async function subscribeToNotifications() {
  const supabase = window.supabaseClient;
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (notificationChannel) {
    await supabase.removeChannel(notificationChannel);
  }

  notificationChannel = supabase
    .channel(`notifications-${user.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        const notification = payload.new;
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'info',
          title: notification.title,
          text: notification.message,
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true,
          didOpen: (toast) => {
            toast.addEventListener('click', () => {
              if (notification.link) {
                window.location.href = notification.link;
              }
            });
          }
        });
        const dot = document.querySelector('.notification-dot');
        if (dot) dot.style.display = 'block';
      }
    )
    .subscribe();
}

function waitForSupabase() {
  return new Promise((resolve) => {
    if (window.supabaseClient) resolve(window.supabaseClient);
    else {
      const interval = setInterval(() => {
        if (window.supabaseClient) {
          clearInterval(interval);
          resolve(window.supabaseClient);
        }
      }, 50);
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await setupAuthGuard();
  await updateHeaderAvatar();

  const user = await waitForUser();
  if (user) {
    subscribeToNotifications();
  }

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.history.back();
    });
  });

  const header = document.querySelector('.app-bar');
  const main = document.querySelector('.main-content');
  if (header && main) {
    const firstChild = main.children[1];
    if (firstChild) firstChild.style.marginTop = '0';
  }
});

// Auth state listener
waitForSupabase().then(supabase => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      localStorage.setItem('mabun_user', JSON.stringify(session.user));
      localStorage.setItem('mabun_token', session.access_token);
      updateHeaderAvatar();
      subscribeToNotifications();
    } else {
      localStorage.removeItem('mabun_user');
      localStorage.removeItem('mabun_token');
      updateHeaderAvatar();
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
        notificationChannel = null;
      }
    }
  });
});
