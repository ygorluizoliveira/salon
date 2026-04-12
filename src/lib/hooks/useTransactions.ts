import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Transaction } from '../types';

interface FinanceStats {
  monthlyRevenue: number;
  monthlyGrowthPct: number;
  totalIncome: number;
  totalExpense: number;
}

/** Returns this month's transactions ordered by date desc. */
export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<FinanceStats>({
    monthlyRevenue: 0,
    monthlyGrowthPct: 0,
    totalIncome: 0,
    totalExpense: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastDayLastMonth  = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

      const [currentRes, previousRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .gte('occurred_at', firstDayThisMonth)
          .order('occurred_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('amount, type')
          .gte('occurred_at', firstDayLastMonth)
          .lte('occurred_at', lastDayLastMonth),
      ]);

      if (cancelled) return;

      if (currentRes.error) { setError(currentRes.error.message); setLoading(false); return; }
      if (previousRes.error) { setError(previousRes.error.message); setLoading(false); return; }

      const current  = currentRes.data  ?? [];
      const previous = previousRes.data ?? [];

      const income  = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const revenue = income - expense;

      const prevRevenue = previous
        .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

      const growthPct = prevRevenue === 0 ? 0 :
        Math.round(((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100);

      setTransactions(current as Transaction[]);
      setStats({ monthlyRevenue: revenue, monthlyGrowthPct: growthPct, totalIncome: income, totalExpense: expense });
      setLoading(false);
    }

    fetch();

    const channel = supabase
      .channel('transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetch)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  async function addTransaction(tx: Omit<Transaction, 'id' | 'created_at'>) {
    const { data, error: err } = await supabase
      .from('transactions')
      .insert(tx)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setTransactions(prev => [data, ...prev]);
    setStats(prev => {
      const delta = tx.type === 'income' ? tx.amount : -tx.amount;
      return {
        ...prev,
        monthlyRevenue: prev.monthlyRevenue + delta,
        totalIncome:  tx.type === 'income'  ? prev.totalIncome  + tx.amount : prev.totalIncome,
        totalExpense: tx.type === 'expense' ? prev.totalExpense + tx.amount : prev.totalExpense,
      };
    });
    return data;
  }

  return { transactions, stats, loading, error, addTransaction };
}
