import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Client } from '../types';

const CLIENTS_CACHE_KEY = 'clients-cache-v1';
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

function readCachedClients(): Client[] {
  try {
    const raw = window.localStorage.getItem(CLIENTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Client[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedClients(value: Client[]) {
  try {
    window.localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage errors.
  }
}

function notifyClientsChanged() {
  window.dispatchEvent(new Event('clients-changed'));
}

function toFriendlyClientError(message?: string | null) {
  const msg = (message ?? '').trim();
  if (msg.includes('Failed to fetch') || msg.includes('TypeError')) {
    return 'Nao foi possivel carregar clientes. Verifique sua conexao com a internet e o Supabase.';
  }
  return msg || 'Erro inesperado ao carregar clientes.';
}

async function tryRecoverBrokenSession(rawError?: string | null) {
  const msg = (rawError ?? '').trim();
  if (!msg.includes('Failed to fetch') && !msg.includes('ERR_CONNECTION_RESET') && !msg.includes('ERR_CONNECTION_CLOSED')) {
    return false;
  }

  try {
    // Local scope avoids failing network call to /auth/v1/logout.
    await supabase.auth.signOut({ scope: 'local' });
    return true;
  } catch {
    return false;
  }
}

async function fetchClientsViaRest(search = ''): Promise<Client[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Configuracao do Supabase ausente (.env.local).');
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/clients`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'name.asc');
  if (search.trim()) {
    url.searchParams.set('name', `ilike.*${search.trim()}*`);
  }

  const resp = await window.fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(body || `Erro HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as Client[];
  return Array.isArray(data) ? data : [];
}

async function fetchClientByIdViaRest(id: string): Promise<Client | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Configuracao do Supabase ausente (.env.local).');
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/clients`);
  url.searchParams.set('select', '*');
  url.searchParams.set('id', `eq.${id}`);
  url.searchParams.set('limit', '1');

  const resp = await window.fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(body || `Erro HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as Client[];
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/** Returns all clients with optional name search filter. */
export function useClients(search = '') {
  const [clients, setClients] = useState<Client[]>(() => readCachedClients());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('clients')
          .select('*')
          .order('name', { ascending: true });

        if (search.trim()) {
          query = query.ilike('name', `%${search.trim()}%`);
        }

        const { data, error: err } = await query;

        if (cancelled) return;

        if (err) {
          setError(toFriendlyClientError(err.message));
        } else {
          const next = data ?? [];
          setClients(next);
          if (!search.trim()) writeCachedClients(next);
        }
      } catch (e: any) {
        if (cancelled) return;
        try {
          // Fallback: bypass Supabase SDK when SDK fetch/auth layer is unstable.
          const fallback = await fetchClientsViaRest(search);
          if (cancelled) return;
          setClients(fallback);
          setError(null);
          if (!search.trim()) writeCachedClients(fallback);
        } catch (fallbackErr: any) {
          if (cancelled) return;
          const recovered = await tryRecoverBrokenSession(fallbackErr?.message ?? e?.message);
          if (recovered) {
            setError('Sua sessao estava corrompida. Faca login novamente no app de gestao.');
          } else {
            setError(toFriendlyClientError(fallbackErr?.message ?? e?.message));
          }
          if (!search.trim()) {
            const cached = readCachedClients();
            if (cached.length > 0) setClients(cached);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    function onClientsChanged() { if (!cancelled) fetch(); }
    window.addEventListener('clients-changed', onClientsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('clients-changed', onClientsChanged);
    };
  }, [search, refreshKey]);

  function refetch() { setRefreshKey(k => k + 1); }

  return { clients, loading, error, refetch };
}

/** Returns a single client by id with their service history. */
export function useClient(id: string | undefined) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase
          .from('clients')
          .select('*')
          .eq('id', id)
          .single();

        if (cancelled) return;

        if (err) {
          setError(toFriendlyClientError(err.message));
        } else {
          setClient(data);
        }
      } catch (e: any) {
        if (cancelled) return;
        try {
          const fallback = await fetchClientByIdViaRest(id);
          if (cancelled) return;
          setClient(fallback);
          setError(null);
        } catch (fallbackErr: any) {
          if (cancelled) return;
          const recovered = await tryRecoverBrokenSession(fallbackErr?.message ?? e?.message);
          if (recovered) {
            setError('Sua sessao estava corrompida. Faca login novamente no app de gestao.');
          } else {
            setError(toFriendlyClientError(fallbackErr?.message ?? e?.message));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [id]);

  async function updateClient(fields: Partial<Omit<Client, 'id' | 'created_at'>>) {
    if (!id) return;
    const { data, error: err } = await supabase
      .from('clients')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setClient(data);
    notifyClientsChanged();
    return data;
  }

  async function deleteClient() {
    if (!id) return;

    const { error: appointmentsError } = await supabase
      .from('appointments')
      .delete()
      .eq('client_id', id);

    if (appointmentsError) throw new Error(appointmentsError.message);

    const { error: clientError } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (clientError) throw new Error(clientError.message);

    setClient(null);
    notifyClientsChanged();
  }

  return { client, loading, error, updateClient, deleteClient };
}

/** Inserts a new client and returns the created record. Only name is required. */
export async function addClient(fields: { name: string; phone?: string | null; email?: string | null }) {
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: fields.name,
      phone: fields.phone ?? null,
      email: fields.email ?? null,
      status: 'Novo' as const,
      member_since: new Date().toISOString().split('T')[0],
    })
    .select('id, name')
    .single();
  if (error) throw new Error(error.message);
  notifyClientsChanged();
  return data as { id: string; name: string };
}
