import { showModal } from '../utils/modal.js';

document.addEventListener('DOMContentLoaded', async () => {
  await showModal({
    title: 'Coming Soon',
    message: 'Deposit feature is currently unavailable. We are working on integrating mobile money payments.',
    confirmText: 'OK',
  });
  window.location.href = 'wallet.html';
});