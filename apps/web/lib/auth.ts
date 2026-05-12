'use client';

const ID_TOKEN_KEY = 'lifeos.idToken';
const ACCESS_TOKEN_KEY = 'lifeos.accessToken';
const REFRESH_TOKEN_KEY = 'lifeos.refreshToken';
const EXPIRES_AT_KEY = 'lifeos.expiresAt';
const PKCE_VERIFIER_KEY = 'lifeos.pkceVerifier';
const PKCE_STATE_KEY = 'lifeos.pkceState';

const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? '';
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '';
const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI ?? '';

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(buf);
}

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

export async function startLogin(): Promise<void> {
  const verifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = randomString(32);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `https://${cognitoDomain}/oauth2/authorize?${params.toString()}`;
}

interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function handleCallback(code: string, state: string): Promise<void> {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(PKCE_STATE_KEY);
  if (!verifier) throw new Error('Missing PKCE verifier in sessionStorage');
  if (state !== expectedState) throw new Error('State mismatch');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(`https://${cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  const tokens = (await res.json()) as TokenResponse;

  localStorage.setItem(ID_TOKEN_KEY, tokens.id_token);
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  if (tokens.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + tokens.expires_in * 1000));

  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);
}

export function getIdTokenSync(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(ID_TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) ?? 0);
  if (!token || Date.now() > expiresAt) return null;
  return token;
}

export async function getIdToken(): Promise<string | null> {
  return getIdTokenSync();
}

export async function currentUser(): Promise<{ sub: string; email?: string } | null> {
  const token = getIdTokenSync();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]!));
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: redirectUri.replace('/auth/callback', '/'),
  });
  window.location.href = `https://${cognitoDomain}/logout?${params.toString()}`;
}
