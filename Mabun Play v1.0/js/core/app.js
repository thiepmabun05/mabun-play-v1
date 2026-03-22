// js/core/app.js
import { setupAuthGuard } from './guards.js';

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
    // Not logged in, reset to icon
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
  // Replace with image
  avatarElement.innerHTML = `<img src="${profile.avatar_url}" alt="Profile" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`;
}

// Expose globally for other scripts
window.updateHeaderAvatar = updateHeaderAvatar;

// Wait for Supabase client and then set up guard and header avatar
document.addEventListener('DOMContentLoaded', async () => {
  await setupAuthGuard();
  await updateHeaderAvatar();

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.history.back();
    });
  });
});

// Auth state listener
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

waitForSupabase().then(supabase => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      localStorage.setItem('mabun_user', JSON.stringify(session.user));
      localStorage.setItem('mabun_token', session.access_token);
      updateHeaderAvatar(); // update avatar when auth state changes
    } else {
      localStorage.removeItem('mabun_user');
      localStorage.removeItem('mabun_token');
      updateHeaderAvatar(); // reset to icon
    }
  });
});

// Fix header overlap
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.app-bar');
  const main = document.querySelector('.main-content');
  if (header && main) {
    const firstChild = main.children[1];
    if (firstChild) firstChild.style.marginTop = '0';
  }
});

// Real‑time notifications subscription (after user is logged in)
let notificationChannel = null;

async function subscribeToNotifications() {
  const supabase = window.supabaseClient;
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Unsubscribe from previous channel if any
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
        // Show toast (SweetAlert2 or custom)
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
        // Update notification dot
        const dot = document.querySelector('.notification-dot');
        if (dot) dot.style.display = 'block';
      }
    )
    .subscribe();
}

// Call after auth state change or when page loads
document.addEventListener('DOMContentLoaded', async () => {
  // ... existing code ...

  // After setting up auth guard, also subscribe
  const user = await waitForUser();
  if (user) subscribeToNotifications();
});

// Also subscribe when auth state changes (user logs in/out)
waitForSupabase().then(supabase => {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      subscribeToNotifications();
    } else if (event === 'SIGNED_OUT') {
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
        notificationChannel = null;
      }
    }
  });
});
