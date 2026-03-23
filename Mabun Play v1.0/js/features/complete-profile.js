// js/features/complete-profile.js
import { showModal } from '../utils/modal.js';
import { validateUsername } from '../utils/validation.js';
import config from '../core/config.js';

document.addEventListener('DOMContentLoaded', async () => {
  const pending = sessionStorage.getItem('pending_registration');
  if (!pending) {
    window.location.href = 'register.html';
    return;
  }
  const pendingData = JSON.parse(pending);

  const mmPhone = document.getElementById('mmPhone');
  const mmBadge = document.getElementById('mmBadge');
  const providerInput = document.getElementById('provider');
  const form = document.getElementById('profileForm');
  const submitBtn = document.getElementById('submitBtn');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');

  if (!mmPhone || !mmBadge || !providerInput || !form || !submitBtn || !usernameInput) return;

  mmPhone.textContent = pendingData.phone;
  const provider = pendingData.provider;
  mmBadge.textContent = provider === 'mtn' ? 'MTN MoMo' : 'Digitel DigiCash';
  mmBadge.className = `mm-badge ${provider}`;
  providerInput.value = provider;

  const supabase = window.supabaseClient;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    window.location.href = 'login.html';
    return;
  }
  emailInput.value = user.email || '';

  if (!config.ENABLE_PAYMENTS) {
    const depositCard = document.querySelector('.deposit-card');
    if (depositCard) depositCard.style.display = 'none';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    if (!validateUsername(username)) {
      await showModal({ title: 'Invalid Username', message: 'Username must be at least 3 characters.', confirmText: 'OK' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Saving...';

    try {
      // Use upsert to update existing profile or insert new one
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username,
          email: user.email,
          phone: pendingData.phone,
          provider,
          coins_balance: 15000,        // initial Mabun coins
          wallet_balance: 0,
          winnings: 0,
          played: 0,
          rank: 0,
        }, { onConflict: 'id' });

      if (upsertError) throw upsertError;

      await supabase.auth.updateUser({ data: { username } });
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
