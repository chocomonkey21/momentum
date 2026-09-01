# CLAUDE.md — Project Instructions for Claude Code

This file governs how Claude Code should work on **Momentum**. Read this before touching any code. `PRD.md` and `design-system.md` are the source of truth for *what* to build; this file governs *how* to build it.

---

## 1. What This Project Is

Momentum is a habit and productivity tracker, built as a **responsive web app** with Next.js + TypeScript, deployed to Vercel and demoed live via a browser URL. It replaces the hard streak-counter model most habit trackers use with a **decaying momentum score** — one missed day dips progress, it doesn't erase it.

It is simultaneously a **habit tracker** (primary identity) and a **productivity tool** (secondary layer, via the Pomodoro timer), connected through one link: a Pomodoro session can optionally attach to a habit. See `PRD.md` §3 for the full categorization.

Current phase: **Phase 1 and Phase 2 are both built and shipped.** The app runs
on **Supabase (Postgres + Auth)** with real accounts — the earlier "local-only,
no backend, no accounts" scope is superseded. Friends & Challenges is live.

Still out of scope: any smart-device/HealthKit/Google Fit integration
(`PRD.md` §4), and light mode.

**Live:** https://momentum-adc-isa.vercel.app · pushing to `main` auto-deploys.

---

## 2. Product Philosophy

- **Progress decays, it doesn't collapse.** Every piece of UI or logic that touches a habit's status should reflect graceful decline, not a binary success/failure. If you're tempted to reset something to zero on a miss, stop and re-read `data-model.md`'s momentum formula.
- **Explain the pattern, don't just record it.** Context tagging (mood/location) exists so the app can tell the user *why* something worked, not just *that* it did. Insight copy should always try to surface a reason, not just a number.
- **Cut scope, not corners.** Phase 1 is deliberately small. Build it completely and polish it, rather than half-building Phase 2 features.

---

## 3. UX Philosophy

- **Wayfinding first.** Every screen must make it obvious: where am I, where can I go, what's here, how do I leave. Never trap the user in a modal or flow with no visible exit.
- **Direct manipulation.** Habit completion, mood selection, and chain reordering should feel like touching the actual thing, not filling out a form about it. Prefer taps/toggles/drags over multi-step dialogs wherever the action is simple.
- **Momentum is the hero.** On any screen where a momentum score, ring, or chart appears, it gets the most visual weight on that screen. Don't let secondary metadata compete with it.

---

## 4. Design Principles

Non-negotiable, from `design-system.md` §0 — restated here because they get violated first under deadline pressure:

- **One tint color means "actionable."** `color.tint` (system blue) is for things the user can tap. Never apply it decoratively.
- **Red is destructive/error only.** Never use `color.destructive` for a neutral stat, empty state, or "0% today" — that was a real bug in an earlier build. Zero is neutral, not an error.
- **Four type faces, each with one job** (`design-system.md` §2.2): Righteous for the splash wordmark, Anton for hero numerals, Roboto Condensed Bold for titles, Roboto Condensed Light for body and metadata. The *scoping principle* is unchanged and still matters: **the display faces never appear on a list row or in body copy.**
- **The app is a fixed 440px phone-width column at every viewport** (`design-system.md` §3). This reverses the earlier responsive requirement, at the client's request. There is no sidebar and no multi-column layout; every screen stacks.

---

## 5. Coding Principles

- **TypeScript strict mode, no `any`.** If a type is genuinely unknown, use `unknown` and narrow it — don't silence the compiler.
- **Functional components + hooks only.** No class components.
- **Colocate by feature, not by type.** Prefer `features/habits/HabitCard.tsx` over a global `components/` dumping ground once a feature has more than 2–3 files.
- **No premature abstraction.** Don't build a generic `<Card>` system until at least two real screens need the same card shape. Copy-paste twice before abstracting.
- **Every file should be understandable on its own.** If a component needs surrounding context to make sense, that's a sign it's doing too much or is split in the wrong place.

---

## 6. Component Architecture Principles

