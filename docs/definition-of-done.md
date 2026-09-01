# definition-of-done.md — Momentum Quality Checklist

> **v3 note.** This checklist is unchanged as a standard — it's what "done"
> should mean. Two items were **not** met in the shipped build and are recorded
> honestly rather than quietly ticked:
>
> - **Testing:** there are no automated tests. The unit coverage of
>   `src/lib/momentum.ts`, streak and time-constraint logic asked for below was
>   traded against the build deadline. The logic was instead verified by running
>   the app and by a standalone simulation of the seed data.
> - **Accessibility audit:** focus states, `aria-label`s on icon-only controls,
>   and non-gesture alternatives to drag/swipe were all built in, but no
>   systematic contrast or screen-reader audit was performed.
>
> Everything else below was applied. Two checklist items are now obsolete: the
> three-breakpoint verification (the app is one fixed width — `design-system.md`
> §3) and the IndexedDB persistence check (now Supabase).

A feature is not complete because it technically runs. It's complete when every applicable box below is checked. Use this per-screen and per-feature, not just once at the end of the project.

---

## Functionality

- [ ] Core behavior works exactly as specified in `ui-spec.md` for this screen/feature
- [ ] All edge cases documented in `user-flows.md` for this feature are handled (not just the happy path)
- [ ] Data persists correctly to Supabase/Postgres and survives a browser refresh, a cleared browser, and a different device
- [ ] Business logic (momentum, streak, time-constraint, adaptive difficulty) matches the exact formulas in `data-model.md` §4 — no approximated or simplified version
- [ ] Every `[ASSUMPTION]` marker in the source docs relevant to this feature has been implemented consistently with how it was documented, or explicitly flagged if it needed to change

## UX

- [ ] All five required states exist where applicable: loading, empty, error, success, disabled (`CLAUDE.md` §14)
- [ ] Navigation matches `ui-spec.md`'s stated primary/secondary actions — no orphaned screens, no dead ends
- [ ] Feedback for every meaningful action is immediate and clear (visual per `interaction-spec.md`, not just a silent database write)
- [ ] Error messages are human-readable, never a raw error object, stack trace, or generic "Something went wrong" with no next step
- [ ] Destructive actions (habit deletion) require confirmation; non-destructive removals (chain deletion) do not, per `user-flows.md` §8

## UI

- [ ] Every color used is a token from `design-system.md` — no hardcoded hex values
- [ ] Every spacing value is from the 4pt scale in `design-system.md` §3 — no arbitrary pixel values
- [ ] Typography follows the type scale (`design-system.md` §2) — the brand display face appears ONLY in its three scoped moments (wordmark, hero numbers, onboarding headlines), nowhere else
- [ ] Components are reused from `src/components/ui/` rather than reimplemented per-screen
- [ ] ~~Screen is verified at all three breakpoints~~ — **obsolete**: the app is one fixed 440px column at every viewport (`design-system.md` §3). Verify it against that frame instead
- [ ] No content is clipped behind the fixed tab bar — bottom padding is applied once in the `Screen` shell rather than per screen, which is what stops this recurring a fourth time

## Accessibility

- [ ] Keyboard/screen-reader navigation order is logical (top to bottom, matching visual hierarchy)
- [ ] Every icon-only control has an `aria-label`
- [ ] Every custom gesture (swipe-to-delete, drag-to-reorder) has a non-gesture alternative reachable by keyboard/click (e.g. a delete icon on hover/focus, an overflow menu action)
- [ ] Every interactive element has a visible `:focus-visible` state and is reachable via Tab
- [ ] Text/background contrast meets 4.5:1, explicitly re-checked for `label.secondary` on `bg.secondary`
- [ ] Reduced-motion fallback exists for every spring/gesture-driven animation
- [ ] Layout respects the user's browser zoom/font-size settings — test at a larger text size and confirm nothing truncates or overlaps

## Engineering

- [ ] Zero TypeScript errors, strict mode, no `any`
- [ ] Zero console errors or warnings in normal use
- [ ] No dependency was added without checking `tech-stack.md` first and confirming it works in a standard Next.js/Vercel deployment
- [ ] No duplicated business logic — momentum/streak/time-constraint calculations exist in exactly one place in `src/lib/`, imported everywhere they're needed
- [ ] Components are colocated sensibly (`CLAUDE.md` §6) — no god-components doing data-fetching, business logic, and rendering all at once
- [ ] Existing working code was not rewritten unnecessarily (`CLAUDE.md` §13) — diffs are as small as correctness allows

## Testing

- [ ] **NOT MET** — Critical business logic (`src/lib/momentum.ts`, streak calculation, time-constraint check) has unit tests covering at least: normal completion, a miss, three consecutive misses (adaptive difficulty trigger), a time-constraint lockout. *This is the single biggest outstanding gap; `src/lib/` is pure functions and would be quick to cover.*
- [ ] The full first-time-user flow (`user-flows.md` §1) has been manually run end-to-end in a real browser, at both a mobile viewport width and a desktop width
- [ ] Regression check: after any change to a shared component (`Button`, `Card`, `MomentumRing`, etc.), every screen using it has been visually re-checked

## Final Polish

- [ ] Loading states verified on a throttled/cold start, not just a warm re-render
- [ ] Empty states verified for every list-bearing screen (Home, Habits List, Statistics, Manage Chains, Weekly Recap, Profile achievements)
- [ ] Error states verified by actually forcing a failure (e.g. temporarily breaking a query), not assumed to work
- [ ] Success feedback (visual per `interaction-spec.md`) verified in an actual browser, not just assumed from code review
- [ ] Micro-interactions match `interaction-spec.md`'s specific configs (spring values, not "close enough")
- [ ] Full app walkthrough performed in a real browser at mobile, tablet, and desktop widths immediately before any demo

---

## Definition of Done for the Project as a Whole (Phase 1)

Phase 1 is done when every item in `PRD.md` §12 (Success Criteria) is checked, every screen in `ui-spec.md` §0–15 passes the checklist above, and the app has been demoed successfully via a live Vercel URL in a browser with no crashes, no clipped content, and no state (loading/empty/error) left unimplemented.

**Status:** every `PRD.md` §12 criterion is met, including the added
account loop (sign up → onboarding → create → log → momentum updates → log out →
log back in → data intact), verified against the live deployment. Outstanding
gaps are listed at the top of this file and in `PRD.md` §14.
