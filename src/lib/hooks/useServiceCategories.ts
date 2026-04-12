import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { ServiceCategory, ServiceCategoryStatus } from '../types';

/** Returns all service categories ordered by name. */
export function useServiceCategories() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('service_categories')
        .select('*')
        .order('name', { ascending: true });

      if (cancelled) return;
      if (err) { setError(err.message); } else { setCategories(data ?? []); }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  async function addCategory(cat: Omit<ServiceCategory, 'id' | 'created_at'>) {
    const { data, error: err } = await supabase
      .from('service_categories')
      .insert(cat)
      .select()
      .single();

    if (err) throw new Error(err.message);
    setCategories(prev =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    );
    return data;
  }

  async function updateCategory(id: string, patch: Partial<Omit<ServiceCategory, 'id' | 'created_at'>>) {
    const { data, error: err } = await supabase
      .from('service_categories')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (err) throw new Error(err.message);
    setCategories(prev =>
      prev.map(c => c.id === id ? data : c)
    );
    return data;
  }

  async function removeCategory(id: string) {
    const { error: err } = await supabase
      .from('service_categories')
      .delete()
      .eq('id', id);

    if (err) throw new Error(err.message);
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  return { categories, loading, error, addCategory, updateCategory, removeCategory };
}