- **Screens own data-fetching and state; components below them are presentational where possible.** A `HabitCard` should receive a habit object and callbacks as props — it should not query the database itself.
- **One state management approach: React Context + hooks**, per `tech-stack.md`. Do not introduce Redux, Zustand, MobX, or Jotai. There are two providers: `AuthContext` owns the session, `AppContext` owns that user's data and only loads once auth resolves. `AppContext` holds an explicit snapshot and calls `refresh()` after every mutation — Postgres over HTTP has no live-query equivalent of Dexie's `useLiveQuery`, and Realtime would be overkill for a single-user app.
- **Shared UI primitives live in `src/components/ui/`** (Button, Card, Chip, MomentumRing, EmptyState, etc.) and must pull every style value from `theme.ts` — no inline hex codes, no inline magic numbers for spacing.
- **Business logic (momentum calculation, streak calculation, time-constraint checks) lives in `src/lib/`, not inside components.** A component calls `computeMomentum(...)`; it does not contain the decay formula inline. This paid off directly: `src/lib/` was **not touched** by the Dexie → Supabase migration, because `src/db/queries.ts` kept its signatures and the domain types kept their shapes.

---

## 7. Rules for Using the Design System

- **`design-system.md` is authoritative for every color, type size, spacing value, radius, and motion config.** If a value you need isn't in that file, don't invent one — pick the nearest token and flag the gap rather than adding a new raw value.
- **Every screen must be checked against `design-system.md` §3 (Layout) for all three breakpoints (mobile/tablet/desktop) before being considered done.**
- **Icons are `lucide-react` only.** Do not pull in a second icon library or custom icon fonts alongside it — one icon system, per `design-system.md` §6.
- **Data-visualization color (per-habit hues in charts/calendars) uses only the curated set** in `design-system.md` §1 (blue/green/orange/purple/pink) — don't generate arbitrary colors per habit.

---

## 8. Rules Against Unnecessary Dependencies

- Before adding any package, check `tech-stack.md` first — if the need is already covered, use what's there.
- **Every new dependency must work in a standard Next.js/Vercel deployment** — no native modules, no platform-specific build steps, no server infrastructure beyond Supabase.
- **shadcn/ui was not adopted.** Radix primitives are used directly (dialog, alert-dialog, switch, popover). Don't reintroduce shadcn to add one component.
- Do not add a themed UI kit (Material UI, Chakra, Ant Design) — the design system already fully specifies the component set, and a themed kit would need overriding more than it would help. Unstyled Radix primitives are the pattern here.
- Do not add a routing library other than Next.js App Router. Do not add a second HTTP client, second date library, or second animation library alongside what `tech-stack.md` specifies.

---

## 9. Accessibility Expectations

