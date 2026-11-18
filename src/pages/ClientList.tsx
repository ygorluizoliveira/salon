import React, { useState } from 'react';
import { formatPhone, maskPhone, isValidPhone, PHONE_ERROR } from '../lib/utils';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Modal } from 'react-native';
import { Search, UserPlus, X, Check, Phone, ChevronRight } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { TopBar } from '../components/TopBar';
import { InviteClientModal } from '../components/InviteClientModal';
import { useClients, addClient } from '../lib/hooks/useClients';
import type { Client } from '../lib/types';

type FilterStatus = 'Todos' | 'Ativo' | 'Inativo';

const FILTERS: FilterStatus[] = ['Todos', 'Ativo', 'Inativo'];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Ativo:   { bg: '#d0fcfe', color: '#3a6264' },
  Inativo: { bg: '#f0e4f8', color: '#625d67' },
};

function getDisplayStatus(client: Client): 'Ativo' | 'Inativo' {
  if (client.status === 'Inativo') return 'Inativo';
  return 'Ativo';
}

export const ClientList: React.FC = () => {
  const navigation = useNavigation<any>();
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<FilterStatus>('Todos');
  const [showAdd, setShowAdd]     = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // Add form state
  const [newName,  setNewName]    = useState('');
  const [newPhone, setNewPhone]   = useState('');
  const [newEmail, setNewEmail]   = useState('');
  const [addError, setAddError]   = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const { clients, loading, error, refetch } = useClients(search);

  // Compute display status and filter
  const displayed = clients
    .map(c => ({ ...c, displayStatus: getDisplayStatus(c) }))
    .filter(c => filter === 'Todos' || c.displayStatus === filter);

  // Stats
  const totalClients = clients.length;
  const ativosCount  = clients.filter(c => getDisplayStatus(c) === 'Ativo').length;

  function openAdd() {
    setNewName(''); setNewPhone(''); setNewEmail(''); setAddError(null);
    setShowAdd(true);
  }

  async function handleAdd() {
    if (!newName.trim()) { setAddError('Informe o nome do cliente.'); return; }
    if (newPhone.trim() && !isValidPhone(newPhone)) { setAddError(PHONE_ERROR); return; }
    setAddLoading(true);
    setAddError(null);
    try {
      const created = await addClient({
        name:  newName.trim(),
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
      });
      setShowAdd(false);
      refetch();
      navigation.navigate('ClientProfile', { id: created.id });
    } catch (e: any) {
      setAddError(e.message ?? 'Erro ao salvar.');
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fef7fe' }}>
      <TopBar title="Clientes" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 96, paddingBottom: 180 }}>
        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 600 }}>

          {/* Header */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 36, color: '#68597a', fontStyle: 'italic', marginBottom: 4 }}>Clientes</Text>
            <Text style={{ color: '#625d67', fontSize: 14 }}>Gerencie seus relacionamentos</Text>
            <TouchableOpacity onPress={() => setShowInvite(true)}
              style={{ alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#68597a', borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Convidar cliente</Text>
            </TouchableOpacity>
            <InviteClientModal key={showInvite ? 'open' : 'closed'} visible={showInvite} onClose={() => setShowInvite(false)} />
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total',  value: totalClients, bg: '#e8e0ec', color: '#35313a' },
              { label: 'Ativos', value: ativosCount,  bg: '#d0fcfe', color: '#3a6264' },
              { label: 'Inativos', value: totalClients - ativosCount, bg: '#f0e4f8', color: '#625d67' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 20, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: s.color }}>{s.value}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: s.color, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Search */}
          <View style={{ backgroundColor: '#e8e0ec', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 }}>
            <Search size={18} color="#625d6799" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar cliente…"
              placeholderTextColor="#625d6766"
              style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 15, color: '#35313a' }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color="#625d67" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 }}>
            {FILTERS.map((f, i) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 20, paddingVertical: 10, borderRadius: 50,
                  backgroundColor: filter === f ? '#68597a' : '#e8e0ec',
                  marginRight: i < FILTERS.length - 1 ? 10 : 0,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: filter === f ? '#fff' : '#625d67' }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          {error && <Text style={{ color: '#ba1a1a', textAlign: 'center', marginBottom: 16 }}>{error}</Text>}
          {loading ? (
            <Text style={{ color: '#625d67', textAlign: 'center', paddingVertical: 40 }}>Carregando…</Text>
          ) : displayed.length === 0 ? (
            <Text style={{ color: '#625d67', textAlign: 'center', paddingVertical: 40 }}>Nenhum cliente encontrado.</Text>
          ) : (
            displayed.map((client, i) => {
              const st = STATUS_STYLE[client.displayStatus] ?? STATUS_STYLE.Ativo;
              return (
                <MotiView
                  key={client.id}
                  from={{ opacity: 0, translateX: -12 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 300, delay: i * 40 }}
                >
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ClientProfile', { id: client.id })}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 20, padding: 16,
                      flexDirection: 'row', alignItems: 'center',
                      marginBottom: 10,
                      shadowColor: '#68597a', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    {/* Avatar */}
                    {client.avatar_url ? (
                      <Image source={{ uri: client.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26, marginRight: 14 }} />
                    ) : (
                      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#e8e0ec', marginRight: 14, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 20, color: '#68597a', fontWeight: '700' }}>{client.name[0]}</Text>
                      </View>
                    )}

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#35313a' }} numberOfLines={1}>{client.name}</Text>
                        <View style={{ backgroundColor: st.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 50 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: st.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{client.displayStatus}</Text>
                        </View>
                      </View>
                      {client.phone ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Phone size={11} color="#625d67" />
                          <Text style={{ fontSize: 12, color: '#625d67' }}>{formatPhone(client.phone)}</Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 12, color: '#b7afbb' }}>Sem telefone</Text>
                      )}
                    </View>

                    <ChevronRight size={18} color="#b7afbb" />
                  </TouchableOpacity>
                </MotiView>
              );
            })
          )}
        </MotiView>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={openAdd}
        style={{
          position: 'absolute', bottom: 40, right: 24,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: '#68597a', borderRadius: 50,
          paddingHorizontal: 28, paddingVertical: 18,
          shadowColor: '#68597a', shadowOpacity: 0.3, shadowRadius: 12,
        }}
      >
        <UserPlus size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Novo Cliente</Text>
      </TouchableOpacity>

      {/* Modal Adicionar */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, backgroundColor: '#00000050', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fef7fe', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 48 }}>

            {/* Handle + header */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e8e0ec', marginBottom: 20 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#35313a', fontStyle: 'italic' }}>Novo Cliente</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <X size={22} color="#625d67" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ gap: 14 }}>
              {/* Nome */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#625d67', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Nome *</Text>
                <TextInput
                  value={newName} onChangeText={setNewName}
                  placeholder="Nome completo" placeholderTextColor="#625d6766"
                  autoCapitalize="words"
                  style={{ backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#35313a' }}
                />
              </View>

              {/* Telefone */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#625d67', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Telefone (com DDD)</Text>
                <TextInput
                  value={newPhone}
                  onChangeText={v => {
                    setNewPhone(maskPhone(v));
                  }}
                  placeholder="(11) 99999-9999" placeholderTextColor="#625d6766"
                  keyboardType="phone-pad"
                  style={{ backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#35313a' }}
                />
              </View>

              {/* E-mail */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#625d67', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>E-mail</Text>
                <TextInput
                  value={newEmail} onChangeText={setNewEmail}
                  placeholder="email@exemplo.com" placeholderTextColor="#625d6766"
                  keyboardType="email-address" autoCapitalize="none"
                  style={{ backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#35313a' }}
                />
              </View>

              {addError && (
                <Text style={{ color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12, padding: 10, fontSize: 13, textAlign: 'center' }}>{addError}</Text>
              )}

              <TouchableOpacity
                onPress={handleAdd}
                disabled={addLoading}
                style={{
                  backgroundColor: addLoading ? '#68597a80' : '#68597a',
                  borderRadius: 50, paddingVertical: 18,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
                }}
              >
                <Check size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{addLoading ? 'Salvando…' : 'Salvar Cliente'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
