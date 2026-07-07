# Brutalist Ledger Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the locked Brutalist Ledger + Signal Accent design system (phase 1, merged today) to all remaining authenticated pages, the chart layer, and the Clerk auth UI.

**Architecture:** One shared-infrastructure task adds the two new CSS patterns and a chart palette module; every following task is a cluster sweep (shared components before the pages that consume them) applying a fixed transformation table, verified by grep-zero checks plus `tsc`/tests. Charts become theme-aware through a `useChartPalette()` hook so both themes render on-system.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, lightweight-charts, Clerk v7, next-themes, Vitest.

## Global Constraints

- Styling-only pass: no behavior, logic, copy, or data changes. 92/92 existing tests stay green; `npx tsc --noEmit -p tsconfig.json` clean; `npm run build` passes.
- Zero border-radius except `rounded-full` (avatars, status dots). Central Tailwind override already zeroes the scale — this pass also removes the now-dead `rounded-{sm,md,lg,xl,2xl,t,r,b,l}` class names from touched files.
- 2px (`border-2`) borders on primary bounded elements (cards, panels, inputs, buttons, dropdowns); small nested tags may keep 1px; internal dividers use `border-border-2` or `border-border/50`.
- No box-shadows anywhere; replace `shadow-*` with borders or nothing.
- Text on green/red/brand fills is always `#0a0a0a` (`text-[#0a0a0a]`).
- `--signal-red` `#ef4444` only for losses/sell/negative semantics — never decorative, never a categorical series color.
- Numeric data keeps JetBrains Mono (`.stat-value`, `.data-value`, or `font-mono tabular-nums`).
- Do not touch: `scripts/test-*.ts`, dependencies, `prisma/`, `app/api/` logic, test files (except reading), or files already finished in phase 1 (`tailwind.config.ts`, `components/ui/badge.tsx`, `app/page.tsx`).
- `text-brand` / `text-green` / `text-red` as plain colored text are ON-SYSTEM (brand is green now) — leave them; the patterns to eliminate are the tint-fill pills and rounded/shadow treatments in the table below.

## Transformation Table (applies to every cluster task)

| # | Old pattern (grep) | Replacement |
|---|---|---|
| P1 | `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-t`, `rounded-r`, `rounded-b`, `rounded-l`, bare `rounded ` | Delete the class (`rounded-full` stays) |
| P2 | `shadow-sm` … `shadow-2xl`, `drop-shadow-*` | Delete; if the element floats (dropdown/popover), ensure it has `border-2 border-border` instead |
| P3 | Tint pill: `bg-brand/10 text-brand` (also `/20`, and `bg-green/10 text-green`, `bg-red/10 text-red`) used as a badge/tag/chip | Solid block: `bg-brand text-[#0a0a0a] font-bold uppercase tracking-wide` (green/red variants same shape) — or, when a fill would overwhelm (large areas), outlined block: `border-2 border-border bg-transparent` keeping the colored text |
| P4 | Tint as row/section highlight background (e.g. selected state `bg-brand/10`) | `bg-surface-2` + `border-2 border-brand` if selection must read; plain `bg-surface-2` for hover |
| P5 | Card/panel/input/dropdown with 1px `border border-border` | `border-2 border-border` (skip tiny inline tags — the "small nested tags may keep 1px" allowance) |
| P6 | `<thead>` styling on dense tables | Add `table-head` class (defined in Task 1) to the header row; keep `.table-row` on body rows |
| P7 | Short card-level lists (≤ ~8 items in a dashboard card: watchlist, holdings summary, alerts dropdown items, feed items) currently styled as underline-separated rows | Wrap each item in `.row-boxed` (defined in Task 1); container drops its own inner separators, items stack with `space-y-2` |
| P8 | Section/eyebrow labels (small headings above lists/cards) | `text-xs font-bold uppercase tracking-widest text-text-secondary` (matches phase-1 `.stat-label` voice) |
| P9 | Hardcoded old-system hex in TSX/TS (`#6366f1`, `#818cf8`, `#4f46e5`, `#1e2334`, `#94a3b8`, off-system categorical hexes in charts) | Values from `components/charts/palette.ts` (Task 1) or theme tokens |

