# Brutalist Ledger Phase 2 — Inner Pages, Charts, and Auth

## Problem

Phase 1 (spec: `2026-07-07-brutalist-ledger-redesign-design.md`, merged same
day) restyled the design tokens, shared primitives, dashboard shell, and
landing page. The ~11 authenticated pages and their ~31 shared components now
inherit the new tokens (bright 2px `--border` hairlines, Space Grotesk, green
brand) but were never deliberately styled — they still carry old-system
patterns: `rounded-*` classes, translucent `bg-brand/10 text-brand` tint
pills, 1px `border` cards, and indigo-anchored chart palettes. The Clerk
sign-in/sign-up widgets are stock Clerk and clash with the shell.

## Direction

Apply the locked Brutalist Ledger + Signal Accent system (see phase-1 spec
for tokens; all its Global Constraints carry over verbatim) across every
remaining authenticated surface, the chart layer, and the Clerk auth UI.
Styling-only: no behavior, copy, or data changes.

## New Shared Patterns (`app/globals.css`)

**Hybrid table treatment** (decided in brainstorming):

- `.row-boxed` — one 2px-bordered rectangle per item, flat, 0 radius:
  ```css
  .row-boxed {
    @apply border-2 border-border bg-surface px-3 py-2 hover:bg-surface-2 transition-colors;
  }
  ```
  Used for short card-level lists: dashboard holdings/watchlist rows, alerts
  list, feed items — the look from the approved phase-1 mockup.
- Dense tables (History, Leaderboard, Screener, Markets table, holdings
  table) keep real `<table>` markup and the existing thin `.table-row`
  separators, but gain a 2px rule under the header:
  ```css
  .table-head {
    @apply border-b-2 border-border text-xs font-bold uppercase tracking-widest text-text-secondary;
  }
  ```
  Applied to `<thead>` rows. Row hover stays `hover:bg-surface-2`.

**Which gets which:** a list is "dense" when it's tabular (multiple aligned
columns, potentially dozens of rows) — use classic table treatment. A list is
"card-level" when it lives inside a dashboard card or sidebar-style panel
with a handful of items — use `.row-boxed`.

## Chart Layer (`components/charts/`, ~1,021 lines, 3 files)

- lightweight-charts themes: up/down candle + area colors mapped to
  `#22c55e` / `#ef4444`; grid and crosshair lines use the subtle divider
  color (`#2a2a2a` dark / `#d4d4d4` light); chart background transparent,
  sitting inside a `border-2 border-border` panel (per phase-1 spec).
- Allocation/sector donuts (currently anchored on indigo `#6366f1`):
  categorical scale anchored on signal green plus neutral steps —
  dark theme: `#22c55e, #16a34a, #ffffff, #a3a3a3, #525252, #2a2a2a`;
  light theme: `#22c55e, #16a34a, #0a0a0a, #525252, #a3a3a3, #d4d4d4`;
  cycle if more slices. Slices separated by a 2px background-colored border
  so adjacent same-ish neutrals stay distinguishable.
- Red stays reserved for loss/sell semantics — never used as a categorical
  slice color.

## Component/Page Rollout (clusters, shared components before consumers)

Mechanical rules applied throughout (from phase 1): strip `rounded-*`
(except `rounded-full` on avatars/status dots), replace `bg-X/10 text-X`
tint pills with solid fills (`#0a0a0a` text) or outlined blocks, labels
bold-uppercase-tracked, primary bounded elements `border-2 border-border`,
no box-shadows, numeric data keeps JetBrains Mono via `.stat-value` /
`.data-value` / `font-mono tabular-nums`.

1. **Charts cluster:** `components/charts/` (3 files) as above.
2. **Markets cluster:** `components/markets/` (13 files), then
   `app/(dashboard)/markets/` (2 pages: browser + `[symbol]` detail).
3. **Portfolio cluster:** `components/portfolio/` (7 files), then
   `app/(dashboard)/portfolio/` and `app/(dashboard)/dashboard/` pages.
4. **Trading cluster:** `components/trading/` (3 files) — buy actions get
   `--signal-green` fills, sell actions `--signal-red` fills, both with
   `#0a0a0a` text; the PredictionOrderForm YES/NO selector follows the same
   green/red mapping.
5. **Remaining pages:** news, screener, analysis, leaderboard, profile
   (2 files), history, bot-logs (2 files), settings, plus the alerts
   dropdown (`components/alerts/`, 1 file — there is no alerts page; the
   `app/(dashboard)/alerts/` directory is empty) and `components/feed/`
   (1 file).
6. **Auth cluster:** Clerk `appearance` on `ClerkProvider` (one place):
   ```ts
   appearance={{
     variables: {
       colorPrimary: '#22c55e',
       borderRadius: '0px',
       fontFamily: "'Space Grotesk', system-ui, sans-serif",
       colorBackground: 'var(--surface)',
       colorText: 'var(--text-primary)',
       colorInputBackground: 'var(--surface-2)',
       colorInputText: 'var(--text-primary)',
     },
   }}
   ```
   CSS `var()` strings make the widget follow the `.light` class toggle
   automatically. If Clerk rejects `var()` values at runtime, fall back to a
   small client wrapper around ClerkProvider that reads `next-themes` and
   passes resolved hex values. The `app/(auth)/` page wrappers (2 files)
   also get the standard mechanical pass.

## Verification

- Styling-only: 92/92 existing tests stay green, `tsc --noEmit` clean,
  `npm run build` passes.
- gstack screenshots of the public surfaces (landing, sign-in) in both
  themes.
- Authenticated pages: manual sign-in check by Styli after deploy (no
  seeded test account — automating one remains out of scope).

## Out of Scope

- New features, behavior, or copy changes.
- Dependency changes (Clerk 7 migration landed separately today).
- Seeded test account / E2E auth automation.
- The five untracked `scripts/test-*.ts` scratch files.
