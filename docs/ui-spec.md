# ui-spec.md — Momentum UI/UX Specification

Every screen below is specified against `design-system.md` (tokens, type, motion) and `data-model.md` (what data backs it). This file describes **behavior**, not just appearance — for the "why," see `PRD.md`; for animation timing, see `interaction-spec.md`; for the flows that connect screens, see `user-flows.md`.

**Global note (v3 — as built).** Three things changed globally from v2. Where a
per-screen section below still describes the v2 behaviour, this note wins.

- **Layout is a fixed 440px phone-width column at every viewport** (`design-system.md` §3). There is **no desktop sidebar** and **no multi-column layout** — the two-column Home and Statistics arrangements described below were built and then removed. Every screen stacks.
- **Nav is a 5-item bottom tab bar at all widths**: Home · Habits · Friends · Focus · Stats. **Chains was folded into the Habits screen** as a second view (`/habits?view=chains`; `/chains` redirects there) — a chain is a grouping of habits, so it belongs in that section, and folding it in freed the slot Friends now occupies. Recap and Profile are reached from the Home header.
- **Hover** is still real and specified (`interaction-spec.md` §15); it just never distinguishes a "desktop layout" any more, because there isn't one.

**Also new since v2:** a **Login / Sign up screen** is now the app's front door (§0 below), since accounts are real.

---

## 0. Login / Sign up (v3 — new)

**Purpose:** Splash and the entry point to an account.
**User goal:** Get in, or create an account.

**Layout hierarchy:**
1. Centre: wordmark (Righteous 50px — the one screen with its own face) + tagline
2. Bottom: `Sign in` / `Create account` segmented pair, then name (signup only), email, password, and the primary CTA

**Primary action:** Sign in → Home. Create account → **Onboarding** (§1–3).
**Navigation:** Signed-out visitors on any route are redirected here; signed-in visitors are redirected away. The tab bar is hidden here and throughout onboarding, so neither can be escaped mid-flow.

**States:**
- **Error:** inline, human-readable. Supabase's raw messages are mapped ("Invalid login credentials" → "That email and password don't match").
- **Success:** redirect. A new signup owns its own redirect to onboarding — the session it creates would otherwise trip the "already signed in, go Home" guard and skip onboarding entirely.
- **Disabled/loading:** CTA shows a spinner during the auth round trip.

**Note:** email + password, deliberately not magic links — a live demo shouldn't depend on an email arriving. "Confirm email" is disabled on the project so signup yields an immediate session.

**Global note on Focus/Keyboard:** every screen must be fully operable by keyboard (Tab/Enter/Escape) per `interaction-spec.md` §15 — this is a first-class requirement now, not a fallback.

---

## 1. Onboarding — Step 1: Welcome

**Purpose:** First impression; establish brand identity and the app's one-line pitch.
**User goal:** Understand what this app is, move forward.

**Layout hierarchy:**
1. Top: small icon cluster (scoped down from the earlier reference — max 1–2 icons, see `design-system.md` §2.2 note on brand moments)
2. Center: wordmark ("MOMENTUM," brand display face, per design-system §2.2) + tagline (system font, Subheadline)
3. Bottom: primary CTA button, safe-area-bottom-aware

**Components used:** Brand wordmark (custom text treatment), Body text, Primary Button, step indicator (3 dots).

**Primary action:** "Let's Go" → advances to Step 2.
**Secondary action:** none.
**Navigation:** none backward (this is the first screen); step indicator shows position 1 of 3.

**Information hierarchy:** Wordmark > tagline > CTA. No data-driven content — fully static.

**Interaction behavior:** Single tap target (CTA). No form input.

**States:**
- Loading: N/A (static content).
- Empty: N/A.
- Error: N/A.
- Success: N/A (advancing is the only outcome).
- Disabled: N/A (CTA always enabled).
- Hover: standard button hover (background brighten) on the CTA — see `interaction-spec.md` §15.
- Focus: CTA is focusable for screen reader; wordmark/tagline are read as a single accessible heading.

**Animation:** Wordmark and tagline fade/slide in on mount (~300ms, default spring, staggered ~80ms between elements) — the only screen where a mount animation is justified, since it's the app's first impression.
**Transition out:** standard push-forward to Step 2 (interaction-spec.md §9).

---

## 2. Onboarding — Step 2: Goal Selection

**Purpose:** Let the user indicate focus areas so Step 3's habit suggestions are relevant.
**User goal:** Tell the app what they care about, quickly.

