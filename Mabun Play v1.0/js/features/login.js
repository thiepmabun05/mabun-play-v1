// js/features/login.js
import { showModal } from '../utils/modal.js';
import { validatePassword } from '../utils/validation.js';
import { initPasswordToggles } from '../utils/password-toggle.js';

document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('submitBtn');

  if (!form || !emailInput || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      await showModal({ title: 'Invalid Email', message: 'Please enter a valid email address.', confirmText: 'OK' });
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
      const supabase = window.supabaseClient;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Login error:', error);
      await showModal({
        title: 'Login Failed',
        message: error.message || 'Incorrect email or password.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Log In <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});
