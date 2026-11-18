import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { withTimeout, translateAuthError } from './authErrors';
import type { Client } from './types';
import { authenticateWithPasskey } from './hooks/useWebAuthn';
import { storageGet, storageRemove, storageSet } from './platform';

interface ClientAuthState {
  client: Client | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithPasskey: (clientId: string) => Promise<boolean>;
  registerWithInvite: (token: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
}

const ClientAuthContext = createContext<ClientAuthState>({
  client: null,
  loading: true,
  signInWithEmail: async () => {},
  signInWithPasskey: async () => false,
  registerWithInvite: async () => {},
  signOut: () => {},
  error: null,
});

const SESSION_KEY = 'client_session_id';

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session with web/native-safe storage adapter.
  useEffect(() => {
    const saved = storageGet(SESSION_KEY);
    if (!saved) { setLoading(false); return; }

    supabase
      .from('clients')
      .select('*')
      .eq('id', saved)
      .single()
      .then(({ data }) => {
        setClient(data ?? null);
        setLoading(false);
      });
  }, []);

  async function signInWithEmail(email: string, password: string) {
    setError(null);
    let user;
    try {
      const res = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
      if (res.error) throw new Error(translateAuthError(res.error.message));
      user = res.data;
    } catch (e: any) {
      throw new Error(translateAuthError(e?.message));
    }

    // Find client linked to this auth user
    const { data: clientData, error: clientError } = await withTimeout(
      supabase.from('clients').select('*').eq('user_id', user.user?.id).maybeSingle(),
    ).catch((e: any) => ({ data: null, error: e as Error }));

    if (clientError || !clientData) throw new Error('Cliente não encontrado. Entre em contato com o salão.');
    setClient(clientData);
    storageSet(SESSION_KEY, clientData.id);
  }

  async function signInWithPasskey(clientId: string): Promise<boolean> {
    setError(null);
    const ok = await authenticateWithPasskey(clientId);
    if (!ok) return false;

    const { data } = await supabase.from('clients').select('*').eq('id', clientId).single();
    if (data) {
      setClient(data);
      storageSet(SESSION_KEY, data.id);
      return true;
    }
    return false;
  }

  async function registerWithInvite(token: string, email: string, password: string) {
    setError(null);
    const generic = 'Convite inválido, expirado ou já utilizado. Peça um novo convite ao salão.';
    let res;
    try {
      res = await withTimeout(
        supabase.functions.invoke('register-client', { body: { token: token.trim(), email: email.trim(), password } }),
      );
    } catch (e: any) {
      throw new Error(translateAuthError(e?.message));
    }
    if (res.error) {
      const r = (res.error as any).context as Response | undefined;
      if (r && typeof r.status === 'number') {
        throw new Error(r.status === 429 ? 'Muitas tentativas. Aguarde um instante e tente novamente.' : generic);
      }
      throw new Error(translateAuthError(res.error.message));
    }
    if (!res.data?.ok) throw new Error(generic);
    await signInWithEmail(email.trim(), password);
  }
  const signOut = useCallback(() => {
    setClient(null);
    storageRemove(SESSION_KEY);
  }, []);

  return (
    <ClientAuthContext.Provider value={{ client, loading, signInWithEmail, signInWithPasskey, registerWithInvite, signOut, error }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  return useContext(ClientAuthContext);
}