Dense vs card-level decision test (from spec): tabular multi-column data that can grow to dozens of rows = dense table (P6); a handful of items inside a dashboard card/panel = card-level list (P7).

---

### Task 1: Shared infrastructure — CSS patterns + chart palette

**Files:**
- Modify: `app/globals.css` (append to `@layer components`)
- Create: `components/charts/palette.ts`

**Interfaces:**
- Produces: CSS classes `.row-boxed`, `.table-head` (used by every later task); module `components/charts/palette.ts` exporting `SIGNAL: { up: string; down: string }`, `CATEGORICAL: { dark: string[]; light: string[] }`, `CHART_CHROME: { dark: {grid,text,border}; light: {grid,text,border} }`, and `useChartPalette(): { mode: 'dark'|'light'; categorical: string[]; chrome: {grid:string;text:string;border:string}; signal: {up:string;down:string} }`.
- Consumes: phase-1 tokens.

- [ ] **Step 1: Append the two classes to `@layer components` in `app/globals.css`**

```css
  /* Phase 2: hybrid list patterns */
  .row-boxed {
    @apply border-2 border-border bg-surface px-3 py-2 hover:bg-surface-2 transition-colors;
  }

  .table-head {
    @apply border-b-2 border-border text-xs font-bold uppercase tracking-widest text-text-secondary;
  }
```

- [ ] **Step 2: Create `components/charts/palette.ts`**

```ts
'use client'

import { useTheme } from 'next-themes'

// Brutalist Ledger chart palette (spec: 2026-07-07-brutalist-phase2-design.md).
// Red is reserved for loss/sell semantics and must never appear in CATEGORICAL.
export const SIGNAL = { up: '#22c55e', down: '#ef4444' } as const

export const CATEGORICAL = {
  dark: ['#22c55e', '#16a34a', '#ffffff', '#a3a3a3', '#525252', '#2a2a2a'],
  light: ['#22c55e', '#16a34a', '#0a0a0a', '#525252', '#a3a3a3', '#d4d4d4'],
} as const

export const CHART_CHROME = {
  dark: { grid: '#2a2a2a', text: '#a3a3a3', border: '#ffffff' },
  light: { grid: '#d4d4d4', text: '#525252', border: '#0a0a0a' },
} as const

export function useChartPalette() {
  const { resolvedTheme } = useTheme()
  // resolvedTheme is undefined during SSR/first paint; dark is the app default.
  const mode: 'dark' | 'light' = resolvedTheme === 'light' ? 'light' : 'dark'
  return {
    mode,
    categorical: [...CATEGORICAL[mode]],
    chrome: CHART_CHROME[mode],
    signal: SIGNAL,
  }
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` → no errors. `npm run test` → 92/92.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/charts/palette.ts
git commit -m "style: add row-boxed/table-head patterns and brutalist chart palette"
```

---

### Task 2: Charts cluster

**Files:**
- Modify: `components/charts/holdings-chart.tsx` (503 lines), `components/charts/portfolio-chart.tsx` (162), `components/charts/price-chart.tsx` (356), `components/portfolio/allocation-chart.tsx` (121), `components/portfolio/sector-chart.tsx` (137)

**Interfaces:**
- Consumes: `useChartPalette()`, `SIGNAL`, `CATEGORICAL`, `CHART_CHROME` from `components/charts/palette.ts` (Task 1 — exact shape in that task).
- Produces: nothing new — component props unchanged.

Known hotspots from census: `#1e2334` grid color ×17, `#94a3b8` text ×7, indigo `#6366f1`/`#818cf8` in all five files, off-system categorical hexes (`#f59e0b`, `#ec4899`, `#8b5cf6`, `#06b6d4`, `#3b82f6`, `#a855f7`, `#14b8a6`, `#eab308`, `#f97316`, `#84cc16`) as multi-series/donut colors.

- [ ] **Step 1: In each chart component, call `useChartPalette()` and replace hardcoded colors**

