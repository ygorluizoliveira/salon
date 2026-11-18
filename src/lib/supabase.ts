import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não estão definidas em .env.local'
  );
}

// Gestão (/) e portal do cliente (/cliente) usam chaves de sessão distintas, para
// poderem estar logados ao mesmo tempo no mesmo navegador sem se afetarem.
const isClientPortal = /^\/cliente(?:\/|$)/.test(window.location.pathname);

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: { storageKey: isClientPortal ? 'sb-salon-client' : 'sb-salon-admin' },
});
