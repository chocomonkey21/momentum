'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, Trophy, UserPlus, Check, Clock, Medal } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { db, type Friendship } from '@/db/schema';
import { cn } from '@/lib/cn';
import { semantic, palette } from '@/theme/theme';

type Tab = 'friends' | 'challenges';

const AVATAR_COLORS = [palette.blue, palette.green, palette.orange, palette.purple, palette.vermillion];

/**
 * Friends & Challenges (PRD.md §7, Phase 2).
 *
 * IMPORTANT: this screen is backed entirely by SEEDED LOCAL MOCK DATA, which is
 * the fallback PRD.md §6 explicitly sanctions ("Mock/seeded friend data is an
 * acceptable stand-in for the demo"). There is no Supabase, no auth, and no
 * cross-device sync behind any of it — "adding a friend" writes a local row.
 * The UI is complete so the flow can be demoed end to end; the backend is not.
 */
export default function FriendsPage() {
  const { status, userId, showToast } = useApp();
  const [tab, setTab] = useState<Tab>('friends');
  const [addOpen, setAddOpen] = useState(false);
  const [username, setUsername] = useState('');

  const friendships = useLiveQuery(
    () =>
      userId
        ? db.friendships.where('userId').equals(userId).toArray()
        : Promise.resolve([] as Friendship[]),
    [userId],
  );
  const users = useLiveQuery(() => db.users.toArray(), []);
  const challenges = useLiveQuery(() => db.challenges.toArray(), []);
  const participants = useLiveQuery(() => db.challengeParticipants.toArray(), []);

  const loading =
    status === 'loading' ||
    !friendships ||
    !users ||
    !challenges ||
    !participants;

  const userById = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  const friendRows = useMemo(() => {
    return (friendships ?? []).map((f) => ({
      ...f,
      user: userById.get(f.friendUserId),
    }));
  }, [friendships, userById]);

  const accepted = friendRows.filter((f) => f.status === 'accepted');
  const pending = friendRows.filter((f) => f.status === 'pending');

  const challengeRows = useMemo(() => {
    return (challenges ?? []).map((c) => {
      const board = (participants ?? [])
        .filter((p) => p.challengeId === c.id)
        .map((p) => ({ ...p, user: userById.get(p.userId) }))
        .sort((a, b) => b.progress - a.progress);
      return { challenge: c, board };
    });
  }, [challenges, participants, userById]);

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

        {/* Honest about what this is — better than implying a live backend. */}
        <p className="mb-5 rounded-[var(--radius-chip)] bg-bg-secondary px-4 py-3 text-footnote text-label-secondary">
          Demo mode: friends and challenges run on local sample data. Real accounts and syncing
          arrive with the Phase 2 backend.
        </p>

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
                  <h2 className="mb-3 text-title2 font-bold">Pending</h2>
                  <ul className="flex flex-col gap-2">
                    {pending.map((f, i) => (
                      <li key={f.id}>
                        <FriendRow
                          name={f.user?.name ?? 'Unknown'}
                          username={f.user?.username ?? null}
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
                <h2 className="mb-3 text-title2 font-bold">Your friends</h2>
                <ul className="flex flex-col gap-2">
                  {accepted.map((f, i) => (
                    <li key={f.id}>
                      <FriendRow
                        name={f.user?.name ?? 'Unknown'}
                        username={f.user?.username ?? null}
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
            {challengeRows.map(({ challenge, board }) => (
              <li key={challenge.id}>
                <section className="rounded-[var(--radius-card)] bg-bg-secondary p-5">
                  <div className="mb-1 flex items-start gap-3">
                    <Trophy size={20} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-headline font-semibold">{challenge.challengeName}</h2>
                      <p className="mt-0.5 text-footnote text-label-secondary">
                        {challenge.goalMetric} ·{' '}
                        {format(new Date(challenge.startDate + 'T00:00:00'), 'd MMM')} –{' '}
                        {format(new Date(challenge.endDate + 'T00:00:00'), 'd MMM')}
                      </p>
                    </div>
                  </div>

                  <ol className="mt-4 flex flex-col gap-2">
                    {board.map((p, rank) => {
                      const isYou = p.userId === userId;
                      const max = board[0]?.progress || 1;
                      return (
                        <li key={`${p.challengeId}-${p.userId}`}>
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
                              {isYou ? 'You' : (p.user?.name ?? 'Unknown')}
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
        description="In this demo build, adding a friend creates a local sample record — nothing is sent anywhere."
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
                'w-full rounded-[var(--radius-chip)] bg-bg-secondary px-4 py-3',
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
              const handle = username.trim();
              const friendUserId = await db.users.add({
                name: handle,
                username: handle,
                createdAt: new Date().toISOString(),
              });
              await db.friendships.add({
                userId,
                friendUserId,
                status: 'pending',
                createdAt: new Date().toISOString(),
              });
              setUsername('');
              setAddOpen(false);
              showToast(`Request sent to ${handle}`);
            }}
          >
            Send request
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}

function FriendRow({
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
