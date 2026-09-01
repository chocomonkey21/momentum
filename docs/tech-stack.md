# tech-stack.md — Momentum Technical Stack (v3 — as built)

> **v3 records what was actually built.** The two substantive changes from v2:
> persistence moved from Dexie/IndexedDB to **Supabase (Postgres + Auth) for all
> phases**, and **shadcn/ui was not adopted** — Radix primitives are used
> directly. Everything else below held up.

**Platform change from v1:** this build is now a **responsive web app**, not an Expo/React Native mobile app. No Expo Go, no native builds, no App Store. The demo path is a browser URL. Visual design, colors, typography, and motion philosophy are unchanged — only the implementation layer changes. Choices below follow the same priority order as before: simplicity → reliability → developer experience → performance → maintainability → visual quality.

---

## Core Stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **Next.js (App Router)** | The default, best-supported choice for a modern React web app in Claude Code; file-based routing (directly replaces Expo Router's mental model), trivial deployment, both client and server components available if Phase 2 needs any server logic |
| **Language** | **TypeScript**, strict mode | Unchanged from v1 |
| **Styling** | **Tailwind CSS v4** | Utility-first, maps directly onto `design-system.md`'s token scale. *v3 note:* Tailwind v4 is **CSS-first** — tokens live in an `@theme` block in `globals.css`, and there is **no `tailwind.config.ts`**. `src/theme/theme.ts` mirrors the values TypeScript needs |
| **Component primitives** | **Radix UI directly** (`@radix-ui/react-dialog`, `-alert-dialog`, `-switch`, `-popover`) | *Changed from v2's shadcn/ui.* Only four primitives were ever needed, and shadcn's generated components carry their own styling opinions that would have been overridden wholesale against this design system. Using Radix directly keeps the accessibility (focus trapping, Escape, focus restoration) without the layer in between |
| **State management** | **React Context + Hooks** | Unchanged — still sufficient at this scale |
| **Persistence (all phases)** | **Supabase — Postgres + Auth** | *Changed from v2's Dexie/IndexedDB.* Real accounts made local-only storage untenable: IndexedDB is per-browser, so a cleared cache or a second device loses everything. Postgres also enforces constraints the client had been checking by hand (one log per habit per day), and Row Level Security scopes every row to its owner in the database rather than in application code |
| **Auth** | **Supabase Auth**, email + password | Deliberately not magic links: a live demo shouldn't depend on an email arriving on time. Sessions persist to localStorage, so a returning visitor skips the login screen |
| **Icons** | **lucide-react** | The closest clean, geometric icon aesthetic to SF Symbols available for web — tree-shakeable and huge. A stated visual approximation of the SF Symbols look, not literal SF Symbols (those are iOS-only) — see `design-system.md` §6 |
| **Animation** | **Framer Motion** | The direct web equivalent of Reanimated — spring-based (`damping`/`stiffness`/`mass` map straight across, see `design-system.md` §5), gesture-aware, respects `prefers-reduced-motion` natively |
| **Charts** | **Recharts** | Composable, well-documented, good visual quality without heavy custom D3 work — sufficient for the Overlapping Momentum Chart and trend lines in `design-system.md` §8. (`visx` is the upgrade path if a future revision wants more bespoke visuals — not needed for v1) |
| **Forms/validation** | **zod** | Unchanged reasoning — schemas double as types, pairs with plain controlled React state |
| **Dates** | **date-fns** | Unchanged — identical usage in a web context |
| **Testing** | **Vitest + React Testing Library** *(not implemented)* | Still the right choice, and `src/lib/` is still what needs coverage. Traded away against the build deadline — recorded as a known gap in `PRD.md` §14 rather than quietly dropped |
| **Deployment** | **Vercel** | Zero-config deploy for Next.js, gives a live shareable URL for the demo — simpler than the old Expo Go flow (no QR code, no phone, no shared Wi-Fi; open a link on any device, including a classroom projector) |

---

## What Changed From v1 (Expo) and Why

| v1 (Expo/RN) | v2 (Web) | Reason |
|---|---|---|
| Expo Router | Next.js App Router | Same file-based routing concept, web-native implementation |
| expo-sqlite | Supabase (Postgres) | Went via Dexie/IndexedDB first, then to Postgres when real accounts arrived |
| expo-symbols (SF Symbols) | lucide-react | SF Symbols are iOS-only; lucide is the closest available aesthetic match for web |
| expo-blur | Tailwind's `backdrop-blur-*` utilities (native CSS `backdrop-filter`) | Web has this natively via CSS — no library needed |
| react-native-reanimated | Framer Motion | Direct spring-based equivalent; same motion philosophy, same numeric spring configs |
| react-native-gesture-handler | Framer Motion's drag APIs + native pointer events | Covers swipe/drag without a separate gesture library |
| expo-notifications | Web Notifications API (in-browser) | **Scope note:** true push needs a service worker + backend subscription; Phase 1 should implement in-app reminder banners only, treat OS-level push as Phase 2+ |
| expo-haptics | *(removed)* | No reliable haptic API on desktop web; feedback is now visual + optional audio, not haptic — see `interaction-spec.md` |
| react-native-safe-area-context | Standard CSS + Tailwind responsive breakpoints | Web's layout model handles this natively |
| victory-native | Recharts | Same charting need, web-native library |

