# Paper Alpha Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the generic indigo-on-zinc "Linear/Vercel-clone" look for a
navy-black + gold "Navy Ledger" identity — design tokens, typography, shared
component classes, and the landing page — while leaving green/red P&L
semantics, all data/auth/trading logic, and the existing test suite
untouched.

**Architecture:** Tailwind + CSS-custom-property token system already in
place (`tailwind.config.ts` + `:root`/`.light` in `app/globals.css`) —
retint at the token layer so shared component classes (`@layer components`)
and every page consuming them (dashboard, portfolio, markets, etc.) cascade
automatically. Only `app/page.tsx` (public landing page) and
`components/charts/palette.ts` need direct edits beyond the token layer.

**Tech Stack:** Next.js 15, Tailwind CSS, `next-themes`, `lightweight-charts`,
Vitest.

## Global Constraints

- **No logic/data/auth changes.** This is a styling-only pass. `npm run
  test` (Vitest) must pass unchanged after every task.
- **Green/red P&L semantics are off-limits**: `SIGNAL.up`/`SIGNAL.down` in
  `components/charts/palette.ts`, and the `green`/`green-dim`/`red`/`red-dim`
  Tailwind tokens, keep their current values throughout this entire plan.
- **Not a return to brutalism** — no zero-radius, no 2px block borders, no
  high-contrast black/white. Navy-black base + gold accent, restrained
  tactile depth (soft inset highlights only, no heavy shadows).
- CSP already allowlists `fonts.googleapis.com`/`fonts.gstatic.com`
  (`middleware.ts:40,42`) — the Google Fonts `@import` swap in Task 2 needs
  no CSP changes.
- Work stays on branch `redesign/paper-alpha-polish`. No push, no merge to
  `main`, no `vercel --prod`.

---

### Task 1: Retint design tokens (colors)

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: the `brand`/`brand-dim` Tailwind color tokens and
  `--background`/`--surface`/`--surface-2`/`--border`/`--border-strong`/
  `--text-primary`/`--text-secondary`/`--text-muted` CSS custom properties
  that every later task's component-class and page edits rely on.

- [ ] **Step 1: Update `tailwind.config.ts` brand colors**

In the `colors` block (currently lines 11–26), change:

```ts
        brand: '#4f46e5',
        'brand-dim': '#4338ca',
```

to:

```ts
        brand: '#c9974a',
        'brand-dim': '#a97b38',
```

Leave `green`, `green-dim`, `red`, `red-dim` exactly as they are.

- [ ] **Step 2: Update the dark-theme CSS custom properties**

In `app/globals.css`, replace the `:root` block (currently lines 12–23):

```css
:root {
  --background:   #05070c;
  --surface:      #080b12;
  --surface-2:    #101623;
  --border:       #1c2433;
  --border-strong: #2c3a4d;
  --text-primary:   #f2f5fa;
  --text-secondary: #8c9bb0;
  --text-muted:     #5a6779;
  --scrollbar:    #2c3a4d;
  --scrollbar-hover: #3f4f66;
}
```

- [ ] **Step 3: Update the light-theme CSS custom properties**

Replace the `.light` block (currently lines 26–37):

```css
.light {
  --background:   #faf8f2;
  --surface:      #faf8f2;
  --surface-2:    #f2efe6;
  --border:       #e2ddd0;
  --border-strong: #cfc7b4;
  --text-primary:   #12161f;
  --text-secondary: #52596b;
  --text-muted:     #8a90a0;
  --scrollbar:    #cfc7b4;
  --scrollbar-hover: #a89f8a;
}
```

- [ ] **Step 4: Update the hero-glow gradient and selection color**

`hero-glow` (in `tailwind.config.ts`, `backgroundImage` block, currently
line 33) currently tints with indigo — update to gold:

```ts
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201,151,74,0.10), transparent)',
```

`::selection` in `app/globals.css` (currently line 57) currently tints
indigo — update to gold:

