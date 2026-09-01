'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client.
 *
 * `persistSession` (the default) stores the session in localStorage, which is
 * what lets a returning visitor skip the login screen entirely — user-flows.md
 * §2's "returning user" path, with "a local User row exists" swapped for "a
 * valid Supabase session exists".
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly at import time rather than producing a client that 401s on
  // every call — a missing env var should look like a missing env var.
  throw new Error(
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (and in the Vercel project).',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
