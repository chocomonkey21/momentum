'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Trophy, UserPlus, Check, Clock, Medal } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { getFriends, getChallenges, requestFriendByUsername, type FriendRow, type ChallengeBoard } from '@/db/queries';
import { cn } from '@/lib/cn';
import { semantic, palette } from '@/theme/theme';

type Tab = 'friends' | 'challenges';

const AVATAR_COLORS = [palette.blue, palette.green, palette.orange, palette.purple, palette.vermillion];

/**
 * Friends & Challenges (PRD.md §7, Phase 2).
 *
 * Backed by real Postgres rows now, not the seeded local mock the Dexie build
 * used. RLS makes a friendship readable from either side, so an incoming
 * request is visible to its recipient, and a challenge leaderboard is readable
 * by its participants.
 *
 * Known gap: resolving a username to an account needs a public-profile policy
 * or a security-definer RPC, because RLS deliberately hides other users'
 * profile rows. requestFriendByUsername() reports that honestly rather than
 * failing silently — see the note there.
 */
export default function FriendsPage() {
  const { status, userId, showToast } = useApp();
  const [tab, setTab] = useState<Tab>('friends');
  const [addOpen, setAddOpen] = useState(false);
  const [username, setUsername] = useState('');

  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [challengeRows, setChallengeRows] = useState<ChallengeBoard[] | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [f, c] = await Promise.all([getFriends(userId), getChallenges(userId)]);
    setFriends(f);
    setChallengeRows(c);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loading = status === 'loading' || friends === null || challengeRows === null;

  const accepted = useMemo(() => (friends ?? []).filter((f) => f.status === 'accepted'), [friends]);
  const pending = useMemo(() => (friends ?? []).filter((f) => f.status === 'pending'), [friends]);

  return (
    <Screen>
      <PageFade>
        <ScreenHeader
          title="Friends"
          action={
            <IconButton label="Add a friend" onClick={() => setAddOpen(true)}>
              <UserPlus size={22} aria-hidden />
            </IconButton>
          }
        />

        <div className="mb-5">
          <SegmentedControl
            options={[
              { value: 'friends', label: 'Friends' },
              { value: 'challenges', label: 'Challenges' },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel="Friends or challenges"
          />
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : tab === 'friends' ? (
          accepted.length === 0 && pending.length === 0 ? (
            <EmptyState
              icon={Users}
              message="No friends yet. Add someone by username to compare momentum."
              actionLabel="Add a friend"
              onAction={() => setAddOpen(true)}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {pending.length > 0 && (
                <section>
                  <h2 className="font-display mb-3 text-title2">Pending</h2>
                  <ul className="flex flex-col gap-2">
                    {pending.map((f, i) => (
                      <li key={f.id}>
                        <FriendRowItem
                          name={f.name}
                          username={f.username}
                          colorIndex={i}
                          trailing={
                            <span className="inline-flex items-center gap-1.5 text-footnote text-label-secondary">
                              <Clock size={13} aria-hidden />
                              Pending
                            </span>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h2 className="font-display mb-3 text-title2">Your friends</h2>
                <ul className="flex flex-col gap-2">
                  {accepted.map((f, i) => (
                    <li key={f.id}>
                      <FriendRowItem
                        name={f.name}
                        username={f.username}
                        colorIndex={i}
                        trailing={
                          <span className="inline-flex items-center gap-1.5 text-footnote text-positive">
                            <Check size={13} aria-hidden />
                            Friends
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )
        ) : challengeRows.length === 0 ? (
          <EmptyState
            icon={Trophy}
            message="No active challenges. Start one with a friend to compare momentum over a set window."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {challengeRows.map((challenge) => (
              <li key={challenge.id}>
                <section className="rounded-[var(--radius-card)] bg-bg-secondary p-5">
                  <div className="mb-1 flex items-start gap-3">
                    <Trophy size={20} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-[17px]">{challenge.challengeName}</h2>
                      <p className="mt-0.5 text-footnote text-label-secondary">
                        {challenge.goalMetric} ·{' '}
                        {format(new Date(challenge.startDate + 'T00:00:00'), 'd MMM')} –{' '}
                        {format(new Date(challenge.endDate + 'T00:00:00'), 'd MMM')}
                      </p>
                    </div>
                  </div>

                  <ol className="mt-4 flex flex-col gap-2">
                    {challenge.board.map((p, rank) => {
                      const isYou = p.userId === userId;
                      const max = challenge.board[0]?.progress || 1;
                      return (
                        <li key={`${challenge.id}-${p.userId}`}>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'w-5 shrink-0 text-center text-footnote tabular-nums',
                                rank === 0 ? 'text-warning' : 'text-label-secondary',
                              )}
                            >
                              {rank === 0 ? <Medal size={14} className="mx-auto" aria-hidden /> : rank + 1}
                            </span>
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-subheadline',
                                isYou && 'font-semibold',
                              )}
                            >
                              {p.name}
                            </span>
                            <span className="text-subheadline tabular-nums">{p.progress}</span>
                          </div>
                          {/* Progress bar uses tint for you, neutral grey for
                              others — tint stays meaningful, not decorative. */}
                          <div
                            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-tertiary"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round((p.progress / max) * 100)}%`,
                                backgroundColor: isYou ? semantic.tint : palette.ink5,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </li>
            ))}
          </ul>
        )}
      </PageFade>

      <Sheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add a friend"
        description="Send a request by username."
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="friend-username" className="mb-2 block text-subheadline text-label-secondary">
              Username
            </label>
            <input
              id="friend-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="priya"
              className={cn(
                'w-full rounded-[var(--radius-block)] bg-white/[0.05] px-4 py-3.5',
                'text-body text-label-primary placeholder:text-label-tertiary',
                'border border-transparent transition-colors focus:border-tint',
              )}
            />
          </div>
          <Button
            fullWidth
            disabled={username.trim().length === 0}
            onClick={async () => {
              if (!userId) return;
              const result = await requestFriendByUsername(userId, username);
              showToast(result.message);
              if (result.ok) {
                setUsername('');
                setAddOpen(false);
                await reload();
              }
            }}
          >
            Send request
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}

function FriendRowItem({
  name,
  username,
  colorIndex,
  trailing,
}: {
  name: string;
  username: string | null;
  colorIndex: number;
  trailing: React.ReactNode;
}) {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="flex min-h-[44px] items-center gap-3 rounded-[var(--radius-card)] bg-bg-secondary px-4 py-3">
      <span
        aria-hidden
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-[16px] font-display text-headline text-black"
        style={{ backgroundColor: color }}
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-subheadline font-medium">{name}</span>
        {username && (
          <span className="block truncate text-footnote text-label-secondary">@{username}</span>
        )}
      </span>
      {trailing}
    </div>
  );
}
