'use client';
import { signInWithRedirect, signOut, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';

export async function startLogin() {
  await signInWithRedirect();
}

export async function logout() {
  await signOut();
}

export async function currentUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function getIdToken(): Promise<string | null> {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString() ?? null;
}
