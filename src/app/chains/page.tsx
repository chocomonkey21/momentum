import { redirect } from 'next/navigation';

/**
 * Chains moved inside the Habits section — a chain is a grouping of habits, so
 * it belongs there rather than in its own nav slot (which Friends now uses).
 *
 * This route is kept purely so existing links and bookmarks don't dead-end
 * (CLAUDE.md §3 — no orphaned screens).
 */
export default function ChainsPage() {
  redirect('/habits?view=chains');
}
