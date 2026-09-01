# Momentum — Product Requirements Document (PRD)
ADC · ISA 2 · Group Project — v4 (post-build)

> **v4 reconciles this document with the app that was actually built and shipped.**
> Live: **https://momentum-adc-isa.vercel.app** · Repo: `chocomonkey21/momentum`
>
> Three things changed materially from v3, all deliberate:
> 1. **Accounts are real.** Phase 1's "local-only, no accounts" is gone — the app
>    runs on Supabase Auth (email + password) with Postgres and Row Level
>    Security. Data follows the user to any device.
> 2. **Phase 2 (Friends & Challenges) shipped**, backed by real rows rather than
>    the mock-data fallback §6 permitted.
> 3. **The app presents as a fixed phone-width column at every viewport** rather
>    than a responsive desktop layout. See `design-system.md` §3.

---

## 1. Overview

Momentum is a habit and productivity tracker built around a decaying **momentum score** instead of a hard streak — one missed day dips progress, it doesn't erase it. This revision reflects professor feedback: scope is narrowed to what's buildable without native device integration, and features are re-sequenced by actual technical dependency rather than by when they were ideated.

## 2. Problem Statement

Most habit trackers reduce behavior to a checkbox and a streak counter. One missed day resets the streak to zero, killing motivation through all-or-nothing thinking, and the app never explains *why* a habit succeeded one day and failed the next. Momentum replaces the binary with a score that decays gracefully and surfaces the context behind the pattern.

## 3. Product Categorization

The brief calls for both a habit tracker and a productivity app. Rather than treating that as two bolted-together apps, every feature maps cleanly to one category, joined by a shared data model:

| Category | Features | Role |
|---|---|---|
| **Habit Tracker** *(primary identity)* | Momentum Score, Context Tagging, Habit Chains, Adaptive Difficulty, Time-Constrained Habits, Friends & Friendly Competition | Behavior formation — recurring, identity-level actions |
| **Productivity Tool** *(secondary layer)* | Pomodoro Timer | Focused, single-session work |

**The connective tissue:** a Pomodoro session can optionally link to a Habit (`PomodoroSession.HabitID`) — so "focus on reading for 25 minutes" both logs a productivity session *and* can count toward the Read habit. That link is what makes this one app rather than two. Positioning line for the professor: *"Momentum is a habit tracker at its core, with a built-in productivity layer for focused work."*

## 4. Goals & Non-Goals

**Platform note (v3):** this project pivoted from an Expo/React Native mobile app to a **responsive web app**, per direct instruction. No native build, no app store, no device-specific deployment step. The demo path is a browser URL. Visual design is unchanged — see `design-system.md` v2.

