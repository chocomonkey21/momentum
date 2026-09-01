# interaction-spec.md — Interaction & Motion Language (v3 — as built)

> **v3 note.** Every motion spec below was implemented as written — the spring
> configs, press-down triggers, interruptibility and reduced-motion fallbacks all
> hold. Two corrections only:
>
> - **There is no desktop layout.** The app is one fixed phone-width column at
>   every viewport (`design-system.md` §3), so anything below that branches on
>   "mobile vs desktop" applies to input type, not screen width. Hover is still
>   real for mouse users; swipe is still real for touch.
> - **Radix, not shadcn/ui**, provides the dialog primitives — the focus
>   trapping, Escape-to-close and focus-restoration behaviour referenced below is
>   Radix's and is unchanged.

Every animation in this app must earn its place: communicate a state change, hierarchy, or causality — never decoration. Default spring configs come from `design-system.md` §5, implemented via Framer Motion; this file applies them per-component. All durations below are **approximate** — since these are spring animations, "duration" is emergent from damping/stiffness, not a fixed timer.

Reduced motion: unless stated otherwise, every animation below has a reduced-motion fallback of a **150–200ms opacity cross-fade**, no movement/scale/spring — respect `prefers-reduced-motion`.

**Platform note (v2):** this is now a responsive web app. Every interaction below applies across touch (mobile/tablet) and mouse/keyboard (desktop) unless a section explicitly splits by input type. Hover and focus states, previously N/A on the touch-only native build, are now real and specified in §15.

---

## 1. Buttons (Primary, Secondary)

- **Trigger:** press-down (`onMouseDown`/`onTouchStart`), not release.
- **What animates:** scale to `0.97`, no color change.
- **Config:** default spring (`damping: 20, stiffness: 200`).
- **Behavior:** returns to `1.0` on release or on drag-out-of-bounds cancel. Interruptible — a second press before the return finishes restarts from the current scale, not from `1.0`.
- **Hover (desktop):** background brightens ~8% (primary) or lightens one step (secondary) — see §15.
- **Reduced motion:** opacity dip to `0.7` instead of scale.

## 2. Cards (Habit Card, generic list card)

- **Trigger:** press-down.
- **What animates:** scale to `0.98` + background lightens one step (`bg.secondary` → `bg.tertiary`).
- **Config:** default spring.
- **Hover (desktop):** lift + shadow per §15, independent of the press-state scale.
- **On release (navigates to detail):** card scales back to `1.0` as the next screen transitions in — don't let the press state persist through the navigation.

## 3. Habit Completion (the signature interaction)

This is the most important micro-interaction in the app — it's the moment the core mechanic (momentum) becomes visible.

- **Trigger:** tapping/clicking the completion toggle on a Habit Card or on the Log Habit screen.
- **What animates:**
  1. The toggle itself fills/checks immediately on press-down (no waiting for a database write to resolve).
  2. The Momentum Ring (if visible on the same screen) animates its fill from the old value to the new value over ~500ms.
  3. A brief glow/scale pulse on the toggle itself confirms the action registered (no haptic on web — see `tech-stack.md`'s platform notes — feedback is fully visual here, optionally paired with a subtle confirmation sound if audio feedback is added later).
  4. If this completion pushes momentum across a meaningful threshold (e.g. crosses 70, or hits 100), a subtle one-time "pulse" on the ring — scale to `1.05` and back — using the momentum-driven spring (`damping: 12, stiffness: 180`) for the one moment where bounce is earned.
- **Un-completing (undo):** same animation in reverse, ring animates down, no celebratory pulse, a quieter visual acknowledgment only — undo should feel neutral, not punishing.
- **Interruptible:** yes — rapidly toggling on/off should never queue up animations; each new toggle reads the ring's current live value (Framer Motion's `useMotionValue`) and animates from there.

## 4. Checkboxes / Toggles (mood selector, context chips, settings switches)

- **Trigger:** press-down (mouse or touch).
- **What animates:** selected state fills with `color.tint` (or the relevant semantic color), unselected chips dim slightly if in a multi-option group (visually de-emphasize non-selected siblings).
- **Config:** default spring, ~150–200ms feel.
- **Hover (new — desktop):** unselected chips get a subtle background lift (`bg.tertiary`) on mouse hover, signaling interactivity before the click.

## 5. Inputs (text fields — Habit name, notes)

