# Brutalist Ledger Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Paper Alpha's design tokens, shared UI primitives, dashboard shell, and public landing page from the current dark-indigo SaaS look to the approved "Brutalist Ledger + Signal Accent" direction (high-contrast black/white, 2px borders, zero radius, Space Grotesk type, market-native green/red as the signal system).

**Architecture:** Because `tailwind.config.ts` and `app/globals.css` define shared design tokens and `@layer components` utility classes (`.card`, `.btn-*`, `.badge-*`, etc.) consumed across the entire app, most of the restyle happens by editing those two files centrally — every page, including ones not touched this pass, picks up the new colors/typography/zero-radius automatically. The remaining tasks apply targeted, semantic changes (solid-fill badges instead of tinted pills, bordered nav states instead of translucent tints) to the specific files called out in the spec: shared UI primitives, the dashboard shell, and the landing page.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- Zero border-radius everywhere except `rounded-full` (avatars, status dots) — enforced centrally via `tailwind.config.ts`, not per-file.
- 2px (`border-2`) borders on primary bounded elements: cards, buttons, inputs, badges, and structural dividers (header/sidebar borders). Small inline/nested tags may keep 1px.
- No box-shadows — brutalism stays flat. Remove any glow/shadow utilities encountered in scope.
- `--signal-green` (`#22c55e`) is the primary brand/action color (replaces indigo `#6366f1`). `--signal-red` (`#ef4444`) is reserved for losses and sell actions only.
- Button/badge text on green or red fills is always `#0a0a0a` (both themes).
- JetBrains Mono stays for all numeric/price data. Space Grotesk replaces Inter for everything else.
- This is a styling-only pass — no behavior or logic changes. The existing `__tests__` suite must still pass unchanged.
- Out of scope: `portfolio`, `markets`, trade forms, `alerts`, `news`, `leaderboard`, `screener`, `analysis`, `history`, `bot-logs`, `profile`, `settings` pages, and the Clerk-hosted auth UI. Do not edit files under those routes in this plan.
- This repo has pre-existing uncommitted changes unrelated to this work (modified files in `app/api/cron/`, `components/charts/`, `lib/bot/`, and several untracked files). Do not stage, commit, or otherwise touch those — only commit the files this plan creates or modifies.

---

### Task 1: Design tokens — `tailwind.config.ts`

**Files:**
- Modify: `tailwind.config.ts` (full file, 49 lines)

**Interfaces:**
- Produces: Tailwind color tokens `brand`, `brand-dim`, `green`, `green-dim`, `red`, `red-dim` (all consumed via `bg-*`/`text-*`/`border-*` classes throughout the app); `fontFamily.sans` now resolves to Space Grotesk; the `borderRadius` scale is overridden so every `rounded-{none,sm,DEFAULT,md,lg,xl,2xl,3xl}` utility in the entire codebase computes to `0px`, while `rounded-full` stays `9999px`.
- Consumes: nothing (root config file).

- [ ] **Step 1: Replace the full contents of `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    borderRadius: {
      none: '0px',
      sm: '0px',
      DEFAULT: '0px',
      md: '0px',
      lg: '0px',
      xl: '0px',
      '2xl': '0px',
      '3xl': '0px',
      full: '9999px',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-2': 'var(--border-2)',
        brand: '#22c55e',
        'brand-dim': '#16a34a',
        green: '#22c55e',
        'green-dim': '#16a34a',
        red: '#ef4444',
        'red-dim': '#dc2626',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15), transparent)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}

export default config
```

Note: `hero-glow`/`gradient-radial` are left in place even though Task 6 removes their only usage — they're harmless unused config and removing them is not required by the spec.

