'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { BottomTabBar } from './Nav';
import { ToastHost } from './Toast';
import { AchievementCelebration } from './AchievementCelebration';

/** Routes reachable without a session. */
const PUBLIC_ROUTES = ['/login'];

/**
 * Route guard.
 *
 * Signed-out visitors are pushed to /login; signed-in visitors never see it.
 * While the session is still resolving we render nothing rather than the app —
 * flashing Home and then bouncing to /login is worse than a beat of black, and
 * the resolve is a localStorage read, so it's genuinely brief.
 *
 * The tab bar and toasts live here too, so they're absent on /login and
 * /onboarding — neither is a place to escape from mid-flow (CLAUDE.md §3).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isOnboarding = pathname.startsWith('/onboarding');

  useEffect(() => {
    if (status === 'signedOut' && !isPublic) router.replace('/login');
  }, [status, isPublic, router]);

  if (status === 'loading') {
    return <div className="min-h-dvh bg-bg-primary" aria-busy="true" />;
  }

  if (status === 'signedOut' && !isPublic) {
    // Redirect is in flight; don't paint the app behind it.
    return <div className="min-h-dvh bg-bg-primary" />;
  }

  return (
    <>
      {children}
      {status === 'signedIn' && !isPublic && !isOnboarding && <BottomTabBar />}
      <ToastHost />
      <AchievementCelebration />
    </>
  );
}