---

## Explicitly Not Used (and why)

| Rejected | Reason |
|---|---|
| Redux / Zustand / MobX / Jotai | Unchanged reasoning from v1 — Context + Hooks is sufficient |
| A heavier UI kit (MUI, Chakra, Ant Design) | Unstyled Radix primitives don't fight the custom design system the way a fully-themed kit would |
| shadcn/ui | *Rejected during the build.* Only four primitives were ever needed, and shadcn's generated components carry styling opinions that would have been overridden wholesale here. Radix directly gives the same accessibility with one less layer |
| `moment.js` | Unchanged — `date-fns` covers it |
| GraphQL/Apollo | No backend in Phase 1; Supabase's own client is sufficient if/when Phase 2 needs one |
| Electron / Tauri (desktop app wrapper) | Out of scope — this is a browser-based web app; "desktop" means "wide browser viewport," not a separate build target |
| Any HealthKit / Google Fit / wearable SDK | Still explicitly out of scope per `PRD.md` §4 |

---

## Authentication

**Supabase Auth, email + password, from the start.** The v2 plan (no auth in Phase 1, Supabase Auth in Phase 2) was overtaken: accounts were pulled forward.

- **Sessions persist** via the Supabase client's localStorage store, so a returning visitor lands on Home rather than the login screen.
- **"Confirm email" is disabled** on the project, so a new signup gets a live session immediately. That is a deliberate demo affordance; a production build should re-enable it.
- **Row Level Security is enabled on every table.** The base rule is `user_id = auth.uid()`. Tables without a `user_id` (`habit_logs`, `chain_habits`) are scoped by joining back to the owning habit/chain, so a user cannot reach another's row by guessing an id.
- The **anon/publishable key is safe to ship** in the client bundle — it is designed to be public, and RLS is what actually enforces access.

---

## Deployment / Demo Path

- **Development:** `npm run dev`, local Next.js dev server. Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the app throws at import without them, deliberately, so a missing env var looks like a missing env var.
- **Live URL:** **https://momentum-adc-isa.vercel.app**
- **Deploys:** the Vercel project is git-linked; **pushing to `main` builds and deploys automatically.**
  - Gotcha worth recording: Vercel blocks git deployments whose commit author isn't a member of the team that owns the project. Commits must be authored as `chocomonkey21`; the repo-local git identity is set to that account's `users.noreply` address.
  - Both `NEXT_PUBLIC_SUPABASE_*` vars must exist on the Vercel project. Next inlines them at **build** time, so a missing var fails the build rather than degrading at runtime.
- **No native build pipeline of any kind is needed.**

---

## Project Structure (recommended)

```
/app                          Next.js App Router
  /page.tsx                    Home
  /habits/page.tsx              Habits List
  /habits/[id]/page.tsx         Habit Detail
  /habits/add/page.tsx          Add Habit
  /habits/[id]/log/page.tsx     Log Habit
  /chains/page.tsx              Manage Chains
  /focus/page.tsx               Focus (Pomodoro)
  /stats/page.tsx               Statistics
  /recap/page.tsx                Weekly Recap
  /profile/page.tsx             Profile
  /settings/page.tsx            Settings
  /layout.tsx                   Root layout — nav shell (sidebar on desktop, tab bar on mobile)
/src
  /components/ui                Shared primitives (Button, Card, Chip, MomentumRing, EmptyState, Sheet, AuthGate — Radix-based where a11y demands it)
  /components/habit              Habit-specific composed components
  /lib                           Business logic — momentum.ts, streak.ts, timeConstraint.ts, recap.ts (UNCHANGED from v1 — pure functions, platform-agnostic)
  /db                             Supabase queries + domain types and row mappers
  /context                        AppContext
  /theme                          theme.ts — token values TypeScript consumes (CSS tokens live in app/globals.css)
```

**Note:** `src/lib/` (momentum, streak, time-constraint, insights, recap) is platform-agnostic pure TypeScript and was **not touched by the Supabase migration** — `src/db/queries.ts` kept its function signatures and the domain types kept their camelCase shapes, so the business logic never learned that storage changed. Row types and mappers in `src/db/schema.ts` are the only place Postgres's snake_case appears.

Added since v2: `/app/login` (splash + auth), `/src/context/AuthContext.tsx`, `/src/components/ui/AuthGate.tsx` (route guard), `/src/lib/supabase.ts` (browser client), and `/supabase/migrations/` (schema + RLS SQL).
