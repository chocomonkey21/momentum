'use client';

import { useEffect, useState } from 'react';
import { Check, BellOff, LogOut } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Screen, PushedHeader, PageFade } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Sheet';
import { updateSettings, updateUserName } from '@/db/queries';
import { cn } from '@/lib/cn';
import { getDisplayNameValidationError } from '@/lib/validation';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Settings (ui-spec.md §14) — pushed from Profile, so it uses Title 2 and a
 * back-capable header rather than a tab-root Large Title.
 *
 * Notifications use the Web Notifications API. tech-stack.md scopes Phase 1 to
 * in-browser reminders only; true push needs a service worker plus a backend
 * subscription, which is Phase 2+.
 */
export default function SettingsPage() {
  const { userName, userId, notificationsEnabled, reminderTime, settingsId, showToast } = useApp();
  const { email, signOut } = useAuth();

  const [name, setName] = useState(userName);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>('default');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => setName(userName), [userName]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  async function toggleNotifications(next: boolean) {
    if (!settingsId) return;
    if (!next) {
      await updateSettings(settingsId, { notificationsEnabled: 0 });
      return;
    }
    if (permission === 'unsupported') return;
    if (permission === 'default') {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      // Denial is never a blocking gate — the app works fully without it
      // (user-flows.md §11).
      if (result !== 'granted') return;
    }
    if (permission === 'denied') return;
    await updateSettings(settingsId, { notificationsEnabled: 1 });
  }

  const blocked = permission === 'denied' || permission === 'unsupported';

  return (
    <Screen>
      <PageFade>
        <PushedHeader title="Settings" fallbackHref="/profile" />

        {/* --- Notifications --- */}
        <section className="mb-8">
          <h2 className="font-display mb-3 text-title2">Notifications</h2>

          <label
            className={cn(
              'flex min-h-[44px] cursor-pointer items-center justify-between gap-4',
              'rounded-[var(--radius-card)] bg-bg-secondary px-5 py-4',
              blocked && 'opacity-40',
            )}
          >
            <span>
              <span className="block text-body font-medium">Daily Reminders</span>
              <span className="block text-footnote text-label-secondary">
                A nudge in this browser while the app is open
              </span>
            </span>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              disabled={blocked}
              onChange={(e) => void toggleNotifications(e.target.checked)}
              className="toggle"
            />
          </label>

          {blocked && (
            <p className="mt-2 flex items-start gap-2 rounded-[var(--radius-block)] bg-bg-secondary p-4 text-footnote text-label-secondary">
              <BellOff size={14} className="mt-1 shrink-0" aria-hidden />
              <span>
                {permission === 'unsupported'
                  ? "This browser doesn't support notifications. Everything else works exactly the same."
                  : 'Notifications are blocked for this site. Re-enable them in your browser’s site settings, then come back — nothing else in the app depends on this.'}
              </span>
            </p>
          )}

          {/* Per-habit reminder controls stay hidden while the master toggle is
              off (ui-spec.md §14 disabled state). */}
          {notificationsEnabled && !blocked && (
            <div className="mt-3 rounded-[var(--radius-card)] bg-bg-secondary px-5 py-4">
              <label htmlFor="reminder-time" className="block text-body font-medium">
                Reminder Time
              </label>
              <p className="mb-3 text-footnote text-label-secondary">
                Time-constrained habits remind you 30 minutes before their deadline instead.
              </p>
              <input
                id="reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => {
                  if (settingsId) void updateSettings(settingsId, { reminderTime: e.target.value });
                }}
                className="rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-2 text-body [color-scheme:dark]"
              />
            </div>
          )}
        </section>

        {/* --- Account --- */}
        <section className="mb-8">
          <h2 className="font-display mb-3 text-title2">Account</h2>
          <div className="rounded-[var(--radius-card)] bg-bg-secondary px-5 py-4">
            <label htmlFor="display-name" className="font-data mb-2 block text-label-tertiary">
              Display Name
            </label>
            <div className="flex items-center gap-3">
              <input
                id="display-name"
                value={name}
                maxLength={40}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameSaved(false);
                  setNameError(null);
                }}
                onBlur={async () => {
                  const trimmed = name.trim();
                  const validationError = getDisplayNameValidationError(trimmed);
                  if (validationError) {
                    setNameError(validationError);
                    setName(userName);
                    return;
                  }
                  if (!userId || trimmed === userName) return;
                  await updateUserName(userId, trimmed);
                  // Low-stakes edit: inline checkmark, not a full toast
                  // (ui-spec.md §14).
                  setNameSaved(true);
                  setTimeout(() => setNameSaved(false), 1800);
                }}
                className={cn(
                  'flex-1 rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-3',
                  'text-body text-label-primary',
                  'border border-transparent transition-colors focus:border-tint',
                )}
              />
              <span
                aria-live="polite"
                className={cn(
                  'text-positive transition-opacity duration-200',
                  nameSaved ? 'opacity-100' : 'opacity-0',
                )}
              >
                <Check size={20} aria-label="Saved" />
              </span>
            </div>
            {nameError && <p className="mt-2 text-footnote text-destructive">{nameError}</p>}
            <p className="mt-2 text-footnote text-label-secondary">
              Synced to your account, so it follows you to any device.
            </p>
          </div>
        </section>

        {/* --- Session --- */}
        <section className="mb-8">
          <h2 className="font-display mb-3 text-title2">Session</h2>
          <div className="rounded-[var(--radius-card)] bg-bg-secondary px-5 py-4">
            <p className="font-data text-label-tertiary">Signed in as</p>
            <p className="mt-1 truncate text-body">{email ?? '—'}</p>
            <div className="mt-4">
              <Button variant="secondary" onClick={() => setConfirmSignOut(true)}>
                <LogOut size={16} aria-hidden />
                Log Out
              </Button>
            </div>
          </div>
        </section>

        {/* --- About --- */}
        <section>
          <h2 className="font-display mb-3 text-title2">About</h2>
          <div className="rounded-[var(--radius-card)] bg-bg-secondary px-5 py-4">
            <dl className="flex items-center justify-between text-subheadline">
              <dt className="text-label-secondary">Version</dt>
              <dd>1.0.0 · Phase 1</dd>
            </dl>
            <dl className="mt-2 flex items-center justify-between text-subheadline">
              <dt className="text-label-secondary">Storage</dt>
              <dd>Supabase (synced)</dd>
            </dl>
          </div>
        </section>
      </PageFade>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Log Out?"
        body="Your habits stay safely on your account — signing back in brings everything back."
        confirmLabel="Log Out"
        onConfirm={async () => {
          setConfirmSignOut(false);
          await signOut();
          window.location.href = '/login';
        }}
      />
    </Screen>
  );
}
