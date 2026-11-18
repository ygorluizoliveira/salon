import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MessageSquare, Mail, Calendar, Send } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { TopBar } from '../components/TopBar';
import { supabase } from '../lib/supabase';
import { todayLocalISO, formatTime } from '../lib/utils';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';

type Channel = 'whatsapp' | 'sms' | 'email';

interface ReminderAppointment {
  id: string;
  client_id: string;
  service: string;
  date: string;
  time_start: string;
  client: { id: string; name: string; phone: string | null; email: string | null } | null;
}

const CHANNELS: { key: Channel; label: string; Icon: typeof Mail }[] = [
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageSquare },
  { key: 'sms',      label: 'SMS',      Icon: Send },
  { key: 'email',    label: 'E-mail',   Icon: Mail },
];

function formatDateBR(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function buildMessage(apt: ReminderAppointment, salonName: string) {
  const first = apt.client?.name?.split(' ')[0] ?? '';
  return `Olá ${first}, confirmamos seu horário de ${apt.service} em ${formatDateBR(apt.date)} às ${formatTime(apt.time_start)} no ${salonName}. Mal podemos esperar para recebê-la!`;
}

function toWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 11 ? `55${digits}` : digits;
}

const EMAIL_ERRORS: Record<number, string> = {
  400: 'Requisição inválida ao enviar o e-mail.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Sem permissão para enviar e-mails.',
  409: 'Este lembrete já foi enviado.',
  422: 'A cliente não possui e-mail cadastrado.',
  502: 'Falha no provedor de e-mail. Tente reenviar.',
};

// Returns a PT error message, or null on success.
async function sendEmailReminder(reminderId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('send-reminder', { body: { reminder_id: reminderId } });
  if (!error) return data?.ok === false ? (data.error ?? 'Falha ao enviar o e-mail.') : null;
  const res = (error as any).context as Response | undefined;
  if (res && typeof res.status === 'number') {
    return EMAIL_ERRORS[res.status] ?? 'Falha ao enviar o e-mail. Tente reenviar.';
  }
  return 'Não foi possível contatar o servidor de e-mail. Tente reenviar.';
}

