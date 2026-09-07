'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getEmailValidationError } from '@/lib/email';

/**
 * Session state.
 *
 * Deliberately separate from AppContext: auth resolves first and decides
 * whether there is a user at all, and only then does AppContext load that
 * user's habits. Folding them together would mean every habit query had to
 * guard against "no session yet".
 *
 * The Supabase client persists the session to localStorage, so a returning
 * visitor is already signed in when this mounts — user-flows.md §2's returning
 * user path, with "a valid session exists" standing in for "a local User row
 * exists".
 */

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthValue {
  status: AuthStatus;
  session: Session | null;
  userId: string | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });

    // Covers sign-in, sign-out and token refresh from any tab.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const emailError = getEmailValidationError(email);
    if (emailError) throw new Error(emailError);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(humanAuthError(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const emailError = getEmailValidationError(email);
    if (emailError) throw new Error(emailError);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Read by the on_auth_user_created trigger to name the profile row.
      options: { data: { name: name.trim() } },
    });
    if (error) throw new Error(humanAuthError(error.message));
    // With "Confirm email" off, signUp returns a live session and the user is
    // straight in. If it's on, there's no session and they'd have to go via
    // their inbox — which the caller surfaces rather than silently hanging.
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthValue = {
    status,
    session,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Supabase's raw messages are terse and sometimes cryptic; never show them raw. */
function humanAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password don’t match.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'There’s already an account with that email — try signing in.';
  if (m.includes('password')) return 'Password needs to be at least 6 characters.';
  if (m.includes('invalid') && m.includes('email')) return 'That doesn’t look like a valid email address.';
  if (m.includes('rate limit')) return 'Too many attempts just now — wait a moment and try again.';
  return message;
}
