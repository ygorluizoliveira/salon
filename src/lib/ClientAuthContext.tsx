import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
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
    const { data: user, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw new Error(authError.message);

    // Find client linked to this auth user
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.user?.id)
      .single();

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
    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw new Error(authError.message);
    const userId = authData.user?.id;
    if (!userId) throw new Error('Erro ao criar conta. Tente novamente.');

    // 2. Create client record linked to auth user
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({ name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() || null, user_id: userId, status: 'Ativo', member_since: new Date().toISOString().slice(0, 10) })
      .select('*')
      .single();

    if (insertError) throw new Error(insertError.message);
    setClient(newClient);
    storageSet(SESSION_KEY, newClient.id);
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
