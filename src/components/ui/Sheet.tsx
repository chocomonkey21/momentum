'use client';

import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, reducedFade } from '@/theme/theme';
import { Button, IconButton } from './Button';

/**
 * Modal sheet (interaction-spec.md §7): slides up from the bottom with the
 * momentum spring (it's a physical "arriving" object), scrim is a plain opacity
 * fade with the blur treatment from design-system.md §4.
 *
 * Radix supplies focus trapping, Escape-to-close and focus restoration to the
 * trigger, which interaction-spec.md §15 requires.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={reduce ? { opacity: 0 } : { y: '100%' }}
                animate={reduce ? { opacity: 1 } : { y: 0 }}
                exit={reduce ? { opacity: 0 } : { y: '100%' }}
                transition={reduce ? reducedFade : spring.bouncy}
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto',
                  'rounded-t-[var(--radius-sheet)] border-t border-white/10 bg-bg-primary',
                  'px-5 pb-8 pt-4',
                  // Tablet/desktop: centre it rather than gluing a phone sheet to
                  // the bottom of a 1440px window.
                  'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,92vw)]',
                  'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-sheet)] sm:border',
                )}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray4 sm:hidden" aria-hidden />
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-title2 font-bold">{title}</Dialog.Title>
                    {description && (
                      <Dialog.Description className="mt-1 text-subheadline text-label-secondary">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <IconButton label="Close">
                      <X size={20} aria-hidden />
                    </IconButton>
                  </Dialog.Close>
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/**
 * Destructive confirmation (interaction-spec.md §13): required for habit
 * deletion, deliberately NOT used for chain deletion.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl" />
        <AlertDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2',
            'rounded-[var(--radius-sheet)] border border-white/10 bg-bg-secondary p-6',
          )}
        >
          <AlertDialog.Title className="text-headline font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-subheadline text-label-secondary">
            {body}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                onClick={onConfirm}
                className="bg-destructive text-white hover:brightness-110"
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
