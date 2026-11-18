import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { todayLocalISO, toLocalISODate } from '../utils';

interface DashboardStats {
  dailyRevenue: number;
  dailyGrowthPct: number;
  totalClients: number;
  newClientsThisWeek: number;
  occupancyPct: number;
}

/**
 * Computes the dashboard summary cards from live DB data:
 * - Daily revenue (today's income transactions)
 * - Total clients count
 * - Today's occupancy % (appointments vs capacity)
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    dailyRevenue: 0,
    dailyGrowthPct: 0,
    totalClients: 0,
    newClientsThisWeek: 0,
    occupancyPct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const today     = todayLocalISO();
      const yesterday = toLocalISODate(new Date(Date.now() - 86_400_000));
      const weekAgo   = toLocalISODate(new Date(Date.now() - 7 * 86_400_000));

      // Daily capacity: maximum appointments per day (configurable)
      const DAILY_CAPACITY = 10;

      const [confirmedToday, confirmedYesterday, clientCount, newClients, todayApts] = await Promise.all([
        supabase.from('appointments').select('price').eq('date', today).eq('status', 'Confirmado'),
        supabase.from('appointments').select('price').eq('date', yesterday).eq('status', 'Confirmado'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('date', today),
      ]);

      if (cancelled) return;

      const errors = [confirmedToday.error, confirmedYesterday.error, clientCount.error, newClients.error, todayApts.error].filter(Boolean);
      if (errors.length) { setError(errors[0]!.message); setLoading(false); return; }

      const dailyRev  = (confirmedToday.data ?? []).reduce((s: number, r: { price: number | null }) => s + (r.price ?? 0), 0);
      const yestRev   = (confirmedYesterday.data ?? []).reduce((s: number, r: { price: number | null }) => s + (r.price ?? 0), 0);
      const growthPct = yestRev === 0 ? 0 : Math.round(((dailyRev - yestRev) / yestRev) * 100);

      setStats({
        dailyRevenue:       dailyRev,
        dailyGrowthPct:     growthPct,
        totalClients:       clientCount.count ?? 0,
        newClientsThisWeek: newClients.count ?? 0,
        occupancyPct:       Math.min(100, Math.round(((todayApts.count ?? 0) / DAILY_CAPACITY) * 100)),
      });
      setLoading(false);
    }

    fetch();

    function onAptsChanged() { if (!cancelled) fetch(); }
    window.addEventListener('appointments-changed', onAptsChanged);
    return () => { cancelled = true; window.removeEventListener('appointments-changed', onAptsChanged); };
  }, []);

  return { stats, loading, error };
}
