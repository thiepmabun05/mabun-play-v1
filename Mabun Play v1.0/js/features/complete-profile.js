import { supabase } from '../core/supabase.js';
import { showModal } from '../utils/modal.js';
import { validateUsername, validateEmail } from '../utils/validation.js';
import config from '../core/config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const phoneRaw = urlParams.get('phone');
  if (!phoneRaw) {
    window.location.href = 'login.html';
    return;
  }

  const fullPhone = '+211' + phoneRaw;
  const pending = sessionStorage.getItem('pending_registration');
  if (!pending) {
    window.location.href = 'register.html';
    return;
  }

  const pendingData = JSON.parse(pending);
  if (pendingData.phone !== fullPhone) {
    window.location.href = 'register.html';
    return;
  }

  const mmPhone = document.getElementById('mmPhone');
  const mmBadge = document.getElementById('mmBadge');
  const providerInput = document.getElementById('provider');
  const form = document.getElementById('profileForm');
  const submitBtn = document.getElementById('submitBtn');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');

  if (!mmPhone || !mmBadge || !providerInput || !form || !submitBtn || !usernameInput) return;

  mmPhone.textContent = '+211 ' + phoneRaw.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  const provider = pendingData.provider || 'mtn';
  mmBadge.textContent = provider === 'mtn' ? 'MTN MoMo' : 'Digitel DigiCash';
  mmBadge.className = `mm-badge ${provider}`;
  providerInput.value = provider;

  // Hide deposit card if payments are disabled
  if (!config.ENABLE_PAYMENTS) {
    const depositCard = document.querySelector('.deposit-card');
    if (depositCard) depositCard.style.display = 'none';
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  const userId = session.user.id;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    if (!validateUsername(username)) {
      await showModal({ title: 'Invalid Username', message: 'Username must be at least 3 characters.', confirmText: 'OK' });
      return;
    }

    const email = emailInput.value.trim();
    if (!validateEmail(email)) {
      await showModal({ title: 'Invalid Email', message: 'Please enter a valid email address or leave it blank.', confirmText: 'OK' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Saving...';

    try {
      // Insert profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          username,
          email: email || null,
          phone: fullPhone,
          provider,
          created_at: new Date().toISOString(),
          wallet_balance: 0,
          winnings: 0,
          played: 0,
          rank: 0,
        });
      if (insertError) throw insertError;

      // Update user metadata in auth
      await supabase.auth.updateUser({
        data: { username, email },
      });

      sessionStorage.removeItem('pending_registration');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('Profile completion error:', error);
      await showModal({
        title: 'Error',
        message: error.message || 'Could not complete profile. Please try again.',
        confirmText: 'OK',
      });
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Save & Continue <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});