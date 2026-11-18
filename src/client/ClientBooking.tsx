import React, { useEffect, useState } from 'react';
import { useClientAuth } from '../lib/ClientAuthContext';
import { useAvailableSlots, useWorkingHours } from '../lib/hooks/useScheduling';
import { createAppointment } from '../lib/hooks/useAppointments';
import { useServiceCategories } from '../lib/hooks/useServiceCategories';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';
import { supabase } from '../lib/supabase';
import { todayLocalISO, toLocalISODate } from '../lib/utils';

const MIN_BOOK_DAYS = 5;
const OTHER_SERVICE_MAX_LENGTH = 80;
const WEEK_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

function daysUntil(isoDate: string): number {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(isoDate + 'T12:00:00');
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.floor((startTarget.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000));
}

function toMinutes(time: string) {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function generateSlots(openTime: string, closeTime: string, durationMin: number) {
  const slots: string[] = [];
  let current = toMinutes(openTime);
  const end = toMinutes(closeTime);
  const slotStep = Math.max(durationMin, 30);
  while (current + durationMin <= end) {
    slots.push(`${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`);
    current += slotStep;
  }
  return slots;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function startOfMonthISO(date: Date) {
  return toLocalISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function getMonthGrid(monthStartIso: string) {
  const start = new Date(monthStartIso + 'T12:00:00');
  const month = start.getMonth();
  const first = new Date(start);
  const lead = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - lead);

  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(toLocalISODate(d));
  }

  return { month, days };
}

export function ClientBooking() {
  const { client } = useClientAuth();
  const { categories } = useServiceCategories();
  const { hours } = useWorkingHours();
  const { settings } = useSalonSettings();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [otherService, setOtherService] = useState('');
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [emergencyRequest, setEmergencyRequest] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [monthStart, setMonthStart] = useState(() => startOfMonthISO(new Date()));
  const [monthAvailability, setMonthAvailability] = useState<Record<string, boolean>>({});

  const selectedCategories = categories.filter(c => selectedServices.includes(c.id));
  const hasOtherService = otherService.trim().length > 0;
  const selectedDurationMin = (
    selectedCategories.reduce((sum, c) => sum + (c.duration_min ?? 0), 0) + (hasOtherService ? 60 : 0)
  ) || 60;
  const { slots, loading: slotsLoading } = useAvailableSlots(selectedDate, selectedDurationMin);
  const shortNotice = selectedDate ? daysUntil(selectedDate) < MIN_BOOK_DAYS : false;
  const todayIso = todayLocalISO();
  const grid = getMonthGrid(monthStart);
  const openDays = new Set(hours.filter(h => h.active).map(h => h.day_of_week));
  const monthLabel = new Date(monthStart + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const closedDates = new Set((settings?.closed_dates ?? []).filter((d): d is string => typeof d === 'string'));

  useEffect(() => {
    let cancelled = false;

    async function loadMonthAvailability() {
      const monthEnd = grid.days[grid.days.length - 1];
      const { data: booked } = await supabase.rpc('get_busy_slots', { from_date: monthStart, to_date: monthEnd });

      const bookedByDate = new Map<string, Array<{ start: number; end: number }>>();
      for (const apt of booked ?? []) {
        const list = bookedByDate.get(apt.date) ?? [];
        const start = toMinutes(apt.time_start);
        const end = apt.time_end ? toMinutes(apt.time_end) : start + 60;
        list.push({ start, end });
        bookedByDate.set(apt.date, list);
      }

      const next: Record<string, boolean> = {};
      for (const iso of grid.days) {
        const d = new Date(iso + 'T12:00:00');
        const wh = hours.find(h => h.day_of_week === d.getDay() && h.active);
        if (closedDates.has(iso) || !wh || iso < todayIso) {
          next[iso] = false;
          continue;
        }
        const possibleSlots = generateSlots(wh.open_time, wh.close_time, selectedDurationMin);
        const ranges = bookedByDate.get(iso) ?? [];
        next[iso] = possibleSlots.some(slot => {
          const start = toMinutes(slot);
          const end = start + selectedDurationMin;
          return !ranges.some(r => overlaps(start, end, r.start, r.end));
        });
      }

      if (!cancelled) setMonthAvailability(next);
    }

    if (hours.length > 0) {
      loadMonthAvailability();
    }

    return () => { cancelled = true; };
  }, [monthStart, grid.days, hours, selectedDurationMin, todayIso, settings?.closed_dates]);
  function goMonth(offset: number) {
    const d = new Date(monthStart + 'T12:00:00');
    d.setMonth(d.getMonth() + offset);
    d.setDate(1);
    const next = startOfMonthISO(d);
    if (next < startOfMonthISO(new Date())) return;
    setMonthStart(next);
  }

  async function handleBook() {
    if (!client || !selectedDate || !selectedTime || (selectedServices.length === 0 && !hasOtherService)) {
      setError('Selecione data, horário e serviço.'); return;
    }
    if (selectedDate < todayLocalISO()) {
      setError('Não é possível agendar em data passada.'); return;
    }
    setSaving(true);
    setError(null);

    const duration = selectedDurationMin;
    const [h, m] = selectedTime.split(':').map(Number);
    const endMin  = h * 60 + m + duration;
    const timeEnd = `${String(Math.floor(endMin / 60)).padStart(2,'0')}:${String(endMin % 60).padStart(2,'0')}`;
    const serviceNames = [
      ...selectedCategories.map(c => c.name),
      ...(hasOtherService ? [otherService.trim()] : []),
    ];
    const totalPrice = selectedCategories.reduce((sum, c) => sum + (c.price ?? 0), 0);

    try {
      await createAppointment({
      client_id:  client.id,
      service:    serviceNames.join(', '),
      date:       selectedDate,
      time_start: selectedTime,
      time_end:   timeEnd,
      status:     'Aguardando',
      price:      totalPrice > 0 ? totalPrice : null,
      }, emergencyRequest && shortNotice
        ? {
            emergency: true,
            reason: emergencyReason,
          }
        : undefined);

      setSaving(false);
      setSuccess(true);
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedServices([]);
      setOtherService('');
      setEmergencyRequest(false);
      setEmergencyReason('');
    } catch (err: any) {
      setSaving(false);
      setError(err.message ?? 'Erro ao agendar.');
    }
  }

  if (success) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: '#68597a', fontStyle: 'italic' }}>Agendamento enviado!</h2>
        <p style={{ color: '#625d67', fontSize: 14 }}>O salão irá confirmar em breve.</p>
        <button onClick={() => setSuccess(false)} style={btnPrimary}>Fazer novo agendamento</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 20px 140px 20px' }}>
      <h2 style={{ color: '#68597a', fontStyle: 'italic', marginBottom: 4 }}>Agendar Horário</h2>
      <p style={{ color: '#625d67', fontSize: 13, marginBottom: 24 }}>Escolha o serviço, data e horário.</p>

      {/* Serviço */}
      <label style={labelStyle}>Serviço</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {categories.filter(c => c.status === 'active').map(c => {
          const selected = selectedServices.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setSelectedServices(prev =>
                prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
              )}
              style={{
                padding: '10px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
                backgroundColor: selected ? '#68597a' : '#e8e0ec',
                color: selected ? '#fff' : '#35313a',
                fontWeight: 700, fontSize: 12,
              }}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <label style={{ ...labelStyle, marginTop: 12 }}>Outros</label>
      <input
        type="text"
        value={otherService}
        onChange={e => setOtherService(e.target.value.slice(0, OTHER_SERVICE_MAX_LENGTH))}
        placeholder="Digite o serviço desejado"
        maxLength={OTHER_SERVICE_MAX_LENGTH}
        style={inputStyle}
      />
      <p style={{ color: '#625d67', fontSize: 11, marginTop: 6, marginBottom: 0, textAlign: 'right' }}>
        {otherService.length}/{OTHER_SERVICE_MAX_LENGTH}
      </p>

      {/* Datas */}
      <label style={{ ...labelStyle, marginTop: 20 }}>Data</label>
      <div style={{ background: '#f7eef8', borderRadius: 22, padding: 16, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button
            onClick={() => goMonth(-1)}
            disabled={monthStart <= startOfMonthISO(new Date())}
            style={monthNavButton(monthStart <= startOfMonthISO(new Date()))}
          >
            ◀
          </button>
          <strong style={{ color: '#68597a', fontStyle: 'italic', textTransform: 'capitalize' }}>{monthLabel}</strong>
          <button onClick={() => goMonth(1)} style={monthNavButton(false)}>▶</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
          {WEEK_DAYS.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#625d67' }}>{day}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {grid.days.map(iso => {
            const date = new Date(iso + 'T12:00:00');
            const isCurrentMonth = date.getMonth() === grid.month;
            const isPast = iso < todayIso;
            const isClosed = closedDates.has(iso) || !openDays.has(date.getDay());
            const hasAvailability = monthAvailability[iso] ?? !isClosed;
            const isNoAvailability = isCurrentMonth && !isPast && !isClosed && !hasAvailability;
            const isDisabled = !isCurrentMonth || isPast || isClosed || isNoAvailability;
            const isSelected = selectedDate === iso;

            if (!isCurrentMonth) return <div key={iso} aria-hidden style={{ minHeight: 56 }} />;

            return (
              <button
                key={iso}
                disabled={isDisabled}
                onClick={() => {
                  setSelectedDate(iso);
                  setSelectedTime(null);
                  setEmergencyRequest(false);
                  setEmergencyReason('');
                }}
                style={{
                  minHeight: 56,
                  borderRadius: 14,
                  border: isSelected ? '1px solid #68597a' : '1px solid transparent',
                  background: isClosed ? '#ffd9d6' : isNoAvailability ? '#ece4ee' : isSelected ? '#68597a' : isCurrentMonth ? '#fff' : '#f3edf5',
                  color: isClosed ? '#ba1a1a' : isNoAvailability ? '#8a8291' : isSelected ? '#fff' : isCurrentMonth ? '#35313a' : '#b7afbb',
                  opacity: isDisabled ? 0.55 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  boxShadow: isCurrentMonth && !isDisabled ? '0 2px 8px rgba(104, 89, 122, 0.08)' : 'none',
                  padding: 6,
                }}
                title={isClosed ? 'Salao fechado neste dia' : isNoAvailability ? 'Sem horarios disponiveis neste dia' : undefined}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{date.getDate()}</div>
                {isClosed && isCurrentMonth && <div style={{ fontSize: 9, marginTop: 2 }}>Fechado</div>}
                {isNoAvailability && <div style={{ fontSize: 9, marginTop: 2 }}>Sem horario</div>}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          <div style={legendItemStyle}><span style={{ ...legendDotStyle, background: '#ffffff', border: '1px solid #d7cde5' }} />Aberto</div>
          <div style={legendItemStyle}><span style={{ ...legendDotStyle, background: '#ffd9d6' }} />Fechado</div>
          <div style={legendItemStyle}><span style={{ ...legendDotStyle, background: '#ece4ee' }} />Sem horário</div>
        </div>
      </div>

      {/* Horários */}
      {selectedDate && (
        <>
          <label style={{ ...labelStyle, marginTop: 20 }}>Horário</label>
          {slotsLoading ? (
            <p style={{ color: '#625d67', fontSize: 13 }}>Verificando disponibilidade…</p>
          ) : slots.length === 0 ? (
            <p style={{ color: '#625d67', fontSize: 13 }}>Nenhum horário disponível nesta data.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {slots.map(s => (
                <button key={s.time} disabled={!s.available}
                  onClick={() => setSelectedTime(s.time)}
                  style={{
                    padding: '10px 16px', borderRadius: 50, border: 'none', cursor: s.available ? 'pointer' : 'default',
                    backgroundColor: !s.available ? '#f0e4f8' : selectedTime === s.time ? '#68597a' : '#d0fcfe',
                    color: !s.available ? '#b7afbb' : selectedTime === s.time ? '#fff' : '#3a6264',
                    fontWeight: 700, fontSize: 13,
                    textDecoration: !s.available ? 'line-through' : 'none',
                  }}>
                  {s.time}{!s.available ? ' ✕' : ''}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p style={errorStyle}>{error}</p>}

      {shortNotice && (
        <div style={{ marginTop: 16, background: '#fff3e8', borderRadius: 14, padding: 12, border: '1px solid #f1d0b4' }}>
          <p style={{ color: '#7a4a27', fontSize: 12, marginTop: 0, marginBottom: 8 }}>
            Esta data e menor que {MIN_BOOK_DAYS} dias. Para seguir, solicite emergencia e informe o motivo.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#7a4a27', fontWeight: 700, fontSize: 13 }}>
            <input
              type="checkbox"
              style={{ width: 22, height: 22 }}
              checked={emergencyRequest}
              onChange={(e) => setEmergencyRequest(e.target.checked)}
            />
            Solicitar agendamento de emergencia
          </label>

          {emergencyRequest && (
            <>
              <label style={{ ...labelStyle, color: '#7a4a27', marginTop: 12 }}>Motivo da urgencia</label>
              <textarea
                value={emergencyReason}
                onChange={e => setEmergencyReason(e.target.value)}
                placeholder="Descreva rapidamente o motivo"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 78, paddingTop: 10 }}
              />
            </>
          )}
        </div>
      )}

      <button
        onClick={handleBook}
        disabled={saving || !selectedDate || !selectedTime || (selectedServices.length === 0 && !hasOtherService)}
        style={{ ...btnPrimary, marginTop: 28, opacity: (!selectedDate || !selectedTime || (selectedServices.length === 0 && !hasOtherService)) ? 0.5 : 1 }}>
        {saving ? 'Agendando…' : 'Confirmar Agendamento'}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: '#625d67',
  textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e3c8b0',
  backgroundColor: '#fff', fontSize: 14, color: '#35313a', outline: 'none',
};
const errorStyle: React.CSSProperties = {
  color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12,
  padding: '10px 14px', fontSize: 13, marginTop: 12,
};
const monthNavButton = (disabled: boolean): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: 16,
  border: 'none',
  backgroundColor: disabled ? '#ece4ee' : '#e8e0ec',
  color: disabled ? '#b7afbb' : '#68597a',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: 700,
});
const legendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#625d67',
  fontSize: 11,
};
const legendDotStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 6,
  display: 'inline-block',
};
const btnPrimary: React.CSSProperties = {
  width: '100%', padding: '16px', borderRadius: 50, border: 'none',
  backgroundColor: '#68597a', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
};
