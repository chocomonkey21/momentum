'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import { reducedFade } from '@/theme/theme';

/**
 * Screen shell.
 *
 * The app renders as a single phone-width column at EVERY viewport — see
 * AppFrame in app/layout.tsx. That is a deliberate departure from
 * design-system.md §3 and CLAUDE.md §10, which specified a responsive build
 * with a desktop sidebar and multi-column dashboards; the client asked for one
 * consistent vertical app presentation instead. Screens therefore no longer
 * carry width variants or breakpoint-specific column layouts.
 *
 * The bottom padding here is the global fix for the audit bug that recurred on
 * three screens: every scrollable screen reserves >= tab-bar height (64px) +
 * 16px, so the last item is never clipped. Applying it once in the shell —
 * rather than per screen — is what stops it recurring a fourth time.
 */
export function Screen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  /** Retained so existing call sites keep compiling; the frame is fixed-width now. */
  width?: 'reading' | 'wide';
}) {
  return (
    <main className="min-h-dvh">
      <div className={cn('px-5 pb-24 pt-6', className)}>{children}</div>
    </main>
  );
}

/** Large Title header for a tab-root screen, with an optional trailing action. */
export function ScreenHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="font-data mb-2 text-[10px] text-label-tertiary">{eyebrow}</p>}
        <h1 className="font-display text-large-title leading-[1.05]">{title}</h1>
      </div>
      {action}
    </header>
  );
}

/** Header for a pushed (non-root) screen — always has a visible way back. */
export function PushedHeader({
  title,
  action,
  fallbackHref = '/',
}: {
  title: string;
  action?: React.ReactNode;
  fallbackHref?: string;
}) {
  const router = useRouter();
  return (
    <header className="mb-6 flex items-center gap-2">
      <IconButton
        label="Go back"
        className="-ml-3"
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push(fallbackHref);
        }}
      >
        <ChevronLeft size={24} aria-hidden />
      </IconButton>
      <h1 className="font-display min-w-0 flex-1 truncate text-large-title leading-[1.05]">{title}</h1>
      {action}
    </header>
  );
}

/**
 * Page transition wrapper. interaction-spec.md §9: tab switches cross-fade
 * (siblings, not a stack). We use a cross-fade throughout rather than a
 * directional slide, because the desktop layout has a persistent sidebar that a
 * horizontal slide would read oddly against.
 */
export function PageFade({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduce ? reducedFade : { duration: 0.15, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
