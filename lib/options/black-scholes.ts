// Garman-Kohlhagen (Black-Scholes for FX) pricing, Greeks and implied vol.
// Ported from the Python implementation in ~/fx-options-dashboard/black_scholes.py.
//
// The model prices a European option on spot S with strike K, time to expiry
// T (years), domestic rate rd, foreign rate rf and volatility sigma:
//
//   d1 = [ln(S/K) + (rd - rf + sigma^2/2) * T] / (sigma * sqrt(T))
//   d2 = d1 - sigma * sqrt(T)
//   Call = S*exp(-rf*T)*N(d1) - K*exp(-rd*T)*N(d2)
//   Put  = K*exp(-rd*T)*N(-d2) - S*exp(-rf*T)*N(-d1)
//
// Setting rf = 0 recovers vanilla Black-Scholes on a non-dividend-paying
// asset (rf doubles as a continuous dividend yield for equities).

export type OptionType = 'call' | 'put'

export interface Greeks {
  delta: number
  gamma: number
  vega: number
  theta: number
  rho: number
}

// Standard normal pdf
function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

// Standard normal CDF via Abramowitz & Stegun 7.1.26 erf approximation
// (max abs error ~1.5e-7 — ample for pricing display).
function cdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2)
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2)
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf)
}

function validate(spot: number, strike: number, t: number, vol: number): void {
  if (spot <= 0) throw new Error(`spot must be positive, got ${spot}`)
  if (strike <= 0) throw new Error(`strike must be positive, got ${strike}`)
  if (t < 0) throw new Error(`time to expiry must be non-negative, got ${t}`)
  if (vol <= 0) throw new Error(`volatility must be positive, got ${vol}`)
}

function d1d2(spot: number, strike: number, t: number, rd: number, rf: number, vol: number): [number, number] {
  const sqrtT = Math.sqrt(t)
  const d1 = (Math.log(spot / strike) + (rd - rf + 0.5 * vol * vol) * t) / (vol * sqrtT)
  return [d1, d1 - vol * sqrtT]
}

/** Price a European option. At T = 0 returns intrinsic value. */
export function bsPrice(
  spot: number, strike: number, t: number, rd: number, rf: number,
  vol: number, optionType: OptionType,
): number {
  validate(spot, strike, t, vol)
  if (t === 0) {
    return optionType === 'call' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0)
  }
  const [d1, d2] = d1d2(spot, strike, t, rd, rf, vol)
  const dfD = Math.exp(-rd * t)
  const dfF = Math.exp(-rf * t)
  if (optionType === 'call') return spot * dfF * cdf(d1) - strike * dfD * cdf(d2)
  return strike * dfD * cdf(-d2) - spot * dfF * cdf(-d1)
}

/**
 * Analytic Greeks, per unit change of the underlying variable:
 * vega per 1.00 of vol, theta per year, rho per 1.00 of rate.
 * The display layer rescales to per-1%/per-day.
 */
export function bsGreeks(
  spot: number, strike: number, t: number, rd: number, rf: number,
  vol: number, optionType: OptionType,
): Greeks {
  validate(spot, strike, t, vol)
  if (t === 0) throw new Error('Greeks are undefined at expiry (t = 0)')

  const [d1, d2] = d1d2(spot, strike, t, rd, rf, vol)
  const sqrtT = Math.sqrt(t)
  const dfD = Math.exp(-rd * t)
  const dfF = Math.exp(-rf * t)
  const pdfD1 = pdf(d1)

  const gamma = (dfF * pdfD1) / (spot * vol * sqrtT)
  const vega = spot * dfF * pdfD1 * sqrtT
  const thetaCommon = (-spot * dfF * pdfD1 * vol) / (2 * sqrtT)

  if (optionType === 'call') {
    return {
      delta: dfF * cdf(d1),
      gamma,
      vega,
      theta: thetaCommon + rf * spot * dfF * cdf(d1) - rd * strike * dfD * cdf(d2),
      rho: strike * t * dfD * cdf(d2),
    }
  }
  return {
    delta: -dfF * cdf(-d1),
    gamma,
    vega,
    theta: thetaCommon - rf * spot * dfF * cdf(-d1) + rd * strike * dfD * cdf(-d2),
    rho: -strike * t * dfD * cdf(-d2),
  }
}

/**
 * Back out implied volatility from a market price by bisection on [lo, hi]
 * (vega > 0 makes the price strictly increasing in vol, so the root is
 * unique when it exists). Returns vol as a decimal, e.g. 0.09 for 9%.
 */
export function impliedVol(
  marketPrice: number, spot: number, strike: number, t: number,
  rd: number, rf: number, optionType: OptionType,
  lo = 1e-6, hi = 5.0,
): number {
  if (marketPrice <= 0) throw new Error(`market price must be positive, got ${marketPrice}`)

  const objective = (vol: number) => bsPrice(spot, strike, t, rd, rf, vol, optionType) - marketPrice

  let fLo = objective(lo)
  const fHi = objective(hi)
  if (fLo * fHi > 0) {
    throw new Error(
      `market price ${marketPrice} is outside the attainable range ` +
      `[${(marketPrice + fLo).toPrecision(6)}, ${(marketPrice + fHi).toPrecision(6)}] ` +
      `for vol in [${lo}, ${hi}]`,
    )
  }

  let a = lo
  let b = hi
  for (let i = 0; i < 200; i++) {
    const mid = (a + b) / 2
    const fMid = objective(mid)
    if (Math.abs(fMid) < 1e-12 || (b - a) / 2 < 1e-10) return mid
    if (fLo * fMid < 0) {
      b = mid
    } else {
      a = mid
      fLo = fMid
    }
  }
  return (a + b) / 2
}