- **Focus:** border/underline animates from `color.separator` to `color.tint` over ~150ms ease (not a spring — this is a simple color transition, not a physical object).
- **Blur:** reverse of focus.
- **Validation error:** border animates to `color.destructive`; a brief horizontal shake (±4px, 2 cycles, ~200ms) on the specific input that failed — only on submit-attempt, not on every keystroke (inline validation should just prevent submission, not shake constantly).

## 6. Dropdowns / Segmented Controls (Week/Year toggle, frequency picker)

- **Trigger:** tap on an option.
- **What animates:** the selection indicator (pill background) slides to the new position — do not fade the old option out and fade the new one in separately; it should read as one element moving.
- **Config:** default spring.

## 7. Modals / Bottom Sheets (Add Habit if presented as a sheet, confirmation dialogs)

- **Entrance:** slides up from the bottom + scrim fades in (blur, per `design-system.md` §4). Momentum-driven spring for the sheet itself since it's a physical "arriving" object; scrim is a simple opacity fade.
- **Exit:** reverse. **Must be interruptible mid-drag** if the sheet supports drag-to-dismiss — track the gesture's velocity and hand it off to the closing spring (see `design-system.md`'s apple-design motion principles: never let a closing gesture "finish" the old animation before starting the new one).
- **Backdrop tap:** dismisses with the same exit animation, not an instant cut.

## 8. Toasts / Confirmations

**Assumption:** PRD doesn't specify a toast system explicitly; recommending one for lightweight, non-blocking confirmations (e.g. "Habit saved") as distinct from the Success state on the acting screen itself.

- **Entrance:** slides down from top safe-area edge + fades in, ~250ms.
- **Duration on screen:** 2.5s before auto-dismiss.
- **Exit:** fades out + slides up slightly.
- **Interruptible:** a new toast replaces an in-flight one immediately rather than queuing.

## 9. Navigation / Page Transitions

- **Tab switches:** cross-fade, no slide — tabs are siblings, not a stack, so a directional slide would misrepresent the relationship. ~150ms.
- **Push navigation (list → detail, e.g. Habits List → Habit Detail):** *as built,* a cross-fade everywhere. The v2 rule branched on mobile-vs-desktop, but with a single fixed frame there is no width at which the two differ, and a cross-fade is the safer default against a persistent tab bar. Implemented via Framer Motion's `AnimatePresence`.
- **Modal presentation (Add Habit, Log Habit if modal):** slide up from bottom, per §7.

## 10. Progress / Loading Animations

