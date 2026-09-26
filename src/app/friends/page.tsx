'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Trophy, UserPlus, Check, Clock, Medal, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { Screen, ScreenHeader, PageFade } from '@/components/ui/Screen';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  createChallenge,
  getFriends,
  getChallenges,
  requestFriendByUsername,
  acceptFriendRequest,
  requestFriendByEmail,
  lookupUserByUsername,
  lookupUserByEmail,
  type FriendRow,
  type ChallengeBoard,
} from '@/db/queries';
import { cn } from '@/lib/cn';
import { palette } from '@/theme/theme';
import { getUsernameValidationError } from '@/lib/validation';
import { getEmailValidationError } from '@/lib/email';

type Tab = 'friends' | 'challenges';
type LookupResult = { key: string; status: 'found'; id: string; name: string } | { key: string; status: 'notfound' };
type LookupState = { status: 'idle' } | { status: 'checking' } | LookupResult;

const AVATAR_COLORS = [palette.vermillion, palette.amber, palette.magenta, palette.blue, palette.plum];

/**
 * Friends & Challenges (PRD.md §7, Phase 2).
 *
 * Backed by real Postgres rows now, not the seeded local mock the Dexie build
 * used. RLS makes a friendship readable from either side, so an incoming
 * request is visible to its recipient, and a challenge leaderboard is readable
 * by its participants.
 *
 * Resolving a handle to an account needs a public-profile policy or a
 * security-definer RPC, because RLS deliberately hides other users' profile
 * rows — find_user_by_username (migration 0007) and find_user_by_email
 * (migration 0010) are that narrow crossing. The Add a Friend sheet below
 * checks the backend live as the user types, by username or by email, and
 * only enables Send once a real account is confirmed.
 */
