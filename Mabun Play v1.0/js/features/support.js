// js/features/support.js
import { showModal } from '../utils/modal.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error('Supabase client not available');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('contactName')?.value.trim();
    const email = document.getElementById('contactEmail')?.value.trim();
    const phone = document.getElementById('contactPhone')?.value.trim();
    const message = document.getElementById('contactMessage')?.value.trim();

    if (!name || !email || !message) {
      await showModal({ title: 'Missing Fields', message: 'Please fill in all required fields.', confirmText: 'OK' });
      return;
    }

    const submitBtn = document.getElementById('contactSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Sending...';

    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          name,
          email,
          phone: phone || null,
          message,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      await showModal({
        title: 'Message Sent',
        message: 'Thank you for contacting us. We\'ll get back to you within 24 hours.',
        confirmText: 'OK'
      });
      form.reset();
    } catch (error) {
      console.error('Support contact error:', error);
      await showModal({
        title: 'Error',
        message: error.message || 'Could not send message. Please try again later.',
        confirmText: 'OK'
      });
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Send Message <iconify-icon icon="solar:plain-bold"></iconify-icon>';
    }
  });
});
