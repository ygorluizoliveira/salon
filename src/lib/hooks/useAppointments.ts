import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { Appointment } from '../types';

const MIN_CANCEL_DAYS = 5;
const MIN_BOOK_DAYS = 5;
const MIN_CONFIRM_DAYS = 5;

type PolicyOptions = {
  urgent?: boolean;
  reason?: string;
  awareShortNotice?: boolean;
};

type CreateOptions = {
  emergency?: boolean;
  reason?: string;
};

function daysUntil(isoDate: string): number {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(isoDate + 'T12:00:00');
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.floor((startTarget.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000));
}

function ensureCanCancel(appointmentDate: string, options?: PolicyOptions) {
  const diff = daysUntil(appointmentDate);
  if (diff >= MIN_CANCEL_DAYS) return;

  if (options?.urgent) {
    const reason = options.reason?.trim() ?? '';
    if (reason.length < 5) {
      throw new Error('Para cancelamento urgente, informe um motivo com pelo menos 5 caracteres.');
    }
    return;
  }

  throw new Error(`Cancelamento permitido apenas com ${MIN_CANCEL_DAYS} dias de antecedência. Para urgência, informe motivo e use cancelamento urgente.`);
}

function ensureCanSchedule(appointmentDate: string, options?: CreateOptions) {
  const diff = daysUntil(appointmentDate);
  if (diff >= MIN_BOOK_DAYS) return;

  if (options?.emergency) {
    const reason = options.reason?.trim() ?? '';
    if (reason.length < 5) {
      throw new Error('Informe o motivo da emergência com pelo menos 5 caracteres.');
    }
    return;
  }

  throw new Error(`Agendamento permitido apenas com ${MIN_BOOK_DAYS} dias de antecedencia.`);
}

function ensureCanConfirm(appointmentDate: string, options?: PolicyOptions) {
  const diff = daysUntil(appointmentDate);
  if (diff >= MIN_CONFIRM_DAYS) return;
  if (options?.awareShortNotice) return;
  throw new Error(`Para confirmar agendamento com menos de ${MIN_CONFIRM_DAYS} dias, marque "Estou ciente".`);
}

async function getAppointmentById(id: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, date, status')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; date: string; status: string };
}

/** Returns all upcoming appointments with status 'Aguardando', across all dates. */
export function usePendingAppointments() {
  const [pending, setPending] = useState<Appointment[]>([]);

  async function load() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('appointments')
      .select('*, client:clients(id, name, avatar_url, status, phone)')
      .eq('status', 'Aguardando')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time_start', { ascending: true });
    setPending((data as Appointment[]) ?? []);
  }

  useEffect(() => {
    load();
    window.addEventListener('appointments-changed', load);
    const channel = supabase
      .channel(`pending-appointments-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, load)
      .subscribe();
    return () => {
      window.removeEventListener('appointments-changed', load);
      supabase.removeChannel(channel);
    };
  }, []);

  return pending;
}

/**
 * Returns today's appointments ordered by start time,
 * with the related client (name, avatar, status) joined.
 */
export function useAppointments(date?: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const targetDate = date ?? new Date().toISOString().split('T')[0];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('appointments')
        .select('*, client:clients(id, name, avatar_url, status, phone)')
        .eq('date', targetDate)
        .order('time_start', { ascending: true });

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        setAppointments((data as Appointment[]) ?? []);
      }
      setLoading(false);
    }

    load();

    // Global event: any mutation dispatches this so all hook instances refresh
    function onChanged() { if (!cancelled) load(); }
    window.addEventListener('appointments-changed', onChanged);

    // Real-time subscription — unique channel name prevents collisions on re-mount
    const channel = supabase
      .channel(`appointments-${targetDate}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener('appointments-changed', onChanged);
      supabase.removeChannel(channel);
    };
  }, [targetDate, refreshKey]);

  function refetch() { setRefreshKey(k => k + 1); }

  return { appointments, loading, error, refetch };
}