export const SendReminder: React.FC = () => {
  const navigation = useNavigation();
  const { salonName } = useSalonSettings();
  const [appointments, setAppointments] = useState<ReminderAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('appointments')
      .select('id, client_id, service, date, time_start, client:clients(id, name, phone, email)')
      .gte('date', todayLocalISO())
      .neq('status', 'Cancelado')
      .order('date', { ascending: true })
      .order('time_start', { ascending: true })
      .limit(50)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setAppointments((data as unknown as ReminderAppointment[]) ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const selected = appointments.find(a => a.id === selectedId) ?? null;

  function selectAppointment(apt: ReminderAppointment) {
    setSelectedId(apt.id);
    setFailedId(null);
    setMessage(buildMessage(apt, salonName));
    setError(null);
    setSuccess(null);
  }

  async function handleSend() {
    if (!selected) { setError('Selecione um agendamento.'); return; }
    if (!message.trim()) { setError('Escreva a mensagem do lembrete.'); return; }
    const contact = channel === 'email' ? selected.client?.email : selected.client?.phone;
    if (!contact) {
      setError(channel === 'email' ? 'Cliente sem e-mail cadastrado.' : 'Cliente sem telefone cadastrado.');
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    let reminderId = channel === 'email' ? failedId : null;
    if (!reminderId) {
      const { data, error: err } = await supabase.from('reminders').insert({
        client_id: selected.client_id,
        appointment_id: selected.id,
        channel,
        message: message.trim(),
        scheduled_for: new Date().toISOString(),
        status: 'pending',
      }).select('id').single();
      if (err) { setSending(false); setError(err.message); return; }
      reminderId = data!.id as string;
    }
    if (channel === 'email') {
      const msg = await sendEmailReminder(reminderId);
      setSending(false);
      if (msg) { setFailedId(reminderId); setError(msg); return; }
      setFailedId(null);
      setSuccess('E-mail enviado com sucesso!');
      return;
    }
    setSending(false);
    setSuccess('Lembrete registrado!');
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/${toWhatsappNumber(contact)}?text=${encodeURIComponent(message.trim())}`, '_blank');
    }
  }

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar onBack={() => navigation.goBack()} title="Lembrete" />
      <ScrollView className="flex-1 px-6 pt-24 pb-32">
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 700 }}>
          <View className="mb-10">
            <Text className="text-4xl font-serif text-[#68597a] leading-tight mb-2 italic">Enviar Lembrete</Text>
            <Text className="text-[#625d67] font-medium">Escolha um agendamento e envie a confirmação para a cliente.</Text>
          </View>

          <View className="bg-[#e8e0ec] rounded-[32px] p-6 mb-8">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-[#625d67] mb-4">Agendamento</Text>
            {loading ? (
              <ActivityIndicator color="#68597a" />
            ) : appointments.length === 0 ? (
              <Text className="text-[#625d67] text-sm">Nenhum agendamento futuro.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {appointments.map(apt => (
                  <TouchableOpacity
                    key={apt.id}
                    onPress={() => selectAppointment(apt)}
                    style={{ borderRadius: 16, padding: 14, backgroundColor: apt.id === selectedId ? '#68597a' : '#f9f1fa' }}
                  >
                    <Text style={{ fontWeight: '700', color: apt.id === selectedId ? '#fff' : '#35313a' }}>
                      {apt.client?.name ?? '—'}
                    </Text>
                    <Text style={{ fontSize: 12, color: apt.id === selectedId ? '#e8e0ec' : '#625d67' }}>
                      {apt.service} · {formatDateBR(apt.date)} · {formatTime(apt.time_start)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View className="mb-8">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-[#625d67] mb-4">Canal de Envio</Text>
            <View className="flex-row gap-3">
              {CHANNELS.map(({ key, label, Icon }) => {
                const active = channel === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setChannel(key)}
                    style={{
                      flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, borderRadius: 16,
                      backgroundColor: active ? '#fff' : '#f9f1fa',
                      borderWidth: 2, borderColor: active ? '#68597a' : 'transparent',
                    }}
                  >
                    <Icon size={24} color={active ? '#68597a' : '#625d67'} />
                    <Text style={{ fontSize: 11, fontWeight: '700', marginTop: 8, color: active ? '#68597a' : '#625d67' }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="bg-[#f9f1fa] rounded-[40px] p-10 mb-20">
            <Text className="text-[11px] font-bold uppercase tracking-widest text-[#625d67] mb-8">Mensagem de Lembrete</Text>
            <TextInput
              multiline
              value={message}
              onChangeText={setMessage}
              placeholder="Selecione um agendamento para gerar a mensagem"
              className="w-full h-48 bg-[#e8e0ec] rounded-3xl p-8 text-[#35313a] font-medium leading-relaxed mb-8"
            />

            {selected && (
              <View className="mb-8 p-6 bg-[#d0fcfe4d] rounded-2xl flex-row justify-between items-center">
                <View className="flex-row items-center gap-4">
                  <Calendar size={24} color="#3a6264" />
                  <View>
                    <Text className="text-[11px] font-bold text-[#625d67] uppercase tracking-widest">Data</Text>
                    <Text className="text-sm font-bold text-[#68597a]">{formatDateBR(selected.date)}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-[11px] font-bold text-[#625d67] uppercase tracking-widest">Horário</Text>
                  <Text className="text-sm font-bold text-[#68597a]">{formatTime(selected.time_start)}</Text>
                </View>
              </View>
            )}

            {error && (
              <Text style={{ color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12, padding: 10, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{error}</Text>
            )}
            {success && (
              <Text style={{ color: '#3a6264', backgroundColor: '#d0fcfe', borderRadius: 12, padding: 10, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{success}</Text>
            )}

            <TouchableOpacity
              onPress={handleSend}
              disabled={sending}
              style={{ backgroundColor: sending ? '#68597a80' : '#68597a', paddingVertical: 24, borderRadius: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{sending ? 'Enviando…' : failedId && channel === 'email' ? 'Reenviar E-mail' : 'Enviar Lembrete'}</Text>
              <Send size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </MotiView>
      </ScrollView>
    </View>
  );
};
