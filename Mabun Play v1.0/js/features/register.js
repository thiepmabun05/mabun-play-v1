// js/features/register.js
import { showModal } from '../utils/modal.js';
import { validatePhone, validatePassword, detectProvider } from '../utils/validation.js';
import { initPasswordToggles } from '../utils/password-toggle.js';

document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();

  const form = document.getElementById('registerForm');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const providerBadge = document.getElementById('providerBadge');
  const submitBtn = document.getElementById('submitBtn');

  if (!form) return;

  if (typeof window.supabaseClient === 'undefined') {
    console.error('Supabase client not defined');
    showModal({
      title: 'Configuration Error',
      message: 'Supabase client not loaded. Please refresh.',
      confirmText: 'OK'
    });
    return;
  }

  if (phoneInput && providerBadge) {
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
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      await showModal({ title: 'Invalid Email', message: 'Please enter a valid email address.', confirmText: 'OK' });
      return;
    }

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
    submitBtn.innerHTML = '<span class="loader"></span> Creating account...';

    try {
      const { data, error } = await window.supabaseClient.auth.signUp({
        email,
        password,
      });
      if (error) throw error;

      sessionStorage.setItem('pending_registration', JSON.stringify({
        phone: '+211' + rawPhone,
        provider: detectProvider(rawPhone) || 'mtn',
      }));

      window.location.href = 'complete-profile.html';
    } catch (error) {
      console.error('Registration error:', error);
      await showModal({
        title: 'Registration Failed',
        message: error.message || 'Could not create account. Please try again.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign Up <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});
