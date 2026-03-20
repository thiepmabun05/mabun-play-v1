import { supabase } from '../core/supabase.js';
import { showModal } from '../utils/modal.js';

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const phoneRaw = urlParams.get('phone');
  const purpose = urlParams.get('purpose') || 'register';

  if (!phoneRaw) {
    window.location.href = 'login.html';
    return;
  }

  const phoneDisplay = document.getElementById('phoneDisplay');
  const hiddenPhone = document.getElementById('hiddenPhone');
  const hiddenPurpose = document.getElementById('hiddenPurpose');
  const inputs = document.querySelectorAll('.otp-input');
  const form = document.getElementById('otpForm');
  const verifyBtn = document.getElementById('verifyBtn');
  const timerSpan = document.getElementById('timer');
  const resendBtn = document.getElementById('resendBtn');

  if (!phoneDisplay || !hiddenPhone || !hiddenPurpose || !form || !verifyBtn || !timerSpan || !resendBtn) return;

  phoneDisplay.textContent = '+211 ' + phoneRaw.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  hiddenPhone.value = phoneRaw;
  hiddenPurpose.value = purpose;

  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/\D/g, '');
      e.target.value = value.slice(0, 1);
      if (value.length === 1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && index > 0 && e.target.value === '') {
        inputs[index - 1].focus();
      }
    });

    input.addEventListener('keypress', (e) => {
      if (!/[0-9]/.test(e.key)) e.preventDefault();
    });
  });

  inputs[0].addEventListener('paste', (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    for (let i = 0; i < pasteData.length; i++) {
      if (inputs[i]) inputs[i].value = pasteData[i];
    }
    const nextEmpty = Array.from(inputs).find(inp => inp.value === '');
    if (nextEmpty) nextEmpty.focus(); else inputs[inputs.length - 1].focus();
  });

  let timeLeft = 120;
  const timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerSpan.textContent = '00:00';
      resendBtn.disabled = false;
      return;
    }
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);

  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: '+211' + phoneRaw,
      });
      if (error) throw error;
      timeLeft = 120;
      await showModal({ title: 'Code Sent', message: 'A new verification code has been sent to your phone.', confirmText: 'OK' });
    } catch (error) {
      console.error('Resend error:', error);
      await showModal({
        title: 'Error',
        message: error.message || 'Could not resend code. Please try again.',
        confirmText: 'OK',
      });
    } finally {
      resendBtn.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const otpCode = Array.from(inputs).map(i => i.value).join('');
    if (otpCode.length !== 6) {
      await showModal({ title: 'Incomplete OTP', message: 'Please enter the 6‑digit code.', confirmText: 'OK' });
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="loader"></span> Verifying...';

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: '+211' + phoneRaw,
        token: otpCode,
        type: 'sms',
      });
      if (error) throw error;

      if (purpose === 'register') {
        window.location.href = `complete-profile.html?phone=${encodeURIComponent(phoneRaw)}`;
      } else if (purpose === 'reset') {
        window.location.href = `reset-password.html?phone=${encodeURIComponent(phoneRaw)}`;
      } else {
        window.location.href = 'dashboard.html';
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      await showModal({
        title: 'Verification Failed',
        message: error.message || 'Invalid or expired code. Please try again.',
        confirmText: 'OK',
      });
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = 'Verify <iconify-icon icon="solar:arrow-right-bold"></iconify-icon>';
    }
  });
});