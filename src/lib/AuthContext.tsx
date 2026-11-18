import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getAppBaseUrl } from './platform';
import { withTimeout, translateAuthError } from './authErrors';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name?: string, cpf?: string, gender?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
  resetPassword: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
      return error ? translateAuthError(error.message) : null;
    } catch (e: any) {
      return translateAuthError(e?.message);
    }
  }

  async function signUp(email: string, password: string, name?: string, cpf?: string, gender?: string): Promise<string | null> {
    const generic = 'Não foi possível criar a conta. Verifique os dados e tente novamente.';
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('register-staff', { body: { email, cpf, password, name, gender } }),
      );
      if (error) {
        const res = (error as any).context as Response | undefined;
        if (res && typeof res.status === 'number') {
          if (res.status === 429) return 'Muitas tentativas. Aguarde um instante e tente novamente.';
          return generic;
        }
        return translateAuthError(error.message);
      }
      if (!data?.ok) return generic;
      return await signIn(email, password);
    } catch (e: any) {
      return translateAuthError(e?.message);
    }
  }

  async function signOut() {
    try {
      // Local sign-out avoids relying on /auth/v1/logout when network/proxy resets requests.
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Fallback to default behavior if local scope is not available for any reason.
      await supabase.auth.signOut();
    } finally {
      try { localStorage.removeItem('sb-salon-admin'); } catch { /* ignore */ }
    }
  }

  async function resetPassword(email: string): Promise<string | null> {
    try {
      const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppBaseUrl()}/reset-password`,
      }));
      return error ? translateAuthError(error.message) : null;
    } catch (e: any) {
      return translateAuthError(e?.message);
    }
  }

  const isAdmin = session?.user?.app_metadata?.role === 'admin';

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, isAdmin, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