**Goals**
- A working, demoable prototype deployed to a live URL, viewable in any browser — **met**: https://momentum-adc-isa.vercel.app
- Core habit-tracking loop fully functional before any expansion feature — **met**
- A bold, consistent interface presented as a single phone-width app column at every browser width (revised from v3's "responsive across mobile/tablet/desktop"; see `design-system.md` §3)

**Non-Goals (this revision)**
- **Smart Device Integration is cut entirely**, per professor guidance. Native HealthKit/Google Fit access requires native device APIs unavailable to a web app regardless of platform — doubly out of scope now. No schema, screen, or dependency in this build should assume wearable data.
- Native mobile app / app store distribution — this is a web app by design now, not a phone-native build with a web version as an afterthought.
- Light mode — dark-only for v1 (see `design-system.md` §10).

## 5. Target Users

Students and young professionals who've abandoned at least one habit tracker within a few weeks — not from lack of discipline, but because the app gave up on them the moment they missed a single day.

## 6. Feature Set — phased by technical dependency

Re-sequenced from the original ideation list. The organizing question for each phase is **"does this need a backend?"** — that's the real cost driver, not how the feature was originally grouped.

### Phase 1 — Core (all shipped)
| # | Feature | Notes |
|---|---|---|
| 1 | Momentum Score | Decaying score, not a hard streak |
| 2 | Context Tagging | Mood + location per log entry, surfaced as insights |
| 3 | Habit Chains | Sequenced habits tracked as one unit |
| 4 | Adaptive Difficulty | Suggests scaling a habit down after repeated misses |
| 5 | Time-Constrained Habits | Optional per-habit deadline; late logging blocked, day counts as missed |
| 6 | Pomodoro Timer | Standalone focus timer, optionally linked to a Habit |

**v4 status:** all six shipped. The original plan ran Phase 1 client-side against IndexedDB (Dexie.js) with no accounts, and it was built that way first; it was then migrated to Supabase/Postgres when real accounts were added. The trade that buys: data survives a cleared browser and follows the user to any device, at the cost of requiring network access. See `tech-stack.md`.

### Phase 2 — Expansion (shipped)
| # | Feature | Notes |
|---|---|---|
| 7 | Friends & Friendly Competition | **Built on the real Supabase backend.** The mock-data fallback this row allowed was used in an interim build and has since been replaced by real friendship, challenge and participant rows, readable across accounts through RLS policies |

### Out of Scope
| Feature | Why it's cut |
|---|---|
| ~~Smart Device Integration~~ | Needs native modules + EAS dev build; not in scope per professor guidance |

## 7. Screens (Information Architecture)

| Screen | Phase | Purpose |
|---|---|---|
| Onboarding (3 steps) | 1 | Welcome → goal category → first habits |
| Home / Today | 1 | Today's habits, momentum snapshot |
| Habits List | 1 | All habits, streak/momentum per habit |
| Habit Detail | 1 | History (mood calendar), trend, edit/delete, time constraint |
| Add Habit | 1 | Name, frequency, difficulty, optional time constraint |
| Log Habit | 1 | Complete/skip, mood, context tag, notes |
| Manage Chains | 1 | View/build habit chains |
| Focus (Pomodoro) | 1 | Timer, duration presets, optional habit link |
| Statistics | 1 | Overlapping momentum chart, per-habit trend, insight card |
| Weekly Recap | 1 | Generated per-habit recap sentence |
| Profile | 1 | Identity stats, achievements, settings entry point |
| Settings | 1 | Notifications, account (no device-sync section) |
| Login / Sign up | 1 | Splash, email + password, entry to onboarding |
| Friends & Challenges | 2 | Friend list, active challenges, leaderboard |

## 8. Data Model (summary)

Nine entities, down from ten — **Activity Sync is removed** along with the feature it supported. Relationships are unchanged from the last ER revision; the storage layer is now Postgres.

**One change worth marking on the ER diagram:** `User` is no longer a standalone entity holding one implicit local row. It is a **profile row keyed 1:1 to Supabase's built-in `auth.users`**, created automatically by a database trigger at signup.

`User → Habit → HabitLog`, `User → HabitChain → ChainHabit ← Habit`, `User → Friendship`, `User → Challenge → ChallengeParticipant`, `User → PomodoroSession → (optionally) Habit`.

The full diagram (`Momentum — ISA2 Deliverables.pdf`) needs one small edit to match: delete the Activity Sync box and its connector notes. Flagging this so the PDF and this PRD don't drift — say the word and I'll regenerate that figure.

## 9. Design Direction

Full spec lives in `DESIGN_SYSTEM.md`. Summary of what your UI INSPO board established:
- Dark-first, one disciplined accent (Apple system blue) for actionable elements, richer per-habit color allowed inside charts and calendars
- Condensed/impact display type scoped to hero moments only; system font stack (`-apple-system`/San Francisco on Apple devices, sensible fallback elsewhere) everywhere else
- Signature data-viz components: momentum ring, overlapping multi-habit momentum chart, mood-colored calendar grid — all directly inspired by references you collected, not generic choices

## 10. Technical Stack (summary)

**Platform pivot (v3):** full detail in `tech-stack.md` v2. The stack is now Next.js + TypeScript, deployed to Vercel, with no native build step anywhere.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · React Context + Hooks · **Supabase (Postgres + Auth, all phases)** · Recharts · lucide-react · Framer Motion.

Changed from v3: Dexie.js/IndexedDB was replaced by Supabase; shadcn/ui was not adopted — Radix primitives are used directly and styled against the design tokens.

## 11. Target Platform

**Responsive web app**, deployed to Vercel. Reference breakpoints (see `design-system.md` §3):

| Breakpoint | Width | Layout |
|---|---|---|
| All widths | any | **A single 440px-wide app column, centred, with a bottom tab bar.** On a wide screen the surrounding page is inert backdrop |

Revised from v3's three-breakpoint responsive layout at the client's request: the
app should read as one consistent vertical application everywhere rather than
reflowing into a desktop dashboard.

Demo path: deploy to Vercel, share the live URL. Open in any browser — no app install, no device pairing.

## 12. Success Criteria (for the demo)

- [x] All screens navigable end-to-end in a browser, deployed at a live Vercel URL
- [x] Momentum score visibly decays and recovers — a year of seeded history spans 32–80 across four habits, and completing a habit moves it live (+8)
- [x] Time-constrained habit correctly blocks a late log and marks the day missed — Morning Run (09:00) shows the locked state after its deadline
- [x] Pomodoro session completes and optionally attaches to a habit
- [x] Habit Chain shows sequential progress across its linked habits
- [x] No layout bugs from the last audit remain (clipped lists, invisible labels, overlapping text)
- [x] **Accounts work end to end**: sign up → onboarding → create a habit → log it → momentum updates → log out → log back in → data intact

## 13. Open Questions

- ~~Is Phase 2 (Friends) expected for the next deliverable, or is mock data acceptable through the final demo?~~ **Resolved:** Phase 2 was built on the real backend; no mock data remains.
- Does the professor want the ISA2 PDF's ER diagram updated before the next submission? It now needs **two** edits: delete the Activity Sync box, and mark `User` as a profile keyed to `auth.users`.

## 14. Known Gaps (v4)

Stated plainly rather than left to be discovered in the demo:

- **Add-friend by username doesn't resolve.** RLS deliberately hides other users' profile rows, so a client-side username lookup returns nothing. Existing friendships and challenges display correctly; sending a *new* request needs a public-profile policy or a security-definer RPC.
- **Notifications are in-browser only.** True push needs a service worker and a backend subscription; `tech-stack.md` always scoped that as Phase 2+.
- **No automated tests.** `definition-of-done.md` asks for unit coverage of the momentum/streak/time-constraint logic; that was consciously traded away against the build deadline.
