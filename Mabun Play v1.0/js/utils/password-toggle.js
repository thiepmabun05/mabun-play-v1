/**
 * Password visibility toggle for password fields
 */
export function initPasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach(button => {
    button.removeEventListener('click', toggleHandler);
    button.addEventListener('click', toggleHandler);
  });
}

function toggleHandler(e) {
  e.preventDefault();
  const button = e.currentTarget;
  const input = button.closest('.input-wrapper')?.querySelector('input');
  if (!input) return;

  const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
  input.setAttribute('type', type);

  const icon = button.querySelector('iconify-icon');
  if (icon) {
    const newIcon = type === 'text' ? 'solar:eye-linear' : 'solar:eye-closed-linear';
    icon.setAttribute('icon', newIcon);
  }
}

// Auto‑initialize on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPasswordToggles);
} else {
  initPasswordToggles();
}