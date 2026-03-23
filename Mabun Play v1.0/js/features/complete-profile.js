// js/features/complete-profile.js
import { showModal } from '../utils/modal.js';
import { validateUsername } from '../utils/validation.js';
import config from '../core/config.js';
import { waitForUser } from '../core/guards.js';

document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.supabaseClient;
  if (!supabase) {
    showModal({ title: 'Error', message: 'Supabase client not loaded.', confirmText: 'OK' });
    return;
  }

  // Wait for user to be fully authenticated (especially after email confirmation)
  const user = await waitForUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Fetch existing profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username, phone, provider')
    .eq('id', user.id)
    .single();

  let pendingData = null;
  const stored = localStorage.getItem('pending_registration');
  if (stored) {
    pendingData = JSON.parse(stored);
  }

  // If profile already has a username and no pending data, they are complete
  if (profile && profile.username && (!pendingData || !pendingData.phone)) {
    window.location.href = 'dashboard.html';
    return;
  }

  // If no pending data but profile exists, use profile phone if any
  if (!pendingData && profile) {
    pendingData = {
      phone: profile.phone || '',
      provider: profile.provider || 'mtn',
    };
  }

  // If still no phone, redirect to register (should not happen)
  if (!pendingData || !pendingData.phone) {
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

  mmPhone.textContent = pendingData.phone;
  const provider = pendingData.provider;
  mmBadge.textContent = provider === 'mtn' ? 'MTN MoMo' : 'Digitel DigiCash';
  mmBadge.className = `mm-badge ${provider}`;
  providerInput.value = provider;
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
      // Upsert profile (includes coins_balance)
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username,
          email: user.email,
          phone: pendingData.phone,
          provider,
          coins_balance: 15000,
          wallet_balance: 0,
          winnings: 0,
          played: 0,
          rank: 0,
        }, { onConflict: 'id' });

      if (upsertError) throw upsertError;

      // Update auth user metadata (optional)
      await supabase.auth.updateUser({ data: { username } });

      // Clear pending data
      localStorage.removeItem('pending_registration');

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
