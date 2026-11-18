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

/** Máscara de telefone BR: (11) 99999-9999 / (11) 9999-9999 (máx. 11 dígitos). */
export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
}

/** Formata telefones antigos (com/sem máscara, com +55) para exibição. */
export function formatPhone(v?: string | null): string {
  let d = (v ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return maskPhone(d);
}

/** Válido: DDD 11–99 + 8 dígitos (fixo) ou 9 dígitos começando em 9 (celular). */
export function isValidPhone(v: string): boolean {
  const d = v.replace(/\D/g, '');
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 10) return true;
  return d.length === 11 && d[2] === '9';
}

export const PHONE_ERROR = 'Telefone inválido.';
export function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

export function isValidCpf(v: string): boolean {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[len])) return false;
  }
  return true;
}

export function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length > 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return d;
}

export function isValidCnpj(v: string): boolean {
  const d = v.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  for (const len of [12, 13]) {
    let sum = 0;
    let w = len - 7;
    for (let i = 0; i < len; i++) { sum += Number(d[i]) * w--; if (w < 2) w = 9; }
    const dv = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (dv !== Number(d[len])) return false;
  }
  return true;
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}