// js/features/settings.js
import { showModal } from '../utils/modal.js';

document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    editProfile: document.getElementById('editProfile'),
    changePassword: document.getElementById('changePassword'),
    linkedAccounts: document.getElementById('linkedAccounts'),
    linkedPhone: document.getElementById('linkedPhone'),
    pushNotifications: document.getElementById('pushNotifications'),
    quizReminders: document.getElementById('quizReminders'),
    promotions: document.getElementById('promotions'),
    helpCenter: document.getElementById('helpCenter'),
    contactSupport: document.getElementById('contactSupport'),
    terms: document.getElementById('terms')
  };

  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error('Supabase client not available');
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (user && elements.linkedPhone) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .single();
    if (!error && profile) elements.linkedPhone.textContent = profile.phone || '—';
    else elements.linkedPhone.textContent = '—';
  }

  try {
    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && settings) {
      if (elements.pushNotifications) elements.pushNotifications.checked = settings.push_notifications;
      if (elements.quizReminders) elements.quizReminders.checked = settings.quiz_reminders;
      if (elements.promotions) elements.promotions.checked = settings.promotions;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  async function saveSetting(key, value) {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          [key]: value,
        });
      if (error) throw error;
    } catch (error) {
      showModal({ title: 'Error', message: error.message, confirmText: 'OK' });
    }
  }

  elements.pushNotifications?.addEventListener('change', (e) => {
    saveSetting('push_notifications', e.target.checked);
  });
  elements.quizReminders?.addEventListener('change', (e) => {
    saveSetting('quiz_reminders', e.target.checked);
  });
  elements.promotions?.addEventListener('change', (e) => {
    saveSetting('promotions', e.target.checked);
  });

  elements.editProfile?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'profile.html?edit=true';
  });

  elements.changePassword?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { value: newPassword } = await Swal.fire({
      title: 'Change Password',
      html: `
        <input type="password" id="currentPassword" class="swal2-input" placeholder="Current password">
        <input type="password" id="newPassword" class="swal2-input" placeholder="New password (min. 6 chars)">
        <input type="password" id="confirmPassword" class="swal2-input" placeholder="Confirm new password">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Change',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const current = document.getElementById('currentPassword').value;
        const newPwd = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;
        if (!current || !newPwd || !confirm) {
          Swal.showValidationMessage('All fields are required');
          return false;
        }
        if (newPwd.length < 6) {
          Swal.showValidationMessage('New password must be at least 6 characters');
          return false;
        }
        if (newPwd !== confirm) {
          Swal.showValidationMessage('New passwords do not match');
          return false;
        }
        return { current, new: newPwd };
      },
    });

    if (newPassword) {
      try {
        // Verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: newPassword.current,
        });
        if (signInError) throw new Error('Current password is incorrect');

        const { error } = await supabase.auth.updateUser({ password: newPassword.new });
        if (error) throw error;
        await showModal({ title: 'Success', message: 'Password updated successfully.', confirmText: 'OK' });
      } catch (error) {
        await showModal({ title: 'Error', message: error.message, confirmText: 'OK' });
      }
    }
  });

  elements.linkedAccounts?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'linked-accounts.html';
  });

  elements.helpCenter?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'support.html';
  });

  elements.contactSupport?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'support.html#contact';
  });

  elements.terms?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'terms.html';
  });
});