**Layout hierarchy:**
1. Top: back button + step indicator (2 of 3)
2. Headline: "What do you want to improve?" (brand display face, per the scoped exception for onboarding headlines)
3. Chip grid: Fitness, Study, Health, Creativity, Mind, Lifestyle, Work (multi-select)
4. Bottom: "Continue" CTA

**Components used:** Chip (multi-select variant), Primary Button, back button (lucide `chevron.left` icon).

**Primary action:** "Continue" → Step 3.
**Secondary action:** Back → Step 1.

**Information hierarchy:** Headline > chip grid > CTA.

**Interaction behavior:** Tapping a chip toggles its selected state (filled `color.tint` bg when selected, outlined when not — per interaction-spec §4). Multiple chips can be selected simultaneously. Zero selections is allowed (see `user-flows.md` §1) — Continue is not blocked by this.

**States:**
- Loading: N/A.
- Empty: N/A (chip list is static).
- Error: N/A — no validation failure state exists here.
- Success: N/A.
- Disabled: N/A — Continue is always enabled (per the Flow 1 assumption that categories are optional).
- Hover: chips lift/highlight on hover per `interaction-spec.md` §15; back button gets standard hover.
- Focus: each chip is independently focusable/toggleable via screen reader, announces selected/unselected state.

**Animation:** chip selection per interaction-spec §4. No screen-level mount animation (reserve that for Step 1 only).
**Transitions:** back = reverse push; forward = standard push (interaction-spec §9).

---

## 3. Onboarding — Step 3: Pick First Habits

**Purpose:** Get the user to a non-empty Home screen by the end of onboarding.
**User goal:** Pick a starting set of habits without being overwhelmed.