- **Momentum Ring loading state:** ring track visible immediately (static), fill animates in once data resolves — never show an indeterminate spinner in place of the ring itself.
- **List loading (Habits List, Statistics):** skeleton rows matching the eventual card shape, with a subtle shimmer (opacity pulse between `0.5` and `0.8`, ~1.2s loop) — stops immediately once real content is ready, no minimum-display-time artificially imposed.
- **Pomodoro timer countdown:** the ring depletes continuously and linearly (this one genuinely is a fixed-duration, not spring-based, animation — it's tracking real elapsed time, not responding to touch).

## 11. Success Feedback

- Habit completion: see §3.
- Chain completion (all member habits done for the day): the chain card gets a brief full-card highlight — background flashes to a light tint of `color.positive` and fades back over ~600ms.
- Weekly Recap generated / viewed: no special animation needed beyond the standard page transition — this is a read moment, not an action moment.

## 12. Error Feedback

- Inline validation: see §5.
- Network/database error (e.g. Phase 2 Supabase call fails): toast-style message (§8) with a "Retry" action where applicable, error-red accent + icon. Never a raw error object rendered to the user.

## 13. Delete Interactions

- **Mobile/touch trigger:** swipe-left-to-reveal-delete on a list row (Habits List, Chain member list), via Framer Motion's drag gesture on the row (`drag="x"`, constrained and with a reveal threshold).
- **Desktop trigger:** no swipe gesture on desktop (nothing to swipe with a mouse) — instead, a delete icon (lucide `Trash2`) appears on row **hover**, positioned at the row's trailing edge, and is always reachable via a per-row overflow menu for keyboard/accessibility users regardless of hover state.
- **What animates (mobile):** row slides left revealing a `color.destructive` action button; 1:1 pointer tracking during the drag (per `design-system.md`'s direct-manipulation principle) — the row must stay glued to the pointer, not snap to a fixed reveal width until released past a threshold.
- **What animates (desktop):** the trailing delete icon fades in on hover (~120ms opacity), no layout shift.
- **Confirmation:** deleting a **Habit** (soft-delete, but still consequential — loses it from active views) requires a confirmation dialog (Radix `AlertDialog`) per Apple HIG guidance on destructive actions ("use sparingly, only for genuinely consequential actions"). Deleting a **chain** does not require confirmation (removes only the grouping, not any habit or log data) — a brief undo toast is sufficient instead.
- **Reduced motion:** the drag/swipe gesture itself is unaffected (it's user-driven, not decorative); only the settle/spring-back animation on release switches to a quick linear snap.

## 14. Drag / Reorder (Chain habit ordering)

- **Trigger:** press-and-drag on a habit chip within Manage Chains' chain-builder view — works identically for mouse (desktop) and touch (mobile/tablet) via Framer Motion's `Reorder.Group`/`Reorder.Item`, no separate implementation needed per input type.
- **What animates:** the picked-up chip lifts slightly (scale `1.05`, subtle shadow increase) and follows the pointer 1:1; other chips animate out of the way with the default spring as the dragged chip passes over them.
- **Drop:** chip settles into its new `orderIndex` position with the default spring.
- **Visual feedback replacing haptics:** a brief shadow/scale pulse on pickup and on drop stands in for the haptic cue the native version would have used.

## 15. Hover, Focus & Keyboard (first-class on web, not a fallback)

This is the biggest behavioral difference from the original native spec — desktop users navigate primarily by mouse and keyboard, and this needs real, designed states, not an afterthought.

**Hover (desktop/mouse only — detect via `@media (hover: hover)` so touch devices never get a stuck hover state):**
- Buttons: background lightens one step (`bg.secondary` → `bg.tertiary`) or, for the primary tint button, brightens slightly (~8%).
- Cards (Habit Card, Chain card): subtle lift — `translateY(-2px)` + soft shadow increase, ~150ms ease. Signals "this is clickable" the way a native app would rely on touch affordance alone to imply.
- List rows (Habits List, Statistics rows): background tint to `bg.secondary` on hover.
- Chips: see §4.
- Sidebar nav items (desktop): background tint + icon/label color shifts toward `color.tint` on hover, distinct from the stronger "active" state.

**Focus (keyboard navigation — `:focus-visible`, not `:focus`, so mouse clicks don't show a focus ring but Tab-navigation does):**
- Every interactive element (buttons, links, chips, form inputs, sidebar items) gets a visible focus ring: 2px `color.tint` outline with ~2px offset.
- Focus order follows visual/DOM order top-to-bottom, left-to-right — matches the Information Hierarchy documented per-screen in `ui-spec.md`.
- Modals/sheets trap focus while open (standard Radix `Dialog` behaviour) and return focus to the triggering element on close.

**Keyboard:**
- `Tab`/`Shift+Tab` moves between focusable elements; `Enter`/`Space` activates buttons and toggles.
- `Escape` closes any open modal, sheet, or dropdown.
- Text inputs: `Enter` advances to the next logical field where one exists (e.g. Add Habit's name field → frequency selection), consistent with the original mobile keyboard-advance behavior.
- **Recommended (not required for v1):** a small set of app-level shortcuts for power users — e.g. `N` to open Add Habit from Home — flagged as a nice-to-have, not blocking Phase 1 completion.

## 16. Gesture & Input Summary

**Touch (mobile/tablet):**

| Gesture | Where | Result |
|---|---|---|
| Tap | Everywhere | Primary action |
| Press-and-drag | Chain builder chips | Reorder (§14) |
| Swipe-left | List rows | Reveal delete (§13) |
| Swipe-down | Modals/sheets | Dismiss (§7) |
| Pull-to-refresh | Habits List, Statistics | **Assumption:** not specified in PRD; recommended as a standard mobile-web pattern for manually re-syncing data — implement via a small custom hook or a lightweight library, low priority relative to core Phase 1 features |

**Mouse & Keyboard (desktop):**

| Input | Where | Result |
|---|---|---|
| Click | Everywhere | Primary action |
| Click-and-drag | Chain builder chips | Reorder (§14) |
| Hover | List rows, cards, chips, nav | Reveals delete icon / lift / tint (§15) |
| Tab / Enter / Escape | Everywhere | Keyboard navigation and activation (§15) |
