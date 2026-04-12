import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useClientAuth } from '../lib/ClientAuthContext';
import { webAuthnSupported } from '../lib/hooks/useWebAuthn';
import { supabase } from '../lib/supabase';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';

type Mode = 'login' | 'register';
type LoginMethod = 'senha' | 'digital';

export function ClientLogin() {
  const { signInWithEmail, signInWithPasskey, signUp } = useClientAuth();
  const { salonName } = useSalonSettings();

  const [mode, setMode] = useState<Mode>('login');

  // Login state
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('senha');
  const [passkeyEmail, setPasskeyEmail] = useState('');

  // Register state
  const [regName, setRegName]       = useState('');
  const [regPhone, setRegPhone]     = useState('');
  const [regEmail, setRegEmail]     = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [registered, setRegistered] = useState(false);

  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(m: Mode) { setMode(m); setError(null); }

  async function handleEmailLogin() {
    setError(null); setLoading(true);
    try { await signInWithEmail(email, password); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handlePasskeyLogin() {
    setError(null); setLoading(true);
    try {
      const { data: c } = await supabase.from('clients').select('id').eq('email', passkeyEmail.trim()).single();
      if (!c) { setError('E-mail não encontrado.'); setLoading(false); return; }
      const ok = await signInWithPasskey(c.id);
      if (!ok) setError('Autenticação biométrica falhou. Tente com e-mail e senha.');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleRegister() {
    setError(null);
    if (regPassword !== regPassword2) { setError('As senhas não coincidem.'); return; }
    if (regPassword.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    setLoading(true);
    try {
      await signUp(regName, regPhone, regEmail, regAddress, regPassword);
      setRegistered(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <ScrollView contentContainerStyle={{
      minHeight: '100%', backgroundColor: '#fef7fe',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 36, backgroundColor: '#e1cdf4',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <Text style={{ fontSize: 32 }}>✂️</Text>
        </View>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#68597a', fontStyle: 'italic' }}>{salonName}</Text>
        <Text style={{ color: '#625d67', fontSize: 13, marginTop: 4 }}>Área do Cliente</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24, width: '100%', maxWidth: 400 }}>
        {(['login', 'register'] as Mode[]).map(m => (
          <TouchableOpacity key={m} onPress={() => switchMode(m)} style={{
            flex: 1, paddingVertical: 12, borderRadius: 50,
            backgroundColor: mode === m ? '#68597a' : '#e8e0ec', alignItems: 'center',
          }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: mode === m ? '#fff' : '#625d67' }}>
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{
        backgroundColor: '#fff', borderRadius: 32, padding: 24,
        width: '100%', maxWidth: 400,
      }}>
        {mode === 'register' && (
          registered ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
              <Text style={{ color: '#68597a', marginBottom: 8, fontSize: 20, fontWeight: '700' }}>Conta criada!</Text>
              <Text style={{ color: '#625d67', fontSize: 14, textAlign: 'center' }}>
                {regEmail.includes('@') ? 'Verifique seu e-mail para confirmar, depois volte para entrar.' : 'Já pode acessar sua área.'}
              </Text>
              <TouchableOpacity onPress={() => { switchMode('login'); setRegistered(false); }} style={btnStyle(false)}>
                <Text style={btnTextStyle}>Ir para o login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={labelStyle}>Nome completo</Text>
              <TextInput value={regName} onChangeText={setRegName} placeholder="Seu nome" style={inputStyle} />

              <Text style={{ ...labelStyle, marginTop: 14 }}>Telefone / WhatsApp</Text>
              <TextInput value={regPhone} onChangeText={setRegPhone} placeholder="(11) 99999-9999" style={inputStyle} keyboardType="phone-pad" />

              <Text style={{ ...labelStyle, marginTop: 14 }}>E-mail</Text>
              <TextInput value={regEmail} onChangeText={setRegEmail} placeholder="seu@email.com" style={inputStyle} autoCapitalize="none" keyboardType="email-address" />

              <Text style={{ ...labelStyle, marginTop: 14 }}>Endereço</Text>
              <TextInput value={regAddress} onChangeText={setRegAddress} placeholder="Rua, número, bairro, cidade" style={inputStyle} />

              <Text style={{ ...labelStyle, marginTop: 14 }}>Senha</Text>
              <TextInput value={regPassword} onChangeText={setRegPassword} placeholder="Mínimo 6 caracteres" style={inputStyle} secureTextEntry />

              <Text style={{ ...labelStyle, marginTop: 14 }}>Confirmar senha</Text>
              <TextInput value={regPassword2} onChangeText={setRegPassword2} placeholder="Repita a senha" style={inputStyle} secureTextEntry />

              {error && <Text style={errorStyle}>{error}</Text>}
              <TouchableOpacity disabled={loading} onPress={handleRegister} style={btnStyle(loading)}>
                <Text style={btnTextStyle}>{loading ? 'Criando conta...' : 'Criar conta'}</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {mode === 'login' && (
          <View>
            {webAuthnSupported && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                {(['senha', 'digital'] as LoginMethod[]).map(m => (
                  <TouchableOpacity key={m} onPress={() => { setLoginMethod(m); setError(null); }} style={{
                    flex: 1, paddingVertical: 10, borderRadius: 50, alignItems: 'center',
                    backgroundColor: loginMethod === m ? '#68597a' : '#e8e0ec',
                  }}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: loginMethod === m ? '#fff' : '#625d67' }}>
                      {m === 'senha' ? 'Senha' : 'Digital / Face ID'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {loginMethod === 'digital' ? (
              <View>
                <Text style={labelStyle}>Seu e-mail cadastrado</Text>
                <TextInput value={passkeyEmail} onChangeText={setPasskeyEmail} placeholder="seu@email.com" style={inputStyle} autoCapitalize="none" keyboardType="email-address" />
                {error && <Text style={errorStyle}>{error}</Text>}
                <TouchableOpacity disabled={loading} onPress={handlePasskeyLogin} style={btnStyle(loading)}>
                  <Text style={btnTextStyle}>{loading ? 'Aguarde...' : 'Entrar com biometria'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={labelStyle}>E-mail</Text>
                <TextInput value={email} onChangeText={setEmail} placeholder="seu@email.com" style={inputStyle} autoCapitalize="none" keyboardType="email-address" />
                <Text style={{ ...labelStyle, marginTop: 14 }}>Senha</Text>
                <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" style={inputStyle} secureTextEntry />
                {error && <Text style={errorStyle}>{error}</Text>}
                <TouchableOpacity disabled={loading} onPress={handleEmailLogin} style={btnStyle(loading)}>
                  <Text style={btnTextStyle}>{loading ? 'Entrando...' : 'Entrar'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const labelStyle = {
  fontSize: 10, fontWeight: '700', color: '#625d67',
  textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6,
};
const inputStyle = {
  width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16,
  backgroundColor: '#f0e9f8', fontSize: 15, color: '#35313a',
};
const errorStyle = {
  color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12,
  padding: '10px 14px', fontSize: 13, marginTop: 12, textAlign: 'center',
};
const btnStyle = (disabled: boolean) => ({
  width: '100%', paddingVertical: 16, borderRadius: 50,
  backgroundColor: disabled ? '#68597a80' : '#68597a', color: '#fff',
  alignItems: 'center',
  marginTop: 20,
});
const btnTextStyle = { color: '#fff', fontWeight: '700', fontSize: 16 };
