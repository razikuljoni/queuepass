const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BASE = `${API}/api/v1`;

export type Branch = { id: string; name: string; nameBn?: string | null; address?: string | null; orgName?: string; isOpen?: boolean };
export type Service = { id: string; name: string; nameBn?: string | null; codePrefix: string; avgServiceMin: number; isOpen?: boolean };
export type Counter = { id: string; name: string; status: 'open' | 'break' | 'closed'; currentTokenId?: string | null; services?: { id: string; name: string }[] };
export type TokenPosition = { position: number; peopleAhead: number; etaMin: number; etaLow: number; etaHigh: number; countersOpen: number; avgServiceMin: number };
export type TokenView = {
  id: string; number: string; seqNo: number; phone: string; name?: string | null; status: string;
  priority: string; source: string; publicCode: string; branchId: string; serviceId: string;
  counterId?: string | null; joinedAt: string; calledAt?: string | null; completedAt?: string | null;
  position?: TokenPosition; serviceName?: string; counterName?: string | null;
};
export type ManagerStats = { waiting: number; served: number; noShow: number; issued: number; countersOpen: number; countersTotal: number; avgWaitMin: number; avgServiceMin: number; noShowRate: number };
export type User = { id: string; orgId: string; email: string; name: string; role: string; branchIds: string[] };

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('qp_token');
}
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('qp_user') || 'null'); } catch { return null; }
}
export function saveSession(token: string, user: User) {
  localStorage.setItem('qp_token', token);
  localStorage.setItem('qp_user', JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem('qp_token');
  localStorage.removeItem('qp_user');
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data as { message?: string })?.message || `Request failed (${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return data as T;
}

export const apiUrl = (path: string) => `${BASE}${path}`;
export const streamUrl = (branchId: string) => `${BASE}/public/stream/${branchId}`;
