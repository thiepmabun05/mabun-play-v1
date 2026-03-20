import config from './config.js';

// Use the global supabase object from the UMD script
export const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
