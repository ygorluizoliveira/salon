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

/** "HH:MM:SS" -> "HH:MM". */
export function formatTime(t?: string | null): string {
  return t ? t.slice(0, 5) : '';
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
