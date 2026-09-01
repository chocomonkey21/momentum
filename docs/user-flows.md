# user-flows.md — Momentum User Flows

> **v3 note:** accounts are real, so Flows 1 and 2 now begin with authentication.
> Everything downstream of "lands on Home" is unchanged and was built as written.

Every flow below documents: starting point → user action → system response → next state → success path → failure path → edge cases → cancellation behavior. Ambiguities not explicitly resolved by the PRD are marked **[ASSUMPTION]**.

---

## 1. First-Time User

```
App opened for the first time (no session)
  → Splash / Login screen
  → Tap "Create account" → name, email, password → account created, session starts
  → Onboarding Step 1: Welcome ("MOMENTUM — Build better days")
  → Tap "Let's Go"
  → Onboarding Step 2: Goal Selection ("What do you want to improve?")
  → Select 1+ category chips (Fitness, Study, Health, Creativity, Mind, Lifestyle, Work)
  → Tap "Continue"
  → Onboarding Step 3: Pick First Habits (list of suggested habits, filtered/ordered by selected categories)
  → Select 1+ habits
  → Tap "Start Tracking"
  → System creates Habit rows for each selection (momentumScore = 50, per data-model.md)
  → Lands on Home / Today
```

- **Success path:** at least one habit selected in Step 3 → habits appear on Home immediately.
- **Failure/edge case:** user taps "Continue"/"Start Tracking" with zero selections. **[ASSUMPTION]** — PRD doesn't specify a minimum. Recommendation: allow zero categories (skip is fine, categories only affect suggested-habit ordering), but **require at least one habit** in Step 3 before "Start Tracking" is enabled — arriving at an empty Home screen with no way to add a habit yet would be a dead end for a first-time user.
- **Cancellation:** no cancellation mid-onboarding. The account now exists by this point, but no habits are persisted until "Start Tracking" commits them. Each step has a back button **[ASSUMPTION — flagged as missing in the UI audit; required for this build]**. The tab bar is hidden throughout, so the flow can't be escaped sideways.
- **v3 implementation note:** a successful signup returns a live session, which initially raced the login screen's "already signed in → go Home" redirect and won, dropping new users on an empty Home and skipping onboarding entirely. The signup path now owns its own redirect.
- **Progress indication:** a 3-dot step indicator on all three onboarding screens **[ASSUMPTION — same audit finding]**.

---

## 2. Returning User

```
App opened with a valid session (persisted in localStorage by the Supabase client)
  → Skip the login screen and onboarding entirely
  → Lands on Home / Today
  → System evaluates any un-logged prior days (data-model.md §4.4) before rendering
```

**v3:** "a local User row exists" is now "a valid Supabase session exists". The
session survives a browser restart, and the data behind it survives a cleared
browser or a different device entirely.

- **Edge case:** returning user with zero active habits (deleted/archived all of them). Home shows the Empty State (see `ui-spec.md` Home) with a direct path to Add Habit — **not** back into onboarding.

---

## 3. Creating a Habit

```
Home or Habits List
  → Tap "+" (Add Habit)
  → Add Habit screen
  → Enter name (required)
  → Select frequency chip (Daily/Weekly/Custom)
  → Select difficulty chip (Easy/Medium/Hard)
  → Optionally set a time constraint (toggle + time picker)
  → Tap "Create Habit"
  → Validate (name non-empty, time format valid if set)
  → Insert Habit row (momentumScore = 50)
  → Toast: "Habit created"
  → Return to the screen the user came from, new habit visible
```

- **Failure path:** empty name → inline validation error on the name field (per `interaction-spec.md` §5), submission blocked, no navigation away.
- **Edge case:** duplicate habit name (e.g. user already has "Gym"). **[ASSUMPTION]** — PRD doesn't restrict this; allow duplicates. Habits are identified by ID internally, not by name uniqueness.
- **Cancellation:** back navigation (swipe-back or a Cancel affordance) discards the in-progress form with no confirmation needed — nothing has been persisted yet.

---

## 4. Editing a Habit

```
Habits List or Home
  → Tap a habit → Habit Detail
  → Tap "Edit"
  → Edit form (pre-filled: name, frequency, difficulty, time constraint, category)
  → Change fields
  → Tap "Save"
  → Update Habit row in place
  → momentumScore and history are NOT reset (data-model.md §6)
  → Return to Habit Detail with updated values
```