export default function FriendsPage() {
  const { status, userId, showToast } = useApp();
  const [tab, setTab] = useState<Tab>('friends');
  const [addOpen, setAddOpen] = useState(false);
  const [addMethod, setAddMethod] = useState<'username' | 'email'>('username');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  // Live "is this a real account" check as the user types — the backend
  // check the request itself will do anyway, surfaced early so Send only
  // ever fires against a confirmed account.
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeName, setChallengeName] = useState('');
  const [challengeGoal, setChallengeGoal] = useState('10');
  const [challengeStart, setChallengeStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [challengeEnd, setChallengeEnd] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [challengeFriend, setChallengeFriend] = useState('');
  const [challengeError, setChallengeError] = useState<string | null>(null);

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

  // Debounced live availability check against the backend as the user
  // types, for whichever method (username/email) is active. Idle/checking are
  // derived from whether the stored result matches the current input, so the
  // effect only ever sets state from its async callback.
  const handle = addMethod === 'username' ? username : email;
  const lookupKey =
    addOpen &&
    handle.trim().length > 0 &&
    !(addMethod === 'username' ? getUsernameValidationError(handle) : getEmailValidationError(handle))
      ? `${addMethod}:${handle.trim().toLowerCase()}`
      : null;

  useEffect(() => {
    if (!lookupKey) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let result: LookupResult;
      try {
        const match =
          addMethod === 'username' ? await lookupUserByUsername(handle) : await lookupUserByEmail(handle);
        result = match ? { key: lookupKey, status: 'found', id: match.id, name: match.name } : { key: lookupKey, status: 'notfound' };
      } catch {
        result = { key: lookupKey, status: 'notfound' };
      }
      if (!cancelled) setLookupResult(result);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lookupKey, addMethod, handle]);

  const lookup: LookupState = !lookupKey
    ? { status: 'idle' }
    : lookupResult?.key === lookupKey
      ? lookupResult
      : { status: 'checking' };

  // A found account you're already connected to can't be requested again —
  // say so before Send, rather than enabling it and failing afterwards.
  const blockedReason: string | null =
    lookup.status !== 'found'
      ? null
      : lookup.id === userId
        ? "That's your own account."
        : (() => {
            const f = friends?.find((row) => row.friendUserId === lookup.id);
            if (!f) return null;
            if (f.status === 'accepted') return `${lookup.name} is already your friend.`;
            return f.incoming
              ? `${lookup.name} already sent you a request — accept it below.`
              : `You've already sent ${lookup.name} a request.`;
          })();
  const canSend = lookup.status === 'found' && blockedReason === null;

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
                            f.incoming ? (
                              <button
                                type="button"
                                aria-label={`Accept friend request from ${f.name}`}
                                onClick={async () => {
                                  if (!userId) return;
                                  try {
                                    await acceptFriendRequest(userId, f.id);
                                    showToast(`You and ${f.name} are now friends.`);
                                    await reload();
                                  } catch {
                                    showToast("Couldn't accept that request.");
                                  }
                                }}
                                className="font-data inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-pill)] bg-white px-4 text-black transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tint"
                              >
                                <Check size={12} strokeWidth={3} aria-hidden />
                                Accept
                              </button>
                            ) : (
                              <span className="font-data inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-ink5 px-3 py-2 text-label-secondary">
                                <Clock size={12} aria-hidden />
                                Sent
                              </span>
                            )
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
            actionLabel={accepted.length > 0 ? 'Create a challenge' : undefined}
            onAction={accepted.length > 0 ? () => setChallengeOpen(true) : undefined}
          />
        ) : (
          <>
            <Button variant="secondary" fullWidth className="mb-4" onClick={() => setChallengeOpen(true)}>
              Create a challenge
            </Button>
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
                      const max = Math.max(challenge.goalValue, challenge.board[0]?.progress ?? 0, 1);
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
                              {p.progress} / {challenge.goalValue}
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
          </>
        )}
      </PageFade>

      <Sheet
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setUsername('');
            setUsernameError(null);
            setEmail('');
            setEmailError(null);
          }
        }}
        title="Add a Friend"
        description={
          addMethod === 'username'
            ? 'Send a request by username.'
            : "Don't know their username? Send a request to their registered email instead."
        }
      >
        <div className="flex flex-col gap-4">
          <SegmentedControl
            ariaLabel="Find a friend by"
            value={addMethod}
            onChange={(v) => {
              setAddMethod(v);
            }}
            options={[
              { value: 'username', label: 'Username' },
              { value: 'email', label: 'Email' },
            ]}
          />

          {addMethod === 'username' ? (
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
                aria-describedby={usernameError ? 'friend-username-error' : 'friend-username-status'}
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
          ) : (
            <div>
              <label htmlFor="friend-email" className="font-data mb-2 block text-label-tertiary">
                Registered email
              </label>
              <input
                id="friend-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="friend@example.com"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'friend-email-error' : 'friend-username-status'}
                className={cn(
                  'w-full rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-4',
                  'font-display text-[17px] text-label-primary placeholder:text-label-tertiary',
                  'border-2 border-transparent transition-colors focus:border-tint',
                )}
              />
              {emailError && (
                <p id="friend-email-error" role="alert" className="mt-2 text-footnote text-destructive">
                  {emailError}
                </p>
              )}
            </div>
          )}

          {/* Live backend check — Send only ever fires once this reads "found". */}
          <p id="friend-username-status" role="status" className="flex items-center gap-2 text-footnote">
            {lookup.status === 'checking' && (
              <>
                <Loader2 size={14} className="animate-spin text-label-tertiary" aria-hidden />
                <span className="text-label-tertiary">Checking…</span>
              </>
            )}
            {lookup.status === 'found' && !blockedReason && (
              <>
                <Check size={14} className="text-positive" aria-hidden />
                <span className="text-positive">Found {lookup.name}.</span>
              </>
            )}
            {lookup.status === 'found' && blockedReason && (
              <>
                <Users size={14} className="text-label-secondary" aria-hidden />
                <span className="text-label-secondary">{blockedReason}</span>
              </>
            )}
            {lookup.status === 'notfound' && (
              <>
                <X size={14} className="text-destructive" aria-hidden />
                <span className="text-destructive">
                  {addMethod === 'username'
                    ? 'No account with that username.'
                    : 'No account is registered with that email.'}
                </span>
              </>
            )}
          </p>

          <Button
            fullWidth
            disabled={!canSend}
            onClick={async () => {
              if (!userId) return;
              if (addMethod === 'username') {
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
              } else {
                const validationError = getEmailValidationError(email);
                if (validationError) {
                  setEmailError(validationError);
                  return;
                }
                const result = await requestFriendByEmail(userId, email);
                showToast(result.message);
                if (result.ok) {
                  setEmail('');
                  setEmailError(null);
                  setAddOpen(false);
                  await reload();
                }
              }
            }}
          >
            Send request
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={challengeOpen}
        onOpenChange={setChallengeOpen}
        title="Create a Challenge"
        description="Set a shared goal and deadline with a friend."
      >
        <div className="flex flex-col gap-4">
          <label className="font-data text-label-tertiary">Challenge name
            <input value={challengeName} onChange={(e) => setChallengeName(e.target.value)} placeholder="Seven day reset" className={sheetInput} />
          </label>
          <label className="font-data text-label-tertiary">Friend
            <select value={challengeFriend} onChange={(e) => setChallengeFriend(e.target.value)} className={sheetInput}>
              <option value="">Choose a friend</option>
              {accepted.map((friend) => <option key={friend.friendUserId} value={friend.friendUserId}>{friend.name}</option>)}
            </select>
          </label>
          <label className="font-data text-label-tertiary">Goal completions
            <input type="number" min={1} value={challengeGoal} onChange={(e) => setChallengeGoal(e.target.value)} className={sheetInput} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="font-data text-label-tertiary">Starts<input type="date" value={challengeStart} onChange={(e) => setChallengeStart(e.target.value)} className={sheetInput} /></label>
            <label className="font-data text-label-tertiary">Ends<input type="date" value={challengeEnd} onChange={(e) => setChallengeEnd(e.target.value)} className={sheetInput} /></label>
          </div>
          {challengeError && <p role="alert" className="text-footnote text-destructive">{challengeError}</p>}
          <Button fullWidth onClick={async () => {
            if (!userId || !challengeFriend) { setChallengeError('Choose a friend to challenge.'); return; }
            try {
              await createChallenge({ userId, friendUserId: challengeFriend, challengeName, goalMetric: 'Habit completions', goalValue: Number(challengeGoal), startDate: challengeStart, endDate: challengeEnd });
              setChallengeOpen(false);
              setChallengeName('');
              setChallengeError(null);
              await reload();
              showToast('Challenge created');
            } catch (error) {
              setChallengeError(error instanceof Error ? error.message : 'Could not create challenge.');
            }
          }}>Create challenge</Button>
        </div>
      </Sheet>
    </Screen>
  );
}

// Inputs sit inside font-data labels; reset the caption tracking/case they'd inherit.
const sheetInput = 'mt-2 w-full rounded-[var(--radius-block)] bg-bg-tertiary px-4 py-3 text-body font-normal normal-case tracking-normal text-label-primary';

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
