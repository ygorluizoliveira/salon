import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { SupplierProduct, SupplierProductCategory } from '../types';

type NewProduct = {
  name: string;
  price: number | null;
  purchase_date: string | null;
  category: SupplierProductCategory | null;
};

export function useSupplierProducts(supplierId: string) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        setProducts(data ?? []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [supplierId]);

  async function addProduct(product: NewProduct) {
    const { data, error } = await supabase
      .from('supplier_products')
      .insert({ supplier_id: supplierId, ...product })
      .select()
      .single();

    if (error) throw new Error(error.message);
    setProducts(prev => [data, ...prev]);
    return data;
  }

  async function removeProduct(id: string) {
    const { error } = await supabase.from('supplier_products').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  return { products, loading, addProduct, removeProduct };
}
