// js/features/forgot-password.js
import { showModal } from '../utils/modal.js';
import { validateEmail } from '../utils/validation.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotForm');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('submitBtn');

  if (!form || !emailInput || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!validateEmail(email)) {
      await showModal({ title: 'Invalid Email', message: 'Please enter a valid email address.', confirmText: 'OK' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Sending...';

    try {
      const supabase = window.supabaseClient;
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;

      await showModal({
        title: 'Reset Email Sent',
        message: 'Check your email for a password reset link.',
        confirmText: 'OK',
      });
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Reset error:', error);
      await showModal({
        title: 'Error',
        message: error.message || 'Could not send reset email. Please try again.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Send Reset Link <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});
