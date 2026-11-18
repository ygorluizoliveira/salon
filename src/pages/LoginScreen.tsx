import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { MotiView } from 'moti';
import { Scissors, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../lib/AuthContext';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';

type Tab = 'login' | 'signup';

function maskCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

function isValidCpf(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const dv = ((sum * 10) % 11) % 10;
    if (dv !== Number(d[len])) return false;
  }
  return true;
}

export function LoginScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const { salonName } = useSalonSettings();
  const [tab, setTab]           = useState<Tab>('login');
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [cpf, setCpf]           = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    setSuccess(null);
    setEmail('');
    setName('');
    setCpf('');
    setPassword('');
    setConfirm('');
    setForgotMode(false);
  }

  function openForgot() {
    setForgotMode(true);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirm('');
  }

  function closeForgot() {
    setForgotMode(false);
    setError(null);
    setSuccess(null);
  }

  async function handleForgot() {
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    setLoading(true);
    setError(null);
    const err = await resetPassword(email.trim());
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSuccess('E-mail enviado! Verifique sua caixa de entrada para redefinir a senha.');
    }
  }

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    if (tab === 'signup') {
      if (!name.trim()) {
        setError('Informe seu nome.');
        return;
      }
      if (!isValidCpf(cpf)) {
        setError('CPF inválido.');
        return;
      }
      if (password.length < 8 || password.length > 72) {
        setError('A senha deve ter entre 8 e 72 caracteres.');
        return;
      }
      if (password !== confirm) {
        setError('As senhas não coincidem.');
        return;
      }
    }
    setLoading(true);
    const err = tab === 'signup'
      ? await signUp(email.trim(), password, name.trim(), cpf.replace(/\D/g, ''))
      : await signIn(email.trim(), password);
    if (err) setError(err);
    setLoading(false);
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: '#fef7fe',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        paddingVertical: 48,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <MotiView
        from={{ opacity: 0, translateY: 24 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 700 }}
        style={{ width: '100%', maxWidth: 380 }}
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: '#e1cdf4',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Scissors size={32} color="#68597a" />
          </View>
          <Text style={{
            fontSize: 32, fontWeight: '700', color: '#68597a',
            fontStyle: 'italic', letterSpacing: -0.5,
          }}>
            {salonName}
          </Text>
          <Text style={{ color: '#625d67', fontSize: 13, marginTop: 4 }}>
            Painel de Gestão
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {([['login', 'Entrar'], ['signup', 'Criar conta']] as const).map(([t, label]) => (
            <TouchableOpacity key={t} onPress={() => switchTab(t)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 50, alignItems: 'center', backgroundColor: tab === t ? '#68597a' : '#e8e0ec' }}>
              <Text style={{ fontWeight: '700', color: tab === t ? '#fff' : '#625d67' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={{
          backgroundColor: '#e8e0ec', borderRadius: 32,
          padding: 32, gap: 16,
        }}>
          {forgotMode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <TouchableOpacity onPress={closeForgot} style={{ marginRight: 10 }}>
                <ArrowLeft size={18} color="#68597a" />
              </TouchableOpacity>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#68597a' }}>Recuperar senha</Text>
            </View>
          )}

          {/* Nome — só no cadastro */}
          {tab === 'signup' && !forgotMode && (
          <View>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: '#625d67',
              textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
            }}>
              Nome completo
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              autoCapitalize="words"
              style={{
                backgroundColor: '#f9f1fa', borderRadius: 16,
                paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 15, color: '#35313a',
              }}
            />
          </View>
          )}

          {/* CPF — só no cadastro */}
          {tab === 'signup' && !forgotMode && (
          <View>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: '#625d67',
              textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
            }}>
              CPF
            </Text>
            <TextInput
              value={cpf}
              onChangeText={v => setCpf(maskCpf(v))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
              style={{
                backgroundColor: '#f9f1fa', borderRadius: 16,
                paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 15, color: '#35313a',
              }}
            />
          </View>
          )}
          {/* E-mail */}
          <View>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: '#625d67',
              textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
            }}>
              E-mail
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: '#f9f1fa', borderRadius: 16,
                paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 15, color: '#35313a',
              }}
            />
          </View>

          {/* Senha — oculto no modo esqueci */}
          {!forgotMode && (
          <View>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: '#625d67',
              textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
            }}>
              Senha
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              style={{
                backgroundColor: '#f9f1fa', borderRadius: 16,
                paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 15, color: '#35313a',
              }}
            />
          </View>
          )}

          {/* Confirmar senha (só no cadastro) */}
          {tab === 'signup' && !forgotMode && (
            <View>
              <Text style={{
                fontSize: 10, fontWeight: '700', color: '#625d67',
                textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
              }}>
                Confirmar Senha
              </Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                secureTextEntry
                style={{
                  backgroundColor: '#f9f1fa', borderRadius: 16,
                  paddingHorizontal: 16, paddingVertical: 14,
                  fontSize: 15, color: '#35313a',
                }}
              />
            </View>
          )}

          {error && (
            <Text style={{
              color: '#ba1a1a', fontSize: 13, textAlign: 'center',
              backgroundColor: '#ffedec', borderRadius: 12, padding: 10,
            }}>
              {error}
            </Text>
          )}

          {success && (
            <Text style={{
              color: '#3a6264', fontSize: 13, textAlign: 'center',
              backgroundColor: '#d0fcfe', borderRadius: 12, padding: 10,
            }}>
              {success}
            </Text>
          )}

          <TouchableOpacity
            onPress={forgotMode ? handleForgot : handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#68597a80' : '#68597a',
              borderRadius: 50, paddingVertical: 18,
              alignItems: 'center', marginTop: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {loading
                ? (forgotMode ? 'Enviando…' : tab === 'login' ? 'Entrando…' : 'Criando conta…')
                : (forgotMode ? 'Enviar e-mail' : tab === 'login' ? 'Entrar' : 'Criar conta')}
            </Text>
          </TouchableOpacity>

          {/* Link esqueci minha senha — só na aba login */}
          {tab === 'login' && !forgotMode && (
            <TouchableOpacity onPress={openForgot} style={{ alignItems: 'center', marginTop: -4 }}>
              <Text style={{ color: '#68597a', fontSize: 13, fontWeight: '600' }}>Esqueci minha senha</Text>
            </TouchableOpacity>
          )}
        </View>
      </MotiView>
    </ScrollView>
  );
}
