import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useClientAuth } from '../lib/ClientAuthContext';
import { supabase } from '../lib/supabase';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';

interface Appointment {
  id: string;
  service: string;
  date: string;
  time_start: string;
  status: string;
  price: number | null;
}

function useClientAppointments(clientId: string | null) {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    supabase
      .from('appointments')
      .select('id, service, date, time_start, status, price')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setAppointments(data ?? []);
        setLoading(false);
      });
  }, [clientId]);

  return { appointments, loading };
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Aguardando: { bg: '#fffbcc', color: '#856c00' },
  Confirmado: { bg: '#d0fcfe', color: '#3a6264' },
  Concluído:  { bg: '#e1cdf4', color: '#524362' },
  Cancelado:  { bg: '#ffedec', color: '#ba1a1a' },
};

export function ClientHome() {
  const { client, signOut } = useClientAuth();
  const { salonName } = useSalonSettings();
  const { appointments, loading } = useClientAppointments(client?.id ?? null);
  const [tab, setTab] = useState<'agendamentos' | 'historico'>('agendamentos');

  const upcoming = appointments.filter(a => a.status !== 'Cancelado' && new Date(a.date) >= new Date());
  const history  = appointments.filter(a => a.status === 'Concluído' || new Date(a.date) < new Date());

  const list = tab === 'agendamentos' ? upcoming : history;

  return (
    <View style={{ paddingBottom: 24 }}>
      <View style={{
        backgroundColor: '#765d8f',
        paddingVertical: 24,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
      }}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{salonName}</Text>
        <Text style={{ color: '#fff', fontStyle: 'italic', fontSize: 22, marginTop: 4 }}>
          Olá, {client?.name?.split(' ')[0]}! 👋
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 }}>
        {(['agendamentos', 'historico'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={{
            flex: 1, paddingVertical: 10, borderRadius: 50,
            alignItems: 'center',
            backgroundColor: tab === t ? '#68597a' : '#e8e0ec',
          }}>
            <Text style={{
              fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5,
              color: tab === t ? '#fff' : '#625d67',
            }}>
              {t === 'agendamentos' ? '📅 Próximos' : '🕓 Histórico'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {loading ? (
          <Text style={{ color: '#625d67', textAlign: 'center', padding: 40 }}>Carregando…</Text>
        ) : list.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>✨</Text>
            <Text style={{ color: '#625d67', fontSize: 13 }}>
              {tab === 'agendamentos' ? 'Nenhum agendamento futuro.' : 'Nenhum histórico ainda.'}
            </Text>
          </View>
        ) : (
          list.map(a => {
            const badge = STATUS_BADGE[a.status] ?? { bg: '#f0e9f8', color: '#68597a' };
            return (
              <View key={a.id} style={{
                backgroundColor: '#fff', borderRadius: 20, padding: 16,
                marginBottom: 12,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#35313a' }}>{a.service}</Text>
                  <Text style={{ marginTop: 4, fontSize: 12, color: '#625d67' }}>
                    {new Date(a.date).toLocaleDateString('pt-BR')}
                    {a.time_start ? ` às ${a.time_start.slice(0,5)}` : ''}
                    {a.price ? ` · R$ ${a.price.toFixed(2)}` : ''}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: badge.bg, color: badge.color,
                  paddingVertical: 4, paddingHorizontal: 12, borderRadius: 50,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: badge.color }}>{a.status}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <TouchableOpacity onPress={signOut} style={{
          width: '100%', paddingVertical: 14, borderRadius: 50,
          backgroundColor: '#f0e9f8', alignItems: 'center',
        }}>
          <Text style={{ color: '#68597a', fontWeight: '700', fontSize: 14 }}>Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
