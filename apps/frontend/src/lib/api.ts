export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('pos_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...headers, ...(init?.headers as any) }, ...init });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const data = await res.json();
      let raw = (data && (data.error || data.message)) || 'Request failed';
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
      throw new Error(`${res.status} ${res.statusText} - ${msg}`);
    } else {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText} - ${text || 'Request failed'}`);
    }
  }
  if (contentType.includes('application/json')) return res.json();
  // @ts-expect-error allow non-json
  return undefined;
}
