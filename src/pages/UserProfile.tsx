import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadAvatarFile } from '../lib/avatarUpload';

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

export function UserProfile({ navigation }: any) {
  const { user, signOut } = useAuth();

  const email     = user?.email ?? '';
  const name      = ((user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || '').trim();
  const birthDate = (user?.user_metadata?.birth_date as string) ?? '';
  const avatarUrl = (user?.user_metadata?.avatar_url as string) ?? '';

  const [newName,      setNewName]      = useState(name);
  const [newBirthDate, setNewBirthDate] = useState(normalizeBirthDate(birthDate));
  const [newAvatarUrl, setNewAvatarUrl] = useState(avatarUrl);
  const displayName = (newName || name).trim();
  const displayAvatar = (newAvatarUrl || avatarUrl).trim();
  const initials  = (displayName || email).slice(0, 1).toUpperCase();
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [newPassword,  setNewPassword]  = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [savedMsg,     setSavedMsg]     = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [selectedAvatarName, setSelectedAvatarName] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSaveName() {
    if (!newName.trim()) return;
    const birthErr = validateBirthDate(newBirthDate);
    if (birthErr) { setError(birthErr); return; }
    setSaving(true); setError(null); setSavedMsg(null);
    const { error: err } = await supabase.auth.updateUser({
      data: {
        name: newName.trim(),
        full_name: newName.trim(),
        birth_date: newBirthDate.trim() || null,
      },
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSavedMsg('Nome atualizado!');
    setTimeout(() => setSavedMsg(null), 2500);
  }

  async function handleAvatarFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const input = (e.currentTarget ?? e.target) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type?.startsWith('image/')) {
      setError('Selecione um arquivo de imagem valido.');
      setSelectedAvatarName('');
      return;
    }
    setSelectedAvatarName(file.name);

    setSaving(true); setError(null); setSavedMsg(null);
    try {
      const url = await uploadAvatarFile(file, `users/${user.id}`);
      const { error: err } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (err) throw err;
      setNewAvatarUrl(url);
      setSavedMsg('Foto enviada com sucesso!');
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao enviar foto.');
    } finally {
      setSaving(false);
      if (input) input.value = '';
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPassword !== newPassword2) { setError('As senhas não coincidem.'); return; }
    setSaving(true); setError(null); setSavedMsg(null);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setNewPassword(''); setNewPassword2('');
    setSavedMsg('Senha alterada com sucesso!');
    setTimeout(() => setSavedMsg(null), 2500);
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fef7fe' }}>
      <TopBar title="Meu Perfil" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 88 }}>
        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <TouchableOpacity
            onPress={() => setShowAvatarEditor(v => !v)}
            style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: '#e1cdf4', alignItems: 'center', justifyContent: 'center',
            borderWidth: 3, borderColor: '#c1aee0', overflow: 'hidden',
          }}>
            {displayAvatar ? (
              <img src={displayAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Text style={{ fontSize: 36, fontWeight: '700', color: '#68597a' }}>{initials}</Text>
            )}
          </TouchableOpacity>
          <Text style={{ color: '#625d67', fontSize: 11, marginTop: 8 }}>Toque na foto para alterar</Text>
          <Text style={{ marginTop: 12, fontWeight: '700', fontSize: 18, color: '#35313a' }}>
            {displayName || 'Sem nome'}
          </Text>
          <Text style={{ color: '#625d67', fontSize: 13, marginTop: 2 }}>{email}</Text>
        </View>

        {showAvatarEditor && (
          <View style={card}>
            <Text style={sectionTitle}>Foto</Text>
            <TouchableOpacity onPress={() => avatarInputRef.current?.click()} disabled={saving} style={btnPrimary}>
              <Text style={btnText}>Selecione uma foto</Text>
            </TouchableOpacity>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarFileSelected}
            />
            <Text style={{ color: '#625d67', fontSize: 11, marginTop: 8 }}>
              {saving ? 'Enviando foto...' : (selectedAvatarName || 'Nenhuma foto selecionada')}
            </Text>
          </View>
        )}

        {/* Nome */}
        <View style={card}>
          <Text style={sectionTitle}>Nome de exibição</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Seu nome"
            style={input}
          />

          <Text style={{ ...sectionTitle, marginTop: 14 }}>Data de nascimento</Text>
          <TextInput
            value={newBirthDate}
            onChangeText={(v: any) => setNewBirthDate(maskBirthDate(parseBirthDateInput(v)))}
            placeholder="DD/MM/AAAA"
            keyboardType="default"
            maxLength={10}
            style={input}
          />

          <TouchableOpacity onPress={handleSaveName} disabled={saving} style={btnPrimary}>
            <Text style={btnText}>{saving ? 'Salvando…' : 'Salvar nome'}</Text>
          </TouchableOpacity>
        </View>

        {/* Senha */}
        <View style={card}>
          <Text style={sectionTitle}>Alterar senha</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Nova senha (mínimo 6 caracteres)"
            secureTextEntry
            style={input}
          />
          <TextInput
            value={newPassword2}
            onChangeText={setNewPassword2}
            placeholder="Confirmar nova senha"
            secureTextEntry
            style={{ ...input, marginTop: 10 }}
          />
          <TouchableOpacity onPress={handleChangePassword} disabled={saving} style={btnPrimary}>
            <Text style={btnText}>{saving ? 'Alterando…' : 'Alterar senha'}</Text>
          </TouchableOpacity>
        </View>

        {/* Feedback */}
        {savedMsg && (
          <View style={{ backgroundColor: '#d0fcfe', borderRadius: 16, padding: 14, marginBottom: 12 }}>
            <Text style={{ color: '#3a6264', fontWeight: '700', textAlign: 'center' }}>✓ {savedMsg}</Text>
          </View>
        )}
        {error && (
          <View style={{ backgroundColor: '#ffedec', borderRadius: 16, padding: 14, marginBottom: 12 }}>
            <Text style={{ color: '#ba1a1a', textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        {/* Sair */}
        <TouchableOpacity onPress={handleSignOut} style={{
          marginTop: 8, padding: 16, borderRadius: 50,
          backgroundColor: '#f0e9f8', alignItems: 'center',
        }}>
          <Text style={{ color: '#68597a', fontWeight: '700', fontSize: 15 }}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const card: object = {
  backgroundColor: '#fff', borderRadius: 24, padding: 20,
  marginBottom: 16,
  shadowColor: '#68597a', shadowOpacity: 0.07, shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 }, elevation: 2,
};
const sectionTitle: object = {
  fontSize: 10, fontWeight: '700', color: '#625d67',
  textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12,
};
const input: object = {
  backgroundColor: '#f0e9f8', borderRadius: 14, padding: 14,
  fontSize: 15, color: '#35313a',
};
const btnPrimary: object = {
  backgroundColor: '#68597a', borderRadius: 50, padding: 14,
  alignItems: 'center', marginTop: 14,
};
const btnText: object = { color: '#fff', fontWeight: '700', fontSize: 14 };