- lightweight-charts `createChart` options: `layout.background` → `{ type: ColorType.Solid, color: 'transparent' }` (or `'transparent'` string if already used), `layout.textColor` → `chrome.text`, `grid.vertLines.color`/`grid.horzLines.color` → `chrome.grid`, crosshair line colors → `chrome.grid`.
- Up/down series (candles, area fills, histogram): `signal.up` / `signal.down` (replaces `#10b981`-era greens and any non-`#ef4444` reds).
- Multi-series line colors (holdings chart per-symbol lines) and donut slice arrays (allocation, sector): index into `categorical` (cycle with `categorical[i % categorical.length]`).
- Donut slices: 2px separator stroke in the page background color — set the arc/border stroke to `mode === 'dark' ? '#0a0a0a' : '#ffffff'`, width 2.
- Add `chrome`/`mode` to the chart-init `useEffect` dependency array (charts re-init on theme flip; they already re-init on data changes, same pattern).
- Apply transformation table P1–P5 to the JSX wrappers in these files (e.g. `rounded-lg` on chart containers, 1px panel borders).

- [ ] **Step 2: Verify no off-system hex remains**

Run: `grep -nE "#(6366f1|818cf8|4f46e5|1e2334|94a3b8|f59e0b|ec4899|8b5cf6|06b6d4|3b82f6|a855f7|14b8a6|eab308|f97316|84cc16|10b981)" components/charts/*.tsx components/portfolio/allocation-chart.tsx components/portfolio/sector-chart.tsx`
Expected: no output.

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc --noEmit -p tsconfig.json` → clean. `npm run test` → 92/92.

- [ ] **Step 4: Commit**

```bash
git add components/charts components/portfolio/allocation-chart.tsx components/portfolio/sector-chart.tsx
git commit -m "style: theme-aware brutalist palette across chart layer"
```

---

### Task 3: Markets cluster (components + pages)

**Files:**
- Modify: all 13 files in `components/markets/` (`ai-commentary.tsx`, `alert-form.tsx`, `asset-row.tsx`, `correlation-heatmap.tsx`, `earnings-calendar.tsx`, `insider-feed.tsx`, `news-feed.tsx`, `market-overview.tsx`, `screener.tsx`, + the rest — enumerate with `ls components/markets/`), plus `app/(dashboard)/markets/page.tsx` and `app/(dashboard)/markets/[symbol]/page.tsx`

**Interfaces:**
- Consumes: `.row-boxed`, `.table-head` (Task 1), existing `.card`/`.btn-*`/`.badge-*`/`.input-base` classes, `Badge` component.
- Produces: nothing new — props unchanged.

- [ ] **Step 1: Sweep every file with the transformation table (P1–P9)**

Cluster-specific applications:
- `screener.tsx` results and any symbols table on `markets/page.tsx`: dense tables → P6 (`table-head` on header row, keep `.table-row` rows).
- `asset-row.tsx`: used in market lists — if rendered inside dashboard-style cards in short lists, P7 (`.row-boxed`); if inside the dense markets table, leave as a table row.
- `correlation-heatmap.tsx`: heatmap cell colors may interpolate green→red — that is signal-semantic (positive/negative correlation), so green/red use is correct; replace any off-system interpolation endpoints with `#22c55e`/`#ef4444` and neutral mid `#525252` (dark) / `#a3a3a3` (light).
- `alert-form.tsx` and form controls: `.input-base` (already brutalist from phase 1) instead of bespoke input classes where trivially applicable; otherwise P5 the borders.
- News/insider/earnings feeds: card-level items → P7; timestamps/sources keep `text-text-muted`.

- [ ] **Step 2: Grep-zero verify**

Run: `grep -rnE "rounded-(sm|md|lg|xl|2xl)|shadow-(sm|md|lg|xl|2xl)|bg-brand/10|bg-brand/20" components/markets "app/(dashboard)/markets"`
Expected: no output.

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc --noEmit -p tsconfig.json` → clean. `npm run test` → 92/92.

- [ ] **Step 4: Commit**

```bash
git add components/markets "app/(dashboard)/markets"
git commit -m "style: brutalist pass over markets components and pages"
```

---

### Task 4: Portfolio + dashboard cluster

**Files:**
- Modify: remaining 5 files in `components/portfolio/` (`holdings-table.tsx`, `risk-metrics.tsx`, `achievements-card.tsx`, + rest — enumerate with `ls components/portfolio/`, excluding the two donut charts done in Task 2), `components/feed/trade-feed.tsx`, `app/(dashboard)/portfolio/page.tsx`, `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `.row-boxed`, `.table-head` (Task 1), phase-1 shared classes.
- Produces: nothing new — props unchanged.

