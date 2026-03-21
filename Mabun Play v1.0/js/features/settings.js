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
    showModal({ title: 'Error', message: 'Configuration error. Please refresh.', confirmText: 'OK' });
    return;
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('User not authenticated');
    window.location.href = 'login.html';
    return;
  }

  // Get profile (for phone number)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .single();
  if (!profileError && profile && elements.linkedPhone) {
    elements.linkedPhone.textContent = profile.phone || '—';
  } else {
    if (elements.linkedPhone) elements.linkedPhone.textContent = '—';
  }

  // Get user settings
  let settings = {
    push_notifications: true,
    quiz_reminders: true,
    promotions: false,
  };
  const { data: existingSettings, error: settingsError } = await supabase
    .from('user_settings')
    .select('push_notifications, quiz_reminders, promotions')
    .eq('user_id', user.id)
    .single();

  if (!settingsError && existingSettings) {
    settings = existingSettings;
  } else if (settingsError && settingsError.code !== 'PGRST116') {
    console.error('Failed to load settings:', settingsError);
  }

  // Apply settings to UI
  if (elements.pushNotifications) elements.pushNotifications.checked = settings.push_notifications;
  if (elements.quizReminders) elements.quizReminders.checked = settings.quiz_reminders;
  if (elements.promotions) elements.promotions.checked = settings.promotions;

  // Save settings to database
  async function saveSetting(key, value) {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        [key]: value,
      });
    if (error) {
      console.error('Error saving setting:', error);
      showModal({ title: 'Error', message: 'Could not save settings. Please try again.', confirmText: 'OK' });
    }
  }

  // Event listeners for toggles
  elements.pushNotifications?.addEventListener('change', (e) => {
    saveSetting('push_notifications', e.target.checked);
  });
  elements.quizReminders?.addEventListener('change', (e) => {
    saveSetting('quiz_reminders', e.target.checked);
  });
  elements.promotions?.addEventListener('change', (e) => {
    saveSetting('promotions', e.target.checked);
  });

  // Edit Profile – redirect to profile page
  elements.editProfile?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'profile.html?edit=true';
  });

  // Change Password – open SweetAlert2 dialog
  elements.changePassword?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { value: formValues } = await Swal.fire({
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

    if (formValues) {
      try {
        // First, verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: formValues.current,
        });
        if (signInError) throw new Error('Current password is incorrect');

        // Update password
        const { error: updateError } = await supabase.auth.updateUser({
          password: formValues.new,
        });
        if (updateError) throw updateError;

        await showModal({ title: 'Success', message: 'Password updated successfully.', confirmText: 'OK' });
      } catch (error) {
        console.error('Password change error:', error);
        await showModal({ title: 'Error', message: error.message, confirmText: 'OK' });
      }
    }
  });

  // Linked Accounts – redirect to linked-accounts.html (which shows phone number)
  elements.linkedAccounts?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'linked-accounts.html';
  });

  // Help Center – redirect to support.html
  elements.helpCenter?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'support.html';
  });

  // Contact Support – redirect to support.html#contact
  elements.contactSupport?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'support.html#contact';
  });

  // Terms & Privacy – redirect to terms.html
  elements.terms?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'terms.html';
  });
});
