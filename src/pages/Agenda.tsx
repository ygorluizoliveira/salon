import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { ChevronLeft, ChevronRight, Plus, MoreVertical, X, User, Check } from 'lucide-react-native';
import { MotiView } from 'moti';
import { TopBar } from '../components/TopBar';
import { useAppointments, useAppointmentsForMonth, useAllClients, useAddAppointment, updateAppointmentStatus, updateAppointment } from '../lib/hooks/useAppointments';
import type { Appointment } from '../lib/types';
import { useServiceCategories } from '../lib/hooks/useServiceCategories';
import { addClient } from '../lib/hooks/useClients';
import { todayLocalISO, formatTime, maskPhone, isValidPhone, PHONE_ERROR } from '../lib/utils';

const MIN_CANCEL_DAYS = 5;
const MIN_BOOK_DAYS = 5;

const STATUS_BG: Record<string, string> = {
  Confirmado: 'bg-[#d0fcfe]',
  Aguardando: 'bg-[#e8e0ec]',
  Cancelado:  'bg-[#f97386]',
};
const STATUS_TEXT: Record<string, string> = {
  Confirmado: 'text-[#3a6264]',
  Aguardando: 'text-[#625d67]',
  Cancelado:  'text-white',
};
function getMondayISO(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

function daysUntil(isoDate: string): number {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(isoDate + 'T12:00:00');
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((d0.getTime() - t0.getTime()) / (24 * 60 * 60 * 1000));
}

function startOfMonthISO(dateIso: string) {
  const d = new Date(dateIso + 'T12:00:00');
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

function getMonthGrid(monthStartIso: string) {
  const start = new Date(monthStartIso + 'T12:00:00');
  const month = start.getMonth();

  const first = new Date(start);
  const firstWeekday = first.getDay(); // 0..6
  const lead = firstWeekday;

  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - lead);

  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }

  return { month, days };
}

function getAppointmentTimeRange(apt: Appointment) {
  return `${formatTime(apt.time_start)} - ${formatTime(apt.time_end)}`;
}

