// Small helpers shared by the splash and game pages.

export const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
};

export const fmt = (n: number): string => n.toLocaleString('en-US');

export const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type ApiError = { status: 'error'; message: string };
const isApiError = (v: unknown): v is ApiError =>
  typeof v === 'object' && v !== null && (v as { status?: unknown }).status === 'error';

/** GET when no body is given, POST with a JSON body otherwise. Throws with the server's message on failure. */
export const fetchJson = async <T>(url: string, body?: unknown): Promise<T> => {
  const res = await fetch(url, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok || isApiError(json)) {
    throw new Error(isApiError(json) ? json.message : `Request failed (${res.status})`);
  }
  return json as T;
};

export type Settings = { sound: boolean; shake: boolean; played: boolean };

const KEY = 'lanternfall.settings';

export const loadSettings = (): Settings => {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base: Settings = { sound: true, shake: !reduce, played: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // storage can be unavailable inside some webviews
  }
  return base;
};

export const saveSettings = (s: Settings): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
};
