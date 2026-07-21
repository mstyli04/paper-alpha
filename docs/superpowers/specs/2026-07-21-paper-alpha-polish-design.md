# Paper Alpha Polish Pass — Design Spec

## Problem

Current UI (`e10e534`, 17 Jul 2026) is a deliberate "clean Linear/Vercel-style"
system — zinc neutrals, single indigo accent (`#4f46e5`), Inter, hairline
borders. It's coherent, not broken, but reads as generic AI-SaaS: the
`globals.css` header comment literally says `/* Clean/minimal (Linear/Vercel)
*/`. Landing page follows the exact badge→glow-hero→icon-card-grid→stat-strip
shape that's everywhere in AI-generated products right now.

**Known history**: this app already went through a full "Brutalist Ledger"
redesign (`27e08e0`…`84823cc`) that was later deliberately reverted back to
the minimal indigo look in `e10e534`. This pass is **not** a return to
brutalism — different direction entirely (navy/gold finance-terminal, not
high-contrast black/white blocks) — confirmed explicitly with Styli given
that history.

This is a **polish pass**: visual/token layer only. No changes to data
fetching, auth, trading logic, Prisma schema, or API routes. Existing
`__tests__` suite must pass unchanged throughout.

## Direction: Navy Ledger + Gold Signal

Deep navy-black base (nods to the existing `paper-alpha-navy.vercel.app`
branding) with a warm gold/amber accent replacing indigo — a ticker-tape /
trading-terminal association rather than generic SaaS purple. **Green/red
P&L semantics are explicitly preserved unchanged** (`SIGNAL.up`/`SIGNAL.down`
in `components/charts/palette.ts`, `--green`/`--red` in Tailwind config) —
this is a load-bearing finance-UX convention, not a style choice, and is out
of scope for recoloring.

### Design tokens

**`tailwind.config.ts` — `colors`:**
| Token | Current | New |
|---|---|---|
| `brand` | `#4f46e5` | `#c9974a` (warm gold) |
| `brand-dim` | `#4338ca` | `#a97b38` |
| `green` / `green-dim` / `red` / `red-dim` | — | **unchanged** |

**`app/globals.css` — `:root` (dark, default):**
| Token | Current | New |
|---|---|---|
| `--background` | `#09090b` | `#05070c` (navy-black) |
| `--surface` | `#09090b` | `#080b12` |
| `--surface-2` | `#18181b` | `#101623` |
| `--border` | `#27272a` | `#1c2433` |
| `--border-strong` | `#3f3f46` | `#2c3a4d` |
| `--text-primary` | `#fafafa` | `#f2f5fa` |
| `--text-secondary` | `#a1a1aa` | `#8c9bb0` |
| `--text-muted` | `#71717a` | `#5a6779` |

**`.light` overrides:** same structure, warm-ivory background (`#faf8f2`)
instead of pure white, deep-navy text, same gold accent (darkened slightly
for contrast: `#a97b38`) — exact values tuned during implementation, verified
for WCAG AA contrast against both surface colors.

**`components/charts/palette.ts`:**
- `SIGNAL` — unchanged.
- `CATEGORICAL` — currently indigo-family hues (`#6366f1`, `#818cf8`, etc.)
  used for non-signal series (allocation/sector charts, benchmark overlay
  lines). Replace with a navy/gold-family categorical set so charts stay
  consistent with the new palette without touching chart logic.
- `CHART_CHROME` — grid/text/border values updated to match the new
  `--border`/`--text-secondary` neutrals.

### Typography

- Replace **Inter** with **Space Grotesk** (weights 400–700) for `fontFamily.sans`
  and the `@import` in `globals.css`. (This was already vetted once, in the
  reverted brutalist spec, as pairing well with the existing JetBrains Mono —
  reusing that specific validated pairing, not the brutalist system it was
  originally part of.)
- **JetBrains Mono** stays unchanged for `.stat-value`/`.data-value` (numeric
  data — prices, P&L, quantities — must stay monospace with tabular numerals;
  no change needed here).

### Component classes (`@layer components` in `globals.css`)

All of these are shared classes consumed across the whole app, so retoning
them cascades to dashboard, portfolio, markets, etc. automatically — no need
to touch most individual pages:

- `.card` / `.card-inset`: add subtle tactile depth (a soft inset top
  highlight + very slight gradient) instead of the current flat
  solid-fill + hairline border. Stay short of shadows/heavy elevation —
  keep it restrained, not skeuomorphic.
