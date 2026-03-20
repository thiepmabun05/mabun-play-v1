import { supabase } from '../core/supabase.js';
import { showModal } from '../utils/modal.js';
import { validatePhone, validatePassword, detectProvider } from '../utils/validation.js';
import { initPasswordToggles } from '../utils/password-toggle.js';

document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();

  const form = document.getElementById('registerForm');
  const phoneInput = document.getElementById('phone');
  const providerBadge = document.getElementById('providerBadge');
  const submitBtn = document.getElementById('submitBtn');

  if (!form || !phoneInput || !providerBadge || !submitBtn) return;

  phoneInput.addEventListener('input', () => {
    const digits = phoneInput.value.replace(/\D/g, '');
    const provider = detectProvider(digits);
    if (provider === 'mtn') {
      providerBadge.textContent = 'MTN';
      providerBadge.className = 'provider-badge mtn';
    } else if (provider === 'digitel') {
      providerBadge.textContent = 'Digitel';
      providerBadge.className = 'provider-badge digitel';
    } else {
      providerBadge.textContent = '';
      providerBadge.className = 'provider-badge';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawPhone = phoneInput.value.replace(/\D/g, '');
    if (!validatePhone(rawPhone)) {
      await showModal({ title: 'Invalid Phone', message: 'Please enter a valid South Sudan number (92X or 98X).', confirmText: 'OK' });
      return;
    }

    const password = document.getElementById('password')?.value;
    const confirm = document.getElementById('confirm')?.value;

    if (!password || !validatePassword(password)) {
      await showModal({ title: 'Weak Password', message: 'Password must be at least 6 characters.', confirmText: 'OK' });
      return;
    }
    if (password !== confirm) {
      await showModal({ title: 'Password Mismatch', message: 'Passwords do not match.', confirmText: 'OK' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Sending...';

    try {
      const { data, error } = await supabase.auth.signUp({
        phone: '+211' + rawPhone,
        password,
      });
      if (error) throw error;

      sessionStorage.setItem('pending_registration', JSON.stringify({
        phone: '+211' + rawPhone,
        provider: detectProvider(rawPhone) || 'mtn',
      }));

      window.location.href = `otp.html?phone=${encodeURIComponent(rawPhone)}&purpose=register`;
    } catch (error) {
      console.error('Registration init error:', error);
      await showModal({
        title: 'Registration Failed',
        message: error.message || 'Could not start registration. Please try again.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Register <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});