- Every screen supports responsive text sizing and respects the user's browser zoom/font-size settings — no fixed-height containers around text that could wrap at larger sizes.
- Every icon-only control has an `aria-label`.
- Every tappable/clickable element has a minimum 44×44px hit area, even if the visible glyph is smaller — pad the target, don't enlarge the glyph past its design size.
- Text/background contrast meets 4.5:1 minimum — this is a known risk area with `label.secondary` gray on `bg.secondary`; verify it explicitly wherever that pairing is used.
- Respect reduced-motion: use `prefers-reduced-motion` (CSS media query or Framer Motion's `useReducedMotion()`) and fall back to opacity cross-fades per `design-system.md` §5 and `interaction-spec.md`.
- **New for web:** every interactive element must have a visible `:focus-visible` state and be reachable via Tab key — this wasn't a concern on the touch-only native build and is now a first-class requirement.

---

## 10. Layout Expectations (revised)

**The responsive requirement was reversed at the client's request.** The app is
**one 440px-wide column, centred, at every viewport**, with a bottom tab bar.

- No sidebar. No multi-column screens. Every screen stacks.
- Fixed overlays (tab bar, toasts, sheets) pin to the **frame**, not the viewport — otherwise they stretch across a wide window while content sits in a narrow strip.
- Hover and focus states are still first-class (`interaction-spec.md` §15). Mouse and keyboard users exist regardless of layout width.

---

## 11. Performance Expectations

- List screens (Habits List, Statistics) must use `FlatList`/`FlashList`-style virtualization once habit counts grow — do not `.map()` an unbounded list directly into a `ScrollView`.
- Avoid unnecessary re-renders: memoize list row components, and don't pass new inline function references to list items on every render.
- Postgres queries are indexed on the foreign keys used in lookups (`habit_id`, `user_id`) — see `data-model.md` §9.
- **PostgREST caps a response at 1000 rows and does not error when it truncates.** Any query that can exceed that must paginate with `.range()`. This bit once already: an un-paginated log read silently dropped the most recent 460 days of a year's history.
- Animations must run on the compositor thread where possible (Framer Motion's transform/opacity animations do this automatically), not block the main JS thread, per `design-system.md` §5.
- Cold start to interactive should feel instant on-device; avoid blocking the first paint on a database migration or heavy computation — show a loading state instead (see §13).

---

## 12. How Claude Should Handle Ambiguity

1. Check `PRD.md`, `design-system.md`, and the docs in this handoff set (`ui-spec.md`, `user-flows.md`, `interaction-spec.md`, `data-model.md`) first — most ambiguity is already resolved somewhere in this set.
2. If it's genuinely undecided, make the smallest reasonable assumption that keeps Phase 1 working end-to-end, implement it, and **leave a `// ASSUMPTION:` comment** at the point of the decision explaining what was assumed and why.
3. Never silently expand scope to resolve ambiguity (e.g., don't add a backend because a Phase 2 feature would be "easier" that way). Prefer the local-only, Phase 1-compatible answer.
4. Surface anything genuinely blocking (not just ambiguous) rather than guessing past it.

---

## 13. How Claude Should Handle Existing Code

- **Read before writing.** Before implementing a screen or component, check whether it already exists (even partially) and match its existing patterns rather than introducing a new pattern alongside it.
- **Don't rewrite working code to "improve" it unless asked.** A working `HabitCard` that doesn't perfectly match a later refinement of the design system should be updated in place, not replaced wholesale — smallest diff that achieves correctness.
- **If you must change a shared component, check every screen that uses it** before finishing, so you don't fix one screen and silently break another.
- **Preserve existing comments and `// ASSUMPTION:` markers** unless the assumption has been explicitly resolved — don't delete the trail of past decisions.

---

## 14. Required States for Every Feature

Every screen or feature that touches data must implement all of the following where applicable — a feature is not done if any of these is missing (see `definition-of-done.md`):

| State | Requirement |
|---|---|
| **Loading** | Skeleton or spinner matching the eventual content's layout — never a blank white/black screen |
| **Empty** | Icon (lucide) + one line of body copy + one primary action — never just an empty list |
| **Success** | Explicit, brief confirmation for meaningful actions (habit logged, chain completed) — visual (+ optional sound), per `interaction-spec.md` |
| **Error** | Human-readable message + a retry action where retry is possible — never a raw error object or silent failure |
| **Disabled** | Visually distinct (reduced opacity, not just non-functional) and not focusable/tappable |

---

## 15. Animation & Micro-interaction Requirements

- Every animation must be **purposeful** — it should communicate state change, hierarchy, or causality. No decorative motion. See `interaction-spec.md` for the full catalogue.
- Default to the spring configs in `design-system.md` §5: critically damped (`damping: 20, stiffness: 200`) for standard UI, slight bounce (`damping: 12, stiffness: 180`) only for momentum-driven/celebratory moments (chain completion, habit logged).
- Respond to touch on press-down, not release.
- Every animation must be interruptible — never lock input during a transition.
- Respect reduced motion (see §9).

---

## 16. Pre-Coding Checklist

Before writing code for any screen or feature:

- [ ] Re-read the relevant section of `ui-spec.md` for this screen
- [ ] Re-read the relevant flow(s) in `user-flows.md`
- [ ] Confirm which entities in `data-model.md` this screen reads/writes
- [ ] Confirm which existing components can be reused vs. what's genuinely new
- [ ] Confirm the screen's states (loading/empty/error/success/disabled) are all accounted for before starting
- [ ] Confirm responsive behavior for this specific screen across mobile/tablet/desktop (does the layout reflow sensibly? does content ever get clipped by the fixed nav?)

## 17. Post-Implementation Checklist

Before considering a screen or feature complete, run through `definition-of-done.md` in full. At minimum:

- [ ] All 5 states implemented and visually verified (§14)
- [ ] No hardcoded colors, spacing, or font sizes — everything through `theme.ts`
- [ ] No new dependency was added without checking `tech-stack.md` first
- [ ] Accessibility labels present on all icon-only controls
- [ ] Tested at all three breakpoints (mobile/tablet/desktop), not just one
- [ ] Business logic (momentum, streaks, time constraints) lives in `src/lib/`, not inlined in the component