- **Failure path:** same validation as creation.
- **Edge case:** user removes a previously-set time constraint. **[ASSUMPTION]** — this takes effect immediately; today's already-logged status is unaffected either way.
- **Cancellation:** back navigation discards unsaved edits. **[ASSUMPTION]** — if fields were changed, show a lightweight "Discard changes?" confirmation before navigating away; if unchanged, navigate immediately with no prompt.

---

## 5. Completing a Habit

```
Home (today's habit list) or Log Habit screen
  → Tap the completion toggle on a Habit Card (quick path)
      OR
  → Tap into the habit → Log Habit screen → set mood + context tag + notes → tap "Save Entry" (detailed path)
  → System checks canLogToday() (data-model.md §4.3)
      → If past time constraint: block, show locked state, do not write a HabitLog
      → If allowed: upsert HabitLog(date = today, completed = 1, ...), call updateMomentum(habit, true)
  → Momentum Ring animates (interaction-spec.md §3), haptic fires
  → Habit Card reflects new momentum/streak immediately
```

- **Success path:** as above.
- **Failure path (time constraint):** see `ui-spec.md` Log Habit locked state — the day is later evaluated as missed per §4.4 if never completed.
- **Edge case:** completing the same habit twice in one day via the quick toggle. **[ASSUMPTION]** — second tap is interpreted as un-completing (see Flow 6), not a duplicate log — the toggle is a true binary switch for "today," not an incrementing counter.

---

## 6. Undoing a Completion

```
Home or Habit Detail, habit already marked complete today
  → Tap the completion toggle again
  → Upsert HabitLog(date = today, completed = 0)
  → Recompute momentum: this is treated as reversing today's gain, not as a fresh miss
```

**[ASSUMPTION — not specified in PRD]:** undo within the same day should restore the pre-completion momentum value exactly (subtract the `GAIN` that was just added) rather than running the full miss/decay path — an accidental tap-then-untap shouldn't cost the user a decay penalty. If the day later ends still uncompleted, the standard miss/decay logic (§4.4 in data-model.md) applies at end-of-day evaluation, not at the moment of undo.

- **Edge case:** undoing a completion from a *previous* day (not today) via Habit Detail's history view. **[ASSUMPTION]** — allowed, since users should be able to correct a mislog, but this recalculates momentum from that date forward by replaying the formula — flagged as non-trivial; simplest correct implementation is to recompute the full momentum history from `HabitLog` on any historical edit rather than trying to patch forward incrementally.

---

## 7. Missing a Habit (no action taken)

```
A day passes with no HabitLog row for an active habit
  → Next app open, any screen touching that habit evaluates data-model.md §4.4
  → HabitLog(date = yesterday, completed = 0) is inserted
  → updateMomentum(habit, false) runs — score decays, missStreak increments
  → If missStreak >= 3: adaptive difficulty suggestion becomes available on Habit Detail
```

- No explicit "you missed a habit" push notification is required by the PRD for Phase 1's core loop — reminders (§11) are a separate, opt-in notification flow, not an automatic penalty announcement.

---

## 8. Deleting a Habit

```
Habits List (swipe-left) or Habit Detail (menu action)
  → Tap "Delete"
  → Confirmation alert: "Delete [Habit Name]? Your history will be kept, but it will be removed from your active list."
  → Confirm
  → Set archivedAt = now (soft delete, data-model.md §6)
  → Remove from Home, Habits List, active charts, chains
  → Toast: "Habit removed" with an "Undo" action [ASSUMPTION — cheap to support since it's a soft delete: undo just clears archivedAt]
```

- **Cancellation:** dismissing the confirmation alert takes no action.
- **Edge case:** deleting a habit that's a member of one or more chains — it's removed from those chains' `ChainHabit` rows automatically; the chain itself and its other members are unaffected. **[ASSUMPTION]** — surfaced to the user in the confirmation copy if the habit belongs to any chain: "This habit is part of [Chain Name]. Deleting it will remove it from that chain."

---

## 9. Viewing Progress (Habit Detail)

```
Habits List or Home → tap a habit → Habit Detail
  → Displays: momentum ring, current streak, mood calendar (history), trend
  → Tap a date on the mood calendar → shows that day's log detail (mood, context, notes) in a small popover/sheet
```

