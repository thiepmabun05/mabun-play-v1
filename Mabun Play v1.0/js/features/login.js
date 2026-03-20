// js/features/login.js
import { showModal } from '../utils/modal.js';
import { validatePassword } from '../utils/validation.js';
import { initPasswordToggles } from '../utils/password-toggle.js';

console.log('Login script started'); // This will appear if the script loads

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired in login.js');

  // Initialize password toggles (optional, but safe)
  try {
    initPasswordToggles();
    console.log('Password toggles initialized');
  } catch (e) {
    console.error('initPasswordToggles error:', e);
  }

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('submitBtn');

  console.log('form found?', !!form);
  console.log('emailInput found?', !!emailInput);
  console.log('submitBtn found?', !!submitBtn);

  if (!form || !emailInput || !submitBtn) {
    console.error('Required elements missing');
    return;
  }

  // Check Supabase client
  if (typeof window.supabaseClient === 'undefined') {
    console.error('Supabase client not defined');
    showModal({
      title: 'Configuration Error',
      message: 'Supabase client not loaded. Please refresh or contact support.',
      confirmText: 'OK'
    });
    return;
  }

  console.log('Supabase client found');

  form.addEventListener('submit', async (e) => {
    console.log('Form submit event fired');
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

  console.log('Login event listener attached');
});