/** Returns appointments for the current week (Monday-Sunday). */
export function useAppointmentsForWeek(baseDate?: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const anchorIso = baseDate ?? new Date().toISOString().split('T')[0];

  useEffect(() => {
    let cancelled = false;

    function getWeekRange(iso: string) {
      const d = new Date(iso + 'T12:00:00');
      const day = d.getDay();
      const mondayShift = day === 0 ? -6 : 1 - day;

      const start = new Date(d);
      start.setDate(d.getDate() + mondayShift);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }

    async function load() {
      setLoading(true);
      setError(null);

      const { start, end } = getWeekRange(anchorIso);
      const { data, error: err } = await supabase
        .from('appointments')
        .select('*, client:clients(id, name, avatar_url, status, phone)')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('time_start', { ascending: true });

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        setAppointments((data as Appointment[]) ?? []);
      }
      setLoading(false);
    }

    load();

    function onChanged() { if (!cancelled) load(); }
    window.addEventListener('appointments-changed', onChanged);

    const channel = supabase
      .channel(`appointments-week-${anchorIso}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener('appointments-changed', onChanged);
      supabase.removeChannel(channel);
    };
  }, [anchorIso, refreshKey]);

  function refetch() { setRefreshKey(k => k + 1); }

  return { appointments, loading, error, refetch };
}

/** Returns appointments for a full month (YYYY-MM). */
export function useAppointmentsForMonth(monthIso: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const start = `${monthIso}-01`;
      const d = new Date(`${start}T12:00:00`);
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      const end = d.toISOString().split('T')[0];

      const { data } = await supabase
        .from('appointments')
        .select('*, client:clients(id, name, avatar_url, status, phone)')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
        .order('time_start', { ascending: true });

      if (!cancelled) {
        setAppointments((data as Appointment[]) ?? []);
        setLoading(false);
      }
    }

    load();
    function onChanged() { if (!cancelled) load(); }
    window.addEventListener('appointments-changed', onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('appointments-changed', onChanged);
    };
  }, [monthIso, refreshKey]);

  function refetch() { setRefreshKey(k => k + 1); }
  return { appointments, loading, refetch };
}

export function useAllClients() {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      setClients(data ?? []);
    });
  }, []);
  return clients;
}

export function useAddAppointment() {
  async function addAppointment(apt: {
    client_id: string;
    service: string;
    date: string;
    time_start: string;
    time_end: string;
    status: string;
    professional?: string | null;
    price?: number;
  }, options?: CreateOptions) {
    return createAppointment(apt, options);
  }
  return addAppointment;
}

export async function createAppointment(apt: {
  client_id: string;
  service: string;
  date: string;
  time_start: string;
  time_end: string;
  status: string;
  professional?: string | null;
  price?: number;
}, options?: CreateOptions) {
  ensureCanSchedule(apt.date, options);

  const payload = { ...apt };
  if (options?.emergency) {
    payload.professional = `Emergencia: ${options.reason?.trim()}`;
  }

  const conflict = await findConflict(apt.date, apt.time_start, apt.time_end);
  if (conflict) {
    const name = (conflict as any).client?.name ?? 'Outro cliente';
    throw new Error(`Horário já ocupado por ${name} (${conflict.time_start}–${conflict.time_end}).`);
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  notifyChange();
  return data;
}

function notifyChange() {
  window.dispatchEvent(new Event('appointments-changed'));
}

export async function updateAppointmentStatus(id: string, status: string, options?: PolicyOptions) {
  const current = await getAppointmentById(id);

  if (current.status === 'Confirmado' && status !== 'Cancelado' && status !== current.status) {
    throw new Error('Agendamento confirmado não pode ser editado. Apenas cancelamento é permitido.');
  }

  if (status === 'Cancelado') {
    ensureCanCancel(current.date, options);
  }

  if (status === 'Confirmado') {
    ensureCanConfirm(current.date, options);
  }

  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
  notifyChange();
}

export async function deleteAppointment(id: string) {
  throw new Error('Exclusão direta desativada. Use cancelamento com política de antecedência/urgência.');
}

export async function updateAppointment(id: string, fields: {
  service: string;
  date: string;
  time_start: string;
  time_end: string;
  status: string;
  price?: number;
}, options?: PolicyOptions) {
  const current = await getAppointmentById(id);

  if (current.status === 'Confirmado' && fields.status !== 'Cancelado') {
    throw new Error('Agendamento confirmado não pode ser editado. Apenas cancelamento é permitido.');
  }

  if (fields.status === 'Cancelado') {
    ensureCanCancel(current.date, options);
  } else if (fields.status === 'Confirmado') {
    ensureCanConfirm(fields.date, options);
  } else {
    ensureCanSchedule(fields.date);
  }

  const conflict = await findConflict(fields.date, fields.time_start, fields.time_end, id);
  if (conflict) {
    const name = (conflict as any).client?.name ?? 'Outro cliente';
    throw new Error(`Horário já ocupado por ${name} (${conflict.time_start}–${conflict.time_end}).`);
  }

  const { error } = await supabase
    .from('appointments')
    .update(fields)
    .eq('id', id);
  if (error) throw new Error(error.message);
  notifyChange();
}

async function findConflict(date: string, timeStart: string, timeEnd: string, excludeId?: string) {
  let q = supabase
    .from('appointments')
    .select('id, time_start, time_end, client:clients(name)')
    .eq('date', date)
    .neq('status', 'Cancelado')
    .lt('time_start', timeEnd)
    .gt('time_end', timeStart)
    .limit(1);

  if (excludeId) q = q.neq('id', excludeId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}