- [ ] **Step 1: Sweep with the transformation table**

Cluster-specific applications:
- `holdings-table.tsx` (real `<table>`, dense): P6 — `table-head` on the header row; body rows keep `.table-row`; P&L cells keep `text-green`/`text-red` semantics.
- Dashboard page short lists (holdings summary, watchlist): P7 `.row-boxed` — this is the exact surface from the approved phase-1 mockup (bordered AAPL/BTC rows).
- `trade-feed.tsx`: feed items → P7.
- `achievements-card.tsx`: P2 kills its shadow; badges → solid blocks per P3.
- Stat tiles on both pages: values `font-mono tabular-nums` (or `.stat-value`), labels per P8.

- [ ] **Step 2: Grep-zero verify**

Run: `grep -rnE "rounded-(sm|md|lg|xl|2xl)|shadow-(sm|md|lg|xl|2xl)|bg-brand/10|bg-brand/20" components/portfolio components/feed "app/(dashboard)/portfolio" "app/(dashboard)/dashboard"`
Expected: no output.

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc --noEmit -p tsconfig.json` → clean. `npm run test` → 92/92.

- [ ] **Step 4: Commit**

```bash
git add components/portfolio components/feed "app/(dashboard)/portfolio" "app/(dashboard)/dashboard"
git commit -m "style: brutalist pass over portfolio, dashboard, and trade feed"
```

---

### Task 5: Trading forms cluster

**Files:**
- Modify: `components/trading/order-form.tsx`, `components/trading/stop-order-form.tsx`, `components/trading/prediction-order-form.tsx` (597 lines total)

**Interfaces:**
- Consumes: `.btn-green`/`.btn-red`/`.input-base` from phase-1 `globals.css`.
- Produces: nothing new — props unchanged.

- [ ] **Step 1: Sweep with the transformation table**

Cluster-specific applications:
- BUY actions/tabs: solid `bg-green text-[#0a0a0a]` (or `.btn-green`); SELL: `bg-red text-[#0a0a0a]` (or `.btn-red`). Inactive tab state: `border-2 border-border bg-transparent text-text-secondary`.
- PredictionOrderForm YES/NO token selector: YES = green fill, NO = red fill, same inactive treatment — red is allowed here because NO is a sell-side/negative semantic.
- Inputs → `.input-base` or P5; quantity/price readouts `font-mono tabular-nums`.

- [ ] **Step 2: Grep-zero verify**

Run: `grep -rnE "rounded-(sm|md|lg|xl|2xl)|shadow-(sm|md|lg|xl|2xl)|bg-brand/10|bg-brand/20" components/trading`
Expected: no output.

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc --noEmit -p tsconfig.json` → clean. `npm run test` → 92/92.

- [ ] **Step 4: Commit**

```bash
git add components/trading
git commit -m "style: brutalist buy/sell forms with signal-color actions"
```

---

### Task 6: Remaining pages + small components

**Files:**
- Modify: `app/(dashboard)/news/page.tsx`, `app/(dashboard)/screener/page.tsx`, `app/(dashboard)/analysis/page.tsx`, `app/(dashboard)/leaderboard/page.tsx`, `app/(dashboard)/profile/page.tsx`, `app/(dashboard)/profile/[username]/page.tsx`, `app/(dashboard)/history/page.tsx`, `app/(dashboard)/bot-logs/page.tsx`, `app/(dashboard)/bot-logs/bot-runs-list.tsx`, `app/(dashboard)/settings/page.tsx`, `components/alerts/alerts-dropdown.tsx`, `components/ui/skeleton.tsx`, `components/ui/avatar-display.tsx`

**Interfaces:**
- Consumes: `.row-boxed`, `.table-head` (Task 1), phase-1 shared classes.
- Produces: nothing new.

- [ ] **Step 1: Sweep with the transformation table**

Cluster-specific applications:
- `history/page.tsx` and `leaderboard/page.tsx`: dense tables → P6.
- `alerts-dropdown.tsx`: dropdown container P2+P5 (`border-2`, no shadow); alert items → P7 `.row-boxed`.
- `skeleton.tsx`: `rounded-md` → delete (one-line P1).
- `avatar-display.tsx`: `drop-shadow-sm` on the owner crown → delete (P2); `rounded-full` avatar circles stay.
- `analysis/page.tsx` tabs: active tab solid `bg-brand text-[#0a0a0a] border-2 border-border`, inactive `border-2 border-transparent text-text-secondary` (mirrors the phase-1 sidebar active-state pattern).
- `settings/page.tsx` forms: `.input-base`/P5; section headings P8.
- Profile pages: stat values `font-mono tabular-nums`; badges P3; the `shadow` census hit in `profile/[username]/page.tsx` → P2.

- [ ] **Step 2: Grep-zero verify**

Run: `grep -rnE "rounded-(sm|md|lg|xl|2xl)|shadow-(sm|md|lg|xl|2xl)|drop-shadow|bg-brand/10|bg-brand/20" "app/(dashboard)" components/alerts components/ui components/feed`
Expected: no output.

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc --noEmit -p tsconfig.json` → clean. `npm run test` → 92/92.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)" components/alerts components/ui
git commit -m "style: brutalist pass over remaining dashboard pages"
```

---

### Task 7: Clerk auth theming

**Files:**
- Modify: `app/layout.tsx`, `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`

**Interfaces:**
- Consumes: phase-1 tokens; Clerk v7 `appearance` prop API.
- Produces: nothing new.

- [ ] **Step 1: Add `appearance` to `ClerkProvider` in `app/layout.tsx`**

```tsx
    <ClerkProvider
      afterSignOutUrl="/"
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
    >
```

If Clerk rejects `var()` strings at runtime (check the browser console on /sign-in — Step 3), fall back to a client wrapper: create `components/layout/clerk-appearance-provider.tsx` ('use client') that reads `useTheme()` from next-themes and renders `ClerkProvider` with resolved hex values (`#0a0a0a`/`#ffffff` etc. per theme), and use it in `app/layout.tsx` in place of the direct `ClerkProvider`.

- [ ] **Step 2: Sweep the two auth page wrappers with the transformation table** (they carry `rounded-*` per census; center layouts stay as-is).

- [ ] **Step 3: Verify on the running dev server**

Run `npm run dev`, then with the gstack browse binary (`~/.claude/skills/gstack/browse/dist/browse` as `$B`):
```bash
$B viewport 1440x900
$B goto http://localhost:3000/sign-in
$B console --errors        # expect: no Clerk appearance warnings/errors
$B screenshot --viewport /tmp/pa2-signin-dark.png
$B js "localStorage.setItem('theme','light')"
$B reload
$B screenshot --viewport /tmp/pa2-signin-light.png
```
Read both screenshots: Clerk card square-cornered, green primary button, Space Grotesk headings, colors following each theme. Stop the dev server after.

- [ ] **Step 4: Verify types and tests**

Run: `npx tsc --noEmit -p tsconfig.json` → clean. `npm run test` → 92/92.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx "app/(auth)" components/layout
git commit -m "style: theme Clerk auth widgets to match brutalist system"
```

---

### Task 8: Verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1:** `npm run test` → 92/92, no new failures.
- [ ] **Step 2:** `npx tsc --noEmit -p tsconfig.json` → no errors.
- [ ] **Step 3:** `npm run build` → completes successfully (prerender included).
- [ ] **Step 4: Whole-tree grep-zero sweep**

Run: `grep -rnE "rounded-(sm|md|lg|xl|2xl)|shadow-(sm|md|lg|xl|2xl)|drop-shadow|#6366f1|#818cf8|#1e2334" components "app/(dashboard)" "app/(auth)" app/page.tsx`
Expected: no output.

- [ ] **Step 5: Screenshot public surfaces** (landing + sign-in, dark and light) via gstack against `npm run dev`, Read them, confirm on-system rendering, stop the server.
- [ ] **Step 6: Note the manual follow-up:** authenticated pages (dashboard, portfolio, markets, etc.) need Styli to sign in locally or after deploy and confirm both themes — no seeded test account exists, deliberately out of scope.
