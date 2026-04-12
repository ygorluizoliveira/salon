import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ClientAuthProvider, useClientAuth } from '../lib/ClientAuthContext';
import { SalonSettingsProvider } from '../lib/hooks/useSalonSettings';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';
import { ClientLogin } from './ClientLogin';
import { ClientHome } from './ClientHome';
import { ClientBooking } from './ClientBooking';
import { ClientPromotions } from './ClientPromotions';

// ── Nav items ─────────────────────────────────────────────────────────────────
type Page = 'home' | 'booking' | 'promotions';

const NAV: { id: Page; icon: string; label: string }[] = [
  { id: 'home',       icon: '🏠', label: 'Início' },
  { id: 'booking',    icon: '📅', label: 'Agendar' },
  { id: 'promotions', icon: '🎁', label: 'Promoções' },
];

function ClientPortal() {
  const { client, loading } = useClientAuth();
  const { salonName } = useSalonSettings();
  const [page, setPage] = useState<Page>('home');

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef7fe' }}>
        <Text style={{ color: '#68597a', fontSize: 16, fontStyle: 'italic' }}>Carregando…</Text>
      </View>
    );
  }

  if (!client) return <ClientLogin />;

  return (
    <View style={{
      maxWidth: 430, width: '100%', alignSelf: 'center',
      height: '100dvh', minHeight: '100vh', backgroundColor: '#faf5ff',
      position: 'relative', flexDirection: 'column',
    }}>
      <View style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e8e0ec',
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text numberOfLines={1} style={{ color: '#68597a', fontWeight: '800', fontSize: 15 }}>
            {salonName || 'Salão'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setPage('home')}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: page === 'home' ? '#e8e0ec' : '#f0e9f8',
          }}
        >
          <Text style={{ color: '#68597a', fontWeight: '700', fontSize: 12 }}>🏠 Home</Text>
        </TouchableOpacity>
      </View>

      <div style={{ flex: 1, paddingBottom: 80, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        {page === 'home'       && <ClientHome />}
        {page === 'booking'    && <ClientBooking />}
        {page === 'promotions' && <ClientPromotions />}
      </div>

      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8e0ec',
        flexDirection: 'row', paddingBottom: 8,
      }}>
        {NAV.map(n => (
          <TouchableOpacity key={n.id} onPress={() => setPage(n.id)} style={{
            flex: 1, paddingVertical: 12,
            backgroundColor: 'transparent', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 20 }}>{n.icon}</Text>
            <Text style={{
              fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
              color: page === n.id ? '#68597a' : '#b7afbb',
            }}>
              {n.label.toUpperCase()}
            </Text>
            {page === n.id && (
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#68597a' }} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function ClientApp() {
  return (
    <SalonSettingsProvider>
      <ClientAuthProvider>
        <ClientPortal />
      </ClientAuthProvider>
    </SalonSettingsProvider>
  );
}
