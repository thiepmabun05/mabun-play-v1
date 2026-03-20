import { supabase } from '../core/supabase.js';
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

    list.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
        <div class="notification-icon">
          <iconify-icon icon="${n.icon || 'solar:info-circle-bold'}"></iconify-icon>
        </div>
        <div class="notification-content">
          <div class="notification-title">${n.title}</div>
          <div class="notification-message">${n.message}</div>
          <div class="notification-time">${timeAgo(n.created_at)}</div>
        </div>
        ${!n.read ? '<span class="unread-dot"></span>' : ''}
      </div>
    `).join('');

    document.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
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
      });
    });
  }
});