```css
  ::selection {
    background-color: rgba(201, 151, 74, 0.2);
  }
```

- [ ] **Step 5: Verify build and tests are unaffected**

Run: `cd ~/paper-alpha && npm run test`

Expected: same pass/fail result as before this task (this is a pure CSS/
config change — zero logic touched, so the suite's result must be identical
to a run on `main`).

Run: `npm run build`

Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "style: retint design tokens to Navy Ledger palette (gold accent)"
```

---

### Task 2: Swap Inter for Space Grotesk

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Swap the Google Fonts import**

In `app/globals.css` line 1, replace:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

with:

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

(JetBrains Mono import is unchanged — only the sans family swaps.)

- [ ] **Step 2: Update the base font-family declaration**

In the `@layer base` block, `html, body` rule (currently line 51):

```css
    font-family: 'Space Grotesk', system-ui, sans-serif;
```

- [ ] **Step 3: Update `tailwind.config.ts`**

In `fontFamily` (currently lines 27–30):

```ts
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
```

- [ ] **Step 4: Verify visually**

Run: `npm run build && npm start -- -p 3100` (background)

Use the gstack skill to browse `http://localhost:3100/` and confirm the
landing page renders in Space Grotesk (visibly different letterforms from
Inter — Space Grotesk has a distinctive squared-off "G" and "1"), with zero
console/CSP errors (font now loads from `fonts.googleapis.com`, which is
already CSP-allowlisted).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css tailwind.config.ts
git commit -m "style: replace Inter with Space Grotesk"
```

---

### Task 3: Retint and add depth to shared component classes

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `--surface`, `--border` etc. from Task 1; `brand`/`brand-dim`
  Tailwind tokens from Task 1.
- Produces: no new class names — existing `.card`, `.card-inset`,
  `.btn-primary` selectors get new declarations that every consuming page
  picks up automatically (no changes needed in the pages/components that
  use these classes).

- [ ] **Step 1: Add tactile depth to `.card` and `.card-inset`**

Replace (currently lines 67–73):

```css
  .card {
    @apply bg-surface border border-border rounded-xl;
    box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.04);
  }

  .card-inset {
    @apply bg-surface-2 border border-border rounded-lg;
    box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.04);
  }
```

- [ ] **Step 2: Add the light-theme variant of the inset highlight**

Add a new rule immediately after `.card-inset` above (a light background
needs a dark, not white, highlight to read correctly):

```css
  .light .card,
  .light .card-inset {
    box-shadow: inset 0 1px 0 0 rgba(10, 15, 26, 0.04);
  }
```

- [ ] **Step 3: Make `.btn-primary` the gold-filled primary CTA**

Replace (currently lines 109–111):

```css
  .btn-primary {
    @apply bg-brand hover:bg-brand-dim font-medium rounded-lg px-4 py-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm;
    color: #0a0f1a;
  }
```

(Text color is a fixed dark navy, not a theme token — gold needs dark text
for contrast in both dark and light theme, unlike the previous
text-primary/background inversion trick.)

- [ ] **Step 4: Verify `.badge-brand` and `.input-base` focus ring automatically retint**

These already reference the `brand` token (`bg-brand/10 text-brand` and
`ring-brand/20` respectively) — no code change needed. Use the gstack skill
to browse a page using each (e.g. `/dashboard` for badges, the header search
input for the focus ring) and confirm both now render gold, not indigo.
Check contrast: gold-on-navy text in `.badge-brand` must remain legible
(WCAG AA) — if it fails, adjust `bg-brand/10` to `bg-brand/15` in this same
step.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "style: add tactile depth to cards, gold-fill primary button"
```

---

### Task 4: Retint chart palette (signal colors untouched)

**Files:**
- Modify: `components/charts/palette.ts`
- Test: run existing Vitest suite (no new tests — this file has no
  dedicated unit tests today; verification is the full suite + visual
  check)