**Layout hierarchy:**
1. Top: back button + step indicator (3 of 3)
2. Headline: "Pick your first habits"
3. Scrollable list of suggested habit chips (ordered/filtered by Step 2's selected categories, falling back to a general default list if none were selected)
4. Bottom: "Start Tracking" CTA, safe-area-bottom-aware, **must not clip the last list item** (direct fix for the audited bug — list needs bottom padding ≥ CTA height + margin, per `design-system.md` §3)

**Components used:** Chip (multi-select, full-width row variant, distinct from Step 2's compact chips), Primary Button.

**Primary action:** "Start Tracking" → creates Habit rows, navigates to Home.
**Secondary action:** Back → Step 2.

**Interaction behavior:** Multi-select, same pattern as Step 2. **Start Tracking is disabled until ≥1 habit is selected** (per `user-flows.md` §1 — this is the one required minimum in onboarding).

**States:**
- Loading: N/A.
- Empty: N/A (list is always populated with suggestions).
- Error: N/A.
- Success: on "Start Tracking" tap, brief loading spinner on the button itself while habits are inserted (a network write now, not a local one, so this state is genuinely visible — never leave the button looking dead).
- **Disabled:** "Start Tracking" is visually dimmed (per `CLAUDE.md` §14 disabled spec) and non-interactive until ≥1 chip selected.
- Hover: habit chips highlight on hover; "Start Tracking" gets standard button hover once enabled.
- Focus: list is scrollable and each chip independently focusable.

**Animation:** chip selection per interaction-spec §4; CTA enable/disable is an opacity transition (~150ms), not a spring.
**Transition out:** this is the one onboarding transition that goes to a **different screen type** (the Nav-based Home, not another onboarding step) — should read as "arriving," a slightly more pronounced transition (fade + slight scale-up of the incoming screen) is acceptable here, still using the default spring.

---

## 4. Home / Today

**Purpose:** The daily landing screen — what needs doing today, at a glance.
**User goal:** See today's habits, complete them, understand current momentum.

**Layout hierarchy:**
1. Header: greeting ("Good morning, [Name]") + date (system font, Subheadline)
2. Hero card: today's aggregate snapshot — **[ASSUMPTION, resolving the audited bug]** this should show something like "3/4 habits done today" with a supporting ring or bar, using `color.tint`/`color.positive`, never `color.destructive` for a neutral 0% state
3. "Today's Habits" section header
4. List of today's habit cards (only habits scheduled for today, per `frequency`)
5. Nav (persistent)

**~~Desktop layout (≥1024px)~~ — removed in v3.** Home stacks at every width (`design-system.md` §3).

**v3 hero, as built:** rather than a single ring, the hero is colour-blocked — a mega `done / due` fraction, a **pip row carrying one pip per habit due today in that habit's own hue** (the day's state readable without parsing a number), and two filled stat tiles for overall momentum and best streak.

**Components used:** Habit Card (with inline completion toggle), hero snapshot component, Nav.

**Primary action:** Tap a habit's completion toggle (inline, fast path — see `user-flows.md` §5).
**Secondary action:** Tap a habit card body (not the toggle) → Habit Detail. Tap the hero card → Statistics.

**Navigation:** Nav — bottom tab bar on mobile, sidebar item on desktop; this is the Home destination, first/default item.

**Information hierarchy:** Greeting (low emphasis) → hero snapshot (highest emphasis, largest number on screen) → today's habit list (per-item: habit name > streak/momentum indicator > completion toggle).

**Interaction behavior:** See `user-flows.md` §5 and §6 for completion/undo. Tapping the toggle does not navigate away from Home — the card updates in place.

**States:**
- **Loading:** skeleton hero card + 2–3 skeleton habit-card rows (interaction-spec §10) while the day's data resolves. **v3:** this is a network round trip to Supabase, not a local read — it is reliably visible for a beat on cold start, so it carries real weight rather than being a formality.
- **Empty:** zero active habits (new user who skipped/deleted everything) → Empty State component: a lucide icon (`Sparkles` or similar), "No habits yet" body copy, "Add your first habit" primary action → Add Habit screen.
- **Error:** database read failure (rare, but must be handled) → inline error message in place of the habit list, with a "Retry" action (interaction-spec §12).
- **Success:** see completion animation, interaction-spec §3.
- **Disabled:** a habit already past its time constraint for today shows its toggle in a locked/disabled visual state (see Log Habit §8 for the full locked spec) — dimmed toggle + a small lock lucide icon, not tappable.
- Hover: habit cards lift on hover (desktop); completion toggle gets its own hover affordance independent of the card's.
- **Focus:** each habit card is a single focusable element for screen reader combining name + status + streak into one readable label; the completion toggle within it is separately focusable as a button with an explicit "Mark [habit] complete" / "Mark [habit] incomplete" accessibility label.

**Animation:** habit completion per interaction-spec §3; list appears via a brief staggered fade-in on first load only (~40ms stagger per row), not on every re-render.
**Transitions:** tab switch to/from Home is a cross-fade (interaction-spec §9), not a slide.

---

## 5. Habits List

**Purpose:** The full roster of active habits, not filtered to "today."
**User goal:** See all habits, their momentum/streak, add or remove one.

**Layout hierarchy:**
1. Header: "Your Habits" (Large Title) + "+" button (top-right, lucide `plus` icon)
2. **Habits / Chains** view toggle (v3 — Chains is hosted here now, not a separate destination)
3. Segmented control: Today / Week / Year **[bug-fixed from audit — the "Today" label must render visibly; verify contrast in implementation]**. Rendered in a quieter "ghost" variant, because two full-strength segmented controls stacked out-shout the coloured content beneath them
4. Scrollable list of Habit Cards (category eyebrow, name, streak badge, momentum indicator)
5. Nav

**v3 — the Year view is the activity view.** Selecting *Year* renders a
**GitHub-style contribution grid inside each habit card**, in that habit's hue,
graded by momentum (`design-system.md` §8).

**Components used:** Segmented Control, Habit Card, Nav, swipe-to-delete affordance (interaction-spec §13).

**Primary action:** "+" → Add Habit.
**Secondary actions:** Tap a card → Habit Detail. Swipe-left on a card → reveal Delete.

**Navigation:** Nav item ("Habits," list icon).

**Information hierarchy:** Screen title > segmented time-range control > per-habit cards, each internally ordered category (low emphasis) → name (high emphasis) → streak/momentum (high emphasis, right-aligned).

**Interaction behavior:** Segmented control changes the stat shown on each card (e.g. this-week completion % vs. this-year) without changing which habits are listed. List must be virtualized once habit counts grow (`CLAUDE.md` §11) and must reserve bottom padding so the last card is never clipped by the tab bar (direct fix for the audited bug, repeated here because it recurred on 3 screens in the audit — treat as a global layout rule, not a per-screen patch).

**States:**
- **Loading:** skeleton list (interaction-spec §10).
- **Empty:** zero active habits → Empty State, "Add your first habit" → Add Habit. Same component as Home's empty state, reused per `CLAUDE.md` §6.
- **Error:** inline error + retry.
- **Success:** N/A at the list level (success feedback belongs to the actions taken from here, e.g. delete confirmation toast).
- **Disabled:** N/A at the list level.
- Hover: cards tint on hover; "+" button and delete icon (revealed on row-hover on desktop, see `interaction-spec.md` §13) get standard hover states.
- **Focus:** each card focusable via keyboard; delete action (revealed on swipe on mobile, or on row-hover on desktop per `interaction-spec.md` §13) is also independently reachable via a keyboard-accessible action (an overflow menu or an always-present-to-screen-readers "Delete" action) — swipe/hover alone is never the only path to it.

**Animation:** swipe-to-delete per interaction-spec §13; segmented control slide per interaction-spec §6; list-row removal on delete animates the row's height collapsing (~250ms) rather than an instant disappearance.
**Transitions:** push to Habit Detail / Add Habit per interaction-spec §9.

---

## 6. Habit Detail

**Purpose:** Deep-dive on one habit — history, trend, edit/delete.
**User goal:** Understand this habit's pattern; make changes to it.

**Layout hierarchy:**
1. Header: back button, habit name (Large Title), "Edit" action (top-right)
2. Momentum Ring (large, hero position) + current streak number beside/below it
3. Mood Calendar (month grid, `design-system.md` §8) — current month, swipeable to prior months
4. Insight card (context-tagging correlation, e.g. "sticks best in the morning")
5. Adaptive difficulty suggestion banner (conditional — only shown when `missStreak >= 3`, per `data-model.md` §4.5)
6. "Delete Habit" (destructive, low visual prominence, likely bottom of screen or inside an overflow menu)

**Components used:** Momentum Ring, Mood Calendar, insight card, suggestion banner, destructive text button.

**Primary action:** "Edit" → edit form (see Flow 4).
**Secondary actions:** tap a calendar day → day-detail popover; accept/dismiss adaptive-difficulty suggestion; "Delete Habit."

**Navigation:** pushed from Home or Habits List; back returns to whichever initiated it.

**Information hierarchy:** Habit name > momentum ring (largest visual element) > streak > calendar > insight > suggestion banner (only when present) > delete (lowest visual weight, since it's destructive and shouldn't be accidentally prominent).

**Interaction behavior:** Calendar day tap opens a small sheet/popover with that day's mood, context tag, and notes (read-only here; editing a historical log is a distinct, secondary capability — see `user-flows.md` §6 edge case). Suggestion banner has two actions: "Scale down to [level]" (applies the suggestion, per `data-model.md` §4.5) or dismiss (X) — dismissing does not disable future suggestions, it just clears this one.

**States:**
- **Loading:** skeleton for ring + calendar while history loads.
- **Empty:** a brand-new habit (created today, no history) shows the ring at its starting value (50) and a fully-blank calendar — not an error, just early data. A one-line hint ("Complete this habit to start building momentum") replaces the insight card until enough data exists to generate one (**[ASSUMPTION]** — recommend a minimum of 3 logged days before attempting an insight, to avoid a misleadingly confident correlation from 1 data point).
- **Error:** inline error + retry if history fails to load.
- **Success:** applying an adaptive-difficulty suggestion shows a brief inline confirmation (banner collapses with a fade, difficulty chip elsewhere in the UI updates).
- **Disabled:** N/A beyond standard button states.
- Hover: calendar days highlight on hover; "Edit" and suggestion-banner actions get standard button hover.
- **Focus:** calendar days are individually focusable with an accessibility label including date + logged status + mood if present (e.g. "August 14th, completed, mood: good").

**Animation:** ring value transitions per interaction-spec §3 pattern (animates between values, doesn't jump-cut) whenever historical data is edited; calendar month swipe uses a horizontal slide (default spring); suggestion banner dismiss/accept collapses its height (~200ms).
**Transitions:** push to Edit form (interaction-spec §9); day-detail as a small popover/sheet (interaction-spec §7, scaled down).

---

## 7. Add Habit

**Purpose:** Create a new habit outside onboarding.
**User goal:** Set up a new habit's core parameters quickly.

**Layout hierarchy:**
1. Header: "Add New Habit" (Large Title), close/cancel action
2. Form: Habit Name (text input), Frequency (chip row), Difficulty (chip row), Time Constraint (toggle + time picker, optional, collapsed by default)
3. "Create Habit" primary button, safe-area-bottom-aware

**Components used:** Text Input, Chip (single-select variant, distinct from onboarding's multi-select), toggle, time picker (native HTML `<input type="time">` or a styled shadcn/ui time picker component), Primary Button.

**Primary action:** "Create Habit."
**Secondary action:** Cancel/close (X or swipe-down if presented as a modal — see `data-model.md`'s Add Habit screen, presented as a sheet per `interaction-spec.md` §7).

**Navigation:** presented modally from Home ("+") or Habits List ("+").

**Information hierarchy:** Name (required, first) > Frequency > Difficulty > Time Constraint (optional, visually secondary/collapsed).

**Interaction behavior:** Time Constraint section expands (height animation, default spring) when its toggle is switched on, revealing the time picker. Frequency and Difficulty are single-select chip rows (only one option highlighted at a time), unlike onboarding's multi-select chips — do not reuse the multi-select chip variant here.

**States:**
- Loading: N/A until submission (see Success).
- Empty: N/A (this screen IS the "create" flow — there's no empty state of its own).
- **Error:** inline validation on the Name field per `interaction-spec.md` §5 (empty name, or name > 60 chars per `data-model.md` §2). Time field validation if a constraint is set but malformed.
- **Success:** on valid submit, brief button-level loading spinner → dismiss the sheet → toast "Habit created" on the screen underneath (per `interaction-spec.md` §8).
- **Disabled:** "Create Habit" is disabled/dimmed while the Name field is empty.
- Hover: chip rows and the Time Constraint toggle highlight on hover; "Create Habit" gets standard button hover.
- Focus: Name field auto-focuses the keyboard on screen mount (this is the primary and often only required field).

**Animation:** sheet presentation per `interaction-spec.md` §7; Time Constraint section expand/collapse (~200ms, default spring); chip selection per §4.
**Transitions:** dismiss (success or cancel) is the sheet's standard downward exit.

---

## 8. Log Habit

**Purpose:** Detailed completion entry — mood, context, notes — beyond the quick toggle.
**User goal:** Record today's entry with enough context to power insights later.

**Layout hierarchy:**
1. Header: "Log Today" (kicker) + habit name (Large Title)
2. Completed / Skipped toggle (two large side-by-side buttons)
3. Mood selector (5-point scale, per `data-model.md` §3)
4. Context tag chips (Home / Work / Gym / Other)
5. Notes (optional multi-line text input, 280 char max)
6. "Save Entry" primary button

**Components used:** Large toggle pair, mood-point selector, Chip (single-select), multi-line Text Input, Primary Button.

**Primary action:** "Save Entry."
**Secondary action:** back/cancel (discards unsaved entry — nothing is written until Save).

**Navigation:** pushed or presented modally from Home (tapping into a habit rather than using the quick toggle) — **[ASSUMPTION]** presented as a modal sheet, consistent with Add Habit, since it's a short, single-purpose form.

**Information hierarchy:** Completed/Skipped (primary decision) > Mood > Context > Notes (fully optional, lowest emphasis).

**Interaction behavior:** Selecting "Skipped" **[ASSUMPTION]** still allows mood/context/notes to be filled in (e.g. "skipped, felt tired, at home") — a skip is still a meaningful data point for insights, not a dead end. Selecting Mood/Context are each single-select within their own row.

**States:**
- Loading: N/A (form is populated instantly, local data only).
- Empty: N/A.
- **Error:** N/A beyond standard text input validation (notes length).
- **Success:** per `interaction-spec.md` §3 — toggle fills, ring animates if visible, confirmation pulse fires, screen dismisses.
- **Disabled — the time-constraint locked state (important, audit-relevant):** if `canLogToday()` returns false (`data-model.md` §4.3), the entire "Completed" path is disabled: the Completed button is dimmed with a lock lucide icon and the copy reads "Logging closed — deadline was [time]." The user can still select "Skipped" with mood/context (that's still useful data), but cannot mark it done. This state must be visually distinct from a normal disabled button — it needs the explanatory copy, not just a dimmed button, since the reason isn't obvious otherwise.
- Hover: Completed/Skipped, mood points, and context chips all get hover highlight per `interaction-spec.md` §4/§15.
- Focus: Completed/Skipped are the first focusable elements; Notes field is reachable last, standard keyboard-dismiss-on-scroll behavior.

**Animation:** Completed/Skipped selection is an immediate fill (not animated in), per interaction-spec §3's "fills on touch-down" rule — the user shouldn't wait to see their choice register. Mood/context chip selection per §4.
**Transitions:** sheet dismiss on save (interaction-spec §7).

---

## 9. Manage Chains

**Purpose:** View and build sequences of habits tracked as a unit.
**User goal:** See chain progress; create/edit a chain.

**Layout hierarchy:**
1. Header: "Habit Chains" (Large Title)
2. List of chain cards: chain name, member habits as connected chips (with arrows between them, per the ISA2 doc's visual language), today's progress (N/M complete)
3. "+ New Chain" button (outlined style, per the earlier PDF mockup — full-width, secondary emphasis relative to habit completion actions)
4. Nav

**Chain builder (secondary view, pushed from "+ New Chain" or a chain's "Edit"):**
1. Chain name input
2. Add-habit picker (from existing active habits)
3. Reorderable list of selected habits (drag handles, per `interaction-spec.md` §14)
4. Save

**Components used:** Chain card, chip-with-arrow connector, Primary Button (outlined variant), drag-reorder list.

**Primary action (list view):** tap a chain → chain detail/edit. "+ New Chain" → builder.
**Primary action (builder):** "Save."
**Secondary actions:** remove a habit from the chain (builder); delete a chain (list view, swipe or overflow menu, per `user-flows.md` §8's chain-deletion note — no confirmation required, unlike habit deletion).

**Navigation:** Nav item (or reached from Home/Statistics — **[ASSUMPTION]** Chains gets its own nav item per the original menu spec in the ISA2 PRD's information architecture).

**Information hierarchy:** Chain name > member sequence (visual, left-to-right with arrows) > progress indicator.

**Interaction behavior:** Progress indicator updates live as member habits are completed elsewhere in the app (Home, Log Habit) — Manage Chains should reflect state changes without requiring a manual refresh (React Context propagation, per `tech-stack.md`).

**States:**
- **Loading:** skeleton chain cards.
- **Empty:** zero chains → Empty State: "No chains yet," "Build your first chain" → builder.
- **Error:** inline + retry.
- **Success:** chain-complete celebration per `interaction-spec.md` §11.
- **Disabled:** "Save" in the builder is disabled until a chain has a name and ≥1 habit (per `user-flows.md` §13, minimum of 1 is technically allowed but the UI may show a soft nudge past 1).
- Hover: chain cards lift on hover; in the builder, drag handles highlight on hover to signal draggability.
- **Focus:** in the builder, reorder must have a non-drag accessibility alternative — **[ASSUMPTION/REQUIREMENT]** provide "Move up" / "Move down" accessibility actions on each list item, since a drag gesture alone isn't accessible via screen reader.

**Animation:** drag-reorder per `interaction-spec.md` §14; chain-complete highlight per §11; list-item add/remove in the builder animates height (~200ms).
**Transitions:** push to builder (interaction-spec §9).

---

## 10. Focus (Pomodoro)

**Purpose:** A standalone focus timer, optionally tied to a habit.
**User goal:** Run a focused work session.

**Layout hierarchy:**
1. Header: "Focus" (Large Title)
2. Circular timer (large, hero position) showing remaining time
3. Start / Reset buttons (side-by-side)
4. Duration presets: 25 / 45 / 60 min (chip row)
5. **Optional habit link** — **[ASSUMPTION, added per `data-model.md` §7 — not present in the audited build]**: a small "Link to a habit (optional)" row above or below the presets, opening a compact picker
6. Nav

**Components used:** Circular progress timer, Primary/Secondary buttons, Chip (single-select for duration), habit picker (compact list/sheet).

**Primary action:** "Start" (becomes "Pause" while running).
**Secondary action:** "Reset." Optional: select a linked habit before starting.

**Navigation:** Nav item.

**Information hierarchy:** Timer digits (largest element on screen, brand display face per the hero-number exception) > Start/Reset > duration presets > optional habit link (lowest emphasis, since it's optional).

**Interaction behavior:** Selecting a duration preset while the timer is idle sets the countdown length; presets are disabled/ignored once a session is running (must Reset first to change duration). The optional habit link can only be set before Start, not mid-session — **[ASSUMPTION]** changing the linked habit mid-focus would confuse what the session "counted for."

**States:**
- Loading: N/A (fully local, instant).
- Empty: N/A.
- Error: N/A (no network dependency).
- **Success:** on natural completion (timer reaches 0): success feedback (visual + optional sound, brief on-screen confirmation), `PomodoroSession.completed = true` saved (`data-model.md` §7).
- **Disabled:** duration presets dim/disable while a session is actively running.
- Hover: Start/Reset get standard button hover; duration chips highlight on hover when idle.
- Focus: Start/Reset are primary focusable controls; timer digits are announced periodically to screen reader users at sensible intervals, not on every second tick (**[ASSUMPTION]** — announce at minute boundaries and on completion, to avoid overwhelming screen reader).

**Animation:** Timer ring depletion is continuous/linear (interaction-spec §10 — this is real-time tracking, not a spring). Start/Pause icon swap is a simple cross-fade (~150ms). Completion triggers the standard success feedback pattern (interaction-spec §11).
**Transitions:** none beyond tab switch (this screen doesn't push to sub-screens, aside from the optional habit-link picker presented as a small sheet).

---

## 11. Statistics

**Purpose:** Cross-habit trends and the app's "smart" surface — correlation insights.
**User goal:** Understand overall progress and patterns across all habits.

**Layout hierarchy:**
1. Header: "Your Progress" (Large Title)
2. Headline aggregate stat (e.g. "Overall Momentum," computed per `user-flows.md` §10's bug-fix note — must be derived from the same data as the rows below it)
3. Time-range control (Week / Year — same segmented control component as Habits List, same bug-fix applies)
4. **Overlapping Momentum Chart** (`design-system.md` §8) — all active habits as translucent colored bands over the selected range
5. Per-habit trend rows (habit name, color swatch matching its chart band, current value)
6. Insight card (correlation copy, same component as Habit Detail's, but aggregated across habits — **[ASSUMPTION]** e.g. "Your habits do best on weekday mornings")

**~~Desktop layout (≥1024px)~~ — removed in v3.** Statistics stacks like every other screen.

**Components used:** Overlapping Momentum Chart (Recharts), Segmented Control, per-habit trend row, insight card.

**Primary action:** tap a per-habit row → that habit's Detail screen.
**Secondary action:** toggle time range.

**Navigation:** Nav item.

**Information hierarchy:** Aggregate headline stat (largest) > chart (largest visual area) > per-habit rows > insight card.

**Interaction behavior:** Tapping/dragging on the chart **[ASSUMPTION]** shows a vertical scrub line with a tooltip of each habit's value at that date — standard chart-library interaction, not a novel one; not required for v1 if it adds meaningful implementation time, but recommended if Recharts' built-in tooltip support makes it cheap.

**States:**
- **Loading:** skeleton for the headline stat + a flat placeholder chart area + skeleton rows.
- **Empty:** zero active habits → Empty State, chart/rows not rendered.
- **Error:** inline + retry.
- **Success:** N/A at this screen's level (success feedback belongs to the actions that produced the data, elsewhere).
- **Disabled:** N/A.
- Hover: per-habit trend rows tint on hover; chart may show a hover/scrub tooltip per `interaction-spec.md`.
- **Focus:** the chart itself needs a non-visual accessibility fallback — **[ASSUMPTION/REQUIREMENT]** provide an accessible summary (e.g. "Momentum chart, 4 habits, [habit] highest at X%") since a line/area chart is not meaningfully navigable point-by-point via screen reader at this scope.

**Animation:** chart draws in on load (progressive line/area reveal, ~500ms, default spring easing); segmented control per §6; per-habit rows fade in on data update.
**Transitions:** push to Habit Detail per §9.

---

## 12. Weekly Recap

**Purpose:** A generated, readable summary of the past 7 days per habit.
**User goal:** Get a quick narrative read on the week without parsing raw numbers.

**Layout hierarchy:**
1. Header: kicker ("Week of [date]") + "Weekly Recap" (Large Title)
2. One recap card per active habit: habit name, verdict badge (Strong week / Steady / Slipping), completion count, generated sentence

**Components used:** Recap card (verdict badge + generated text, per the ISA2 PDF's existing pattern).

**Primary action:** tap a card → that habit's Detail screen (**[ASSUMPTION]**, consistent with Statistics).
**Secondary action:** none.

**Navigation:** reached from Home or a tab **[ASSUMPTION — recommend surfacing via a Home banner/notification-style entry point rather than a permanent 6th tab, since it's a weekly-cadence screen, not a daily one; a persistent tab for something viewed once a week would waste prime navigation real estate]**.

**Information hierarchy:** Per card: habit name + verdict (equal top billing) > completion count > generated sentence (longest, lowest visual weight, body text).

**Interaction behavior:** Purely a read screen; no logging or editing happens here.

**States:**
- **Loading:** skeleton recap cards.
- **Empty:** zero active habits, or a user in their first week (no full 7-day window yet) → **[ASSUMPTION]** show a "Come back after your first week" message rather than a misleading partial recap.
- **Error:** inline + retry.
- **Success:** N/A (no action to succeed at here).
- **Disabled:** N/A.
- Hover: recap cards lift slightly on hover, signaling they're tappable through to Habit Detail.
- Focus: each card is a single focusable unit combining habit name, verdict, and the generated sentence.

**Animation:** cards fade/stagger in on load (~40ms stagger, same pattern as Home's first-load list).
**Transitions:** push to Habit Detail per §9.

---

## 13. Profile

**Purpose:** Identity, lifetime stats, achievements, entry point to Settings.
**User goal:** See overall standing; reach Settings.

**Layout hierarchy:**
1. Avatar (initial-based, e.g. "M" in a colored circle — no photo upload in Phase 1, **[ASSUMPTION]**, since there's no account system yet) + name
2. Lifetime stat row: streak, completions, consistency — **[ASSUMPTION, resolving audit finding]** this row must pull from the same computed source as Statistics, not a separately hardcoded value, to avoid the numbers disagreeing
3. Achievements section (badge list, locked vs. unlocked states per `design-system.md` §7)
4. Settings entry point (gear icon or list row — **[ASSUMPTION/REQUIREMENT]**, missing in the audited build)

**Components used:** Avatar, stat row, Achievement Badge, list row (Settings entry).

**Primary action:** tap Settings row → Settings screen.
**Secondary action:** tap an achievement → detail/description of how it's earned (**[ASSUMPTION]** — a locked badge should still explain what unlocks it, not just show a mystery gray icon).

**Navigation:** Nav item (last position, conventional for a profile/account destination).

**Information hierarchy:** Identity (avatar + name) > lifetime stats > achievements > settings (lowest visual weight, since it's a navigation row, not content).

**Interaction behavior:** Achievements are read-only displays; tapping one shows criteria, doesn't "do" anything.

**States:**
- **Loading:** skeleton for stat row + badge grid.
- **Empty:** zero achievements unlocked yet → still show the full badge grid with all badges in the locked state (never hide unearned achievements — showing what's achievable is itself motivating, consistent with the Product Philosophy).
- **Error:** inline + retry.
- **Success:** N/A (no action at this screen level beyond navigation).
- **Disabled:** N/A.
- Hover: achievement badges highlight on hover; Settings row gets standard row-hover.
- Focus: stat row values are individually announced; each badge announces name + locked/unlocked + criteria.

**Animation:** stat numbers count up from 0 on first load only (~400ms, not on every revisit); badge unlock (if it happens while the user is on this screen — unlikely but possible) gets a celebratory pulse per the momentum-driven spring.
**Transitions:** push to Settings (interaction-spec §9).

---

## 14. Settings

**Purpose:** Notifications and basic account info.
**User goal:** Configure reminders; see app info.

**Layout hierarchy:**
1. Header: "Settings" (Title 2, since this is a secondary/pushed screen, not a tab root)
2. Notifications section (toggle + per-habit reminder times if enabled, per `user-flows.md` §11)
3. Account section (display name, editable) and a **Session section** showing the signed-in email with a **Log out** action (v3 — accounts are real, so logout exists)
4. About section (version number)

**Components used:** Toggle, list row, text input (name).

**Primary action:** toggle notifications on/off.
**Secondary action:** edit display name.

**Navigation:** pushed from Profile.

**Information hierarchy:** Notifications (most actionable) > Account > About (lowest, purely informational).

**Interaction behavior:** Toggling notifications on triggers the OS permission prompt (`user-flows.md` §11) — if the user previously denied permission at the OS level, tapping the toggle should deep-link to the system Settings app rather than re-prompting silently and failing (**[ASSUMPTION/REQUIREMENT]**, standard iOS pattern).

**States:**
- Loading: N/A (settings are local, instant).
- Empty: N/A.
- **Error:** if permission is denied, show explanatory copy in place of the per-habit reminder controls (per `user-flows.md` §11's failure path).
- **Success:** name-edit save shows a brief inline confirmation (checkmark fade, not a full toast — this is a low-stakes edit).
- **Disabled:** per-habit reminder time controls are disabled/hidden while the master Notifications toggle is off.
- Hover: toggle and list rows get standard hover states; no non-standard behavior on this screen.
- Focus: standard form focus order, top to bottom.

**Animation:** toggle switch per `interaction-spec.md` §4; section expand/collapse (per-habit reminder list appearing) per the same ~200ms pattern used in Add Habit's time-constraint section.
**Transitions:** standard push/back.

---

## 15. Friends & Challenges (v3 — built)

**Purpose:** Friendly competition. **User goal:** see who you're connected to and
where you stand.

**Layout hierarchy:**
1. Header: "Friends" (Large Title) + add-friend action
2. Segmented control: **Friends / Challenges**
3. *Friends:* a **Pending** section (incoming requests) above **Your friends**, each row an initial-avatar + name + @username + status
4. *Challenges:* one card per challenge — name, goal metric, date range, and a ranked leaderboard with a progress bar per participant. Your own row is labelled "You" and uses `color.tint`; others are neutral grey, so tint stays meaningful

**Navigation:** Nav item (third slot, the one Chains vacated).

**States:**
- **Loading:** skeleton rows.
- **Empty:** Empty State — "No friends yet. Add someone by username to compare momentum."
- **Error:** inline + retry.

**Backed by real Postgres rows**, not the mock data `PRD.md` §6 permitted as a
fallback. RLS makes a friendship readable from either side, so an incoming
request is visible to its recipient, and a leaderboard is readable by its
participants.

**Known gap:** *sending* a new request by username doesn't resolve — RLS
deliberately hides other users' profile rows, so the lookup returns nothing. It
reports that honestly rather than failing silently. Needs a public-profile
policy or a security-definer RPC.
