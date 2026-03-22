import { showModal } from '../utils/modal.js';
import { timeAgo } from '../utils/formatters.js';

document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('notificationsList');
  const backBtn = document.getElementById('backBtn');

  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.history.back();
    });
  }

  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error('Supabase client not available');
    if (list) list.innerHTML = '<div class="empty-state">Error loading notifications</div>';
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    renderNotifications(notifications || []);
  } catch (error) {
    showModal({ title: 'Error', message: error.message, confirmText: 'OK' });
  }

  function renderNotifications(notifications) {
    if (!list) return;
    if (notifications.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <iconify-icon icon="solar:bell-off-bold"></iconify-icon>
          <p>No notifications</p>
        </div>
      `;
      return;
    }

    list.innerHTML = notifications.map(n => {
      let icon = 'solar:info-circle-bold';
      if (n.type === 'comment') icon = 'solar:chat-round-bold';
      else if (n.type === 'like') icon = 'solar:heart-bold';
      else if (n.type === 'follow') icon = 'solar:user-plus-bold';
      else if (n.type === 'quiz_reminder') icon = 'solar:clock-circle-bold';
      else if (n.type === 'payment') icon = 'solar:wallet-bold';

      return `
        <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}" data-link="${n.link || '#'}">
          <div class="notification-icon">
            <iconify-icon icon="${icon}"></iconify-icon>
          </div>
          <div class="notification-content">
            <div class="notification-title">${escapeHtml(n.title)}</div>
            <div class="notification-message">${escapeHtml(n.message)}</div>
            <div class="notification-time">${timeAgo(n.created_at)}</div>
          </div>
          ${!n.read ? '<span class="unread-dot"></span>' : ''}
        </div>
      `;
    }).join('');

    // Attach click handler to each notification (to mark as read and navigate)
    document.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        const link = item.dataset.link;
        try {
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id);
          item.classList.remove('unread');
          item.querySelector('.unread-dot')?.remove();
        } catch (error) {
          console.error('Failed to mark as read:', error);
        }
        if (link && link !== '#') {
          window.location.href = link;
        }
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});

async function updateUnreadCount() {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);
  if (!error) {
    const dot = document.querySelector('.notification-dot');
    if (dot) dot.style.display = count > 0 ? 'block' : 'none';
  }
}

// Call on notifications page load
updateUnreadCount();
// Also call after marking a notification read (in the click handler)
