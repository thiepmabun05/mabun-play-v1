import { supabase } from '../core/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  const mtnPhoneEl = document.getElementById('mtnPhone');
  const digitelPhoneEl = document.getElementById('digitelPhone');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // Fetch user profile to get phone number and provider
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('phone, provider')
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    const phone = profile.phone || '+211 — —';
    const provider = profile.provider;

    if (provider === 'mtn') {
      mtnPhoneEl.textContent = phone;
      digitelPhoneEl.textContent = '—';
    } else if (provider === 'digitel') {
      digitelPhoneEl.textContent = phone;
      mtnPhoneEl.textContent = '—';
    } else {
      mtnPhoneEl.textContent = '—';
      digitelPhoneEl.textContent = '—';
    }
  } catch (err) {
    console.error('Failed to load linked accounts:', err);
    mtnPhoneEl.textContent = '—';
    digitelPhoneEl.textContent = '—';
  }
});