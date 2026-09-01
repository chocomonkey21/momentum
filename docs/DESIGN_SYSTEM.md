# Momentum — Design System v3 (as built)

> **v3 records the shipped visual direction, which diverges from v1/v2 in four
> deliberate ways** — all client-directed, with visual references:
>
> | Area | v1/v2 said | v3 ships |
> |---|---|---|
> | Type | One condensed/impact face, scoped to 3 moments | **Four faces**: Righteous (wordmark), Anton (hero numerals), Roboto Condensed Bold/Light (everything else) — §2 |
> | Colour | Apple system palette, one disciplined tint | **Bolder warm ramp**, colour-blocked cards and filled stat tiles — §1 |
> | Layout | Responsive; desktop sidebar + multi-column | **One 440px phone-width column at every viewport** — §3 |
> | Chart | Overlapping translucent area bands | **Stacked bars**, warm ramp — §8 |
>
> The *principles* in §0 all survived. What changed is the expression.
Apple-first design system, built from your existing black/blue UI reference and Apple's Human Interface Guidelines. **v2 note:** the target platform is now a responsive web app (see `tech-stack.md`) rather than an Expo/React Native native build — every visual token in this file is unchanged, only the underlying implementation technology is remapped where noted. This file is meant to travel with the codebase — drop it in the project root so Claude Code can read it directly as the design spec.

---

## 0. Principles

Grounded in Apple's HIG pillars — **Clarity, Deference, Depth** — applied as three rules for this app:

