import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Switch } from 'react-native';
import { useWorkingHours } from '../lib/hooks/useScheduling';
import type { WorkingHour } from '../lib/hooks/useScheduling';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';
import { TopBar } from '../components/TopBar';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DEFAULT_OPEN  = '09:00';
const DEFAULT_CLOSE = '18:00';

function pad(n: number) { return String(n).padStart(2, '0'); }
function validateTime(t: string) { return /^\d{2}:\d{2}$/.test(t); }

// Convert DD-MM-AAAA to AAAA-MM-DD (ISO)
function ddmmyyyyToIso(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Convert AAAA-MM-DD (ISO) to DD-MM-AAAA
function isoToDdmmyyyy(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Get dates for this week (Sunday to Saturday)
function getWeekDates(): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek; // Sunday is 0
  const sunday = new Date(today.setDate(diff));
  
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

// Format date as DD/MM
function formatDateShort(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

// Apply DD-MM-AAAA mask to input
function applyDateMask(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 8)}`;
}

export default function WorkingHours({ navigation }: any) {
  const { hours, loading, upsertDay } = useWorkingHours();
  const { settings, updateSettings } = useSalonSettings();
  const [saving, setSaving] = useState<number | null>(null);
  const [saved,  setSaved]  = useState<Set<number>>(new Set());
  const [err,    setErr]    = useState<string | null>(null);
  const [closedDateInput, setClosedDateInput] = useState('');
  const [savingClosedDates, setSavingClosedDates] = useState(false);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [weekDates, setWeekDates] = useState<Date[]>([]);

  // Local editable state indexed by day_of_week (0-6)
  const [rows, setRows] = useState<Record<number, { open: string; close: string; active: boolean }>>({});

  // Initialise rows when data arrives
  useEffect(() => {
    const init: Record<number, { open: string; close: string; active: boolean }> = {};
    for (let d = 0; d < 7; d++) {
      const found = hours.find(h => h.day_of_week === d);
      init[d] = {
        open:   found?.open_time  ?? DEFAULT_OPEN,
        close:  found?.close_time ?? DEFAULT_CLOSE,
        active: found?.active     ?? (d !== 0),   // Sun off by default
      };
    }
    setRows(init);
  }, [hours]);

  useEffect(() => {
    const next = (settings?.closed_dates ?? []).filter((d): d is string => typeof d === 'string');
    const unique = Array.from(new Set(next)).sort();
    setClosedDates(unique);
  }, [settings?.closed_dates]);

  useEffect(() => {
    setWeekDates(getWeekDates());
  }, []);

  async function save(dow: number) {
    const row = rows[dow];
    if (!validateTime(row.open) || !validateTime(row.close)) {
      setErr(`Horário inválido para ${DAYS[dow]}. Use HH:MM.`); return;
    }
    setErr(null);
    setSaving(dow);
    await upsertDay(dow, row.open, row.close, row.active);
    setSaving(null);
    setSaved(prev => new Set(prev).add(dow));
    setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(dow); return n; }), 2500);
  }

  function setRow(dow: number, patch: Partial<{ open: string; close: string; active: boolean }>) {
    setRows(prev => ({ ...prev, [dow]: { ...prev[dow], ...patch } }));
  }

  async function persistClosedDates(nextDates: string[]) {
    setSavingClosedDates(true);
    setErr(null);
    try {
      const sorted = Array.from(new Set(nextDates)).sort();
      await updateSettings({ closed_dates: sorted });
      setClosedDates(sorted);
    } catch (e: any) {
      const errorMsg = e?.message ?? 'Erro ao salvar datas fechadas.';
      const displayMsg = errorMsg.includes('Failed to fetch') 
        ? 'Erro de conexão. Verifique sua internet e tente novamente.'
        : errorMsg;
      setErr(displayMsg);
      console.error('Erro ao persistir datas fechadas:', e);
    } finally {
      setSavingClosedDates(false);
    }
  }

  async function addClosedDate() {
    const todayIso = new Date().toISOString().slice(0, 10);
    if (!closedDateInput) {
      setErr('Informe uma data no formato DD-MM-AAAA.');
      return;
    }
    // Validate format DD-MM-AAAA
    if (!/^\d{2}-\d{2}-\d{4}$/.test(closedDateInput)) {
      setErr('Use o formato DD-MM-AAAA (ex: 25-12-2026).');
      return;
    }
    const dateIso = ddmmyyyyToIso(closedDateInput);
    if (dateIso < todayIso) {
      setErr('Use apenas datas futuras para fechamento.');
      return;
    }
    if (closedDates.includes(dateIso)) {
      setErr('Esta data ja esta marcada como fechada.');
      return;
    }
    await persistClosedDates([...closedDates, dateIso]);
    setClosedDateInput('');
  }

  async function removeClosedDate(dateIso: string) {
    await persistClosedDates(closedDates.filter(d => d !== dateIso));
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fef7fe' }}>
      <TopBar title="Horários de Funcionamento" navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ color: '#625d67', fontSize: 13, marginBottom: 20 }}>
          Configure os horários de atendimento para cada dia da semana.
        </Text>

        <View style={{
          backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 18,
          shadowColor: '#68597a', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
        }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#35313a', marginBottom: 6 }}>Fechamento em Data Futura</Text>
          <Text style={{ color: '#625d67', fontSize: 12, marginBottom: 12 }}>
            Marque datas especificas em que o salao estara fechado para que clientes vejam com antecedencia.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              value={closedDateInput}
              onChangeText={(text) => setClosedDateInput(applyDateMask(text))}
              placeholder="DD-MM-AAAA"
              maxLength={10}
              keyboardType="numeric"
              style={{ ...inputStyle, flex: 1, textAlign: 'left' }}
            />
            <TouchableOpacity
              onPress={addClosedDate}
              disabled={savingClosedDates}
              style={{ backgroundColor: '#68597a', borderRadius: 50, paddingHorizontal: 16, paddingVertical: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{savingClosedDates ? 'Salvando...' : 'Adicionar'}</Text>
            </TouchableOpacity>
          </View>

          {closedDates.length > 0 && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {closedDates.map(dateIso => (
                <View key={dateIso} style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: '#f6eef8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
                }}>
                  <Text style={{ color: '#35313a', fontWeight: '600' }}>
                    {isoToDdmmyyyy(dateIso)}
                  </Text>
                  <TouchableOpacity onPress={() => removeClosedDate(dateIso)} disabled={savingClosedDates}>
                    <Text style={{ color: '#ba1a1a', fontWeight: '700', fontSize: 12 }}>Remover</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#68597a" style={{ marginTop: 40 }} />
        ) : (
          DAYS.map((day, dow) => {
            const row = rows[dow] ?? { open: DEFAULT_OPEN, close: DEFAULT_CLOSE, active: dow !== 0 };
            const isSaving = saving === dow;
            const isSaved  = saved.has(dow);
            const dateThisWeek = weekDates[dow];
            const dateLabel = dateThisWeek ? formatDateShort(dateThisWeek) : '';

            return (
              <View key={dow} style={{
                backgroundColor: '#fff', borderRadius: 24, padding: 20,
                marginBottom: 16, shadowColor: '#68597a', shadowOpacity: 0.07,
                shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
              }}>
                {/* Header row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#35313a' }}>
                    {day}{dateLabel ? ` • ${dateLabel}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: row.active ? '#68597a' : '#b7afbb', fontWeight: '600' }}>
                      {row.active ? 'Aberto' : 'Fechado'}
                    </Text>
                    <Switch
                      value={row.active}
                      onValueChange={v => setRow(dow, { active: v })}
                      trackColor={{ false: '#e8e0ec', true: '#c1aee0' }}
                      thumbColor={row.active ? '#68597a' : '#f0e9f8'}
                    />
                  </View>
                </View>

                {row.active && (
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={labelStyle}>Abertura</Text>
                      <TextInput
                        value={row.open}
                        onChangeText={t => setRow(dow, { open: t })}
                        placeholder="09:00"
                        maxLength={5}
                        keyboardType="numeric"
                        style={inputStyle}
                      />
                    </View>
                    <Text style={{ color: '#625d67', marginTop: 18, fontSize: 18 }}>—</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={labelStyle}>Fechamento</Text>
                      <TextInput
                        value={row.close}
                        onChangeText={t => setRow(dow, { close: t })}
                        placeholder="18:00"
                        maxLength={5}
                        keyboardType="numeric"
                        style={inputStyle}
                      />
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => save(dow)}
                  disabled={isSaving}
                  style={{
                    backgroundColor: isSaved ? '#e1cdf4' : '#68597a',
                    padding: 12, borderRadius: 50, alignItems: 'center',
                  }}>
                  <Text style={{ color: isSaved ? '#68597a' : '#fff', fontWeight: '700', fontSize: 13 }}>
                    {isSaving ? 'Salvando…' : isSaved ? '✓ Salvo!' : 'Salvar'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {err && (
          <View style={{ backgroundColor: '#ffedec', borderRadius: 16, padding: 14, marginTop: 8 }}>
            <Text style={{ color: '#ba1a1a', fontSize: 13, textAlign: 'center' }}>{err}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const labelStyle = { fontSize: 10, fontWeight: '700' as const, color: '#625d67', textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 6 };
const inputStyle = {
  backgroundColor: '#f0e9f8', borderRadius: 12, padding: 12,
  fontSize: 16, color: '#35313a', textAlign: 'center' as const, fontWeight: '700' as const,
};
