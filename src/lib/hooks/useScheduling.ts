import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { toLocalISODate } from '../utils';

// ── Working hours ──────────────────────────────────────────────────────────────
export interface WorkingHour {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  active: boolean;
}

// ── Available slot ────────────────────────────────────────────────────────────
export interface TimeSlot {
  time: string;   // "HH:MM"
  available: boolean;
}

const MIN_SLOT_STEP_MIN = 30;

function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function generateSlots(openTime: string, closeTime: string, durationMin: number): string[] {
  const slots: string[] = [];
  let current = toMinutes(openTime);
  const end = toMinutes(closeTime);
  const slotStep = Math.max(durationMin, MIN_SLOT_STEP_MIN);

  while (current + durationMin <= end) {
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm = String(current % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    current += slotStep;
  }
  return slots;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

export function useAvailableSlots(dateStr: string | null, serviceDurationMin = 60) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dateStr) { setSlots([]); return; }
    let cancelled = false;

    async function load() {
      setLoading(true);
      const date = new Date(dateStr + 'T00:00:00');
      const dow  = date.getDay(); // 0=Sun

      // Fetch specific closure dates configured by management.
      const { data: settings } = await supabase
        .from('settings')
        .select('closed_dates')
        .limit(1)
        .single();
      const closedDates = ((settings as any)?.closed_dates ?? []) as string[];
      if (closedDates.includes(dateStr)) {
        if (!cancelled) { setSlots([]); setLoading(false); }
        return;
      }

      // Fetch working hours for this day
      const { data: wh } = await supabase
        .from('working_hours')
        .select('*')
        .eq('day_of_week', dow)
        .eq('active', true)
        .single();

      if (!wh) { if (!cancelled) { setSlots([]); setLoading(false); } return; }

      // Fetch booked appointments for this date
      const { data: booked } = await supabase.rpc('get_busy_slots', { from_date: dateStr, to_date: dateStr });

      const bookedRanges = (booked ?? []).map(a => {
        const start = toMinutes(a.time_start);
        // Fallback for legacy rows without end time
        const end = a.time_end ? toMinutes(a.time_end) : start + 60;
        return { start, end };
      });

      const allSlots = generateSlots(wh.open_time, wh.close_time, serviceDurationMin);
      const now = new Date();
      const isToday = dateStr === toLocalISODate(now);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const result: TimeSlot[] = allSlots.map(t => ({
        time: t,
        available:
          !(isToday && toMinutes(t) <= nowMin) &&
          !bookedRanges.some(r => overlaps(toMinutes(t), toMinutes(t) + serviceDurationMin, r.start, r.end)),
      }));

      if (!cancelled) {
        setSlots(result);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [dateStr, serviceDurationMin]);

  return { slots, loading };
}

// ── Working hours CRUD (admin) ────────────────────────────────────────────────
export function useWorkingHours() {
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('working_hours')
      .select('*')
      .order('day_of_week')
      .then(({ data }) => {
        if (!cancelled) {
          setHours(data ?? []);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  async function upsertDay(day: number, open: string, close: string, active: boolean) {
    const existing = hours.find(h => h.day_of_week === day);
    if (existing) {
      await supabase.from('working_hours').update({ open_time: open, close_time: close, active }).eq('id', existing.id);
    } else {
      await supabase.from('working_hours').insert({ day_of_week: day, open_time: open, close_time: close, active });
    }
    refetch();
  }

  return { hours, loading, upsertDay, refetch };
}
