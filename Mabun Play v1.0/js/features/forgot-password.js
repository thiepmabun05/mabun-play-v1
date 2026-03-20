import { supabase } from '../core/supabase.js';
import { showModal } from '../utils/modal.js';
import { validatePhone } from '../utils/validation.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotForm');
  const phoneInput = document.getElementById('phone');
  const submitBtn = document.getElementById('submitBtn');

  if (!form || !phoneInput || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawPhone = phoneInput.value.replace(/\D/g, '');
    if (!validatePhone(rawPhone)) {
      await showModal({ title: 'Invalid Phone', message: 'Please enter a valid South Sudan number (92X or 98X).', confirmText: 'OK' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Sending...';

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(rawPhone + '@temp.mabun.com'); // Supabase email-based
      // For phone, you'd need a custom function; we'll use email fallback for now.
      if (error) throw error;

      await showModal({
        title: 'Reset Link Sent',
        message: 'A password reset link has been sent to your registered email. If you did not receive it, please contact support.',
        confirmText: 'OK',
      });
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Forgot password error:', error);
      await showModal({
        title: 'Error',
        message: error.message || 'Could not send reset link. Please try again.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Send Reset Code <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});