import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput } from 'react-native';
import { TrendingUp, Users, MoreVertical, Plus, X, Check, MessageCircle } from 'lucide-react-native';
import { MotiView } from 'moti';
import { TopBar } from '../components/TopBar';
import { navigationRef } from '../lib/navigationRef';
import { useAuth } from '../lib/AuthContext';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';
import { useAppointmentsForWeek, updateAppointmentStatus, updateAppointment } from '../lib/hooks/useAppointments';
import { useDashboardStats } from '../lib/hooks/useDashboardStats';
import { useServiceCategories } from '../lib/hooks/useServiceCategories';
import { useClients } from '../lib/hooks/useClients';
import type { Appointment } from '../lib/types';
import { formatTime } from '../lib/utils';

// Maps an appointment status to its Tailwind colour classes
const STATUS_COLORS: Record<string, string> = {
  Confirmado: 'bg-[#d0fcfe] text-[#3a6264]',
  Aguardando: 'bg-[#e8e0ec] text-[#625d67]',
  Cancelado:  'bg-[#f97386] text-white',
};

const MIN_CANCEL_DAYS = 5;
const MIN_BOOK_DAYS = 5;

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Normalises any Brazilian phone string to the international E.164 digits
 * expected by wa.me (e.g. "5511999999999").
 * Handles: +55…, 0055…, 55…, (11) 9…, 9… (no DDD), etc.
 */
function toWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Already has country code
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  // Has leading 00 country code
  if (digits.startsWith('0055')) return digits.slice(2);
  // Local number: prepend Brazil country code
  return '55' + digits;
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

function daysUntil(isoDate: string): number {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(isoDate + 'T12:00:00');
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((d0.getTime() - t0.getTime()) / (24 * 60 * 60 * 1000));
}

function parseBirthDate(value?: string | null): { month: number; day: number } | null {
  if (!value) return null;
  const v = value.trim();

  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return { day: Number(br[1]), month: Number(br[2]) };
  }

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return { day: Number(iso[3]), month: Number(iso[2]) };
  }

  return null;
}

