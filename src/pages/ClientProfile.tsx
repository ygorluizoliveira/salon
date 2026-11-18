import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { Mail, Phone, MapPin, MessageCircle, ArrowRight, Pencil, X, Check } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useNavigation, useRoute } from '@react-navigation/native';
import { TopBar } from '../components/TopBar';
import { useClient } from '../lib/hooks/useClients';
import { useServiceHistory } from '../lib/hooks/useServiceHistory';
import { uploadAvatarFile } from '../lib/avatarUpload';
import type { ClientStatus } from '../lib/types';
import { navigationRef } from '../lib/navigationRef';
import { parseLocalDate } from '../lib/utils';
import { InviteClientModal } from '../components/InviteClientModal';

const STATUSES: ClientStatus[] = ['Ativo', 'Inativo'];
const CONTACT_OPTIONS = ['WhatsApp', 'Telefone', 'E-mail', 'Instagram'];

function maskBirthDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits.length === 2 ? `${digits}/` : digits;
  if (digits.length <= 4) {
    const mm = digits.slice(2);
    return mm.length === 2 ? `${digits.slice(0, 2)}/${mm}/` : `${digits.slice(0, 2)}/${mm}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBirthDateInput(value: any) {
  if (typeof value === 'string') return value;
  if (value?.nativeEvent?.text && typeof value.nativeEvent.text === 'string') return value.nativeEvent.text;
  return '';
}

function normalizeBirthDate(value: string) {
  const v = (value ?? '').trim();
  if (!v) return '';
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return maskBirthDate(v);
}

function validateBirthDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 'Data de nascimento invalida. Use DD/MM/AAAA.';
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12) return 'Mes invalido na data de nascimento.';
  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) return 'Dia invalido na data de nascimento.';
  return null;
}

function toIsoBirthDate(value: string): string {
  const v = value.trim();
  if (!v) return '';
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return v;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export const ClientProfile: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const clientId: string | undefined = route.params?.id;

  const { client, loading: clientLoading, updateClient, deleteClient } = useClient(clientId);
  const [showInvite, setShowInvite] = useState(false);
  const { history, loading: historyLoading }             = useServiceHistory(clientId);

  const loading = clientLoading || historyLoading;

  // ── edit state ─────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedAvatarName, setSelectedAvatarName] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', notes: '', status: 'Ativo' as ClientStatus,
    address: '', contact_preference: '', birth_date: '', avatar_url: '',
  });

  useEffect(() => {
    if (client) {
      setForm({
        name:               client.name,
        email:              client.email  ?? '',
        phone:              client.phone  ?? '',
        notes:              client.notes  ?? '',
        status:             client.status,
        address:            client.address            ?? '',
        contact_preference: client.contact_preference ?? '',
        birth_date:         normalizeBirthDate(client.birth_date ?? ''),
        avatar_url:         client.avatar_url          ?? '',
      });
    }
  }, [client]);

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('Nome é obrigatório.'); return; }
    const birthErr = validateBirthDate(form.birth_date);
    if (birthErr) { setSaveError(birthErr); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await updateClient({
        name:               form.name.trim(),
        email:              form.email.trim()   || null,
        phone:              form.phone.trim()   || null,
        notes:              form.notes.trim()   || null,
        address:            form.address.trim() || null,
        contact_preference: form.contact_preference || null,
        birth_date:         toIsoBirthDate(form.birth_date) || null,
        avatar_url:         form.avatar_url.trim() || null,
        status:             form.status,
      });
      setEditing(false);
    } catch (err: any) {
      setSaveError(err.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const input = (e.currentTarget ?? e.target) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || !clientId) return;
    if (!file.type?.startsWith('image/')) {
      setSaveError('Selecione um arquivo de imagem valido.');
      setSelectedAvatarName('');
      return;
    }
    setSelectedAvatarName(file.name);
    setSaving(true);
    setSaveError(null);
    try {
      const url = await uploadAvatarFile(file, `clients/${clientId}`);
      setForm(f => ({ ...f, avatar_url: url }));
    } catch (err: any) {
      setSaveError(err.message ?? 'Erro ao enviar foto.');
    } finally {
      setSaving(false);
      if (input) input.value = '';
    }
  }

  async function handleDeleteClient() {
    if (!client) return;
    const confirmed = window.confirm(`Deseja excluir o cliente ${client.name}? Esta ação remove também os agendamentos vinculados.`);
    if (!confirmed) return;

    setSaving(true);
    setSaveError(null);
    try {
      await deleteClient();
      if (typeof window !== 'undefined') {
        window.location.assign('/clientes');
        return;
      }
      if (navigationRef.isReady()) {
        navigationRef.navigate('Main' as never, { screen: 'Clientes' } as never);
      }
    } catch (err: any) {
      setSaveError(err.message ?? 'Não foi possível excluir o cliente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar onBack={() => navigation.goBack()} title="Perfil" />
      <ScrollView className="flex-1 px-6 pt-24 pb-32">
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 700 }}
        >
          {loading && (
            <Text className="text-[#625d67] text-sm text-center py-16">Carregando…</Text>
          )}

          {!loading && !client && (
            <Text className="text-[#ba1a1a] text-sm text-center py-16">Cliente não encontrado.</Text>
          )}

          {!loading && client && (
            <>
              {/* ── Edit form ───────────────────────────────────────────── */}
              {editing && (
                <MotiView
                  from={{ opacity: 0, translateY: -8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 300 }}
                  className="bg-[#e8e0ec] rounded-[32px] p-8 mb-8"
                >
                  <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-xl font-serif text-[#68597a] italic">Editar Perfil</Text>
                    <TouchableOpacity onPress={() => setEditing(false)} className="p-2">
                      <X size={20} color="#625d67" />
                    </TouchableOpacity>
                  </View>

                  {/* Nome */}
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Nome *</Text>
                    <TextInput value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))}
                      placeholder="Nome completo" placeholderTextColor="#625d6766"
                      className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]" />
                  </View>

                  {/* E-mail */}
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">E-mail</Text>
                    <TextInput value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))}
                      placeholder="email@exemplo.com" placeholderTextColor="#625d6766"
                      keyboardType="email-address" autoCapitalize="none"
                      className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]" />
                  </View>

                  {/* Telefone */}
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Telefone (com DDD)</Text>
                    <TextInput value={form.phone}
                      onChangeText={v => {
                        // Mask: (XX) XXXXX-XXXX
                        const d = v.replace(/\D/g, '').slice(0, 11);
                        let masked = d;
                        if (d.length > 2)  masked = `(${d.slice(0,2)}) ${d.slice(2)}`;
                        if (d.length > 7)  masked = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
                        setForm(f => ({ ...f, phone: masked }));
                      }}
                      placeholder="(11) 99999-9999" placeholderTextColor="#625d6766"
                      keyboardType="phone-pad"
                      className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]" />
                  </View>

                  {/* Data de nascimento */}
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Data de Nascimento</Text>
                    <TextInput value={form.birth_date}
                      onChangeText={v => {
                        setForm(f => ({ ...f, birth_date: maskBirthDate(parseBirthDateInput(v)) }));
                      }}
                      placeholder="DD/MM/AAAA" placeholderTextColor="#625d6766"
                      keyboardType="default"
                      maxLength={10}
                      className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]" />
                  </View>

                  {/* Endereço */}
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Endereço</Text>
                    <TextInput value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))}
                      placeholder="Rua, número, bairro…" placeholderTextColor="#625d6766"
                      className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]" />
                  </View>

                  {/* Foto */}
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Foto</Text>
                    <TouchableOpacity
                      onPress={() => avatarInputRef.current?.click()}
                      disabled={saving}
                      className={`py-3 rounded-xl mb-2 ${saving ? 'bg-[#68597a80]' : 'bg-[#68597a]'}`}
                    >
                      <Text className="text-center text-white font-bold text-sm">Selecione uma foto</Text>
                    </TouchableOpacity>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAvatarFileSelected}
                    />
                    <Text className="text-[#625d67] text-[11px] mt-2">
                      {saving ? 'Enviando foto...' : (selectedAvatarName || 'Nenhuma foto selecionada')}
                    </Text>
                  </View>

                  {/* Forma de contato */}
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Forma de Contato Preferida</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {CONTACT_OPTIONS.map(c => (
                        <TouchableOpacity key={c} onPress={() => setForm(f => ({ ...f, contact_preference: c }))}
                          className={`px-4 py-2 rounded-xl ${form.contact_preference === c ? 'bg-[#68597a]' : 'bg-[#f9f1fa]'}`}>
                          <Text className={`text-xs font-bold ${form.contact_preference === c ? 'text-white' : 'text-[#625d67]'}`}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Status */}
                  <View className="mb-4">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Status</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {STATUSES.map(s => (
                        <TouchableOpacity key={s} onPress={() => setForm(f => ({ ...f, status: s }))}
                          className={`px-4 py-2 rounded-xl ${form.status === s ? 'bg-[#68597a]' : 'bg-[#f9f1fa]'}`}>
                          <Text className={`text-xs font-bold ${form.status === s ? 'text-white' : 'text-[#625d67]'}`}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Observações */}
                  <View className="mb-6">
                    <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Observações</Text>
                    <TextInput value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                      placeholder="Anotações sobre o cliente…" placeholderTextColor="#625d6766"
                      multiline numberOfLines={3}
                      className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]" />
                  </View>

                  {saveError && (
                    <Text className="text-[#ba1a1a] bg-[#ffedec] rounded-xl px-4 py-3 text-sm text-center mb-2">{saveError}</Text>
                  )}

                  <TouchableOpacity onPress={handleSave} disabled={saving}
                    className={`flex-row items-center justify-center gap-2 py-4 rounded-full ${saving ? 'bg-[#68597a80]' : 'bg-[#68597a]'}`}>
                    <Check size={18} color="#fff" />
                    <Text className="text-white font-bold text-base">{saving ? 'Salvando…' : 'Salvar alterações'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleDeleteClient}
                    disabled={saving}
                    className={`flex-row items-center justify-center gap-2 py-4 rounded-full mt-3 ${saving ? 'bg-[#ba1a1a80]' : 'bg-[#ba1a1a]'}`}>
                    <Text className="text-white font-bold text-base">{saving ? 'Processando…' : 'Excluir cliente'}</Text>
                  </TouchableOpacity>
                </MotiView>
              )}

              {/* Avatar & info */}
              <View className="items-center mb-12">
                <TouchableOpacity className="relative" onPress={() => setEditing(true)}>
                  <View className="w-40 h-40 rounded-full overflow-hidden shadow-2xl border-4 border-[#e1cdf4]">
                    {(client.avatar_url || form.avatar_url) ? (
                      <Image source={{ uri: (form.avatar_url || client.avatar_url) as string }} className="w-full h-full object-cover" />
                    ) : (
                      <View className="w-full h-full bg-[#e8e0ec] items-center justify-center">
                        <Text className="text-5xl font-serif text-[#68597a]">{client.name[0]}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <View className="mt-6 items-center">
                  {(() => {
                    const displayStatus = client.status === 'Inativo' ? 'Inativo' : 'Ativo';
                    return (
                      <View className={`px-4 py-1 rounded-full mb-3 ${displayStatus === 'Ativo' ? 'bg-[#d0fcfe]' : 'bg-[#f0e4f8]'}`}>
                        <Text className={`text-xs font-bold uppercase tracking-widest ${displayStatus === 'Ativo' ? 'text-[#3a6264]' : 'text-[#625d67]'}`}>{displayStatus}</Text>
                      </View>
                    );
                  })()}
                  <Text className="text-4xl font-serif font-bold text-[#68597a] text-center">{client.name}</Text>
                  <Text className="text-[#625d67] font-bold tracking-widest uppercase text-xs mt-2">
                    {client.member_since ? `Cliente desde ${parseLocalDate(client.member_since).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}` : ''}
                  </Text>
                  <TouchableOpacity onPress={() => setShowInvite(true)}
                    style={{ marginTop: 12, backgroundColor: '#68597a', borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Convidar para o app</Text>
                  </TouchableOpacity>
                  <InviteClientModal key={showInvite ? 'open' : 'closed'} visible={showInvite} onClose={() => setShowInvite(false)} client={client} />

                  <View className="flex-row flex-wrap justify-center gap-3 mt-6">
                    {client.email && (
                      <View className="flex-row items-center gap-2 bg-[#f9f1fa] px-4 py-2 rounded-full">
                        <Mail size={14} color="#68597a" />
                        <Text className="text-xs font-medium text-[#35313a]">{client.email}</Text>
                      </View>
                    )}
                    {client.phone && (
                      <View className="flex-row items-center gap-2 bg-[#f9f1fa] px-4 py-2 rounded-full">
                        <Phone size={14} color="#68597a" />
                        <Text className="text-xs font-medium text-[#35313a]">{client.phone}</Text>
                      </View>
                    )}
                    {client.address && (
                      <View className="flex-row items-center gap-2 bg-[#f9f1fa] px-4 py-2 rounded-full">
                        <MapPin size={14} color="#68597a" />
                        <Text className="text-xs font-medium text-[#35313a]">{client.address}</Text>
                      </View>
                    )}
                    {client.contact_preference && (
                      <View className="flex-row items-center gap-2 bg-[#e1cdf4] px-4 py-2 rounded-full">
                        <MessageCircle size={14} color="#68597a" />
                        <Text className="text-xs font-bold text-[#524362]">Prefere: {client.contact_preference}</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => setEditing(e => !e)}
                    className="flex-row items-center gap-2 bg-[#68597a] px-10 py-3 rounded-full mt-6 shadow-lg shadow-[#68597a4d]">
                    <Pencil size={14} color="#fff" />
                    <Text className="text-white font-bold">{editing ? 'Fechar edição' : 'Editar Perfil'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notes */}
              {client.notes && (
                <View className="mb-8">
                  <View className="bg-[#e8e0ec] p-8 rounded-[32px] mb-6">
                    <Text className="text-2xl font-serif text-[#68597a] mb-4 italic">Observações</Text>
                    <Text className="text-[#35313a] text-sm leading-relaxed">{client.notes}</Text>
                  </View>
                </View>
              )}

              {/* Service history */}
              <View className="bg-[#f9f1fa] p-8 rounded-[32px] mb-20">
                <View className="flex-row justify-between items-center mb-10">
                  <Text className="text-2xl font-serif text-[#68597a] italic">Histórico</Text>
                  <TouchableOpacity className="flex-row items-center gap-1">
                    <Text className="text-[#68597a] font-bold text-xs uppercase">Ver todos</Text>
                    <ArrowRight size={14} color="#68597a" />
                  </TouchableOpacity>
                </View>

                {history.length === 0 && (
                  <Text className="text-[#625d67] text-sm text-center py-4">Nenhum serviço registrado.</Text>
                )}

                {history.map((item, idx) => (
                  <View key={item.id} className="flex-row gap-4 mb-8">
                    <View className="items-center">
                      <View className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-[#68597a]' : 'bg-[#68597a4d]'}`} />
                      {idx !== history.length - 1 && <View className="w-[1px] flex-1 bg-[#b7afbb4d] my-1" />}
                    </View>
                    <View className="flex-1 bg-[#e8e0ec] p-6 rounded-2xl" style={{ opacity: Math.max(0.4, 1 - idx * 0.2) }}>
                      <View className="flex-row items-center gap-3 mb-2">
                        <View className="bg-[#d0fcfe] px-3 py-1 rounded-full">
                          <Text className="text-[8px] font-bold text-[#3a6264] uppercase">{item.status}</Text>
                        </View>
                        <Text className="text-[10px] text-[#625d67]">
                          {parseLocalDate(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                      <Text className="text-lg font-bold text-[#35313a] mb-1">{item.title}</Text>
                      {item.professional && (
                        <Text className="text-xs text-[#625d67] mb-4">Profissional: {item.professional}</Text>
                      )}
                      <Text className="text-lg font-serif text-[#68597a] italic">
                        R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </MotiView>
      </ScrollView>
    </View>
  );
};
