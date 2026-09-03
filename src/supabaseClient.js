import { createClient } from '@supabase/supabase-js';

// Zmienne środowiskowe (Vite): SUPABASE_URL i SUPABASE_ANON_KEY
// (obsługiwane są też prefiksy VITE_ dla zgodności z konwencją Vite)
const SUPABASE_URL =
  import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  import.meta.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
