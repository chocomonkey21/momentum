'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, Timer, BarChart3, CalendarDays, Users, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Nav — bottom tab bar on mobile/tablet, persistent left sidebar on desktop
 * (design-system.md §3, ui-spec.md global note). Every item has a LABEL next to
 * or under its icon; icon-only nav was an audit finding (design-system.md §7).
 *
 * design-system.md §7 specifies a 5-item tab bar, but ui-spec.md assigns its own
 * nav item to Home, Habits, Chains, Focus, Statistics AND Profile (§9, §13),
 * with Weekly Recap explicitly NOT a tab (§12), plus Friends & Challenges for
 * this build — more destinations than a 5-item bar can hold.
 *
 * Resolved by folding Chains into the Habits section rather than dropping a
 * destination: a chain is a grouping of habits, so it reads naturally as a view
 * there (`/habits?view=chains`), and the freed slot goes to Friends. That gets
 * mobile down to exactly the 5 the design system allows without hiding anything
 * behind a width breakpoint. Recap and Profile are the only items not in the tab
 * bar, and both keep visible entry points in the Home header, so no screen is a
 * dead end at any width (CLAUDE.md §3 wayfinding).
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Present in the 5-item mobile tab bar. */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, mobile: true },
  { href: '/habits', label: 'Habits', icon: ListChecks, mobile: true },
  // Friends sits in the slot Chains used to hold, now that Chains lives inside
  // the Habits section.
  { href: '/friends', label: 'Friends', icon: Users, mobile: true },
  { href: '/focus', label: 'Focus', icon: Timer, mobile: true },
  { href: '/stats', label: 'Stats', icon: BarChart3, mobile: true },
  { href: '/recap', label: 'Recap', icon: CalendarDays, mobile: false },
  { href: '/profile', label: 'Profile', icon: User, mobile: false },
];

/** Onboarding is a pre-nav flow — it has its own back stack and step indicator,
 *  and showing the tab bar there would let a first-time user escape the flow
 *  into empty screens (CLAUDE.md §3). */
function hideNav(pathname: string) {
  return pathname.startsWith('/onboarding');
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function BottomTabBar() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => i.mobile);
  if (hideNav(pathname)) return null;

  return (
    <nav
      aria-label="Primary"
      // Translucent + blur so content scrolls visibly underneath (design-system.md §4).
      // Fixed, but pinned to the phone frame's width rather than the viewport's,
      // so it stays under the app column on a wide screen.
      className={cn(
        'fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2',
        'border-t border-white/10 bg-black/85 backdrop-blur-xl',
      )}
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 py-2',
                  'text-[length:var(--text-caption1)] transition-colors',
                  active ? 'text-tint' : 'text-label-secondary hover:text-white',
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
