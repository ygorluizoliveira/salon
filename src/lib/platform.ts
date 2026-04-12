const memoryStore = new Map<string, string>();

export function getAppBaseUrl(): string {
  const envUrl = (import.meta as any)?.env?.VITE_APP_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // Safe fallback for non-web runtimes.
  return 'http://localhost:3000';
}

export function storageGet(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryStore.get(key) ?? null;
}

export function storageSet(key: string, value: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  memoryStore.set(key, value);
}

export function storageRemove(key: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  memoryStore.delete(key);
}
