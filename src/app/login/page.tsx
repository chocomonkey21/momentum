'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { FloatingIcons } from '@/components/ui/FloatingIcons';
import { cn } from '@/lib/cn';
import { getEmailValidationError } from '@/lib/email';
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

  /**
   * A brand-new signup returns a live session, which flips `status` to
   * signedIn and would send this effect racing the onboarding redirect below —
   * and it won. New users skipped goal selection entirely and landed on an
   * empty Home. This flag lets the signup path own its own redirect.
   */
  const signingUp = useRef(false);

  // Already signed in (persisted session) — don't sit on the login screen.
  useEffect(() => {
    if (status === 'signedIn' && !signingUp.current) router.replace('/');
  }, [status, router]);

  async function submit() {
    setError(null);
    setNotice(null);
    const emailError = getEmailValidationError(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
        router.replace('/');
      } else {
        signingUp.current = true;
        const { needsConfirmation } = await signUp(email, password, name || email.split('@')[0]);
        if (needsConfirmation) {
          // "Confirm email" is still on in Supabase Auth settings. Say so
          // plainly instead of leaving the user on a dead screen.
          setNotice(
            'Account created, but this project still requires email confirmation. Check your inbox, then sign in.',
          );
          signingUp.current = false;
          setMode('signIn');
        } else {
          // New account -> pick goals and first habits (user-flows.md §1).
          router.replace('/onboarding');
        }
      }
    } catch (e) {
      signingUp.current = false;
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
        // Left-aligned: a centred paragraph is the fastest way to make a
        // product read as a template.
        className="relative flex min-h-[400px] flex-1 flex-col justify-center"
      >
        {/* The things people track, drifting around the name. */}
        <FloatingIcons />
        <div className="relative">
          <h1 className="font-wordmark leading-none" style={{ color: '#0b6bff' }}>
            MOMENTUM
          </h1>
          <p className="mt-4 max-w-[28ch] text-body leading-relaxed text-label-secondary">
            Build better days. Miss one and your progress dips — it doesn&rsquo;t disappear.
          </p>
        </div>
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
                'flex-1 rounded-[var(--radius-pill)] py-4 text-subheadline font-semibold transition-colors',
                mode === m ? 'bg-white text-black' : 'bg-bg-tertiary text-label-secondary',
              )}
            >
              {m === 'signIn' ? 'Sign In' : 'Create Account'}
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
              <label htmlFor="name" className="font-data mb-2 block text-label-tertiary">
                Your Name
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
          <label htmlFor="email" className="font-data mb-2 block text-label-tertiary">
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
          <label htmlFor="password" className="font-data mb-2 block text-label-tertiary">
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
          {mode === 'signIn' ? 'Sign In' : 'Create Account'}
        </Button>
      </section>
    </main>
  );
}

const fieldClass = cn(
  'w-full rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-4',
  'text-body text-label-primary placeholder:text-label-tertiary',
  'border-2 border-transparent transition-colors focus:border-tint',
);
