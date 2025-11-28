import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAZIONE DATABASE ---
// 1. Vai su https://supabase.com, crea un progetto.
// 2. Incolla qui sotto URL e ANON KEY del tuo progetto.
const SUPABASE_URL = 'https://tuo-progetto.supabase.co';
const SUPABASE_ANON_KEY = 'tua-chiave-anonima';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper per verificare se è configurato
export const isDbConfigured = () => {
    return SUPABASE_URL !== 'https://tuo-progetto.supabase.co';
};
