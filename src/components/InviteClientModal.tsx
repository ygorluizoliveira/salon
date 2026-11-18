import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/authErrors';

interface Props {
  visible: boolean;
  onClose: () => void;
  client?: { id: string; name: string; phone: string | null; email: string | null } | null;
}

const box = { backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 13, color: '#35313a' } as const;

function extractToken(data: unknown): string | null {
  const row: any = Array.isArray(data) ? data[0] : data;
  if (typeof row === 'string') return row;
  return row?.token ?? row?.invite_token ?? row?.create_client_invite ?? null;
}

export function InviteClientModal({ visible, onClose, client }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = token ? `${window.location.origin}/cliente?convite=${encodeURIComponent(token)}` : '';
  const waText = `Olá${client?.name ? ` ${client.name.split(' ')[0]}` : ''}! Segue seu link para criar sua conta na área do cliente (válido por 15 minutos, uso único): ${link}`;

  async function generate() {
    setLoading(true); setError(null); setCopied(false); setToken(null);
    try {
      const args = client?.id ? { p_client_id: client.id } : {};
      const { data, error: err } = await withTimeout(supabase.rpc('create_client_invite', args as any));
      if (err) throw new Error(err.message);
      const t = extractToken(data);
      if (!t) throw new Error('Não foi possível gerar o link.');
      setToken(t);
    } catch (e: any) {
      setError(e?.message === 'TIMEOUT' ? 'Tempo de conexão esgotado. Tente novamente.' : (e?.message ?? 'Erro ao gerar o link.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (visible) generate(); }, [visible]);

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  }

  function whatsapp() {
    const digits = (client?.phone ?? '').replace(/\D/g, '');
    const num = digits ? (digits.length <= 11 ? `55${digits}` : digits) : '';
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(waText)}`, '_blank');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fef7fe', borderRadius: 28, padding: 24, gap: 14, maxWidth: 440, width: '100%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#68597a' }}>Convidar cliente</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color="#625d67" /></TouchableOpacity>
          </View>

          {loading && <Text style={{ color: '#625d67', textAlign: 'center' }}>Gerando link…</Text>}
          {error && <Text style={{ color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12, padding: 10, fontSize: 13, textAlign: 'center' }}>{error}</Text>}

          {token && (
            <>
              <Text style={{ color: '#ba1a1a', fontSize: 13, fontWeight: '600' }}>
                Válido por 15 minutos, uso único. O link aparece só agora — copie ou envie.
              </Text>
              <Text selectable style={box}>{link}</Text>
              <TouchableOpacity onPress={copy} style={{ backgroundColor: '#e8e0ec', borderRadius: 50, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#68597a', fontWeight: '700' }}>{copied ? 'Copiado!' : 'Copiar link'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={whatsapp} style={{ backgroundColor: '#25a244', borderRadius: 50, paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Enviar por WhatsApp</Text>
              </TouchableOpacity>
            </>
          )}

          {!loading && (
            <TouchableOpacity onPress={generate} style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ color: '#68597a', fontWeight: '700', fontSize: 13 }}>{token ? 'Gerar novo link' : 'Tentar novamente'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