- **Clarity** — one accent color means "actionable." Numbers that matter (momentum, today's %) get the largest, boldest treatment on any screen.
- **Deference** — chrome (tab bar, headers) stays quiet; content and the user's data are what's loud.
- **Depth** — layered backgrounds (not flat black everywhere) and motion communicate hierarchy and give touch feedback.

And one rule from your UI audit, made explicit: **red is reserved for destructive/error states only.** It doesn't mean "0% today."

---

## 1. Color

Three layers — primitive (raw values) → semantic (purpose) → component (specific use). Never reference a primitive directly from a component; always go through semantic.

### 1.1 Primitives — as shipped

**v3:** the Apple system palette was replaced with a bolder, more saturated set.
The data-viz colours are ordered as a **warm ramp** so a typical 3–4 habit
account renders the stacked momentum chart as a yellow-to-red gradient.

| Token | Hex | Use |
|---|---|---|
| `amber` | `#FFC400` | Habit 1 · base of the stacked chart |
| `orange` | `#FF7A00` | Habit 2 · `color.warning` |
| `vermillion` | `#FF3D00` | Habit 3 |
| `blue` | `#0B6BFF` | Habit 4 · `color.tint` |
| `purple` | `#A855F7` | Habit 5 |
| `green` | `#34D058` | `color.positive` |
| `crimson` | `#FF2D55` | `color.destructive` — error/delete only |
| `ink0`–`ink8` | `#000000` → `#C4C4CC` | Neutral ramp, higher contrast than Apple's greys |

Habit colours are persisted **by name**, so a palette change has to handle
databases holding retired names — `normalizeChartColor()` maps legacy values
(`pink`, `red`, `yellow`, old `green`) onto the current set rather than
rendering `undefined`.

<details><summary>v1/v2 Apple system palette (superseded)</summary>

| Token | Hex | Use |
|---|---|---|
| `blue` | `#0A84FF` | iOS system blue, dark mode |
| `green` | `#30D158` | iOS system green, dark mode |
| `orange` | `#FF9F0A` | iOS system orange, dark mode |
| `red` | `#FF453A` | iOS system red, dark mode |
| `yellow` | `#FFD60A` | iOS system yellow, dark mode |
| `purple` | `#BF5AF2` | iOS system purple, dark mode |
| `gray1`–`gray6` | `#8E8E93` `#636366` `#48484A` `#3A3A3C` `#2C2C2E` `#1C1C1E` | Apple's system gray ramp, dark mode |
| `black` | `#000000` | True black (matches your current bg exactly) |
| `white` | `#FFFFFF` | — |

These are Apple's actual shipped values — not approximations — so anything built with them already looks native.

</details>

### 1.2 Semantic tokens

| Token | Value | Meaning |
|---|---|---|
| `color.tint` | `blue` | The ONE accent for interactive/actionable elements — buttons, active tab, links, selected states |
| `color.positive` | `green` | Success, completed, consistency-up |
| `color.warning` | `orange` | Momentum dipping, approaching a time constraint |
| `color.destructive` | `red` | Delete, error, failed sync — **never used for a neutral stat** |
| `color.bg.primary` | `black` | Screen background |
| `color.bg.secondary` | `gray6` (`#1C1C1E`) | Cards, list rows |
| `color.bg.tertiary` | `gray5` (`#2C2C2E`) | Nested elements inside a card (e.g. a pill inside a row) |
| `color.label.primary` | `white` | Primary text |
| `color.label.secondary` | `gray1` (`#8E8E93`) | Secondary text, captions, eyebrows |
| `color.separator` | `gray4` (`#3A3A3C`) at 50% opacity | Hairlines between rows |

**Fix from the audit:** the Home screen's "0%" card should use `color.bg.secondary` + `color.tint` for the ring, not a red gradient. Reserve `color.destructive` for things that are actually errors.

**Exception for data visualization — widened in v3.** Per-habit colour now extends beyond charts and calendars onto the **habit cards themselves**: each card carries a low-alpha wash and hairline in its own hue, deepening once the habit is done for the day. A list of habits reads as a set of distinct blocks rather than identical grey rows, and the same hue follows the habit into its contribution grid, its calendar and its chart band.

The curated set is `amber, orange, vermillion, blue, purple`, assigned round-robin at creation. (v1 named a "pink" in this list but never gave it a hex — that gap is now closed by dropping it.)

"One tint = actionable" still governs buttons, links and selection state.

### 1.3 Component tokens (examples)

```
button.primary.bg        = color.tint
button.primary.label     = color.black        // dark text on bright blue = better contrast than white
button.secondary.bg      = color.bg.secondary
button.secondary.label   = color.label.primary
card.bg                  = color.bg.secondary
card.border              = color.separator
tabBar.bg                = color.bg.primary at 85% + blur   // see §4 Materials
tabBar.tint.active       = color.tint
tabBar.tint.inactive     = color.label.secondary
momentumRing.track       = color.bg.tertiary
momentumRing.fill        = color.tint  → color.positive gradient as score climbs past 70
```

---

## 2. Typography

**Default to a system font stack for everything functional.** Use `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (Tailwind's default `font-sans` stack already does this) — on a Mac or iPhone browser this renders as San Francisco, Apple's exact type rendering, with zero font-loading cost; other platforms get their own native equivalent. This is the direct web analog of what "system font" meant in the original native spec.

### 2.1 System type scale (use for all UI chrome, body copy, list content)

| Style | Size / Weight | Use |
|---|---|---|
| Large Title | 34 / Bold | Screen titles ("Your Habits") |
| Title 2 | 22 / Bold | Section headers |
| Headline | 17 / Semibold | List row titles, card titles |
| Body | 17 / Regular | Primary reading text |
| Subheadline | 15 / Regular | Secondary row text |
| Footnote | 13 / Regular | Metadata, timestamps |
| Caption 1 | 12 / Regular | Eyebrows (uppercase category labels) |

All type sizes use relative units (`rem`, not `px`) so they scale correctly with the user's browser zoom/font-size settings — no fixed-height text containers around them that could clip at a larger size.

### 2.2 Type roles — as shipped

**v3 replaces the single condensed/impact face with four families**, each with
one job. Sizes and letter-spacing are unchanged from §2.1.

| Role | Face | Where |
|---|---|---|
| Wordmark | **Righteous 400, 50px** | The splash/login screen only — the one screen with its own face |
| Hero numerals | **Anton 400** | Momentum score, streak counts, timer digits, the big done/due fraction |
| Large Title · Title 2 · Headline | **Roboto Condensed 700** | Screen titles, section headers, card titles |
| Body · Subheadline · Footnote · Caption | **Roboto Condensed 300** | List rows, buttons, body copy, metadata |
| Eyebrows / axis labels / metric captions | Roboto Condensed 400, uppercase, `0.14em` tracking | Reads as instrumentation without a fifth family |

The scoping *principle* from v1 survives intact and still matters: **the display
faces never appear on a list row or in body copy.** Per Apple's type craft,
tracking stays size-specific — large numerals tighten, body sits at 0.

<details><summary>v1/v2 single-display-face rule (superseded)</summary>

Keep your existing condensed/impact face (the one used everywhere today) but **restrict it to three moments only**:
1. The wordmark ("MOMENTUM") on Onboarding
2. Hero stat numbers (the big momentum %, the streak count) — one number per screen, max
3. Onboarding step headlines ("WHAT DO YOU WANT TO IMPROVE?")

Everywhere else — list rows, buttons, tab labels, card metadata — switch to the system font. This was the single biggest legibility issue in the audit: one heavy face for every text size makes dense screens (Habits, Statistics) shout instead of guide.

Per Apple's own type craft: tracking is size-specific. Tighten large display numbers (`letterSpacing: -1` to `-2`), leave body text at `0`.

</details>

---

## 3. Layout

**v3: one fixed phone-width column at every viewport.** The responsive
three-breakpoint layout below was built and then deliberately reversed at the
client's request — the app should read as one consistent vertical application
everywhere, not reflow into a desktop dashboard.

| Width | Layout |
|---|---|
| All | A single **440px max-width column, centred**, with a fixed bottom tab bar. On a wide screen the surrounding page is inert backdrop |

Consequences, all intentional:
- **No desktop sidebar.** The bottom tab bar is the only nav at every width.
- **No multi-column screens.** Home and Statistics stack, as on mobile.
- Fixed overlays (tab bar, toasts, sheets) are pinned to the **frame**, not the viewport, or they stretch across a wide window while the content sits in a narrow strip.

<details><summary>v2 responsive breakpoints (superseded)</summary>

- **Base unit: 4pt.** Spacing scale unchanged: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` — now expressed as Tailwind spacing units (`1 = 4px` in Tailwind's default scale, so this maps directly: `p-4` = 16px, etc.)
- **Content margin:** 20px on mobile, scaling up to 32–48px on desktop as the sidebar layout takes over.
- **Minimum tap/click target: 44×44px** — unchanged principle, now also covers mouse click targets, not just touch.
- **Corner radius:** unchanged — `10` (small elements/chips), `16` (cards), `20` (sheets/modals), full pill (`999`) for primary buttons.
</details>

- **Safe area:** the iPhone-specific Dynamic Island/home-indicator insets no longer apply. On mobile web, use `env(safe-area-inset-*)` CSS only if the app is later installed as a PWA (not required for v1 — a normal browser tab has no notch to avoid). The general principle carries over unchanged: **every scrollable list needs bottom padding ≥ the fixed nav element's height + 16px**, so content is never hidden behind the tab bar/sidebar — this was a real recurring bug in the native build and the rule still applies here.

---

## 4. Materials & Depth

Apple's HIG leans on translucency to show layering (Depth pillar) — this translates natively to web CSS, no library needed:

- **Nav (tab bar on mobile / sidebar on desktop):** semi-transparent black (`rgba(0,0,0,0.85)`) + `backdrop-filter: blur()`, via Tailwind's `bg-black/85 backdrop-blur-xl` utilities — content scrolling underneath remains visible through it, same effect as the native `BlurView`.
- **Modals/sheets** (Add Habit, Log Habit): same blur treatment on the scrim behind them, built on Radix `Dialog` / `AlertDialog` and styled with the same utilities.

```tsx
<div className="fixed bottom-0 w-full bg-black/85 backdrop-blur-xl border-t border-white/10">
  {/* nav content */}
</div>
```

---

## 5. Motion

Apple's interfaces use **springs, not fixed-duration easing**, and are always interruptible. This is tooling-agnostic — use `framer-motion` (the web equivalent of Reanimated) with the same numeric configs:

| Interaction | Feel | Config (Framer Motion `transition`) |
|---|---|---|
| Default UI (modal open, card press, nav switch) | Critically damped, no bounce | `{ type: 'spring', damping: 20, stiffness: 200, mass: 1 }` |
| Momentum-driven (drag release, chain-complete celebration) | Slight bounce | `{ type: 'spring', damping: 12, stiffness: 180, mass: 1 }` |

Rules to bake in — unchanged from the native version, still platform-correct for web:
- Respond to **press-down** (`onMouseDown`/`onTouchStart`), not release.
- Never animate from a hardcoded starting value on interrupt — Framer Motion's `useMotionValue` reads the live value automatically when a new animation target is set mid-flight.
- Respect reduced motion — CSS `@media (prefers-reduced-motion: reduce)` or Framer Motion's `useReducedMotion()` hook — and fall back to opacity cross-fades.
- **New for web:** add real `:hover` and `:focus-visible` states wherever a mouse/keyboard user would expect one (see `interaction-spec.md`) — this didn't exist on the native touch-only build and is now a first-class requirement.

---

## 6. Iconography

**Use `lucide-react`** — a clean, geometric icon set that's the closest available web equivalent to SF Symbols' aesthetic (SF Symbols themselves are iOS-only and unavailable on web). Tree-shakeable and huge.

```tsx
import { Flame } from 'lucide-react';
<Flame color={colors.warning} size={20} strokeWidth={2.25} />
```

This directly replaces the audit's biggest icon issue: mixed outline + colored-illustration icons with no shared system. One rule going forward: **every icon is a lucide icon**, rendered as a single-color stroke matching text color by default, except where color itself is meaningful (e.g. the streak flame stays orange).

Reserve fully custom illustration for zero-frequency brand moments only (the onboarding wordmark treatment) — not for anything that repeats across screens.

---

## 7. Components

| Component | Spec | Notes / audit fixes |
|---|---|---|
| **Primary Button** | Pill, `color.tint` bg, black label, Headline weight, 50pt height | Already close to HIG in your reference — keep it |
| **Tab Bar** (all widths) | **5 items**: Home · Habits · Friends · Focus · Stats. lucide icons, **label under every icon** | Icons with no labels was an audit finding. v3 note: Chains folded into the Habits section (a chain is a grouping of habits) and Friends took the freed slot, which is what gets this to exactly the 5 items this table always specified. Recap and Profile keep entry points in the Home header |
| **Habit Card** | `card.bg`, 16pt radius, category eyebrow (Caption 1, `label.secondary`) + title (Headline) + streak badge | Remove the unused gray placeholder bars until they have a real purpose |
| **Segmented Control** | Native-style pill selector | Fix the invisible white-on-white label bug before anything else |
| **Momentum Ring** | Circular progress, `momentumRing.track`/`fill`, center label = hero number | Signature component. Lives on Habit Detail and the Focus timer; Home uses colour-blocked stat tiles instead, which read better at a glance than a second ring |
| **Habit Card** (v3) | Tinted wash + hairline in the habit's own hue, deepening when complete; squircle completion toggle filled with that hue | Makes a habit list read as distinct blocks rather than grey rows |
| **Stat Tile** (v3) | Solid filled block, mono eyebrow, Anton numeral | Home's momentum and streak tiles |
| **Empty State** | Icon (lucide) + one line of body text + one action | Currently missing everywhere — needed for zero-habits, zero-friends states |
| **Achievement Badge** | Icon + label, locked (gray, low opacity) vs. unlocked (full color) states | Define the locked state explicitly — not shown yet |

---

## 8. Data Visualization

Your UI INSPO board (6 references) points to a clear direction for the momentum/insights surfaces. Here's what each reference translates to:

**v3 status of each reference:** the Mood Calendar, Streak Dot Row and per-habit
colour all shipped as described. The Overlapping Momentum Chart shipped first as
an area chart and was then **replaced by a stacked bar chart** (below). A
**GitHub-style contribution grid** was added, which this table never anticipated.

| Reference | What it shows | Where it applies here |
|---|---|---|
| Running app (lime/dark, big pace numbers) | Bold hero numbers, weekly bar strip, stat-card grid | Validates the existing hero-number treatment on Home/Statistics — keep it, just scope the display font per §2.2 |
| "SPARK" task manager | Condensed logo type, weekly line-and-dot productivity graph, 3-stat footer row | Direct precedent for a **Weekly Trend** chart on Statistics — line graph with dot markers per day, not just a flat percentage |
| "Goal Completion" dot grid | Days-as-dots, filled vs. unfilled, single accent color | Precedent for a compact **streak dot row** on a Habit Detail screen (e.g. last 21 days as a dot strip) |
| "dotyo." month calendar | Full month as a dot grid, **each dot colored by mood/quality**, dense stat footer (Logged, Streak, Top Mood, etc.) | This is the model for **Habit Detail → History**: a month grid where dot color = logged mood, not just done/not-done. Directly visualizes the Context Tagging feature — build this |
| "Resource Overview" stacked chart | Overlapping/stacked area chart, multiple colored series over a day | This is what you asked for directly: an **Overlapping Momentum Chart** — each habit as a translucent colored band on one time axis, so you can see multiple habits' momentum rise and fall together. Build with `Recharts`' stacked/area chart |
| "Sprinter" concentric arcs | Multiple metrics as concentric colored arc bands radiating from center | Stretch goal, not v1: a **Momentum Constellation** view — all active habits as concentric rings around one center point, for a single "state of everything" glance. Worth prototyping after the core loop works, not before |

**New components this adds to §7:**

| Component | Spec |
|---|---|
| **Mood Calendar** | Month grid, 7 columns, each day a filled circle colored by that day's `MoodTag` (map moods to the 5-color habit palette above); unlogged days render as `gray5` |
| **Stacked Momentum Chart** *(v3, replaces the overlapping area chart)* | Bar chart, one thin bar per day, segmented by habit in the warm ramp, shared Y axis `0 … 100 × habitCount`. Each segment is that habit's own momentum, so stacking is a genuine **sum**, not a proportion — and every segment still equals the number on that habit's card |
| **Contribution Grid** *(v3, new)* | GitHub activity-graph treatment: one column per week, seven rows, in the habit's own hue. Intensity is graded 1–4 by that day's **momentum**, not binary done/not-done, so a run visibly builds and decays. Opens scrolled to the most recent weeks. Used by the Habits screen's Year view |
| ~~Overlapping Momentum Chart~~ *(superseded)* | Area chart, one translucent (60% opacity) band per habit over a 7/30-day window, shared Y axis (0–100 momentum) |
| **Streak Dot Row** | Horizontal row of small dots (last 14–21 days), filled = completed, outline = missed, using `color.tint` |

---

## 9. Accessibility

- Relative (`rem`-based) type sizing on all system-font text, respecting the browser's zoom/font-size settings (no fixed containers)
- Minimum contrast 4.5:1 for body text — verify `label.secondary` gray against `bg.secondary`, the closest pairing in the current palette
- All icon-only buttons need an `aria-label`
- Every interactive element ≥ 44×44pt hit area, even if the visible glyph is smaller (pad, don't just accept a small icon as the whole tap target)

---

## 10. Dev handoff notes (for Claude Code)

- **Tailwind v4 is CSS-first — there is no `tailwind.config.ts`.** Tokens live in an `@theme` block in `src/app/globals.css`, with `src/theme/theme.ts` mirroring the values TypeScript consumes (Recharts props, SVG strokes, spring configs).
- Gotcha: `text-[var(--x)]` is **ambiguous** and Tailwind resolves it as a *colour*. Font sizes from a variable need `text-[length:var(--x)]`.
- Stack: Next.js 16, React 19, Tailwind v4, Radix primitives (not shadcn/ui), Framer Motion, Recharts, lucide-react, Supabase — see `tech-stack.md`.
- Build every screen against the fixed 440px frame (§3). There are no breakpoints left to verify.
- Dark mode is the only mode for v1 — token structure supports adding a light variant later without touching component code, but don't build it now.
- **Smart Device Integration is out of scope** (professor's call — see `PRD.md`). Nothing in this file assumes HealthKit/Google Fit or any native sensor access.
- Give Claude Code this file plus `PRD.md`, `tech-stack.md`, and the rest of the handoff doc set as project context before it scaffolds anything.
