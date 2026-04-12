import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Client } from '../types';

/** Returns all clients with optional name search filter. */
export function useClients(search = '') {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

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
        setError(err.message);
      } else {
        setClients(data ?? []);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
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

      const { data, error: err } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        setClient(data);
      }
      setLoading(false);
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
  return data as { id: string; name: string };
}
