import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/authErrors';

interface Props {
  visible: boolean;
  onClose: () => void;
  client?: { id: string; name: string; phone: string | null; email: string | null } | null;
}

const input = { backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#35313a' } as const;
const label = { fontSize: 10, fontWeight: '700', color: '#625d67', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6, marginLeft: 4 } as const;

function extractToken(data: unknown): string | null {
  const row: any = Array.isArray(data) ? data[0] : data;
  if (typeof row === 'string') return row;
  return row?.token ?? row?.invite_token ?? row?.create_client_invite ?? null;
}

export function InviteClientModal({ visible, onClose, client }: Props) {
  const [name, setName] = useState(client?.name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const link = token ? `${window.location.origin}/cliente?convite=${encodeURIComponent(token)}` : '';
  const waText = `Olá${name ? ` ${name.split(' ')[0]}` : ''}! Segue seu convite para criar sua conta na área do cliente: ${link}\nCódigo: ${token ?? ''}`;

  function close() {
    setToken(null); setError(null); setCopied(null);
    onClose();
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Informe o nome do cliente.'); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await withTimeout(supabase.rpc('create_client_invite', {
        p_name: name.trim(),
        p_phone: phone.trim() || null,
        p_email: email.trim() || null,
        p_client_id: client?.id ?? null,
      }));
      if (err) throw new Error(err.message);
      const t = extractToken(data);
      if (!t) throw new Error('Não foi possível gerar o convite.');
      setToken(t);
    } catch (e: any) {
      setError(e?.message === 'TIMEOUT' ? 'Tempo de conexão esgotado. Tente novamente.' : (e?.message ?? 'Erro ao gerar convite.'));
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); } catch { setCopied(null); }
  }

  function whatsapp() {
    const digits = phone.replace(/\D/g, '');
    const num = digits ? (digits.length <= 11 ? `55${digits}` : digits) : '';
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(waText)}`, '_blank');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fef7fe', borderRadius: 28, padding: 24, gap: 14, maxWidth: 440, width: '100%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#68597a' }}>Convidar cliente</Text>
            <TouchableOpacity onPress={close}><X size={20} color="#625d67" /></TouchableOpacity>
          </View>

          {!token ? (
            <>
              <View><Text style={label}>Nome</Text><TextInput value={name} onChangeText={setName} placeholder="Nome da cliente" style={input} /></View>
              <View><Text style={label}>Telefone / WhatsApp</Text><TextInput value={phone} onChangeText={setPhone} placeholder="(11) 99999-9999" inputMode="tel" style={input} /></View>
              <View><Text style={label}>E-mail (opcional)</Text><TextInput value={email} onChangeText={setEmail} placeholder="cliente@email.com" autoCapitalize="none" inputMode="email" style={input} /></View>
              {error && <Text style={{ color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12, padding: 10, fontSize: 13, textAlign: 'center' }}>{error}</Text>}
              <TouchableOpacity onPress={handleCreate} disabled={loading}
                style={{ backgroundColor: loading ? '#68597a80' : '#68597a', borderRadius: 50, paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{loading ? 'Gerando…' : 'Gerar convite'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: '#ba1a1a', fontSize: 13, fontWeight: '600' }}>
                Atenção: o código aparece apenas uma vez. Copie ou envie agora.
              </Text>
              <View><Text style={label}>Link</Text><Text selectable style={{ ...input, fontSize: 13 }}>{link}</Text></View>
              <View><Text style={label}>Código</Text><Text selectable style={{ ...input, fontSize: 13 }}>{token}</Text></View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => copy(link, 'link')} style={{ flex: 1, backgroundColor: '#e8e0ec', borderRadius: 50, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#68597a', fontWeight: '700' }}>{copied === 'link' ? 'Copiado!' : 'Copiar link'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => copy(token, 'code')} style={{ flex: 1, backgroundColor: '#e8e0ec', borderRadius: 50, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#68597a', fontWeight: '700' }}>{copied === 'code' ? 'Copiado!' : 'Copiar código'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={whatsapp} style={{ backgroundColor: '#25a244', borderRadius: 50, paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Enviar por WhatsApp</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
