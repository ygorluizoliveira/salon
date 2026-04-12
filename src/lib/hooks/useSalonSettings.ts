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
const SETTINGS_CACHE_KEY = 'salon-settings-cache-v1';

function readCachedSettings(): SalonSettings | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SalonSettings;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedSettings(value: SalonSettings | null) {
  try {
    if (!value) {
      window.localStorage.removeItem(SETTINGS_CACHE_KEY);
      return;
    }
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage errors to avoid breaking app flow.
  }
}

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
  const [settings, setSettings] = useState<SalonSettings | null>(() => readCachedSettings());
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('loadSettings error:', error.message);
          return;
        }

        const next = data ?? null;
        setSettings(next);
        writeCachedSettings(next);
      } catch (err: any) {
        if (cancelled) return;
        console.error('loadSettings exception:', err?.message ?? err);
      } finally {
        if (!cancelled) setLoading(false);
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
        writeCachedSettings(data);
      } else {
        const insertPayload = {
          salon_name: fields.salon_name ?? DEFAULT_NAME,
          ...fields,
        };
        const { data, error } = await supabase
          .from('settings')
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw new Error(error.message);
        setSettings(data);
        writeCachedSettings(data);
      }
      window.dispatchEvent(new Event('salon-settings-changed'));
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
