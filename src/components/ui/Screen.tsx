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
 * The bottom padding here is the global fix for the audit bug that recurred on
 * three screens (design-system.md §3, definition-of-done.md): every scrollable
 * screen reserves >= tab-bar height (64px) + 16px, so the last item is never
 * clipped. Applying it once in the shell — rather than per screen — is what
 * stops it recurring a fourth time.
 */
export function Screen({
  children,
  className,
  /** Dashboard-style screens (Home, Statistics) get more room than reading widths. */
  width = 'reading',
}: {
  children: React.ReactNode;
  className?: string;
  width?: 'reading' | 'wide';
}) {
  return (
    <main
      className={cn(
        // Desktop: clear the fixed 240px sidebar.
        'min-h-dvh lg:pl-60',
      )}
    >
      <div
        className={cn(
          // Content margin: 20px mobile, scaling up on tablet/desktop (§3).
          'mx-auto px-5 pt-6 sm:px-8 lg:px-12',
          // pb-20 = 80px = 64px tab bar + 16px, per §3. Desktop has no bottom bar
          // but keeps breathing room.
          'pb-20 lg:pb-16',
          width === 'reading' ? 'max-w-[760px]' : 'max-w-[1180px]',
          className,
        )}
      >
        {children}
      </div>
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
        {eyebrow && (
          <p className="mb-1 text-caption1 uppercase tracking-wide text-label-secondary">
            {eyebrow}
          </p>
        )}
        {/* Large Title uses the SYSTEM font — the display face is scoped to the
            wordmark, hero numbers and onboarding headlines only (§2.2). */}
        <h1 className="text-large-title font-bold leading-tight">{title}</h1>
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
      <h1 className="min-w-0 flex-1 truncate text-large-title font-bold leading-tight">{title}</h1>
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