export const Dashboard: React.FC = () => {
  const { appointments, loading: aptsLoading, refetch } = useAppointmentsForWeek();
  const { stats, loading: statsLoading }                = useDashboardStats();
  const { categories: serviceCategories }               = useServiceCategories();
  const { clients, loading: clientsLoading }            = useClients();

  const { user } = useAuth();
  const { salonName } = useSalonSettings();
  const firstName = (user?.user_metadata?.full_name as string | undefined)
    ?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'você';
  const gender    = user?.user_metadata?.gender as string | undefined;
  const greeting  = gender === 'M' ? 'Bem-vindo' : 'Bem-vinda';

  const loading = aptsLoading || statsLoading;
  const currentMonth = new Date().getMonth() + 1;
  const birthdaysThisMonth = clients
    .map(c => {
      const birth = parseBirthDate(c.birth_date ?? null);
      return { client: c, birth };
    })
    .filter(item => item.birth && item.birth.month === currentMonth)
    .sort((a, b) => (a.birth!.day - b.birth!.day));

  const [actionApt,    setActionApt]    = useState<Appointment | null>(null);
  const [editApt,      setEditApt]      = useState<Appointment | null>(null);
  const [editServices, setEditServices] = useState<string[]>([]);
  const [editDate,     setEditDate]     = useState('');
  const [editTimeStart,setEditTimeStart]= useState('');
  const [editTimeEnd,  setEditTimeEnd]  = useState('');
  const [editStatus,   setEditStatus]   = useState('');
  const [editSaving,   setEditSaving]   = useState(false);
  const [editPrice,    setEditPrice]    = useState('');
  const [editError,    setEditError]    = useState<string | null>(null);
  const isConfirmedEdit = editApt?.status === 'Confirmado';

  function openEdit(apt: Appointment) {
    setEditApt(apt);
    setEditServices(apt.service ? apt.service.split(', ') : []);
    setEditDate(apt.date);
    setEditTimeStart(formatTime(apt.time_start));
    setEditTimeEnd(formatTime(apt.time_end));
    setEditStatus(apt.status);
    setEditPrice(apt.price != null ? String(apt.price) : '');
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
        const reason = window.prompt('Cancelamento com menos de 5 dias: informe o motivo urgente.');
        if (!reason) { setEditSaving(false); return; }
        options.urgent = true;
        options.reason = reason;
      }
      if (editStatus === 'Confirmado' && daysUntil(editDate) < MIN_BOOK_DAYS) {
        const aware = window.confirm('Estou ciente de que este agendamento será confirmado com menos de 5 dias de antecedência. Deseja continuar?');
        if (!aware) { setEditSaving(false); return; }
        options.awareShortNotice = true;
      }

      const fields: Parameters<typeof updateAppointment>[1] = {
        service: editServices.join(', '),
        date: editDate,
        time_start: editTimeStart,
        time_end: editTimeEnd,
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

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar />
      <ScrollView className="flex-1 px-6 pt-24 pb-32">
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 700 }}
        >
          <View className="mb-10">
            <Text className="text-4xl font-serif text-[#68597a] mb-2 italic">{greeting}, {firstName}</Text>
            <Text className="text-[#625d67] font-medium tracking-wide">
              Sua curadoria para hoje, {todayLabel()}.
            </Text>
          </View>

          {/* ── Summary cards ─────────────────────────────────────────────── */}
          <View className="flex-row flex-wrap gap-4 mb-10">
            {/* Ganhos do Dia */}
            <TouchableOpacity
              onPress={() => navigationRef.navigate('Financeiro' as never)}
              className="bg-[#e8e0ec] p-6 rounded-[32px] justify-between"
              style={{ flex: 1, minWidth: 140, minHeight: 160 }}
            >
              <Text className="text-[10px] font-bold uppercase tracking-widest text-[#625d67]">Ganhos do Dia</Text>
              <View>
                <Text className="text-xs font-serif text-[#68597a]">R$</Text>
                <Text className="text-3xl font-serif text-[#68597a]">
                  {loading ? '—' : formatBRL(stats.dailyRevenue)}
                </Text>
              </View>
              <View className="flex-row items-center">
                <TrendingUp size={12} color="#3d6668" />
                <Text className="text-[9px] font-bold text-[#3d6668] ml-1" numberOfLines={1}>
                  {loading ? '' : `${stats.dailyGrowthPct >= 0 ? '+' : ''}${stats.dailyGrowthPct}% vs. ontem`}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Total de Clientes */}
            <TouchableOpacity
              onPress={() => navigationRef.navigate('Clientes' as never)}
              className="bg-[#e1cdf4] p-6 rounded-[32px] justify-between"
              style={{ flex: 1, minWidth: 140, minHeight: 160 }}
            >
              <Text className="text-[10px] font-bold uppercase tracking-widest text-[#524362]">Clientes</Text>
              <Text className="text-3xl font-serif text-[#524362]">
                {loading ? '—' : stats.totalClients}
              </Text>
              <View className="flex-row items-center">
                <Users size={12} color="#524362" />
                <Text className="text-[9px] font-bold text-[#524362] ml-1" numberOfLines={1}>
                  {loading ? '' : `+${stats.newClientsThisWeek} esta semana`}
                </Text>
              </View>
            </TouchableOpacity>

          </View>

          {/* ── Appointments list ──────────────────────────────────────────── */}
          <View className="mb-8 flex-row justify-between items-end">
            <Text className="text-2xl font-serif text-[#35313a]">Agendamentos da Semana</Text>
            <TouchableOpacity onPress={() => navigationRef.navigate('Agenda' as never)}>
              <Text className="text-[#68597a] font-bold text-xs underline">Ver Agenda</Text>
            </TouchableOpacity>
          </View>

          <View className="mb-20">
            {loading && (
              <Text className="text-[#625d67] text-sm text-center py-8">Carregando…</Text>
            )}
            {!loading && appointments.length === 0 && (
              <Text className="text-[#625d67] text-sm text-center py-8">Nenhum agendamento para esta semana.</Text>
            )}
            {appointments.map((apt: Appointment) => {
              const colorClass = STATUS_COLORS[apt.status] ?? STATUS_COLORS.Aguardando;
              const [bgColor, textColor] = colorClass.split(' ');
              const timeLabel = `${formatTime(apt.time_start)} - ${formatTime(apt.time_end)}`;
              const dateLabel = new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
              });
              return (
                <View
                  key={apt.id}
                  className="bg-[#f9f1fa] rounded-2xl p-4 flex-row items-center justify-between mb-4"
                >
                  <TouchableOpacity onPress={() => openEdit(apt)} className="flex-row items-center flex-1">
                    {apt.client?.avatar_url ? (
                      <Image
                        source={{ uri: apt.client.avatar_url }}
                        className="w-14 h-14 rounded-full mr-4"
                      />
                    ) : (
                      <View className="w-14 h-14 rounded-full bg-[#e8e0ec] mr-4 items-center justify-center">
                        <Text className="text-xl font-serif text-[#68597a]">
                          {apt.client?.name?.[0] ?? '?'}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold uppercase tracking-widest text-[#625d67] mb-1">
                        {dateLabel} · {timeLabel}
                      </Text>
                      <Text className="text-lg font-serif text-[#35313a]">{apt.client?.name}</Text>
                      <Text className="text-xs text-[#625d67]" numberOfLines={1}>{apt.service}</Text>
                      {apt.price != null && (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#3a6264', marginTop: 2 }}>
                          R$ {apt.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <View className="items-end">
                    <View className={`px-3 py-1 rounded-full ${bgColor}`}>
                      <Text className={`text-[8px] font-bold uppercase tracking-wider ${textColor}`}>
                        {apt.status}
                      </Text>
                    </View>
                    {apt.client?.phone ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          (e as any).stopPropagation?.();
                          const waNumber = toWhatsappNumber(apt.client!.phone!);
                          const dateFormatted = new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
                          const msg = encodeURIComponent(
                            `Olá ${apt.client!.name}! 💜 Lembrando do seu agendamento no ${salonName}:\n` +
                            `📅 ${dateFormatted} às ${formatTime(apt.time_start)}\n` +
                            `✂️ ${apt.service}\n\nQualquer dúvida, estamos à disposição!`
                          );
                          window.open(`https://wa.me/${waNumber}?text=${msg}`, '_blank');
                        }}
                        style={{ marginTop: 8, backgroundColor: '#25D366', borderRadius: 20, padding: 6 }}
                        accessibilityLabel={`WhatsApp: ${apt.client.phone}`}
                      >
                        <MessageCircle size={14} color="#fff" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={(e) => {
                          (e as any).stopPropagation?.();
                          openEdit(apt);
                        }}
                        style={{ marginTop: 8, backgroundColor: '#e8e0ec', borderRadius: 20, padding: 6 }}
                        accessibilityLabel="Sem telefone — edite o cliente para adicionar"
                      >
                        <MessageCircle size={14} color="#625d67" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setActionApt(apt)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      className="mt-2"
                    >
                      <MoreVertical size={20} color="#625d67" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── Birthdays ───────────────────────────────────────────────── */}
          <View className="mb-8 bg-[#fff7d6] rounded-[24px] p-5">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-[#644f00] mb-2">
              Aniversariantes do mês
            </Text>
            {clientsLoading ? (
              <Text className="text-[#644f00] text-sm">Carregando…</Text>
            ) : birthdaysThisMonth.length === 0 ? (
              <Text className="text-[#644f00] text-sm">Nenhum aniversariante este mês.</Text>
            ) : (
              birthdaysThisMonth.slice(0, 6).map(({ client, birth }) => (
                <View key={client.id} className="flex-row items-center justify-between py-2">
                  <Text className="text-[#35313a] font-medium">{client.name}</Text>
                  <Text className="text-[#644f00] font-bold text-xs">{String(birth!.day).padStart(2, '0')}/{String(birth!.month).padStart(2, '0')}</Text>
                </View>
              ))
            )}
          </View>
        </MotiView>

        <TouchableOpacity
          onPress={() => navigationRef.navigate('Agenda' as never)}
          className="absolute bottom-10 right-6 w-14 h-14 rounded-full bg-[#68597a] items-center justify-center shadow-lg shadow-[#68597a4d]">
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </ScrollView>

      {/* ── Action sheet ──────────────────────────────────────────────────── */}
      <Modal visible={!!actionApt} transparent animationType="slide" onRequestClose={() => setActionApt(null)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(53,49,58,0.5)' }}
            onPress={() => setActionApt(null)}
          />
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
                      const reason = window.prompt('Cancelamento com menos de 5 dias: informe o motivo urgente.');
                      if (!reason) return;
                      await updateAppointmentStatus(aptId, s, { urgent: true, reason });
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

            <TouchableOpacity
              onPress={() => {
                const apt = actionApt;
                setActionApt(null);
                if (!apt) return;
                if (apt.status === 'Confirmado') {
                  window.alert('Agendamento confirmado não pode ser editado.');
                  return;
                }
                openEdit(apt);
              }}
              style={{ marginTop: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: '#e8e0ec', alignItems: 'center', opacity: actionApt?.status === 'Confirmado' ? 0.5 : 1 }}
            >
              <Text style={{ color: '#35313a', fontWeight: 'bold', fontSize: 14 }}>Editar agendamento</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActionApt(null)}
              style={{ marginTop: 12, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#625d67', fontWeight: 'bold', fontSize: 14 }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      <Modal visible={!!editApt} transparent animationType="slide" onRequestClose={() => setEditApt(null)}>
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
                    className={`px-4 py-3 rounded-2xl ${editStatus === s ? 'bg-[#68597a]' : 'bg-[#e8e0ec]'}`}
                  >
                    <View className="flex-row items-center gap-1.5">
                      {editStatus === s && <Check size={12} color="white" />}
                      <Text className={`text-sm font-semibold ${editStatus === s ? 'text-white' : 'text-[#35313a]'}`}>{s}</Text>
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
                        className={`px-4 py-3 rounded-2xl border ${sel ? 'bg-[#68597a] border-[#68597a]' : 'bg-[#e8e0ec] border-transparent'}`}
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
              <View className="flex-row gap-4 mb-8">
                <View className="flex-1">
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
                </View>
                <View className="flex-1">
                  <Text className="uppercase tracking-widest text-[10px] font-bold text-[#625d67] mb-2">Término</Text>
                  <input
                    type="time"
                    value={editTimeEnd}
                    onChange={(e: any) => setEditTimeEnd(e.target.value)}
                    disabled={!!isConfirmedEdit}
                    style={{
                      background: '#e8e0ec', borderRadius: 16, padding: '14px 16px',
                      color: '#35313a', border: 'none', width: '100%',
                      fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
                      opacity: isConfirmedEdit ? 0.5 : 1,
                    }}
                  />
                </View>
              </View>

              {isConfirmedEdit && (
                <Text style={{ color: '#625d67', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
                  Agendamento confirmado: campos bloqueados. Apenas cancelamento e permitido.
                </Text>
              )}

              {editError && (
                <Text style={{ color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12, padding: 10, marginBottom: 12, fontSize: 13, textAlign: 'center' }}>{editError}</Text>
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
    </View>
  );
};
