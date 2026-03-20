import { showModal } from '../utils/modal.js';

document.addEventListener('DOMContentLoaded', () => {
  const transactionsList = document.getElementById('transactionsList');
  if (transactionsList) {
    transactionsList.innerHTML = '<div class="empty-state">Transaction history will be available soon.</div>';
  }
  // Disable filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await showModal({ title: 'Coming Soon', message: 'Transaction history is not yet available.', confirmText: 'OK' });
    });
  });
});