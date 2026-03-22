const supabase = window.supabaseClient;
import { showModal } from '../utils/modal.js';
import { validatePassword } from '../utils/validation.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('changePasswordForm');
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const submitBtn = document.getElementById('submitBtn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!currentPassword) {
      await showModal({ title: 'Missing Field', message: 'Please enter your current password.', confirmText: 'OK' });
      return;
    }

    if (!validatePassword(newPassword)) {
      await showModal({ title: 'Weak Password', message: 'New password must be at least 6 characters.', confirmText: 'OK' });
      return;
    }

    if (newPassword !== confirmPassword) {
      await showModal({ title: 'Password Mismatch', message: 'New passwords do not match.', confirmText: 'OK' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Updating...';

    try {
      // First, verify current password by attempting to sign in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Supabase does not provide a direct way to verify password without re-authenticating.
      // We can attempt to sign in with the current password. If it fails, password is wrong.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      await showModal({
        title: 'Success',
        message: 'Your password has been updated successfully.',
        confirmText: 'OK',
      });

      window.location.href = 'settings.html';
    } catch (error) {
      console.error('Password change error:', error);
      await showModal({
        title: 'Error',
        message: error.message || 'Could not change password. Please try again.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Update Password <iconify-icon icon="solar:check-circle-bold"></iconify-icon>';
    }
  });
});
