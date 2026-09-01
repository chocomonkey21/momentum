'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { spring, reducedFade } from '@/theme/theme';

type Mode = 'signIn' | 'signUp';

/**
 * Splash + Login / Signup.
 *
 * This is the app's front door now that accounts are real: Splash -> here ->
 * (new users) onboarding -> Home. Returning visitors with a persisted session
 * never see it, because the root layout redirects them straight to Home.
 *
 * Email + password rather than a magic link, deliberately — a live demo
 * shouldn't depend on an email arriving on time.
 */
export default function LoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { status, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in (persisted session) — don't sit on the login screen.
  useEffect(() => {
    if (status === 'signedIn') router.replace('/');
  }, [status, router]);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
        router.replace('/');
      } else {
        const { needsConfirmation } = await signUp(email, password, name || email.split('@')[0]);
        if (needsConfirmation) {
          // "Confirm email" is still on in Supabase Auth settings. Say so
          // plainly instead of leaving the user on a dead screen.
          setNotice(
            'Account created, but this project still requires email confirmation. Check your inbox, then sign in.',
          );
          setMode('signIn');
        } else {
          // New account -> pick goals and first habits (user-flows.md §1).
          router.replace('/onboarding');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-between px-6 pb-10 pt-16">
      {/* Splash wordmark — Righteous 50px, the one screen with its own face. */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? reducedFade : spring.default}
        className="flex flex-1 flex-col items-center justify-center text-center"
      >
        <h1 className="font-wordmark leading-none">MOMENTUM</h1>
        <p className="mt-4 max-w-[26ch] text-subheadline text-label-secondary">
          Build better days. Miss one and your progress dips — it doesn&rsquo;t disappear.
        </p>
      </motion.div>

      <section className="flex flex-col gap-3">
        <div className="mb-1 flex gap-2" role="tablist" aria-label="Sign in or create an account">
          {(['signIn', 'signUp'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              className={cn(
                'flex-1 rounded-[var(--radius-block)] py-3 text-subheadline font-semibold transition-colors',
                mode === m ? 'bg-white text-black' : 'bg-white/[0.05] text-label-secondary',
              )}
            >
              {m === 'signIn' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {mode === 'signUp' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduce ? reducedFade : spring.default}
              className="overflow-hidden"
            >
              <label htmlFor="name" className="font-data mb-2 block text-[10px] text-label-tertiary">
                Your name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shreyas"
                autoComplete="name"
                className={fieldClass}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <label htmlFor="email" className="font-data mb-2 block text-[10px] text-label-tertiary">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="font-data mb-2 block text-[10px] text-label-tertiary">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            placeholder="At least 6 characters"
            className={fieldClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-footnote text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-footnote text-warning">
            {notice}
          </p>
        )}

        <Button fullWidth loading={busy} onClick={submit} className="mt-2">
          {mode === 'signIn' ? 'Sign in' : 'Create account'}
        </Button>
      </section>
    </main>
  );
}

const fieldClass = cn(
  'w-full rounded-[var(--radius-block)] bg-white/[0.05] px-4 py-3.5',
  'text-body text-label-primary placeholder:text-label-tertiary',
  'border border-transparent transition-colors focus:border-tint',
);
