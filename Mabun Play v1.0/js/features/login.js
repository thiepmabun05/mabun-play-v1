// js/features/login.js
import { showModal } from '../utils/modal.js';
import { validatePassword } from '../utils/validation.js';
import { initPasswordToggles } from '../utils/password-toggle.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded in login.js');

  initPasswordToggles();

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('submitBtn');

  if (!form) {
    console.error('❌ loginForm not found');
    return;
  }
  if (!emailInput) console.warn('⚠️ email input not found');
  if (!submitBtn) console.warn('⚠️ submit button not found');

  // Check Supabase client
  if (typeof window.supabaseClient === 'undefined') {
    console.error('❌ Supabase client not defined');
    showModal({
      title: 'Configuration Error',
      message: 'Supabase client not loaded. Please refresh or contact support.',
      confirmText: 'OK'
    });
    return;
  }
  console.log('✅ Supabase client found');

  // Attach submit event
  form.addEventListener('submit', async (e) => {
    console.log('🔵 Form submit intercepted');
    e.preventDefault(); // Prevents page refresh

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
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      console.log('Login successful, redirecting to dashboard');
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

  console.log('✅ Login event listener attached');
});
