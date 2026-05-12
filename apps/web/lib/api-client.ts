'use client';
import { getIdToken } from './auth';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
