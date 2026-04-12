import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { ServiceHistory } from '../types';

/** Returns service history for a specific client, newest first. */
export function useServiceHistory(clientId: string | undefined) {
  const [history, setHistory] = useState<ServiceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('appointments')
        .select('id, client_id, service, date, status, price, professional, created_at')
        .eq('client_id', clientId)
        .order('date', { ascending: false });

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        const mapped: ServiceHistory[] = (data ?? []).map((a: any) => ({
          id: a.id,
          client_id: a.client_id,
          title: a.service,
          professional: a.professional ?? null,
          amount: a.price ?? 0,
          date: a.date,
          status: a.status,
          created_at: a.created_at,
        }));
        setHistory(mapped);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [clientId]);

  return { history, loading, error };
}
