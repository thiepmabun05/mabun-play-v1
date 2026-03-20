import config from './config.js';

// Check if the global supabase object exists (from the UMD script)
if (typeof window.supabase === 'undefined') {
  console.error('Supabase global object not found. Make sure the UMD script is loaded.');
  throw new Error('Supabase not loaded');
}

// Create the Supabase client
const supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
export const supabase = supabaseClient;
