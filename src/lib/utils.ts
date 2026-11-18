import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Local-timezone YYYY-MM-DD (no UTC shift). */
export function toLocalISODate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayLocalISO(): string {
  return toLocalISODate(new Date());
}

/** Parses a date-only string (YYYY-MM-DD) as local midnight, avoiding the UTC shift. */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

type UserLike = { email?: string | null; user_metadata?: Record<string, any> | null } | null | undefined;

/** Person's name: metadata name, else capitalized e-mail prefix without digits/underscores. */
export function displayName(user: UserLike): string {
  const meta = user?.user_metadata;
  const name = String(meta?.name || meta?.full_name || '').trim();
  if (name) return name;
  const prefix = (user?.email ?? '').split('@')[0].replace(/[\d_.\-]+/g, ' ').trim();
  if (!prefix) return 'você';
  return prefix.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function userGender(user: UserLike): 'F' | 'M' | 'O' {
  const g = user?.user_metadata?.gender;
  return g === 'F' || g === 'M' ? g : 'O';
}

export function welcomeWord(gender?: string | null): string {
  return gender === 'F' ? 'Bem-vinda' : gender === 'M' ? 'Bem-vindo' : 'Boas-vindas';
}

/** "HH:MM:SS" -> "HH:MM". */
export function formatTime(t?: string | null): string {
  return t ? t.slice(0, 5) : '';
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
