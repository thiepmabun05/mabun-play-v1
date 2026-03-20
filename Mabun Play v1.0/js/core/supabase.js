import config from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/module/index.js';

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);