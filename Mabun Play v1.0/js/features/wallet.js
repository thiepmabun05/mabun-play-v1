import { showModal } from '../utils/modal.js';
import { formatCurrency } from '../utils/formatters.js';
import config from '../core/config.js';

const LOW_BALANCE_THRESHOLD = 5000;
const MAX_WALLET_FALLBACK = 50_000_000;

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    balance: document.getElementById('walletBalance'),
    progress: document.getElementById('balanceProgress'),
    warning: document.getElementById('balanceWarning'),
    transactionsList: document.getElementById('transactionsList'),
    topupReminder: document.getElementById('topupReminder'),
    quickTopupBtn: document.getElementById('quickTopupBtn'),
    filterContainer: document.querySelector('.transaction-filters'),
  };

  let currentFilter = 'all';

  async function showComingSoon() {
    await showModal({
      title: 'Coming Soon',
      message: 'Wallet functionality is currently under development. Payments will be available soon.',
      confirmText: 'OK',
    });
  }

  // Disable all interactive elements and show coming soon on click
  if (elements.quickTopupBtn) {
    elements.quickTopupBtn.addEventListener('click', showComingSoon);
  }

  if (elements.filterContainer) {
    elements.filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', showComingSoon);
    });
  }

  // Display placeholder balance
  if (elements.balance) elements.balance.textContent = formatCurrency(0);
  if (elements.progress) elements.progress.style.width = '0%';
  if (elements.warning) elements.warning.textContent = 'Wallet features are temporarily unavailable.';
  if (elements.transactionsList) {
    elements.transactionsList.innerHTML = '<div class="empty-state">Transaction history will appear here once wallet is active.</div>';
  }
  if (elements.topupReminder) {
    elements.topupReminder.style.display = 'none';
  }
});