**Interfaces:**
- Consumes: nothing new.
- Produces: `useChartPalette()` return shape is unchanged (`{ mode,
  categorical, chrome, signal }`) — only the color values inside
  `CATEGORICAL` and `CHART_CHROME` change. `SIGNAL` is byte-for-byte
  identical to before. Every chart component consuming this hook
  (`portfolio-chart.tsx`, `holdings-chart.tsx`, `price-chart.tsx`,
  `allocation-chart.tsx`, `sector-chart.tsx`, `options-lab.tsx`) needs no
  changes.

- [ ] **Step 1: Update the file**

Replace the full contents of `components/charts/palette.ts`:

```ts
'use client'

import { useTheme } from 'next-themes'

// Navy Ledger + Gold Signal chart palette.
// Red is reserved for loss/sell semantics and must never appear in CATEGORICAL.
export const SIGNAL = { up: '#16a34a', down: '#dc2626' } as const

export const CATEGORICAL = {
  dark: ['#c9974a', '#8c9bb0', '#e0b876', '#5a6779', '#f2dfb0', '#2c3a4d'],
  light: ['#a97b38', '#52596b', '#c9974a', '#8a90a0', '#dcb877', '#d4cfc0'],
} as const

export const CHART_CHROME = {
  dark: { grid: '#1c2433', text: '#8c9bb0', border: '#1c2433' },
  light: { grid: '#e2ddd0', text: '#52596b', border: '#e2ddd0' },
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

Confirm `SIGNAL` above is character-for-character identical to the current
file's `SIGNAL` constant before committing.

- [ ] **Step 2: Run the test suite**

Run: `npm run test`

Expected: identical pass/fail result to Task 1's baseline run — no test
references literal color values from this file (confirm with `grep -rn
"CATEGORICAL\|CHART_CHROME" __tests__/` — expected: no matches; if a test
does reference these, update its expected literal to the new value, since
this is exactly the kind of change the spec authorizes).

- [ ] **Step 3: Verify visually**

Use the gstack skill to browse `/portfolio` (allocation/sector charts, which
use `CATEGORICAL`) and `/dashboard` (equity curve, which uses `SIGNAL`) in
both dark and light mode.

Expected: allocation/sector chart series now render in gold/navy-neutral
tones instead of indigo; equity curve up/down coloring is pixel-identical
to before this task (green/red unchanged).

- [ ] **Step 4: Commit**

```bash
git add components/charts/palette.ts
git commit -m "style: retint chart categorical palette to gold/navy (signal colors unchanged)"
```

---

### Task 5: Verify layout chrome cascades correctly

**Files:** none expected — `components/layout/header.tsx` and
`components/layout/sidebar.tsx` reference colors exclusively via the
`brand`/`text-brand`/`bg-brand` Tailwind utility classes retinted in Task 1,
so they should update with no source changes.

- [ ] **Step 1: Visual check**

Use the gstack skill to browse `/dashboard` (or any authenticated page —
use a test session if available, otherwise inspect via a signed-out
redirect target is insufficient; if no test credentials are available,
statically review `header.tsx`/`sidebar.tsx` for any hardcoded hex colors
instead — see Step 2).

Expected: sidebar logo icon square (`bg-brand`), the "Simulation" label
(`text-brand`), and the header's crypto-market status dot/label (`bg-brand`/
`text-brand`) all render gold, not indigo. The sidebar's "LIVE" pulse dot
(`bg-green`) and header's NYSE-open indicator (`bg-green`) stay green,
unchanged.

- [ ] **Step 2: Grep for any hardcoded colors that would NOT have cascaded**

Run: `grep -n "#[0-9a-fA-F]\{3,6\}" components/layout/header.tsx components/layout/sidebar.tsx`

Expected: no matches (both files use only Tailwind utility classes / CSS
custom properties, confirmed by reading them during spec research — this
step is a safety check, not expected to find anything).

- [ ] **Step 3: If Step 1 could not be verified live (no auth session available)**

Confirm by static review only: `sidebar.tsx:81` (`bg-brand shrink-0`),
`sidebar.tsx:138` (`text-brand`), `header.tsx:115` (`bg-brand`),
`header.tsx:117` (`text-brand`) — all four reference the token, none hardcode
a color. No commit needed for this task (no files modified) — note the
verification result in the task's completion summary instead.

---

### Task 6: Redesign the landing page hero and feature grid

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `tickers` const (new, local to this file — purely decorative
  static data, not fetched) and an updated `LogoMark` component (same
  props/signature: `{ size?: 'sm' | 'md' }`, used unchanged at both existing
  call sites — nav and footer).

- [ ] **Step 1: Add static ticker-strip data**

Add this constant immediately after the existing `features` array (after
line 46):

```tsx
const tickers = [
  { symbol: 'AAPL', change: '+1.24%', up: true },
  { symbol: 'BTC', change: '-0.38%', up: false },
  { symbol: 'TSLA', change: '+2.05%', up: true },
  { symbol: 'ETH', change: '+0.91%', up: true },
  { symbol: 'NVDA', change: '-0.62%', up: false },
  { symbol: 'SOL', change: '+3.14%', up: true },
]
```

- [ ] **Step 2: Replace the `LogoMark` glyph**

old_string:
```tsx
function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-7 h-7' : 'w-6 h-6'
  const glyph = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'
  return (
    <div className={`${box} rounded-lg bg-brand flex items-center justify-center`}>
      <svg viewBox="0 0 16 16" className={`${glyph} fill-white`}>
        <path d="M1 12.5 6 7l3 3 6-6.5V9h-2V7.9L9 12.3 6 9.3l-3.6 4L1 12.5Z" />
      </svg>
    </div>
  )
}
```

new_string:
```tsx
function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-7 h-7' : 'w-6 h-6'
  const glyph = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'
  return (
    <div className={`${box} rounded-lg bg-brand flex items-center justify-center`}>
      <svg viewBox="0 0 16 16" className={`${glyph} fill-white`}>
        <rect x="2" y="9" width="3" height="5" rx="0.5" />
        <rect x="6.5" y="6" width="3" height="8" rx="0.5" />
        <rect x="11" y="2" width="3" height="12" rx="0.5" />
      </svg>
    </div>
  )
}
```

(Ascending bar-chart mark instead of the generic checkmark-zigzag — same
component signature, so both existing call sites — nav `<LogoMark />` and
footer `<LogoMark size="sm" />` — need no changes.)

- [ ] **Step 3: Replace the hero section with a ticker strip + asymmetric hero**

old_string:
```tsx
      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6 md:py-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-hero-glow" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-surface-2 text-text-secondary text-xs font-medium px-3 py-1 rounded-full border border-border mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-slow" />
            Live market data · No real money required
          </div>

          <h1 className="text-5xl md:text-6xl font-semibold text-text-primary tracking-tighter text-balance mb-6">
            Trade the markets.
            <br />
            Risk nothing.
          </h1>

          <p className="text-lg text-text-secondary max-w-xl mx-auto mb-8 leading-relaxed text-balance">
            Practice trading stocks and crypto with{' '}
            <span className="text-text-primary font-medium">$100,000 in virtual cash</span>.
            Real prices, real strategies, zero financial risk.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2">
              Start paper trading
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/sign-in" className="btn-secondary text-sm px-5 py-2.5">
              Sign in
            </Link>
          </div>

          <p className="text-xs text-text-muted mt-5">
            Free to use · Simulated environment only · Not financial advice
          </p>
        </div>
      </section>
