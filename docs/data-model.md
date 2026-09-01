# data-model.md — Momentum Data Model

Inferred from `PRD.md` and the ISA2 entity set, reduced to what Phase 1 actually needs. Phase 2 entities (Friendship, Challenge, ChallengeParticipant) are included but marked — do not build their persistence logic until Phase 2 starts.

**v3 — persistence is now Supabase/Postgres.** The field tables, relationships and business logic below are unchanged; only the storage engine differs. The build went native SQLite → Dexie/IndexedDB → Postgres, and the model survived all three, which is what "storage-agnostic" was supposed to buy.

The shipped DDL lives in `momentum/supabase/migrations/`:

| Migration | What it does |
|---|---|
| `0001_init.sql` | All nine entities plus `settings`, indexes, and the signup trigger |
| `0002_fix_challenge_rls_recursion.sql` | Fixes a policy that queried its own table |
| `0003_lock_down_security_definer.sql` | Revokes RPC access to the `SECURITY DEFINER` helpers |
| `0004` (applied) | Lets you read the profiles of people you're connected to |

Postgres naming is `snake_case` (`user_id`, `momentum_score`); the TypeScript domain types keep the camelCase names used below, with mappers in `src/db/schema.ts` as the only translation point.

---

## 0. Cross-cutting assumptions

**~~Assumption — single local user (Phase 1)~~ — superseded.** Accounts are real. `public.users` is a **profile row keyed 1:1 to Supabase's `auth.users`** by a `uuid` primary key. An `on_auth_user_created` trigger inserts the profile and settings rows at signup, so the client never has to race a "does my profile exist yet?" check on first login. There is a login screen; there is no user switcher.

**Assumption — dates and time zones (holds, and it earned its keep):** day-level fields are Postgres `date`, timestamps are `timestamptz`. A "day" boundary is the **device's local midnight**, not UTC — every day key is computed client-side in local time and sent as a string; the server's own `current_date` is never used for user-facing day logic, because on a UTC server it disagrees with a user in IST. Two real bugs came from violating this: a streak walk that used `toISOString()` and skipped a day at positive UTC offsets, and a seed query that anchored to the server's date — a habit logged at 11:58 PM and one at 12:02 AM count as different days in the user's local time. This matters directly for time-constraint enforcement (§4) and streak calculation (§5). Not specified in the PRD; this is the standard behavior for a single-device habit tracker and should be revisited if/when Phase 2 adds cross-timezone sync.

**Assumption — deletion is soft:** Deleting a Habit does not delete its `HabitLog` history. See §6.

---

## 1. User

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID PK | yes | **FK → `auth.users(id)`, on delete cascade.** Not generated here |
| `name` | TEXT | yes | Display name. Defaulted from signup metadata, or the email's local part |
| `username` | TEXT | no | Unique. Used for Friends lookup |
| `createdAt` | TIMESTAMPTZ | yes | |

**One row per account,** created automatically by the signup trigger.

---

## 2. Habit

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT PK (identity) | yes | | |
| `userId` | UUID FK → User | yes | | |
| `name` | TEXT | yes | | 1–60 chars. **Validation:** trim whitespace, reject empty after trim |
| `frequency` | TEXT enum (`daily`, `weekly`, `custom`) | yes | `daily` | Matches the chip options in `ui-spec.md` Add Habit |
| `difficultyLevel` | INTEGER enum (`1`=Easy, `2`=Medium, `3`=Hard) | yes | `2` | Drives the adaptive-difficulty step-down target (§5) |
| `momentumScore` | REAL | yes | `50` | 0–100. **Assumption:** new habits start at the midpoint (50), matching the Add Habit screen's placeholder copy ("new habits start at the midpoint") from the ISA2 doc |
| `timeConstraint` | TEXT (`HH:mm`), nullable | no | `null` | If set, logging is blocked after this local time each day (§4) |
| `categoryTag` | TEXT, nullable | no | `null` | Free-form or from the onboarding goal categories (Fitness/Study/Health/Creativity/Mind/Lifestyle/Work). **Assumption:** stored as plain text, not a separate lookup table — the category list is small and fixed enough not to warrant its own entity |
| `chartColor` | TEXT enum (from the curated palette in `design-system.md`) | yes | assigned round-robin at creation | Used by the Overlapping Momentum Chart and Mood Calendar so a habit's color is stable across screens |
| `createdAt` | TEXT (ISO datetime) | yes | | |
| `archivedAt` | TEXT (ISO datetime), nullable | no | `null` | Soft-delete marker — see §6 |

