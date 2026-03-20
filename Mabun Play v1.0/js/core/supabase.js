import config from './config.js';

let supabaseClient;

function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    // If not loaded yet, wait for it (should be loaded by script tag)
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (typeof window.supabase !== 'undefined') {
          clearInterval(interval);
          resolve(window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY));
        }
      }, 50);
    });
  }
  return window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
}

// Export a promise that resolves with the client
export const supabasePromise = initSupabase();

// For convenience, we can also export a ready client after initialization
supabasePromise.then(client => { supabaseClient = client; });
export const supabase = () => supabaseClient;