- [ ] **Step 2: Verify the config loads**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no new errors related to `tailwind.config.ts` (pre-existing unrelated errors, if any, are not your concern this task).

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "style: brutalist ledger design tokens in tailwind config"
```

---

### Task 2: Design tokens + shared component classes — `app/globals.css`

**Files:**
- Modify: `app/globals.css` (full file, 162 lines)

**Interfaces:**
- Produces: CSS custom properties `--background`, `--surface`, `--surface-2`, `--border`, `--border-2`, `--text-primary`, `--text-secondary`, `--text-muted` for both `:root` (dark) and `.light`; `@layer components` classes `.card`, `.card-inset`, `.stat-value`, `.stat-label`, `.data-value`, `.badge-green`, `.badge-red`, `.badge-neutral`, `.badge-brand`, `.input-base`, `.btn-primary`, `.btn-secondary`, `.btn-green`, `.btn-red`, `.table-row`, `.data-row`, `.data-label` (all consumed throughout the app, including deferred pages).
- Consumes: `brand`/`green`/`red` color tokens and the zeroed `borderRadius` scale from Task 1.

- [ ] **Step 1: Replace the full contents of `app/globals.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ─── Dark theme (default) ──────────────────────────────── */
:root {
  --background:   #0a0a0a;
  --surface:      #0a0a0a;
  --surface-2:    #141414;
  --border:       #ffffff;
  --border-2:     #2a2a2a;
  --text-primary:   #ffffff;
  --text-secondary: #a3a3a3;
  --text-muted:     #525252;
  --scrollbar:    #2a2a2a;
  --scrollbar-hover: #3a3a3a;
}

/* ─── Light theme ────────────────────────────────────────── */
.light {
  --background:   #ffffff;
  --surface:      #ffffff;
  --surface-2:    #f0f0f0;
  --border:       #0a0a0a;
  --border-2:     #d4d4d4;
  --text-primary:   #0a0a0a;
  --text-secondary: #525252;
  --text-muted:     #a3a3a3;
  --scrollbar:    #d4d4d4;
  --scrollbar-hover: #a3a3a3;
}

@layer base {
  * {
    box-sizing: border-box;
    padding: 0;
    margin: 0;
  }

  html, body {
    max-width: 100vw;
    overflow-x: hidden;
    background-color: var(--background);
    color: var(--text-primary);
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  }

  ::selection {
    background-color: rgba(34, 197, 94, 0.25);
  }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }
}

