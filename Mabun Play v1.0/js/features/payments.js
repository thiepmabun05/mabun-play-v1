import { showModal } from '../utils/modal.js';

export async function initiateDeposit(amount, provider) {
  await showModal({
    title: 'Coming Soon',
    message: 'Deposits are not yet available. We are working on integrating mobile money payments.',
    confirmText: 'OK'
  });
}

export async function initiateWithdrawal(amount) {
  await showModal({
    title: 'Coming Soon',
    message: 'Withdrawals are not yet available. We are working on integrating mobile money payments.',
    confirmText: 'OK'
  });
}