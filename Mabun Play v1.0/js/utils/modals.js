// js/utils/modal.js
export function showModal({ title, message, confirmText = 'OK', cancelText = null, showDeposit = false }) {
  return new Promise((resolve) => {
    const existing = document.querySelector('.custom-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'custom-modal';

    const titleEl = document.createElement('h3');
    titleEl.className = 'custom-modal-title';
    titleEl.textContent = title;

    const msgEl = document.createElement('p');
    msgEl.className = 'custom-modal-message';
    msgEl.textContent = message;

    const btns = document.createElement('div');
    btns.className = 'custom-modal-buttons';

    if (cancelText) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'custom-modal-btn cancel';
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve('cancel');
      });
      btns.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'custom-modal-btn confirm';
    confirmBtn.textContent = confirmText;
    confirmBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve('confirm');
    });
    btns.appendChild(confirmBtn);

    if (showDeposit) {
      const depositBtn = document.createElement('button');
      depositBtn.className = 'custom-modal-btn deposit';
      depositBtn.textContent = 'Deposit Now';
      depositBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve('deposit');
      });
      btns.appendChild(depositBtn);
    }

    modal.appendChild(titleEl);
    modal.appendChild(msgEl);
    modal.appendChild(btns);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}