- **Empty edge case:** a habit with no logged history yet (created today) shows the calendar with all days blank/unlogged, not an error.

---

## 10. Viewing Statistics

```
Tab bar → Statistics
  → Displays: Overlapping Momentum Chart (all active habits), per-habit trend rows, insight card
  → Tap a habit's row → jumps to that habit's Detail screen for deeper history
  → Toggle time range (Week/Year, matching the existing segmented control pattern — bug-fixed per design-system.md)
```

- **Empty edge case:** zero active habits → Empty State directing to Add Habit, chart area not rendered.
- **Edge case — the "82% vs four 100% rows" bug** found in the earlier audit: **[ASSUMPTION — resolved here]** the headline "Overall Consistency" percentage must be a computed aggregate (mean of all active habits' `momentumScore` values, or mean completion rate over the selected time range — recommend momentum-based to match the app's actual mechanic) and must be derived from the same underlying data as the per-habit rows below it, never a separately hardcoded number.

---

## 11. Managing Reminders / Notifications

**[ASSUMPTION — PRD does not fully specify this flow]:** minimal, opt-in reminder system:

```
Settings → Notifications
  → Toggle "Daily reminders" on
  → System requests browser notification permission (Web Notifications API)
  → If granted: per-habit reminder time can optionally be set (defaults to a general daily reminder if not customized)
  → If denied: show a message explaining reminders are off, with a link to system Settings
```

- **Failure path:** permission denied → app continues to function fully without reminders; this is never a blocking gate.
- Time-constraint habits **[ASSUMPTION]** should default their reminder time to ~30 minutes before the constraint, if reminders are enabled — a natural pairing between two already-specified features, not a new one.

---

## 12. Changing Settings

```
Profile → Settings
  → Notifications (§11)
  → Account (display name, editable)
  → Session (signed-in email, "Log out")
  → About / version info
```

**v3:** logout exists, and confirms before signing out ("Your habits stay safely
on your account"). Still no data-wipe or account deletion — those remain out of
scope.

---

## 13. Building / Completing a Habit Chain

```
Manage Chains → Tap "+ New Chain"
  → Name the chain
  → Add habits from existing active habits, drag to reorder (interaction-spec.md §14)
  → Save
  → Chain appears on Manage Chains with today's progress (0/N)

Daily use:
  → Completing each member habit (Flow 5) increments the chain's computed progress
  → When all members are complete for today → chain card success animation (interaction-spec.md §11)
```

- **Edge case:** a chain with only one habit. **[ASSUMPTION]** — technically allowed (no minimum enforced), though the UI may nudge toward 2+ since a one-habit chain provides no sequencing value.

---

## 14. Running a Pomodoro Session

```
Tab bar → Focus
  → Select duration preset (25/45/60) or leave default
  → Optionally select a linked habit [ASSUMPTION — see ui-spec.md Focus screen; not present in the audited build, added per data-model.md §7]
  → Tap "Start"
  → Timer counts down; Pause/Reset available
  → On completion: PomodoroSession row saved (completed = 1), success feedback fires
  → On manual reset before completion: PomodoroSession row saved (completed = 0) [ASSUMPTION — abandoned sessions are still recorded for accuracy of any future "sessions today" count, just flagged incomplete]
```

- **Cancellation:** "Reset" at any time stops the timer and returns to the preset-selection state; per §14's assumption, this still writes an incomplete session row rather than discarding it silently.

---

## 15. Viewing the Weekly Recap

```
Tab bar or Home → Weekly Recap
  → System generates one recap card per active habit for the past 7 days (data-model.md-driven aggregation, template logic from PRD/ISA2 doc)
  → Each card: completion count, verdict badge (Strong week / Steady / Slipping), generated sentence
  → No interaction beyond reading — [ASSUMPTION] tapping a card navigates to that habit's Detail screen, consistent with Statistics' pattern
```

---

## 16. Friends & Challenges (Phase 2 — documented for completeness, not built yet)

```
Tab bar → Friends & Challenges (only visible/enabled once Phase 2 ships)
  → View friend list, pending requests
  → Add friend by username
  → View/join active challenges, leaderboard
```

Not detailed further — this entire flow is out of scope until Phase 2 is explicitly started, per `PRD.md` §6.
