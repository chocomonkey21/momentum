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
import { palette } from '@/theme/theme';
import { getUsernameValidationError } from '@/lib/validation';

type Tab = 'friends' | 'challenges';

const AVATAR_COLORS = [palette.vermillion, palette.amber, palette.magenta, palette.blue, palette.plum];

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
  const [usernameError, setUsernameError] = useState<string | null>(null);

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
              {/* The one solid block on this screen: how many people you're
                  comparing momentum with. */}
              <section
                className="flex items-end justify-between rounded-[var(--radius-card)] p-6"
                style={{ backgroundColor: palette.magenta, color: palette.ink0 }}
              >
                <div>
                  <p className="font-data text-black/60">Friends</p>
                  <p className="font-display-hero mt-2 text-[64px] leading-[0.85]">{accepted.length}</p>
                </div>
                <p className="font-data pb-1 text-right text-black/60">
                  {pending.length} pending
                  <br />
                  {challengeRows.length} challenge{challengeRows.length === 1 ? '' : 's'}
                </p>
              </section>

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
                            <span className="font-data inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-ink5 px-3 py-2 text-label-secondary">
                              <Clock size={12} aria-hidden />
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
                <h2 className="font-display mb-3 text-title2">Your Friends</h2>
                <ul className="flex flex-col gap-2">
                  {accepted.map((f, i) => (
                    <li key={f.id}>
                      <FriendRowItem
                        name={f.name}
                        username={f.username}
                        colorIndex={i}
                        trailing={
                          <span className="font-data inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-positive px-3 py-2 text-positive">
                            <Check size={12} strokeWidth={3} aria-hidden />
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
                <section className="overflow-hidden rounded-[var(--radius-card)] bg-bg-secondary">
                  {/* Header: amber title and a filled amber trophy disc on the
                      neutral card — the prize, without a second solid slab. */}
                  <div className="flex items-start gap-3 p-5 pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-data text-label-tertiary">{challenge.goalMetric}</p>
                      <h2
                        className="font-display mt-1 text-[24px] leading-tight"
                        style={{ color: palette.amber }}
                      >
                        {challenge.challengeName}
                      </h2>
                      <p className="font-data mt-2 text-label-tertiary">
                        {format(new Date(challenge.startDate + 'T00:00:00'), 'd MMM')} –{' '}
                        {format(new Date(challenge.endDate + 'T00:00:00'), 'd MMM')}
                      </p>
                    </div>
                    <span
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] text-black"
                      style={{ backgroundColor: palette.amber }}
                      aria-hidden
                    >
                      <Trophy size={20} />
                    </span>
                  </div>

                  <ol className="flex flex-col gap-3 p-5">
                    {challenge.board.map((p, rank) => {
                      const isYou = p.userId === userId;
                      const max = challenge.board[0]?.progress || 1;
                      return (
                        <li key={`${challenge.id}-${p.userId}`}>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'font-display-hero w-8 shrink-0 text-center text-[26px]',
                                rank === 0 ? 'text-app-amber' : 'text-label-tertiary',
                              )}
                            >
                              {rank === 0 ? <Medal size={16} className="mx-auto" aria-hidden /> : rank + 1}
                            </span>
                            <span
                              className={cn(
                                'font-display min-w-0 flex-1 truncate text-[18px] leading-tight',
                                !isYou && 'text-label-secondary',
                              )}
                            >
                              {p.name}
                            </span>
                            <span className="font-display-hero text-[22px] leading-none">
                              {p.progress}
                            </span>
                          </div>
                          {/* Progress bar uses tint for you, neutral grey for
                              others — tint stays meaningful, not decorative. */}
                          <div
                            className="mt-2 h-3 overflow-hidden rounded-[var(--radius-pill)] bg-bg-tertiary"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-[var(--radius-pill)]"
                              style={{
                                width: `${Math.round((p.progress / max) * 100)}%`,
                                backgroundColor: isYou ? palette.amber : palette.ink5,
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
        title="Add a Friend"
        description="Send a request by username."
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="friend-username" className="font-data mb-2 block text-label-tertiary">
              Username
            </label>
            <input
              id="friend-username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameError(null);
              }}
              placeholder="priya"
              maxLength={30}
              aria-invalid={Boolean(usernameError)}
              aria-describedby={usernameError ? 'friend-username-error' : undefined}
              className={cn(
                'w-full rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-4',
                'font-display text-[22px] text-label-primary placeholder:text-label-tertiary',
                'border-2 border-transparent transition-colors focus:border-tint',
              )}
            />
            {usernameError && (
              <p id="friend-username-error" role="alert" className="mt-2 text-footnote text-destructive">
                {usernameError}
              </p>
            )}
          </div>
          <Button
            fullWidth
            disabled={username.trim().length === 0}
            onClick={async () => {
              if (!userId) return;
              const validationError = getUsernameValidationError(username);
              if (validationError) {
                setUsernameError(validationError);
                return;
              }
              const result = await requestFriendByUsername(userId, username);
              showToast(result.message);
              if (result.ok) {
                setUsername('');
                setUsernameError(null);
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
    <div className="flex min-h-[44px] items-center gap-3 rounded-[var(--radius-block)] bg-bg-secondary px-4 py-4">
      <span
        aria-hidden
        className="font-display inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-block)] text-[17px] text-black"
        style={{ backgroundColor: color }}
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block truncate text-[19px] leading-tight">{name}</span>
        {username && (
          <span className="block truncate text-footnote text-label-secondary">@{username}</span>
        )}
      </span>
      {trailing}
    </div>
  );
}
