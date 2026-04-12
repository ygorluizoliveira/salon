import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discount_pct: number | null;
  valid_until: string | null;
  active: boolean;
  created_at: string;
}

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!cancelled) {
        setPromotions(data ?? []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { promotions, loading, refetch };
}

export async function addPromotion(fields: {
  title: string;
  description?: string | null;
  discount_pct?: number | null;
  valid_until?: string | null;
  active: boolean;
}) {
  // Convert DD/MM/YYYY to YYYY-MM-DD for Supabase
  let valid_until = fields.valid_until;
  if (valid_until && valid_until.includes('/')) {
    const parts = valid_until.split('/');
    if (parts.length === 3) valid_until = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const { data, error } = await supabase
    .from('promotions')
    .insert({ ...fields, valid_until })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deletePromotion(id: string) {
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
