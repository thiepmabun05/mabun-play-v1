// js/features/register.js
import { showModal } from '../utils/modal.js';
import { validatePhone, validatePassword, detectProvider } from '../utils/validation.js';
import { initPasswordToggles } from '../utils/password-toggle.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ register.js loaded');

  // Initialize password toggles
  initPasswordToggles();

  // Grab DOM elements
  const form = document.getElementById('registerForm');
  const phoneInput = document.getElementById('phone');
  const providerBadge = document.getElementById('providerBadge');
  const submitBtn = document.getElementById('submitBtn');

  if (!form) {
    console.error('❌ registerForm not found');
    return;
  }
  if (!phoneInput) console.warn('⚠️ phone input not found');
  if (!providerBadge) console.warn('⚠️ providerBadge not found');
  if (!submitBtn) console.warn('⚠️ submitBtn not found');

  // Check Supabase client
  if (typeof window.supabaseClient === 'undefined') {
    console.error('❌ Supabase client not defined! Did you include the script in the <head>?');
    showModal({
      title: 'Configuration Error',
      message: 'Supabase client not loaded. Please refresh or contact support.',
      confirmText: 'OK'
    });
    return;
  } else {
    console.log('✅ Supabase client available');
  }

  // Provider detection (optional, but kept)
  if (phoneInput) {
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

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📤 Form submitted');

    // Get values
    const rawPhone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
    const password = document.getElementById('password')?.value;
    const confirm = document.getElementById('confirm')?.value;

    // Validation
    if (!validatePhone(rawPhone)) {
      await showModal({
        title: 'Invalid Phone',
        message: 'Please enter a valid South Sudan number (92X or 98X).',
        confirmText: 'OK'
      });
      return;
    }

    if (!password || !validatePassword(password)) {
      await showModal({
        title: 'Weak Password',
        message: 'Password must be at least 6 characters.',
        confirmText: 'OK'
      });
      return;
    }

    if (password !== confirm) {
      await showModal({
        title: 'Password Mismatch',
        message: 'Passwords do not match.',
        confirmText: 'OK'
      });
      return;
    }

    // Disable button and show spinner
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loader"></span> Sending...';
    }

    try {
      // Use the global supabase client
      const supabase = window.supabaseClient;
      console.log('Calling supabase.auth.signUp with phone:', rawPhone);

      const { data, error } = await supabase.auth.signUp({
        phone: '+211' + rawPhone,
        password: password,
      });

      if (error) {
        console.error('SignUp error:', error);
        throw error;
      }

      console.log('SignUp success:', data);

      // Store pending data for profile completion
      sessionStorage.setItem('pending_registration', JSON.stringify({
        phone: '+211' + rawPhone,
        provider: detectProvider(rawPhone) || 'mtn',
      }));

      // Redirect to OTP verification
      window.location.href = `otp.html?phone=${encodeURIComponent(rawPhone)}&purpose=register`;
    } catch (error) {
      console.error('Registration init error:', error);
      await showModal({
        title: 'Registration Failed',
        message: error.message || 'Could not start registration. Please try again.',
        confirmText: 'OK',
      });
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Register <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
      }
    }
  });
});
