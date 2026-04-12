import { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { supabase } from '../supabase';

export interface SalonSettings {
  id: string;
  salon_name: string;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  instagram: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  primary_color: string | null;
  closed_dates?: string[] | null;
}

const DEFAULT_NAME = 'Meu Salão';

// ── Context ───────────────────────────────────────────────────────────────────
import React from 'react';

interface SalonSettingsContextValue {
  settings: SalonSettings | null;
  salonName: string;
  loading: boolean;
  refetch: () => void;
  updateSettings: (fields: Partial<Omit<SalonSettings, 'id'>>) => Promise<void>;
}

export const SalonSettingsContext = createContext<SalonSettingsContextValue>({
  settings: null,
  salonName: DEFAULT_NAME,
  loading: true,
  refetch: () => {},
  updateSettings: async () => {},
});

export function SalonSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .single();

      if (!cancelled) {
        setSettings(data ?? null);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  async function updateSettings(fields: Partial<Omit<SalonSettings, 'id'>>) {
    try {
      if (settings?.id) {
        const { data, error } = await supabase
          .from('settings')
          .update(fields)
          .eq('id', settings.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        setSettings(data);
      } else {
        const { data, error } = await supabase
          .from('settings')
          .insert(fields)
          .select()
          .single();
        if (error) throw new Error(error.message);
        setSettings(data);
      }
    } catch (err: any) {
      console.error('updateSettings error:', err);
      if (err.message?.includes('Failed to fetch') || err instanceof TypeError) {
        throw new Error('Falha na conexão com o servidor. Verifique sua internet.');
      }
      throw err;
    }
  }

  return React.createElement(SalonSettingsContext.Provider, {
    value: {
      settings,
      salonName: settings?.salon_name ?? DEFAULT_NAME,
      loading,
      refetch,
      updateSettings,
    },
  }, children);
}

export function useSalonSettings() {
  return useContext(SalonSettingsContext);
}
