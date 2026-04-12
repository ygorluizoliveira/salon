import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Supplier } from '../types';

/** Returns all suppliers ordered by company name. */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('suppliers')
        .select('*')
        .order('company_name', { ascending: true });

      if (cancelled) return;
      if (err) { setError(err.message); } else { setSuppliers(data ?? []); }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  async function addSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>) {
    const { data, error: err } = await supabase
      .from('suppliers')
      .insert(supplier)
      .select()
      .single();

    if (err) throw new Error(err.message);
    setSuppliers(prev => [...prev, data].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    return data;
  }

  async function removeSupplier(id: string) {
    const { error: err } = await supabase.from('suppliers').delete().eq('id', id);
    if (err) throw new Error(err.message);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  }

  return { suppliers, loading, error, addSupplier, removeSupplier };
}
