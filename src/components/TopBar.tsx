import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Bell, Menu, ChevronLeft, UserCircle, X, Check, House } from 'lucide-react-native';
import { useDrawer } from '../lib/DrawerContext';
import { useAuth } from '../lib/AuthContext';
import { usePendingAppointments, updateAppointmentStatus } from '../lib/hooks/useAppointments';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';
import { navigationRef } from '../lib/navigationRef';
import { formatTime, displayName } from '../lib/utils';

interface TopBarProps {
  onBack?: () => void;
  title?: string;
}

const MIN_BOOK_DAYS = 5;

function daysUntil(isoDate: string): number {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(isoDate + 'T12:00:00');
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.floor((startTarget.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000));
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export const TopBar: React.FC<TopBarProps> = ({ onBack, title }) => {
  const { open } = useDrawer();
  const { user } = useAuth();
  const { salonName } = useSalonSettings();
  const displayTitle = title ?? salonName;
  const pending = usePendingAppointments();
  const [showPanel, setShowPanel] = useState(false);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = displayName(user).slice(0, 1).toUpperCase();
  const showHomeShortcut = !!onBack || !!title;

  async function confirm(id: string, date: string) {
    if (daysUntil(date) < MIN_BOOK_DAYS) {
      const aware = window.confirm('Estou ciente de que este agendamento serÃ¡ confirmado com menos de 5 dias de antecedÃªncia. Deseja continuar?');
      if (!aware) return;
      await updateAppointmentStatus(id, 'Confirmado', { awareShortNotice: true });
      return;
    }
    await updateAppointmentStatus(id, 'Confirmado');
  }

  return (
    <View className="absolute top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md px-4 py-4 flex-row items-center border-b border-[#b7afbb26]">
      {/* Canto esquerdo â€” hamburguer ou botÃ£o voltar */}
      {onBack ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          <TouchableOpacity onPress={onBack} className="p-1 mr-2">
            <ChevronLeft size={24} color="#68597a" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigationRef.isReady() && navigationRef.navigate('Main' as never, { screen: 'InÃ­cio' } as never)}
            style={{ padding: 6, borderRadius: 20, backgroundColor: '#f9f1fa' }}
          >
            <House size={18} color="#68597a" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          <TouchableOpacity onPress={open} className="p-1 mr-2">
            <Menu size={24} color="#68597a" />
          </TouchableOpacity>
          {showHomeShortcut && (
            <TouchableOpacity
              onPress={() => navigationRef.isReady() && navigationRef.navigate('Main' as never, { screen: 'InÃ­cio' } as never)}
              style={{ padding: 6, borderRadius: 20, backgroundColor: '#f9f1fa' }}
            >
              <House size={18} color="#68597a" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* TÃ­tulo â€” ocupa o espaÃ§o restante */}
      <Text className="flex-1 text-xl font-bold tracking-tight text-[#68597a] italic">
        {displayTitle}
      </Text>

      {/* Canto direito â€” aÃ§Ãµes */}
      <View className="flex-row items-center gap-3">
        {/* Sino com badge */}
        <TouchableOpacity
          onPress={() => setShowPanel(true)}
          style={{ padding: 8, borderRadius: 50, backgroundColor: '#f9f1fa', position: 'relative' }}
        >
          <Bell size={22} color="#68597a" />
          {pending.length > 0 && (
            <View style={{
              position: 'absolute', top: 4, right: 4,
              backgroundColor: '#f97386', borderRadius: 8,
              minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 3,
            }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                {pending.length > 9 ? '9+' : pending.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigationRef.isReady() && navigationRef.navigate('UserProfile' as never)}
          style={{ borderRadius: 50, overflow: 'hidden' }}
        >
          <View className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#e1cdf4] items-center justify-center bg-[#e8e0ec]">
            {avatarUrl ? (
              <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : user ? (
              <Text style={{ color: '#68597a', fontWeight: 'bold', fontSize: 16 }}>{initials}</Text>
            ) : (
              <UserCircle size={24} color="#68597a" />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Painel de notificaÃ§Ãµes */}
      <Modal visible={showPanel} transparent animationType="fade" onRequestClose={() => setShowPanel(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#00000040' }}
          activeOpacity={1}
          onPress={() => setShowPanel(false)}
        >
          <View style={{
            position: 'absolute', top: 72, right: 16,
            width: 320, maxHeight: 460,
            backgroundColor: '#fef7fe', borderRadius: 24,
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: '#e8e0ec',
            }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#35313a' }}>
                ConfirmaÃ§Ãµes pendentes
              </Text>
              <TouchableOpacity onPress={() => setShowPanel(false)}>
                <X size={18} color="#625d67" />
              </TouchableOpacity>
            </View>

            {pending.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#625d67', fontSize: 14 }}>Nenhum agendamento aguardando ðŸŽ‰</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {pending.map(apt => (
                  <View key={apt.id} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: '#f0e8f8',
                  }}>
                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 14, color: '#35313a' }}>
                        {apt.client?.name ?? 'â€”'}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#625d67', marginTop: 2 }}>
                        {formatDate(apt.date)} Ã s {formatTime(apt.time_start)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#68597a', marginTop: 1 }} numberOfLines={1}>
                        {apt.service}
                      </Text>
                    </View>
                    {/* Confirmar */}
                    <TouchableOpacity
                      onPress={() => confirm(apt.id, apt.date)}
                      style={{
                        backgroundColor: '#d0fcfe', borderRadius: 16,
                        paddingHorizontal: 12, paddingVertical: 8,
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        marginLeft: 8,
                      }}
                    >
                      <Check size={14} color="#3a6264" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#3a6264' }}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
