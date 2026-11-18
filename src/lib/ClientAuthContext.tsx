import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { todayLocalISO } from './utils';
import { withTimeout, translateAuthError } from './authErrors';
import type { Client } from './types';
import { authenticateWithPasskey } from './hooks/useWebAuthn';
import { storageGet, storageRemove, storageSet } from './platform';

interface ClientAuthState {
  client: Client | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithPasskey: (clientId: string) => Promise<boolean>;
  signUp: (name: string, phone: string, email: string, address: string, password: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
}

const ClientAuthContext = createContext<ClientAuthState>({
  client: null,
  loading: true,
  signInWithEmail: async () => {},
  signInWithPasskey: async () => false,
  signUp: async () => {},
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

  async function signUp(name: string, phone: string, email: string, address: string, password: string) {
    setError(null);
    let authData;
    try {
      // is_client/name/phone/address feed the backend trigger that creates the clients row.
      const res = await withTimeout(supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { is_client: true, name: name.trim(), phone: phone.trim(), address: address.trim() } },
      }));
      if (res.error) throw new Error(res.error.message);
      authData = res.data;
    } catch (e: any) {
      throw new Error(translateAuthError(e?.message));
    }
    const userId = authData.user?.id;
    if (!userId) throw new Error('Erro ao criar conta. Tente novamente.');
    if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
      throw new Error('Este e-mail já está cadastrado.');
    }

    // Without a session (e-mail confirmation on) RLS hides the row; the user finishes on first login.
    if (!authData.session) return;

    const findClient = () => supabase.from('clients').select('*').eq('user_id', userId).maybeSingle();
    let { data: found } = await findClient();

    if (!found) {
      // Fallback for databases without the signup trigger: tolerate an already-existing row.
      await supabase.from('clients').insert({
        name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() || null,
        user_id: userId, status: 'Ativo', member_since: todayLocalISO(),
      });
      ({ data: found } = await findClient());
    }

    if (found) {
      setClient(found);
      storageSet(SESSION_KEY, found.id);
    }
  }

  const signOut = useCallback(() => {
    setClient(null);
    storageRemove(SESSION_KEY);
  }, []);

  return (
    <ClientAuthContext.Provider value={{ client, loading, signInWithEmail, signInWithPasskey, signUp, signOut, error }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  return useContext(ClientAuthContext);
}