- `.btn-primary`: becomes the gold-filled primary CTA (`bg-brand`, dark navy
  text) instead of the current text-primary/background inversion.
- `.badge-brand`: retints from `bg-brand/10 text-brand` indigo to the new
  gold token (automatic once `brand` token changes — verify contrast).
- `.badge-green` / `.badge-red` / `.btn-green` / `.btn-red`: **unchanged**
  (P&L semantics).
- `.input-base`: focus ring retints from `ring-brand/20` (indigo) to gold
  (automatic via token change) — verify focus visibility against navy
  background.

### Layout chrome

- `components/layout/header.tsx`, `components/layout/sidebar.tsx`: retint
  active/hover states to gold; no structural changes. The existing "LIVE"
  pulse dot next to the logo is preserved as-is (audit flagged it as already
  a nice touch).

### Landing page (`app/page.tsx`)

Replace the generic centered badge→glow-hero→3-col-icon-grid→stat-strip
template with something more specific to a trading product:
- Asymmetric hero layout (not centered-everything) with a live-look ticker
  strip element instead of the pulsing "Live market data" badge.
- Feature grid keeps 3 items but drops the identical bordered-rounded-square
  icon treatment in favor of something with more editorial character
  (exact treatment decided during implementation, informed by
  `ui-ux-pro-max` style/pattern reference).
- Logo mark: the current generic checkmark-zigzag glyph is replaced with
  something more specific to "ledger/terminal" (exact concept decided during
  implementation).

### Preserve as-is

- `components/charts/portfolio-chart.tsx` and sibling chart components'
  **logic** — only their color inputs (via `palette.ts`) change, not
  structure, data handling, or the benchmark-overlay/toggle behavior.
- Clerk-hosted auth UI (`<SignIn/>`/`<SignUp/>` components) — these already
  inherit the app's CSS custom properties via Clerk's `appearance` prop, so
  they'll retint automatically with the token changes above. No custom
  auth-page work needed.
- All data fetching, trading engine, Prisma schema, middleware/auth logic,
  rate limiting, cron routes — untouched.

## Phase-1 scope (this pass)

1. `tailwind.config.ts` — brand/brand-dim tokens, `fontFamily.sans` →
   Space Grotesk.
2. `app/globals.css` — CSS custom properties (dark + light), font import
   swap, component-class retoning (`.card`, `.btn-primary`, depth treatment).
3. `components/charts/palette.ts` — `CATEGORICAL`/`CHART_CHROME` retint
   (`SIGNAL` untouched).
4. `components/layout/header.tsx`, `sidebar.tsx` — chrome retint.
5. `app/page.tsx` — landing page hero/feature-grid redesign.

Because tokens and shared component classes cascade automatically, the
dashboard stat-card grid, portfolio/markets/history tables, badges, and
buttons across the whole authenticated app pick up the new palette and
typography **without separate per-page edits** — consistent with how the
(reverted) brutalist pass scoped itself, which worked structurally even
though its aesthetic was later rejected.

**Explicitly deferred** (bespoke per-page layouts, not shared-chrome-driven):
any page-specific structural redesign beyond what tokens/shared classes
already cascade — e.g. the markets table's specific column layout, the
options-lab's specific curve/payoff chart arrangement, the alerts/screener
form layouts. These inherit the new look automatically; nothing here
prevents a future fast-follow pass if any of them look under-designed once
the token pass is visible.

## Out of scope

- Any logic, data, auth, or API changes.
- Brutalist-style treatment (zero-radius, 2px borders, block fills) — this
  is a different direction, confirmed with Styli.
- Recoloring green/red P&L semantics.
- New features.

## Verification

- `npm run build && npm start -- -p <port>` locally (exact prod build,
  avoids the Vercel preview SSO wall) + `gstack browse` to confirm dark AND
  light mode render cleanly with zero console/CSP errors on: landing page,
  dashboard, one dashboard sub-page (e.g. portfolio or markets), sign-in.
- `npm run test` (Vitest) must still pass unchanged — this is a styling-only
  pass with no logic touched.
- Contrast-check the new gold accent against both navy-dark and warm-ivory-
  light surfaces (WCAG AA) since it's replacing indigo in focus rings,
  primary buttons, and links.
- No push, no merge to `main`, no `vercel --prod` — work stays on
  `redesign/paper-alpha-polish` until Styli reviews locally and decides.