```

new_string:
```tsx
      {/* Ticker strip */}
      <div className="border-b border-border bg-surface-2/40 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center gap-6 w-max">
          {tickers.map(({ symbol, change, up }) => (
            <span key={symbol} className="flex items-center gap-1.5 text-xs font-mono tabular-nums whitespace-nowrap">
              <span className="text-text-secondary">{symbol}</span>
              <span className={up ? 'text-green' : 'text-red'}>{change}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-6 md:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-hero-glow" />
        <div className="relative max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-semibold text-text-primary tracking-tighter text-balance mb-6">
              Trade the markets.
              <br />
              Risk nothing.
            </h1>

            <p className="text-lg text-text-secondary max-w-xl mb-8 leading-relaxed text-balance">
              Practice trading stocks and crypto with{' '}
              <span className="text-text-primary font-medium">$100,000 in virtual cash</span>.
              Real prices, real strategies, zero financial risk.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link href="/sign-up" className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2">
                Start paper trading
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/sign-in" className="btn-secondary text-sm px-5 py-2.5">
                Sign in
              </Link>
            </div>

            <p className="text-xs text-text-muted mt-5">
              Free to use · Simulated environment only · Not financial advice
            </p>
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Give the feature grid an indexed treatment instead of icon-in-box**

old_string:
```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6">
                <div className="w-9 h-9 rounded-lg border border-border bg-surface-2 flex items-center justify-center mb-4">
                  <Icon className="w-4 h-4 text-text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium text-text-primary mb-2">{title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
```

new_string:
```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="card p-6">
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="font-mono text-xs text-brand">{String(i + 1).padStart(2, '0')}</span>
                  <Icon className="w-5 h-5 text-text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium text-text-primary mb-2">{title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
```

- [ ] **Step 5: Verify visually**

Run: `npm run build && npm start -- -p 3100` (background)

Use the gstack skill to browse `http://localhost:3100/` in both dark and
light mode. Screenshot: nav (new bar-chart logo mark), ticker strip, hero
(now left-aligned within the page, not centered), feature grid (numbered
instead of boxed icons), footer (new logo mark at small size).

Expected: zero console errors, ticker strip scrolls horizontally without
breaking layout on mobile (375px), all existing links/CTAs still navigate
correctly (`/sign-up`, `/sign-in`, `/privacy`).

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "style: redesign landing hero with ticker strip, asymmetric layout, indexed features"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`

Expected: identical result to the pre-redesign baseline (run `git stash;
npm run test; git stash pop` first if you need a fresh baseline — but Task
1/4's per-task checks should already have established this; this is the
final confirmation across the whole branch).

- [ ] **Step 2: Production build + local server check**

Run: `npm run build && npm start -- -p 3100` (background)

Use the gstack skill to browse, in both dark and light mode:
- `/` (landing page)
- `/sign-in`
- `/sign-up`
- `/dashboard` (requires a session — if unavailable, at minimum confirm the
  signed-out → `/sign-in` redirect renders with zero console/CSP errors,
  consistent with how this was previously verified per project history)

Expected: zero console errors, zero CSP violations, gold accent visible
throughout, green/red P&L coloring unchanged wherever visible.

- [ ] **Step 3: Contrast check**

Check the gold accent (`#c9974a` dark theme / `#a97b38` light theme) against:
- Navy-black surfaces (`#080b12`, `#101623`) — dark theme text/icon use.
- Warm-ivory surfaces (`#faf8f2`, `#f2efe6`) — light theme text/icon use.
- The fixed `#0a0f1a` text on gold (`.btn-primary`).

Use a contrast-ratio check (e.g. WebAIM contrast checker values, or
`gstack`'s accessibility tooling if available) — target WCAG AA (4.5:1 for
body text, 3:1 for large text/UI components). If any combination fails,
adjust that specific value only (don't restructure the token system) and
re-verify.

- [ ] **Step 4: Final status check**

```bash
git status
git log --oneline redesign/paper-alpha-polish -8
git diff main redesign/paper-alpha-polish --stat
```

Expected: working tree clean, 8 commits ahead of `main` (task 5 may have 0
commits if no chrome changes were needed) on
`redesign/paper-alpha-polish`, `main` itself unchanged, file set matches
expectations: `tailwind.config.ts`, `app/globals.css`,
`components/charts/palette.ts`, `app/page.tsx`.

No push, no merge, no `vercel --prod` — report back to Styli for local
review.