export const Agenda: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // form state
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [services, setServices]   = useState<string[]>([]);
  const [date, setDate]           = useState(todayLocalISO());
  const [timeStart, setTimeStart] = useState('09:00');
  const [saving, setSaving]         = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState('');
  const [price,          setPrice]          = useState('');
  const [emergencyRequest, setEmergencyRequest] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [shortNoticeAck, setShortNoticeAck] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => todayLocalISO());
  const [monthStart,   setMonthStart]   = useState(() => startOfMonthISO(todayLocalISO()));
  const [actionApt,    setActionApt]    = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [editApt,      setEditApt]      = useState<Appointment | null>(null);
  const [editServices, setEditServices] = useState<string[]>([]);
  const [editDate,     setEditDate]     = useState('');
  const [editTimeStart,setEditTimeStart]= useState('');
  const [editStatus,   setEditStatus]   = useState('');
  const [editSaving,   setEditSaving]   = useState(false);
  const [editPrice,    setEditPrice]    = useState('');
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [editError,    setEditError]    = useState<string | null>(null);
  const [editUrgentReason, setEditUrgentReason] = useState('');
  const [actionUrgentMode, setActionUrgentMode] = useState(false);
  const [actionUrgentReason, setActionUrgentReason] = useState('');
  const isConfirmedEdit = editApt?.status === 'Confirmado';

  function openEdit(apt: Appointment) {
    setEditApt(apt);
    setEditServices(apt.service ? apt.service.split(', ') : []);
    setEditDate(apt.date);
    setEditTimeStart(formatTime(apt.time_start));
    setEditStatus(apt.status);
    setEditPrice(apt.price != null ? String(apt.price) : '');
    setEditUrgentReason('');
  }

  async function handleEditSave() {
    if (!editApt) return;
    if (editApt.status === 'Confirmado' && editStatus !== 'Cancelado') {
      setEditError('Agendamento confirmado não pode ser editado.');
      return;
    }
    if (editServices.length === 0) { setEditError('Selecione ao menos um serviço.'); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      const options: { urgent?: boolean; reason?: string; awareShortNotice?: boolean } = {};
      if (editStatus === 'Cancelado' && daysUntil(editDate) < MIN_CANCEL_DAYS) {
        const reason = editUrgentReason.trim();
        if (reason.length < 5) {
          setEditError('Para cancelamento urgente, informe motivo com pelo menos 5 caracteres.');
          setEditSaving(false);
          return;
        }
        options.urgent = true;
        options.reason = reason;
      }
      if (editStatus === 'Confirmado' && daysUntil(editDate) < MIN_BOOK_DAYS) {
        const aware = window.confirm('Estou ciente de que este agendamento será confirmado com menos de 5 dias de antecedência. Deseja continuar?');
        if (!aware) {
          setEditSaving(false);
          return;
        }
        options.awareShortNotice = true;
      }

      const fields: Parameters<typeof updateAppointment>[1] = {
        service: editServices.join(', '),
        date: editDate,
        time_start: editTimeStart,
        time_end: computeEndTime(editTimeStart, editServices),
        status: editStatus,
      };
      if (editPrice) fields.price = parseFloat(editPrice.replace(',', '.'));
      await updateAppointment(editApt.id, fields, options);
      setEditApt(null);
    } catch (e: any) {
      setEditError(e.message ?? 'Erro ao salvar.');
    } finally {
      setEditSaving(false);
    }
  }

  const allClients     = useAllClients();
  const addAppointment = useAddAppointment();
  const { categories: serviceCategories } = useServiceCategories();
  const { appointments, loading: aptsLoading, refetch } = useAppointments(selectedDate);
  const monthIso = monthStart.slice(0, 7);
  const { appointments: monthAppointments } = useAppointmentsForMonth(monthIso);
  const filteredApts = statusFilter ? appointments.filter(a => a.status === statusFilter) : appointments;
  const shortNoticeBooking = !!date && daysUntil(date) < MIN_BOOK_DAYS;

  const monthLabel = new Date(monthStart + 'T12:00:00')
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const grid = getMonthGrid(monthStart);
  const monthMap = new Map<string, Appointment[]>();
  for (const apt of monthAppointments) {
    const list = monthMap.get(apt.date) ?? [];
    list.push(apt);
    monthMap.set(apt.date, list);
  }

  function prevMonth() {
    const d = new Date(monthStart + 'T12:00:00');
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    setMonthStart(d.toISOString().split('T')[0]);
  }
  function nextMonth() {
    const d = new Date(monthStart + 'T12:00:00');
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    setMonthStart(d.toISOString().split('T')[0]);
  }

  const filteredClients = clientSearch.trim()
    ? allClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : allClients;

  function computeEndTime(start: string, selectedServices: string[]) {
    const [h, m] = start.split(':').map(Number);
    const startMin = h * 60 + m;

    const totalDuration = selectedServices.reduce((sum, s) => {
      const cat = serviceCategories.find(c => c.name === s);
      return sum + (cat?.duration_min ?? 0);
    }, 0);

    const duration = totalDuration > 0 ? totalDuration : 60;
    const end = startMin + duration;
    const hh = String(Math.floor(end / 60)).padStart(2, '0');
    const mm = String(end % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function closeModal() {
    setIsModalOpen(false);
    setClientSearch('');
    setSelectedClient(null);
    setShowClientList(false);
    setCreatingClient(false);
    setNewClientPhone('');
    setServices([]);
    setDate(todayLocalISO());
    setTimeStart('09:00');
    setPrice('');
    setEmergencyRequest(false);
    setEmergencyReason('');
    setShortNoticeAck(false);
    setSaveError(null);
  }

  async function handleSave() {
    if (!selectedClient) { setSaveError('Selecione um cliente.'); return; }
    if (services.length === 0) { setSaveError('Selecione ao menos um serviço.'); return; }
    if (!date) { setSaveError('Informe a data.'); return; }
    if (shortNoticeBooking && !shortNoticeAck) {
      setSaveError('Marque que esta ciente para agendamento com menos de 5 dias.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const apt: Parameters<typeof addAppointment>[0] = {
        client_id: selectedClient.id,
        service: services.join(', '),
        date,
        time_start: timeStart,
        time_end: computeEndTime(timeStart, services),
        status: 'Aguardando',
      };
      if (price) apt.price = parseFloat(price.replace(',', '.'));
      await addAppointment(
        apt,
        emergencyRequest && shortNoticeBooking
          ? {
              emergency: true,
              reason: emergencyReason,
            }
          : undefined,
      );
      closeModal();
    } catch (err: any) {
      setSaveError(err.message ?? 'Erro ao salvar agendamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar title="Agenda" />
      <ScrollView className="flex-1 px-6 pt-24 pb-32">
        <MotiView 
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 700 }}
        >
          <View className="mb-10 flex-row justify-between items-end">
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-[#625d67] mb-1">Organizando o Tempo</Text>
              <Text className="text-5xl font-serif text-[#68597a] italic">Agenda</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setIsModalOpen(true)}
              className="bg-[#68597a] px-6 py-3 rounded-full flex-row items-center gap-2 shadow-lg shadow-[#68597a4d]"
            >
              <Plus size={18} color="#fff" />
              <Text className="text-white font-bold text-xs uppercase tracking-widest">Agendar</Text>
            </TouchableOpacity>
          </View>

        <View className="bg-[#f9f1fa] rounded-3xl p-6 mb-10">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-lg font-serif italic text-[#68597a] capitalize">{monthLabel}</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity onPress={prevMonth} className="p-2 bg-[#e8e0ec] rounded-full"><ChevronLeft size={18} color="#68597a" /></TouchableOpacity>
              <TouchableOpacity onPress={nextMonth} className="p-2 bg-[#e8e0ec] rounded-full"><ChevronRight size={18} color="#68597a" /></TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map(w => (
              <Text key={w} style={{ width: '14.2%', textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#625d67' }}>{w}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {grid.days.map((iso) => {
              const d = new Date(iso + 'T12:00:00');
              const isCurrentMonth = d.getMonth() === grid.month;
              const isSelected = iso === selectedDate;
              const dayApts = (monthMap.get(iso) ?? []).slice(0, 2);

              return (
                <TouchableOpacity
                  key={iso}
                  onPress={() => setSelectedDate(iso)}
                  style={{
                    width: '14.2%', minHeight: 96, padding: 4,
                    borderRadius: 10,
                    backgroundColor: isSelected ? '#68597a22' : 'transparent',
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: '#68597a55',
                  }}
                >
                  <Text style={{
                    textAlign: 'center', fontSize: 12, marginBottom: 4,
                    fontWeight: isSelected ? '700' : '500',
                    color: isCurrentMonth ? '#35313a' : '#b7afbb',
                  }}>
                    {d.getDate()}
                  </Text>
                  {dayApts.map(a => (
                    <View key={a.id} style={{ backgroundColor: '#e8e0ec', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 3 }}>
                      <Text numberOfLines={1} style={{ fontSize: 8, color: '#625d67', fontWeight: '700' }}>
                        {getAppointmentTimeRange(a)} {a.client?.name ?? '—'}
                      </Text>
                    </View>
                  ))}
                  {(monthMap.get(iso)?.length ?? 0) > 2 && (
                    <Text style={{ fontSize: 8, color: '#625d67', textAlign: 'center' }}>+{(monthMap.get(iso)?.length ?? 0) - 2}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Filtro por status */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([null, 'Aguardando', 'Confirmado', 'Cancelado'] as const).map(s => (
              <TouchableOpacity
                key={s ?? 'todos'}
                onPress={() => setStatusFilter(s)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: statusFilter === s ? '#68597a' : '#e8e0ec',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: statusFilter === s ? '#fff' : '#625d67' }}>
                  {s ?? 'Todos'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-20">
          {aptsLoading ? (
            <Text className="text-[#625d67] text-sm text-center py-8">Carregando…</Text>
          ) : filteredApts.length === 0 ? (
            <TouchableOpacity
              onPress={() => setIsModalOpen(true)}
              className="border-2 border-dashed border-[#b7afbb4d] rounded-2xl p-10 items-center justify-center mt-4"
            >
              <Plus size={20} color="#625d6766" />
              <Text className="font-bold uppercase tracking-widest text-[10px] text-[#625d6766] mt-3">Nenhum agendamento</Text>
              <Text className="text-[#625d6766] text-xs mt-1">{statusFilter ? `Nenhum com status "${statusFilter}"` : 'Toque para agendar'}</Text>
            </TouchableOpacity>
          ) : (
            filteredApts.map((apt: Appointment) => (
              <View key={apt.id} className="flex-row gap-4 mb-8">
                <View className="w-16 items-end pt-3">
                  <Text className="text-base font-serif text-[#68597a] text-right">{formatTime(apt.time_start)}</Text>
                  <Text className="text-[11px] text-[#625d67] text-right mt-1">{formatTime(apt.time_end)}</Text>
                </View>
                <View className="flex-1">
                  <View className="bg-[#e8e0ec] rounded-2xl p-5 flex-row items-center gap-4">
                    <TouchableOpacity
                      onPress={() => openEdit(apt)}
                      className="flex-1 flex-row items-center gap-4"
                    >
                      <View className="w-14 h-14 rounded-xl bg-[#d0c5dc] items-center justify-center" style={{ minWidth: 56 }}>
                        <Text className="text-2xl font-serif text-[#68597a]">{apt.client?.name?.[0] ?? '?'}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-serif text-[#35313a]">{apt.client?.name ?? '—'}</Text>
                        <Text className="text-[#625d67] text-xs" numberOfLines={1}>{apt.service}</Text>
                        <Text className="text-[#68597a] text-xs font-bold mt-1">{getAppointmentTimeRange(apt)}</Text>
                        <View className="flex-row flex-wrap gap-2 mt-2">
                          <View className={`px-2 py-0.5 rounded-full ${STATUS_BG[apt.status] ?? 'bg-[#e8e0ec]'}`}>
                            <Text className={`text-[7px] font-bold uppercase tracking-widest ${STATUS_TEXT[apt.status] ?? 'text-[#625d67]'}`}>
                              {apt.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActionApt(apt)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={{ padding: 4 }}
                    >
                      <MoreVertical size={20} color="#68597a" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </MotiView>

      <Modal
        visible={isModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(53,49,58,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fef7fe', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%' }}>
            {/* Header */}
            <View className="px-8 py-6 flex-row justify-between items-center border-b border-[#b7afbb26]">
              <Text className="text-2xl font-serif text-[#68597a] italic">Novo Agendamento</Text>
              <TouchableOpacity onPress={closeModal}><X size={24} color="#625d67" /></TouchableOpacity>
            </View>

            <ScrollView className="px-8 pt-6 pb-10" keyboardShouldPersistTaps="handled">

              {/* Cliente */}
              <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2">Cliente *</Text>
              {selectedClient ? (
                <TouchableOpacity
                  onPress={() => { setSelectedClient(null); setShowClientList(false); }}
                  className="bg-[#68597a] rounded-2xl px-4 py-4 flex-row items-center justify-between mb-6"
                >
                  <Text className="text-white font-bold">{selectedClient.name}</Text>
                  <X size={16} color="white" />
                </TouchableOpacity>
              ) : (
                <View className="mb-2">
                  <View className="flex-row items-center bg-[#e8e0ec] rounded-2xl px-4 mb-2">
                    <User size={16} color="#625d6766" />
                    <TextInput
                      value={clientSearch}
                      onChangeText={setClientSearch}
                      placeholder="Nome do cliente..."
                      placeholderTextColor="#625d6766"
                      className="flex-1 py-4 pl-3 text-[#35313a]"
                    />
                    <TouchableOpacity
                      onPress={() => setShowClientList(v => !v)}
                      className="py-2 px-3 bg-[#68597a] rounded-xl"
                    >
                      <Text className="text-white text-xs font-bold">Buscar</Text>
                    </TouchableOpacity>
                  </View>
                  {showClientList && (
                    <View className="bg-white rounded-2xl border border-[#e8e0ec] mb-4" style={{ maxHeight: 220 }}>
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredClients.map(c => (
                          <TouchableOpacity
                            key={c.id}
                            onPress={() => { setSelectedClient(c); setClientSearch(''); setShowClientList(false); setCreatingClient(false); }}
                            className="px-4 py-3 border-b border-[#e8e0ec4d]"
                          >
                            <Text className="text-[#35313a] text-sm">{c.name}</Text>
                          </TouchableOpacity>
                        ))}

                        {/* Cadastrar novo cliente */}
                        {!creatingClient ? (
                          <TouchableOpacity
                            onPress={() => setCreatingClient(true)}
                            className="px-4 py-3 flex-row items-center gap-2"
                          >
                            <Plus size={14} color="#68597a" />
                            <Text className="text-[#68597a] text-sm font-semibold">
                              {clientSearch.trim() ? `Cadastrar "${clientSearch.trim()}"` : 'Cadastrar novo cliente'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View className="px-4 py-3 border-t border-[#e8e0ec]">
                            <Text className="text-xs font-bold uppercase tracking-widest text-[#625d67] mb-2">Novo cliente</Text>
                            <TextInput
                              value={clientSearch}
                              onChangeText={setClientSearch}
                              placeholder="Nome *"
                              placeholderTextColor="#625d6766"
                              className="bg-[#e8e0ec] rounded-xl px-3 py-2 text-[#35313a] text-sm mb-2"
                            />
                            <TextInput
                              value={newClientPhone}
                              onChangeText={v => setNewClientPhone(maskPhone(v))}
                              placeholder="Telefone (opcional)"
                              placeholderTextColor="#625d6766"
                              className="bg-[#e8e0ec] rounded-xl px-3 py-2 text-[#35313a] text-sm mb-3"
                            />
                            <View className="flex-row gap-2">
                              <TouchableOpacity
                                onPress={() => setCreatingClient(false)}
                                className="flex-1 bg-[#e8e0ec] rounded-xl py-2 items-center"
                              >
                                <Text className="text-[#625d67] text-xs font-bold">Cancelar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={async () => {
                                  const name = clientSearch.trim();
                                  if (!name) return;
                                  if (newClientPhone.trim() && !isValidPhone(newClientPhone)) { Alert.alert('Erro', PHONE_ERROR); return; }
                                  try {
                                    const created = await addClient({ name, phone: newClientPhone.trim() || null });
                                    setSelectedClient(created);
                                    setShowClientList(false);
                                    setCreatingClient(false);
                                    setClientSearch('');
                                    setNewClientPhone('');
                                  } catch (e: any) {
                                    Alert.alert('Erro', e.message);
                                  }
                                }}
                                className="flex-1 bg-[#68597a] rounded-xl py-2 items-center"
                              >
                                <Text className="text-white text-xs font-bold">Cadastrar</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Serviço */}
              <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2 mt-2">Serviço *</Text>
              {serviceCategories.filter(c => c.status === 'active').length > 0 ? (
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {serviceCategories.filter(c => c.status === 'active').map(cat => {
                    const selected = services.includes(cat.name);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setServices(prev =>
                          prev.includes(cat.name)
                            ? prev.filter(s => s !== cat.name)
                            : [...prev, cat.name]
                        )}
                        className={`px-4 py-3 rounded-2xl border ${
                          selected ? 'bg-[#68597a] border-[#68597a]' : 'bg-[#e8e0ec] border-transparent'
                        }`}
                      >
                        <View className="flex-row items-center gap-1.5">
                          {selected && <Check size={12} color="white" />}
                          <Text className={`text-sm font-semibold ${
                            selected ? 'text-white' : 'text-[#35313a]'
                          }`}>{cat.name}</Text>
                        </View>
                        {cat.price != null && (
                          <Text className={`text-[10px] mt-0.5 ${
                            selected ? 'text-white/80' : 'text-[#625d67]'
                          }`}>R$ {cat.price.toFixed(2).replace('.', ',')}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  value={services.join(', ')}
                  onChangeText={v => setServices(v ? [v] : [])}
                  placeholder="Ex: Coloração, Corte, Escova…"
                  placeholderTextColor="#625d6766"
                  className="bg-[#e8e0ec] rounded-2xl px-4 py-4 text-[#35313a] mb-6"
                />
              )}

              {/* Valor do Serviço */}
              <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2 mt-2">Valor do Serviço</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8e0ec', borderRadius: 16, paddingHorizontal: 16, marginBottom: 24 }}>
                <Text style={{ color: '#625d67', fontSize: 13 }}>R$</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0,00 (opcional)"
                  placeholderTextColor="#625d6766"
                  keyboardType="decimal-pad"
                  style={{ flex: 1, paddingVertical: 14, paddingLeft: 8, color: '#35313a', fontSize: 14 }}
                />
              </View>

              {/* Data */}
              <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2">Data *</Text>
              <input
                type="date"
                value={date}
                onChange={(e: any) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  if (daysUntil(nextDate) >= MIN_BOOK_DAYS) {
                    setShortNoticeAck(false);
                    setEmergencyRequest(false);
                    setEmergencyReason('');
                  }
                }}
                style={{
                  background: '#e8e0ec', borderRadius: 16, padding: '14px 16px',
                  color: '#35313a', border: 'none', width: '100%',
                  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 24,
                }}
              />

              {/* Horários */}
              <View className="mb-8">
                <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2">Início</Text>
                <input
                  type="time"
                  value={timeStart}
                  onChange={(e: any) => setTimeStart(e.target.value)}
                  style={{
                    background: '#e8e0ec', borderRadius: 16, padding: '14px 16px',
                    color: '#35313a', border: 'none', width: '100%',
                    fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
                <Text className="text-xs text-[#625d67] mt-2">
                  Término automático: {computeEndTime(timeStart, services)}
                </Text>
              </View>

              {/* Botões */}
              {saveError && (
                <Text style={{ color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12, padding: 10, marginBottom: 12, fontSize: 13, textAlign: 'center' }}>{saveError}</Text>
              )}

              {shortNoticeBooking && (
                <View style={{ marginBottom: 14, backgroundColor: '#fff3e8', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f1d0b4' }}>
                  <Text style={{ color: '#7a4a27', fontSize: 11, marginTop: 0, marginBottom: 8 }}>
                    Esta data e menor que {MIN_BOOK_DAYS} dias. Para seguir, solicite emergencia e informe o motivo.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShortNoticeAck(v => !v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: '#7a4a27',
                        backgroundColor: shortNoticeAck ? '#7a4a27' : '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {shortNoticeAck && <Check size={10} color="#fff" />}
                    </View>
                    <Text style={{ color: '#7a4a27', fontWeight: '700', fontSize: 13 }}>
                      Estou ciente
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => shortNoticeAck && setEmergencyRequest(v => !v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: '#7a4a27',
                        backgroundColor: emergencyRequest && shortNoticeAck ? '#7a4a27' : '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {emergencyRequest && shortNoticeAck && <Check size={10} color="#fff" />}
                    </View>
                    <Text style={{ color: shortNoticeAck ? '#7a4a27' : '#a68c74', fontWeight: '700', fontSize: 13 }}>
                      Solicitar agendamento de emergencia
                    </Text>
                  </TouchableOpacity>

                  {emergencyRequest && shortNoticeAck && (
                    <>
                      <Text style={{ color: '#7a4a27', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, marginTop: 12 }}>
                        Motivo da emergencia
                      </Text>
                      <TextInput
                        value={emergencyReason}
                        onChangeText={setEmergencyReason}
                        placeholder="Descreva o motivo urgente"
                        placeholderTextColor="#625d6766"
                        multiline
                        numberOfLines={3}
                        style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, color: '#35313a', fontSize: 13, minHeight: 78, textAlignVertical: 'top' }}
                      />
                    </>
                  )}
                </View>
              )}

              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={closeModal}
                  className="flex-1 py-4 rounded-full border border-[#68597a4d] items-center"
                >
                  <Text className="text-[#68597a] font-bold text-sm">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  className={`flex-1 py-4 rounded-full items-center ${saving ? 'bg-[#68597a80]' : 'bg-[#68597a]'}`}
                >
                  <Text className="text-white font-bold text-sm">{saving ? 'Salvando…' : 'Confirmar'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal
        visible={!!editApt}
        transparent
        animationType="slide"
        onRequestClose={() => setEditApt(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(53,49,58,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fef7fe', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%' }}>
            <View className="px-8 py-6 flex-row justify-between items-center border-b border-[#b7afbb26]">
              <View>
                <Text className="text-2xl font-serif text-[#68597a] italic">Editar Agendamento</Text>
                <Text className="text-xs text-[#625d67] mt-0.5">{editApt?.client?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditApt(null)}><X size={24} color="#625d67" /></TouchableOpacity>
            </View>

            <ScrollView className="px-8 pt-6 pb-10" keyboardShouldPersistTaps="handled">

              {/* Status */}
              <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-3">Status</Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {(['Aguardando', 'Confirmado', 'Cancelado'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setEditStatus(s)}
                    className={`px-4 py-3 rounded-2xl ${
                      editStatus === s ? 'bg-[#68597a]' : 'bg-[#e8e0ec]'
                    }`}
                  >
                    <View className="flex-row items-center gap-1.5">
                      {editStatus === s && <Check size={12} color="white" />}
                      <Text className={`text-sm font-semibold ${
                        editStatus === s ? 'text-white' : 'text-[#35313a]'
                      }`}>{s}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Serviço */}
              <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-3">Serviço *</Text>
              {serviceCategories.filter(c => c.status === 'active').length > 0 ? (
                <View className={`flex-row flex-wrap gap-2 mb-6 ${isConfirmedEdit ? 'opacity-50' : ''}`}>
                  {serviceCategories.filter(c => c.status === 'active').map(cat => {
                    const sel = editServices.includes(cat.name);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        disabled={!!isConfirmedEdit}
                        onPress={() => setEditServices(prev =>
                          prev.includes(cat.name) ? prev.filter(s => s !== cat.name) : [...prev, cat.name]
                        )}
                        className={`px-4 py-3 rounded-2xl border ${
                          sel ? 'bg-[#68597a] border-[#68597a]' : 'bg-[#e8e0ec] border-transparent'
                        }`}
                      >
                        <View className="flex-row items-center gap-1.5">
                          {sel && <Check size={12} color="white" />}
                          <Text className={`text-sm font-semibold ${sel ? 'text-white' : 'text-[#35313a]'}`}>{cat.name}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  value={editServices.join(', ')}
                  onChangeText={v => setEditServices(v ? [v] : [])}
                  placeholder="Ex: Coloração, Corte…"
                  placeholderTextColor="#625d6766"
                  editable={!isConfirmedEdit}
                  className="bg-[#e8e0ec] rounded-2xl px-4 py-4 text-[#35313a] mb-6"
                />
              )}

              {/* Valor do Serviço */}
              <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2 mt-2">Valor do Serviço</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8e0ec', borderRadius: 16, paddingHorizontal: 16, marginBottom: 24, opacity: isConfirmedEdit ? 0.5 : 1 }}>
                <Text style={{ color: '#625d67', fontSize: 13 }}>R$</Text>
                <TextInput
                  value={editPrice}
                  onChangeText={setEditPrice}
                  placeholder="0,00 (opcional)"
                  placeholderTextColor="#625d6766"
                  keyboardType="decimal-pad"
                  editable={!isConfirmedEdit}
                  style={{ flex: 1, paddingVertical: 14, paddingLeft: 8, color: '#35313a', fontSize: 14 }}
                />
              </View>

              {/* Data */}
              <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2">Data *</Text>
              <input
                type="date"
                value={editDate}
                onChange={(e: any) => setEditDate(e.target.value)}
                disabled={!!isConfirmedEdit}
                style={{
                  background: '#e8e0ec', borderRadius: 16, padding: '14px 16px',
                  color: '#35313a', border: 'none', width: '100%',
                  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 24,
                  opacity: isConfirmedEdit ? 0.5 : 1,
                }}
              />

              {/* Horários */}
              <View className="mb-8">
                <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2">Início</Text>
                <input
                  type="time"
                  value={editTimeStart}
                  onChange={(e: any) => setEditTimeStart(e.target.value)}
                  disabled={!!isConfirmedEdit}
                  style={{
                    background: '#e8e0ec', borderRadius: 16, padding: '14px 16px',
                    color: '#35313a', border: 'none', width: '100%',
                    fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
                    opacity: isConfirmedEdit ? 0.5 : 1,
                  }}
                />
                <Text className="text-xs text-[#625d67] mt-2">
                  Término automático: {computeEndTime(editTimeStart, editServices)}
                </Text>
              </View>

              {isConfirmedEdit && (
                <Text style={{ color: '#625d67', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
                  Agendamento confirmado: campos bloqueados. Apenas cancelamento e permitido.
                </Text>
              )}

              {editError && (
                <Text style={{ color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12, padding: 10, marginBottom: 12, fontSize: 13, textAlign: 'center' }}>{editError}</Text>
              )}
              {editStatus === 'Cancelado' && daysUntil(editDate) < MIN_CANCEL_DAYS && (
                <View style={{ backgroundColor: '#ffedec', borderRadius: 12, padding: 10, marginBottom: 12 }}>
                  <Text style={{ color: '#ba1a1a', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                    Cancelamento urgente (menos de {MIN_CANCEL_DAYS} dias)
                  </Text>
                  <TextInput
                    value={editUrgentReason}
                    onChangeText={setEditUrgentReason}
                    placeholder="Informe o motivo urgente"
                    placeholderTextColor="#625d6766"
                    style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, color: '#35313a', fontSize: 13 }}
                  />
                </View>
              )}
              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={() => setEditApt(null)}
                  className="flex-1 py-4 rounded-full border border-[#68597a4d] items-center"
                >
                  <Text className="text-[#68597a] font-bold text-sm">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEditSave}
                  disabled={editSaving}
                  className={`flex-1 py-4 rounded-full items-center ${editSaving ? 'bg-[#68597a80]' : 'bg-[#68597a]'}`}
                >
                  <Text className="text-white font-bold text-sm">{editSaving ? 'Salvando…' : 'Salvar'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Action sheet */}
      <Modal
        visible={!!actionApt}
        transparent
        animationType="slide"
        onRequestClose={() => setActionApt(null)}
      >
        {/* Backdrop e conteúdo como irmãos para evitar bubble de eventos */}
        <View style={{ flex: 1 }}>
          {/* Backdrop – toca fora para fechar */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(53,49,58,0.5)' }}
            onPress={() => setActionApt(null)}
          />
          {/* Sheet – irmão do backdrop, cliques não chegam ao backdrop */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fef7fe', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32 }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#35313a', marginBottom: 4 }}>{actionApt?.client?.name}</Text>
            <Text style={{ fontSize: 12, color: '#625d67', marginBottom: 24 }}>{actionApt?.service} • {formatTime(actionApt?.time_start)} – {formatTime(actionApt?.time_end)}</Text>

            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#625d67', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Alterar status</Text>
            {(['Aguardando', 'Confirmado', 'Cancelado'] as const).map(s => (
              <TouchableOpacity
                key={s}
                onPress={async () => {
                  if (!actionApt) return;
                  const aptId = actionApt.id;
                  try {
                    if (s === 'Cancelado' && daysUntil(actionApt.date) < MIN_CANCEL_DAYS) {
                      setActionUrgentMode(true);
                      return;
                    } else if (s === 'Confirmado' && daysUntil(actionApt.date) < MIN_BOOK_DAYS) {
                      const aware = window.confirm('Estou ciente de que este agendamento será confirmado com menos de 5 dias de antecedência. Deseja continuar?');
                      if (!aware) return;
                      await updateAppointmentStatus(aptId, s, { awareShortNotice: true });
                    } else {
                      await updateAppointmentStatus(aptId, s);
                    }
                    setActionApt(null);
                    refetch();
                  } catch (err: any) {
                    window.alert('Erro ao alterar status: ' + (err?.message ?? String(err)));
                  }
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16, marginBottom: 8,
                  backgroundColor: actionApt?.status === s ? '#68597a' : '#e8e0ec',
                }}
              >
                <Text style={{ fontWeight: '600', fontSize: 14, color: actionApt?.status === s ? '#fff' : '#35313a' }}>{s}</Text>
                {actionApt?.status === s && <Check size={16} color="white" />}
              </TouchableOpacity>
            ))}

            {actionUrgentMode && (
              <View style={{ backgroundColor: '#ffedec', borderRadius: 12, padding: 10, marginTop: 8 }}>
                <Text style={{ color: '#ba1a1a', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                  Cancelamento urgente (menos de {MIN_CANCEL_DAYS} dias)
                </Text>
                <TextInput
                  value={actionUrgentReason}
                  onChangeText={setActionUrgentReason}
                  placeholder="Informe o motivo urgente"
                  placeholderTextColor="#625d6766"
                  style={{ backgroundColor: '#fff', borderRadius: 10, padding: 10, color: '#35313a', fontSize: 13 }}
                />
                <TouchableOpacity
                  onPress={async () => {
                    if (!actionApt) return;
                    try {
                      await updateAppointmentStatus(actionApt.id, 'Cancelado', { urgent: true, reason: actionUrgentReason });
                      setActionApt(null);
                      setActionUrgentMode(false);
                      setActionUrgentReason('');
                      refetch();
                    } catch (err: any) {
                      window.alert('Erro ao cancelar: ' + (err?.message ?? String(err)));
                    }
                  }}
                  style={{ marginTop: 8, backgroundColor: '#ba1a1a', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Confirmar cancelamento urgente</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={() => { setActionApt(null); setActionUrgentMode(false); setActionUrgentReason(''); }}
              style={{ marginTop: 12, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#625d67', fontWeight: 'bold', fontSize: 14 }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
};
