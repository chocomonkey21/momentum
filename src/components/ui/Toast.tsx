'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { reducedFade } from '@/theme/theme';

/**
 * Toast host (interaction-spec.md §8): slides down from the top edge, 2.5s on
 * screen, replaced immediately by a newer toast rather than queued.
 * The 2.5s auto-dismiss timer lives in AppContext.
 */
export function ToastHost() {
  const { toast, dismissToast } = useApp();
  const reduce = useReducedMotion();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed left-1/2 top-0 z-[60] flex w-full max-w-[440px] -translate-x-1/2 justify-center px-4 pt-4"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reduce ? reducedFade : { duration: 0.25, ease: 'easeOut' }}
            className={[
              // Flat, opaque surface: §4 scopes blur to the nav and sheet
              // scrims, and a toast needs no shadow to read above the page.
              'pointer-events-auto flex items-center gap-4 rounded-[var(--radius-pill)]',
              'bg-app-amber px-5 py-3 text-black',
            ].join(' ')}
          >
            <span className="text-subheadline font-medium">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="font-display min-h-[24px] text-[14px] uppercase tracking-[0.04em] underline underline-offset-4"
                onClick={() => {
                  toast.onAction?.();
                  dismissToast();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