**Validation rules:**
- `name` required, 1–60 chars after trim.
- `timeConstraint`, if present, must be a valid `HH:mm` 24-hour value.
- A habit with `archivedAt` set is excluded from Home, Habits List, Add/Log flows, and active charts, but remains queryable for historical Statistics/Weekly Recap if those screens choose to include archived habits (see §6).

---

## 3. HabitLog

One row per day a habit is acted on (completed or explicitly skipped).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | BIGINT PK (identity) | yes | |
| `habitId` | BIGINT FK → Habit | yes | |
| `date` | DATE (local day) | yes | The day this entry is *for* — not necessarily when it was logged. A bare `date`, never a timestamp, so a local day can't drift across a zone boundary |
| `completed` | INTEGER (boolean 0/1) | yes | |
| `moodTag` | INTEGER (1–5), nullable | no | Matches the 5-point mood scale in `ui-spec.md` Log Habit |
| `contextTag` | TEXT enum (`home`, `work`, `gym`, `other`), nullable | no | |
| `notes` | TEXT, nullable | no | Free text, max 280 chars (**assumption** — PRD doesn't specify a limit; 280 keeps it a "note," not a journal entry) |
| `loggedAt` | TEXT (ISO datetime) | yes | Actual timestamp of the log action — used to enforce time constraints |

**Constraints:**
- **Unique constraint on (`habitId`, `date`)** — one log entry per habit per day. Re-logging the same day updates the existing row rather than creating a second one.
- **Now enforced by the database.** Under Dexie this was an application-layer check, because IndexedDB can't enforce uniqueness on a non-primary compound index; in Postgres it is a real `unique` constraint and the write is a genuine upsert.

---

## 4. Business Logic — Momentum, Streaks, Time Constraints, Adaptive Difficulty

### 4.1 Momentum Score (the core mechanic)

```
MAX = 100
GAIN = 8      // added on a completed day
DECAY = 12    // subtracted on a missed day

function updateMomentum(habit, completedToday: boolean):
    if completedToday:
        habit.momentumScore = min(MAX, habit.momentumScore + GAIN)
        habit.missStreak = 0
    else:
        habit.momentumScore = max(0, habit.momentumScore - DECAY)
        habit.missStreak += 1
    if habit.missStreak >= 3:
        triggerAdaptiveDifficultySuggestion(habit)
```

`missStreak` is **not a stored column** — it's derived at read time by counting consecutive most-recent `HabitLog` rows (ordered by `date` descending) where `completed = 0`, stopping at the first gap or completed day.

**As built:** `momentumScore` is a *cache* of a full replay of the habit's logs (`replayMomentum` in `src/lib/momentum.ts`), not an incrementally-patched value. That's what makes historical edits correct per §6 of `user-flows.md`. Today is treated asymmetrically: a completed log for today applies GAIN immediately, but an *incomplete* one applies no decay, because the day isn't over — which is exactly what makes undo restore the pre-completion value without a special case.

### 4.2 Streak (display metric, separate from momentum)

**Assumption:** early UI references (both the original mockups and the audited build) show a "current streak" badge (e.g. "12 DAY STREAK") in addition to momentum. These are two different, coexisting metrics:

- **`momentumScore`** — the decaying score (§4.1), the philosophical core of the product.
- **`currentStreak`** (derived, not stored) — count of consecutive most-recent days with `completed = 1`, reset to `0` on the first missed day encountered walking backward from today.

```
function currentStreak(habitId):
    count = 0
    for log in habitLogsOrderedByDateDesc(habitId):
        if log.completed: count += 1
        else: break
    return count
```

Streak is shown because it's an easy-to-read motivational number; momentum governs the actual decay/adaptive-difficulty logic. They will usually move together but are not the same number, and the UI should not conflate them (see `ui-spec.md` Habit Card).

### 4.3 Time-Constrained Habits

```
function canLogToday(habit, nowLocal):
    if habit.timeConstraint is null: return true
    return nowLocal.time <= habit.timeConstraint

// If canLogToday() is false when the day rolls over without a completed log,
// the day is automatically recorded as missed (completed = 0) the next time
// the app evaluates that habit (see §4.4).
```

**Assumption:** the deadline applies only to *logging as completed* — a user can still open the app and see the habit, they just cannot mark it done past the deadline. The UI should communicate this as a locked state (see `ui-spec.md` Log Habit), not hide the habit entirely.

### 4.4 End-of-day evaluation (missed habits) — implemented as specified

**Assumption (not specified in PRD):** the app needs a moment where "did nothing" becomes "missed." Recommended approach: **lazy evaluation on read**, not a background job (a browser tab has no reliable persistent background execution once closed — a scheduled job isn't a safe assumption on web any more than it was on Expo Go). When any screen queries a habit's current state, if there is no `HabitLog` row for *yesterday* (relative to today, local time) and the habit existed on that date, retroactively insert a `HabitLog` row for yesterday with `completed = 0` before computing momentum/streak. This keeps the data model consistent without requiring a scheduled task.

### 4.5 Adaptive Difficulty

```
function triggerAdaptiveDifficultySuggestion(habit):
    if habit.difficultyLevel > 1:
        // Surface a suggestion in the UI (see ui-spec.md Habit Detail);
        // do NOT auto-change difficultyLevel — the user must accept it.
        showSuggestion(habit, suggestedLevel = habit.difficultyLevel - 1)
```

**Assumption:** the suggestion is a proposal, not an automatic change — matches the Product Philosophy principle of user agency. The user taps "Scale down" or dismisses it.

---

## 5. HabitChain / ChainHabit

| Entity | Field | Type | Notes |
|---|---|---|---|
| **HabitChain** | `id` | INTEGER PK | |
| | `userId` | INTEGER FK → User | |
| | `chainName` | TEXT | 1–40 chars |
| | `createdAt` | TEXT | |
| **ChainHabit** *(junction table)* | `chainId` | INTEGER FK → HabitChain | **Composite PK (`chainId`, `habitId`)** |
| | `habitId` | INTEGER FK → Habit | |
| | `orderIndex` | INTEGER | Position within the chain, 0-based |

**Business rule — chain completion:** a chain is "complete for today" when every habit in it has a `HabitLog` row for today with `completed = 1`. Chain progress is a computed read (count of today's completed member habits / total member habits), not a stored value.

**Deletion:** removing a habit from a chain deletes only its `ChainHabit` row; the habit and its logs are untouched. Deleting a chain deletes its `ChainHabit` rows but never touches `Habit` or `HabitLog`.

---

## 6. Deletion Behavior (applies to Habit)

**Assumption — soft delete:** deleting a habit sets `archivedAt` rather than removing the row, and does **not** delete its `HabitLog` history. Rationale: Statistics and Weekly Recap need historical data to remain meaningful even after a habit is retired, and this avoids an irreversible destructive action for what's often a routine "I don't do this anymore" edit.

- Archived habits are excluded from: Home, Habits List (default view), Add/Log flows, active Overlapping Momentum Chart, Chains.
- Archived habits remain visible in: a habit's own historical detail view if navigated to directly, and in aggregate lifetime stats on Profile (total completions, etc.) unless the user is looking at a "current habits only" filter.
- There is no hard-delete path in Phase 1. If the user needs to permanently erase data (e.g. for privacy), that's a Phase 2 Settings concern, not built now.

**Editing a habit:** changing `name`, `frequency`, `difficultyLevel`, `timeConstraint`, or `categoryTag` updates the `Habit` row in place. **`momentumScore` is never reset by an edit** — editing a habit's settings does not affect its accumulated momentum or history.

---

## 7. PomodoroSession

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | INTEGER PK | yes | |
| `userId` | INTEGER FK → User | yes | |
| `habitId` | INTEGER FK → Habit, nullable | no | Optional link — a session can be general-purpose focus time |
| `startTime` | TEXT (ISO datetime) | yes | |
| `endTime` | TEXT (ISO datetime), nullable | no | Null while a session is in progress |
| `durationMinutes` | INTEGER | yes | Selected preset (25/45/60) or custom |
| `completed` | INTEGER (boolean 0/1) | yes | `0` if the session was reset/abandoned before the timer finished |

**Business rule:** a completed Pomodoro session linked to a habit does **not** automatically create/update a `HabitLog` row. **Assumption:** the PRD describes the link as "optional," not automatic completion — the user still logs the habit separately via the normal Log Habit flow. The link is for correlation/display (e.g. "3 focus sessions logged against Read this week"), not an implicit completion trigger. Flag this for confirmation if a tighter coupling is actually wanted.

---

## 8. Phase 2 Entities (built)

| Entity | Key fields | Notes |
|---|---|---|
| **Friendship** | `id` PK, `userId` FK, `friendUserId` FK, `status` (`pending`/`accepted`), `createdAt` | Self-referencing M:M on User |
| **Challenge** | `id` PK, `creatorUserId` FK, `challengeName`, `goalMetric`, `startDate`, `endDate` | No `habitId` — challenges are aggregate (e.g. total momentum gained), not tied to one habit |
| **ChallengeParticipant** *(junction)* | Composite PK (`challengeId`, `userId`), `progress` | |

**v3: these are live.** All three tables exist with RLS policies and back the Friends & Challenges screen against real accounts.

Field types as built: `Friendship.userId`/`friendUserId` are UUIDs referencing `public.users`, with a `no self-friendship` check and a unique constraint on the pair. `Challenge.startDate`/`endDate` are `date` with an `end >= start` check. `ChallengeParticipant` keeps its composite PK.

---

## 9. Indexing, RLS and pagination (Postgres)

Indexes as shipped (see `0001_init.sql`):

| Table | Index | Why |
|---|---|---|
| `habits` | `(user_id)`, `(user_id, archived_at)` | "Active habits for this user" runs on nearly every screen |
| `habit_logs` | `(habit_id)`, `(habit_id, date desc)`, **unique `(habit_id, date)`** | History reads, plus the §3 one-per-day rule |
| `chain_habits` | PK `(chain_id, habit_id)`, plus each side | Both directions are queried: chain → habits, habit → chains |
| `habit_chains`, `pomodoro_sessions`, `friendships`, `challenges`, `challenge_participants` | `(user_id)` / equivalent | Owner lookups |

### 9.1 Row Level Security

RLS is enabled on **all ten tables**; none is left open. The base rule is
`user_id = auth.uid()`.

- `habit_logs` and `chain_habits` carry no `user_id`, so they are scoped by joining back to the owning habit/chain. Without this a user could read another account's log by guessing its id.
- `friendships` are readable from **either** side, so an incoming request is visible to its recipient; writes are restricted to the row's owner.
- `challenge_participants` is readable by fellow participants — that is what a leaderboard is — but writable only for your own row.
- `users` is readable for yourself **and for anyone you're connected to** (a friendship in either direction, or a shared challenge). Without that, RLS hides every friend's name and the Friends screen renders "Unknown".

Two implementation notes worth carrying forward:

1. **A policy must never query its own table.** The first leaderboard policy did, and Postgres rejected every read with `42P17: infinite recursion detected in policy`. The fix is a `SECURITY DEFINER` helper, which runs as the function owner so RLS isn't re-evaluated inside it.
2. **`SECURITY DEFINER` functions are reachable over `/rest/v1/rpc`** unless `EXECUTE` is revoked. Both helpers are locked down to only the role that needs them.

### 9.2 Reading more than 1000 rows

PostgREST caps a response at 1000 rows **and does not error when it truncates.**
A year of history across four habits is ~1460 log rows, so an un-paginated read
silently dropped the most *recent* 460 days while the cached `momentumScore`
still looked correct. Every log read paginates with `.range()` until a short
page comes back. Any new query that can exceed 1000 rows must do the same.
