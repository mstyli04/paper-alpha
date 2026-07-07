# Brutalist Ledger Redesign — Design Spec

## Problem

Paper Alpha's current UI (dark background, indigo `#6366f1` brand color, rounded
corners, soft gradients) reads as generic dark-mode SaaS — indistinguishable
from countless other AI-era product templates. It doesn't communicate "trading
platform" and doesn't stand out.

## Direction: Brutalist Ledger + Signal Accent

High-contrast black/white base with thick borders and blocky uppercase
typography, carrying the market's own green/red vocabulary as the accent
system rather than an arbitrary brand color. Chosen after visual mockup
comparison (three directions, then three color treatments of the winning
direction) via the brainstorming visual companion.

## Design Tokens

### Colors

**Dark theme (default):**
| Token | Value | Use |
|---|---|---|
| `--background` | `#0a0a0a` | Page background |
| `--surface` | `#0a0a0a` | Same as background — brutalism separates content with borders, not elevated surfaces |
| `--border` | `#ffffff` | Primary 2px borders on all bounded elements |
| `--border-2` | `#2a2a2a` | Subtler internal dividers only |
| `--text-primary` | `#ffffff` | |
| `--text-secondary` | `#a3a3a3` | |
| `--text-muted` | `#525252` | |

**Light theme:**
| Token | Value | Use |
|---|---|---|
| `--background` | `#ffffff` | |
| `--surface` | `#ffffff` | |
| `--border` | `#0a0a0a` | |
| `--border-2` | `#d4d4d4` | |
| `--text-primary` | `#0a0a0a` | |
| `--text-secondary` | `#525252` | |
| `--text-muted` | `#a3a3a3` | |

**Signal colors (both themes):**
| Token | Value | Use |
|---|---|---|
| `--signal-green` | `#22c55e` | Primary brand/action color (replaces indigo). Positive P&L, buy actions, primary CTAs, focus states |
| `--signal-red` | `#ef4444` | Losses only. Sell actions, negative P&L |

Border-radius is zeroed across the board — `border-radius: 0` on cards,
buttons, inputs, badges, panels. No box-shadows; brutalism stays flat.

### Typography

- **Space Grotesk** (weights 400–800) replaces Inter for all headings and UI
  text.
- **JetBrains Mono** is retained for numeric data — prices, P&L, balances,
  quantities — with tabular numerals. Trading apps need aligned columns of
  numbers; monospace stays regardless of the rest of the type system changing.
- Display/hero headlines: weight 700–800, uppercase, tight letter-spacing
  (e.g. "RISK NOTHING.").
- Labels, eyebrow text, nav items, badges: weight 600, uppercase, wide
  letter-spacing, small size.
- Body/UI text: weight 400–500, normal case.

## Component Patterns

- **Buttons**: always a visible 2px border (no borderless ghost buttons), 0
  radius, bold uppercase label. Primary = `--signal-green` fill with `#0a0a0a`
  text (both themes — matches the approved mockup). Destructive/sell =
  `--signal-red` fill, also `#0a0a0a` text. Secondary = transparent fill,
  border only, `--text-primary` label (theme-dependent).
- **Cards/panels**: 2px `--border`, 0 radius, flat — no shadow.
- **Badges** (`components/ui/badge.tsx`): solid rectangular fill, bold
  uppercase text, 0 radius. Status badges (LIVE, PENDING, etc.) use this
  pattern.
- **Position/watchlist rows**: full bordered box per row (not underline-only
  dividers) — each row is its own bounded rectangle.
- **Inputs**: 2px `--border`, 0 radius, no inner shadow. Focus state shifts
  border to `--signal-green`.
- **Charts** (`lightweight-charts`): up/down series colors mapped to
  `--signal-green` / `--signal-red`. Transparent chart background, sitting
  inside a bordered panel rather than carrying its own rounded container.

## Phase-1 Scope

This pass covers the design system plus the two highest-traffic surfaces:

1. `tailwind.config.ts` — new color tokens, `fontFamily.sans` → Space
   Grotesk, border-radius scale zeroed.
2. `app/globals.css` — CSS custom properties for both themes (dark default +
   `.light` override), swap Google Fonts import from Inter to Space Grotesk,
   keep the existing JetBrains Mono import.
3. `components/ui/badge.tsx`, `components/ui/avatar-display.tsx`,
   `components/ui/skeleton.tsx` — restyled to the new tokens.
4. `components/layout/header.tsx`, `components/layout/sidebar.tsx` —
   restyled shell. Every page under `app/(dashboard)` inherits this
   automatically since it's shared chrome.
5. `app/page.tsx` (public landing page) — full redesign per the approved
   Brutalist Ledger + Signal Accent mockup (hero, feature cards, CTAs).

**Explicitly deferred** to a fast-follow pass: `portfolio`, `markets`, trade
forms/order tickets, `alerts`, `news`, `leaderboard`, `screener`, `analysis`,
`history`, `bot-logs`, `profile`, `settings`. These pages pick up shared
primitives (badges, buttons, the dashboard shell) automatically from this
pass, but their page-specific layouts are not touched here.

## Verification

- No behavioral/logic changes — this is a styling-only pass. Existing
  `__tests__` suite must still pass unchanged.
- Visual verification via gstack screenshots (dark + light) of the landing
  page and at least one dashboard page (to confirm the shell renders
  correctly) before calling the phase done.
- No new automated visual regression tests are being introduced — manual
  screenshot review is the verification method, consistent with how
  `cinematic-hero` (a sibling portfolio project) is verified.

## Out of Scope

- The ~11 deferred pages listed above (fast-follow, separate spec/plan).
- Clerk-hosted auth UI (sign-in/sign-up widgets) — not touched this pass;
  revisit if the mismatch with the new brutalist shell looks jarring after
  phase 1 ships.
- Any new features or behavior changes.
