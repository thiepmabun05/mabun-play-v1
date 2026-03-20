import { supabase } from '../core/supabase.js';
import { showModal } from '../utils/modal.js';
import { validatePhone, validatePassword, detectProvider } from '../utils/validation.js';
import { initPasswordToggles } from '../utils/password-toggle.js';

document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();

  const form = document.getElementById('loginForm');
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
    if (!password || !validatePassword(password)) {
      await showModal({ title: 'Invalid Password', message: 'Password must be at least 6 characters.', confirmText: 'OK' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Logging in...';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: '+211' + rawPhone,
        password,
      });
      if (error) throw error;

      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Login error:', error);
      await showModal({
        title: 'Login Failed',
        message: error.message || 'Incorrect phone or password.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Log In <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});