@layer components {
  .card {
    @apply bg-surface border-2 border-border;
  }

  .card-inset {
    @apply bg-surface-2 border-2 border-border;
  }

  .stat-value {
    @apply text-2xl font-semibold text-text-primary tabular-nums;
    font-family: 'JetBrains Mono', monospace;
  }

  .stat-label {
    @apply text-xs font-medium text-text-muted uppercase tracking-widest;
  }

  .data-value {
    @apply text-sm font-medium text-text-primary tabular-nums;
    font-family: 'JetBrains Mono', monospace;
  }

  .badge-green {
    @apply bg-green text-[#0a0a0a] text-xs font-bold uppercase tracking-wide px-2 py-0.5;
  }

  .badge-red {
    @apply bg-red text-[#0a0a0a] text-xs font-bold uppercase tracking-wide px-2 py-0.5;
  }

  .badge-neutral {
    @apply bg-transparent text-text-secondary border-2 border-border text-xs font-bold uppercase tracking-wide px-2 py-0.5;
  }

  .badge-brand {
    @apply bg-brand text-[#0a0a0a] text-xs font-bold uppercase tracking-wide px-2 py-0.5;
  }

  .input-base {
    @apply bg-surface-2 border-2 border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green transition-colors;
  }

  .btn-primary {
    @apply bg-brand hover:bg-brand-dim text-[#0a0a0a] font-bold uppercase tracking-wide px-4 py-2 border-2 border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm;
  }

  .btn-secondary {
    @apply bg-transparent hover:bg-surface-2 text-text-primary font-bold uppercase tracking-wide px-4 py-2 border-2 border-border transition-colors text-sm;
  }

  .btn-green {
    @apply bg-green hover:bg-green-dim text-[#0a0a0a] font-bold uppercase tracking-wide px-4 py-2 border-2 border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm;
  }

  .btn-red {
    @apply bg-red hover:bg-red-dim text-[#0a0a0a] font-bold uppercase tracking-wide px-4 py-2 border-2 border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm;
  }

  .table-row {
    @apply border-b border-border hover:bg-surface-2 transition-colors;
  }

  /* Terminal-style data row */
  .data-row {
    @apply flex items-center justify-between py-2 border-b border-border/50 last:border-0;
  }

  .data-label {
    @apply text-xs text-text-muted;
  }
}

/* Lightweight charts override */
.tv-lightweight-charts {
  border-radius: 0;
}
```

Notes on what changed from the current file:
- Font import swapped from Inter to Space Grotesk (JetBrains Mono import unchanged).
- `:root` and `.light` tokens replaced with the brutalist palette from the spec.
- `::selection` tint changed from indigo to green.
- `.card`/`.card-inset`/`.input-base`/`.btn-*` bumped from `border` (1px) to `border-2` and lost their `rounded-*` classes (redundant now that Task 1 zeroes the scale, but left in would be misleading to a future reader).
- `.badge-*` changed from tinted `/10` opacity pills with `rounded-full` to solid-fill rectangles with `#0a0a0a` text (except `.badge-neutral`, which has no signal color to fill with, so it's an outlined block instead — matches the "secondary button = outline" pattern from the spec).
- `.glow-green`/`.glow-red`/`.glow-brand`/`.card-accent-brand`/`.card-accent-green`/`.card-accent-red` are **removed** — grep confirmed zero usages in any `.tsx` file, and they use box-shadow / hardcoded old hex, both of which contradict the flat brutalist rule.
- `.table-row` and `.data-row` are **left unchanged**. `.table-row` has only two call sites (`app/(dashboard)/history/page.tsx`, `components/portfolio/holdings-table.tsx`), both inside real `<table>` markup on pages this plan explicitly defers — turning it into a full boxed row (as the spec's mockup showed) needs a markup restructure that belongs with those pages' own fast-follow pass, not a blind class-string swap here.
- `.tv-lightweight-charts` simplified to just `border-radius: 0` (the `overflow: hidden` was only there to clip the rounded corner, no longer needed).

- [ ] **Step 2: Confirm no other file references the removed glow/card-accent classes**

Run: `grep -rn "glow-green\|glow-red\|glow-brand\|card-accent" --include="*.tsx" . | grep -v node_modules`
Expected: no output (already confirmed during planning, re-check here in case the working tree changed).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: brutalist ledger tokens and component classes in globals.css"
```

---

### Task 3: Badge component — `components/ui/badge.tsx`

**Files:**
- Modify: `components/ui/badge.tsx` (full file, 24 lines)

**Interfaces:**
- Consumes: `green`/`red`/`brand` color tokens from Task 1.
- Produces: `Badge` component, unchanged props (`variant: 'green' | 'red' | 'neutral' | 'brand'`), only its visual output changes. No call sites need updating.

- [ ] **Step 1: Replace the full contents of `components/ui/badge.tsx`**

```tsx
import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'neutral' | 'brand'
  className?: string
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-bold uppercase tracking-wide px-2 py-0.5',
        variant === 'green' && 'bg-green text-[#0a0a0a]',
        variant === 'red' && 'bg-red text-[#0a0a0a]',
        variant === 'neutral' && 'bg-transparent text-text-secondary border-2 border-border',
        variant === 'brand' && 'bg-brand text-[#0a0a0a]',
        className
      )}
    >
      {children}
    </span>
  )
}
```

This mirrors the `.badge-*` utility classes from Task 2 exactly, so the standalone `Badge` component and the raw CSS classes stay visually consistent wherever either is used.

- [ ] **Step 2: Commit**

```bash
git add components/ui/badge.tsx
git commit -m "style: solid-fill brutalist badges in Badge component"
```

---

### Task 4: Dashboard shell — `components/layout/sidebar.tsx`

**Files:**
- Modify: `components/layout/sidebar.tsx:74,79,81,135-144,156-159`

**Interfaces:**
- Consumes: `border`/`brand`/`surface-2` tokens from Tasks 1–2.
- Produces: no change to `Sidebar` component's props or exported interface — visual only.

- [ ] **Step 1: Bump the sidebar's outer border to 2px**

Find (line 74):
```tsx
      <aside className={cn(
        'fixed left-0 top-0 h-full w-56 bg-surface border-r border-border flex flex-col z-30 transition-transform duration-300',
```

Replace with:
```tsx
      <aside className={cn(
        'fixed left-0 top-0 h-full w-56 bg-surface border-r-2 border-border flex flex-col z-30 transition-transform duration-300',
```

- [ ] **Step 2: Bump the logo row's bottom border to 2px**

Find (line 79):
```tsx
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
```

Replace with:
```tsx
        <div className="flex items-center justify-between px-4 h-14 border-b-2 border-border shrink-0">
```

- [ ] **Step 3: Square off and re-border the logo mark**

Find (line 81):
```tsx
            <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 border border-brand/30">
```

Replace with:
```tsx
            <div className="w-7 h-7 overflow-hidden shrink-0 border-2 border-border">
```

- [ ] **Step 4: Replace the tinted active nav state with a solid-fill block**

Find (lines 135-144):
```tsx
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all relative',
                        active
                          ? 'bg-brand/10 text-brand'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand rounded-r-full" />
                      )}
```

Replace with:
```tsx
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 text-sm font-bold uppercase tracking-wide transition-all border-2',
                        active
                          ? 'bg-brand text-[#0a0a0a] border-border'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2 border-transparent'
                      )}
                    >
```

The solid green fill now communicates the active state on its own, so the separate absolute-positioned indicator bar is removed rather than restyled.

- [ ] **Step 5: Re-border the footer panel**

Find (lines 156-157):
```tsx
        <div className="p-3 border-t border-border shrink-0">
          <div className="px-3 py-2.5 rounded-lg bg-surface-2 border border-border/50">
```

Replace with:
```tsx
        <div className="p-3 border-t-2 border-border shrink-0">
          <div className="px-3 py-2.5 bg-surface-2 border-2 border-border">
```

- [ ] **Step 6: Verify types still check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep sidebar`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "style: brutalist borders and solid active state in sidebar"
```

---

### Task 5: Dashboard shell — `components/layout/header.tsx`

**Files:**
- Modify: `components/layout/header.tsx:56,76,79`

**Interfaces:**
- Consumes: `border`/`green` tokens from Tasks 1–2.
- Produces: no change to `Header` component's props — visual only.

- [ ] **Step 1: Bump the header's bottom border to 2px**

Find (line 56):
```tsx
    <header className="h-14 bg-surface border-b border-border flex items-center px-4 gap-3 sticky top-0 z-20">
```

Replace with:
```tsx
    <header className="h-14 bg-surface border-b-2 border-border flex items-center px-4 gap-3 sticky top-0 z-20">
```

- [ ] **Step 2: Bump the search input border and swap the focus color**

Find (line 76):
```tsx
          className="w-full bg-surface-2 border border-border rounded-lg pl-8 pr-4 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition-colors"
```

Replace with:
```tsx
          className="w-full bg-surface-2 border-2 border-border pl-8 pr-4 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green transition-colors"
```

- [ ] **Step 3: Flatten the search results dropdown (drop shadow, bump border)**

Find (line 79):
```tsx
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50">
```

Replace with:
```tsx
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border-2 border-border overflow-hidden z-50">
```

- [ ] **Step 4: Verify types still check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep header`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/layout/header.tsx
git commit -m "style: brutalist borders and flat search dropdown in header"
```

---

### Task 6: Landing page — `app/page.tsx`

**Files:**
- Modify: `app/page.tsx` (full file, 171 lines)

**Interfaces:**
- Consumes: `.card`, `.btn-primary`, `.btn-secondary` classes from Task 2; `brand`/`green` color tokens from Task 1.
- Produces: no change to the page's route or exports — visual only. `hero-glow` background utility becomes unused after this task (left in Tailwind config per Task 1's note).

- [ ] **Step 1: Replace the full contents of `app/page.tsx`**

```tsx
import Link from 'next/link'
import {
  TrendingUp,
  Zap,
  Trophy,
  ShieldCheck,
  BarChart3,
  Coins,
  ArrowRight,
} from 'lucide-react'

const features = [
  {
    icon: Coins,
    title: '$100,000 Virtual Cash',
    desc: 'Start with a hundred grand in fake money. Trade stocks and crypto with zero real-world risk.',
  },
  {
    icon: TrendingUp,
    title: 'Live Market Prices',
    desc: 'All prices are sourced from real market data. Every trade executes at the current live price.',
  },
  {
    icon: BarChart3,
    title: 'Track Your P&L',
    desc: 'Monitor unrealized gains, realized profits, portfolio allocation, and performance over time.',
  },
  {
    icon: Trophy,
    title: 'Compete on Leaderboards',
    desc: 'Rank against other traders by return percentage. Weekly competitions coming soon.',
  },
  {
    icon: ShieldCheck,
    title: 'Zero Risk',
    desc: 'No real money, no brokerage accounts, no deposits. Just practice and learning.',
  },
  {
    icon: Zap,
    title: 'Instant Execution',
    desc: 'Market orders fill instantly at live prices. See your portfolio update in real time.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b-2 border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand border-2 border-border flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#0a0a0a]" />
            </div>
            <span className="font-bold text-text-primary text-lg uppercase tracking-tight">Paper Alpha</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-bold uppercase tracking-wide text-text-secondary hover:text-text-primary transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link href="/sign-up" className="btn-primary text-sm">
              Start Trading Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand text-[#0a0a0a] text-xs font-bold uppercase tracking-wide px-3 py-1.5 border-2 border-border mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] animate-pulse-slow" />
            Live market data · No real money required
          </div>

          <h1 className="text-5xl md:text-6xl font-bold uppercase text-text-primary leading-tight mb-6 tracking-tight">
            Trade the Markets.
            <br />
            <span className="text-brand">Risk Nothing.</span>
          </h1>

          <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Practice trading stocks and crypto with{' '}
            <span className="text-text-primary font-medium">$100,000 in virtual cash</span>.
            Real prices, real strategies, zero financial risk.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up" className="btn-primary text-base px-8 py-3 flex items-center gap-2">
              Start Paper Trading
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/sign-in" className="btn-secondary text-base px-8 py-3">
              Sign In
            </Link>
          </div>

          <p className="text-xs text-text-muted mt-6">
            Free to use · Simulated environment only · Not financial advice
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t-2 border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold uppercase text-text-primary mb-3">Everything you need to practice trading</h2>
            <p className="text-text-secondary">Built for beginners and experienced traders alike.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6 hover:border-border-2 transition-colors">
                <div className="w-10 h-10 border-2 border-border flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-brand" />
                </div>
                <h3 className="font-bold text-text-primary mb-2">{title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 bg-surface border-y-2 border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: '$100,000', label: 'Starting virtual balance' },
            { value: '500+', label: 'Stocks & crypto assets' },
            { value: '15s', label: 'Price refresh interval' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-bold font-mono tabular-nums text-text-primary mb-1">{value}</p>
              <p className="text-sm text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold uppercase text-text-primary mb-4">Ready to start trading?</h2>
          <p className="text-text-secondary mb-8">Join and get $100,000 in virtual cash instantly. No credit card required.</p>
          <Link href="/sign-up" className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand border-2 border-border flex items-center justify-center">
              <Zap className="w-3 h-3 text-[#0a0a0a]" />
            </div>
            <span className="text-sm font-bold uppercase text-text-primary">Paper Alpha</span>
          </div>
          <p className="text-xs text-text-muted text-center">
            Paper Alpha is a simulated trading platform for educational purposes only. Not financial advice. No real money involved.
          </p>
        </div>
      </footer>
    </div>
  )
}
```

Changes from the current file: nav/section dividers bumped to `border-2`/`border-y-2`/`border-t-2`; logo marks squared off with a border instead of `rounded-lg` fill; the "Live market data" pill flipped from a translucent tint to a solid green block (matches the approved mockup's "LIVE" tag); the `bg-hero-glow` absolute div removed along with the now-unnecessary `relative overflow-hidden` wrapper; headline and section headings set to `uppercase`; feature icon squares changed from tinted rounded squares to bordered squares; stat values given `font-mono tabular-nums` since they're numeric data.

- [ ] **Step 2: Verify types still check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/page.tsx"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "style: brutalist ledger redesign of landing page"
```

---

### Task 7: Verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the existing test suite**

Run: `npm run test`
Expected: same pass/fail counts as on `main` before this plan — this is a styling-only pass, so no existing test should newly fail. If a test fails, stop and investigate before continuing; do not edit test files to make them pass without understanding why they failed.

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors introduced by Tasks 1–6 (pre-existing errors unrelated to files this plan touched are not your concern).

- [ ] **Step 3: Start the dev server**

Run: `npm run dev` (leave running in the background)
Expected: server starts on `http://localhost:3000` with no compile errors printed for `app/page.tsx`, `app/globals.css`, `components/layout/header.tsx`, `components/layout/sidebar.tsx`, `components/ui/badge.tsx`.

- [ ] **Step 4: Screenshot the landing page in dark mode**

Using the gstack browse binary (`~/.claude/skills/gstack/browse/dist/browse`, call it `$B`):

```bash
$B viewport 1440x900
$B goto http://localhost:3000
$B console --errors
$B screenshot --viewport /tmp/pa-landing-dark.png
```

Expected: no console errors; screenshot shows black background, white 2px borders, green "Live market data" tag, uppercase bold headline with green "Risk Nothing." line, squared bordered buttons and feature cards.

- [ ] **Step 5: Screenshot the landing page in light mode**

The theme toggle lives in the dashboard header, not the public landing page, so flip it via `next-themes`' `localStorage` key directly:

```bash
$B js "localStorage.setItem('theme', 'light')"
$B reload
$B screenshot --viewport /tmp/pa-landing-light.png
```

Expected: white background, black 2px borders, same green/red signal colors, same layout as the dark screenshot.

- [ ] **Step 6: Read both screenshots and confirm visually**

Use the Read tool on `/tmp/pa-landing-dark.png` and `/tmp/pa-landing-light.png`. Confirm: zero rounded corners anywhere except the small status-dot circles, 2px borders visible on nav/cards/buttons, Space Grotesk loaded (distinct geometric letterforms, not the old Inter), green used as the primary accent, no leftover indigo (`#6366f1`) or soft box-shadow glow anywhere.

- [ ] **Step 7: Note the manual follow-up for the authenticated shell**

`components/layout/header.tsx` and `components/layout/sidebar.tsx` only render inside `app/(dashboard)/layout.tsx`, which sits behind Clerk auth. This plan's automated verification (Steps 1-2, type-check and test suite) confirms those files compile and don't break existing tests, but does not visually confirm the sidebar/header render correctly — there's no seeded test account or bypass in this codebase to automate a login. Tell the user: sign in locally at `http://localhost:3000` (with `npm run dev` running) and confirm the sidebar/header look right in both themes before merging.

- [ ] **Step 8: Stop the dev server**

Run: `kill %1` (or whatever job-control reference the background `npm run dev` process has), or use the Bash tool's background-process kill mechanism.
