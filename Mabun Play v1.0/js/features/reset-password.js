// js/features/reset-password.js
import { showModal } from '../utils/modal.js';
import { validatePassword } from '../utils/validation.js';
import { initPasswordToggles } from '../utils/password-toggle.js';

document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();

  // Supabase automatically handles the access_token in the URL
  // We just need to update the user's password.
  const form = document.getElementById('resetForm');
  const submitBtn = document.getElementById('submitBtn');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');

  if (!form || !submitBtn || !newPassword || !confirmPassword) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = newPassword.value;
    const confirm = confirmPassword.value;

    if (!validatePassword(password)) {
      await showModal({ title: 'Weak Password', message: 'Password must be at least 6 characters.', confirmText: 'OK' });
      return;
    }
    if (password !== confirm) {
      await showModal({ title: 'Password Mismatch', message: 'Passwords do not match.', confirmText: 'OK' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Resetting...';

    try {
      const supabase = window.supabaseClient;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await showModal({
        title: 'Success',
        message: 'Password reset successfully. Please log in.',
        confirmText: 'OK',
      });
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Reset password error:', error);
      await showModal({
        title: 'Error',
        message: error.message || 'Could not reset password. Please try again.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Reset Password <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});
