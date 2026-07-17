import { describe, expect, it } from 'vitest'
import { bsPrice, bsGreeks, impliedVol } from '@/lib/options/black-scholes'

// Reference values computed with the Python implementation this was ported
// from (scipy-based), rounded to 4 dp.
describe('bsPrice', () => {
  it('matches the textbook vanilla call value', () => {
    // S=100, K=100, T=1y, rd=5%, rf=0, vol=20% → 10.4506
    expect(bsPrice(100, 100, 1, 0.05, 0, 0.2, 'call')).toBeCloseTo(10.4506, 3)
  })

  it('satisfies put-call parity', () => {
    const call = bsPrice(100, 100, 1, 0.05, 0, 0.2, 'call')
    const put = bsPrice(100, 100, 1, 0.05, 0, 0.2, 'put')
    // C - P = S*exp(-rf T) - K*exp(-rd T)
    expect(call - put).toBeCloseTo(100 - 100 * Math.exp(-0.05), 6)
  })

  it('returns intrinsic value at expiry', () => {
    expect(bsPrice(110, 100, 0, 0.05, 0, 0.2, 'call')).toBe(10)
    expect(bsPrice(90, 100, 0, 0.05, 0, 0.2, 'put')).toBe(10)
  })

  it('prices a Garman-Kohlhagen FX call with nonzero foreign rate', () => {
    // S=1.10, K=1.12, T=0.5, rd=3%, rf=1%, vol=9% → 0.023710 (from Python impl)
    expect(bsPrice(1.10, 1.12, 0.5, 0.03, 0.01, 0.09, 'call')).toBeCloseTo(0.023710, 4)
  })

  it('rejects invalid inputs', () => {
    expect(() => bsPrice(-1, 100, 1, 0.05, 0, 0.2, 'call')).toThrow()
    expect(() => bsPrice(100, 100, 1, 0.05, 0, -0.2, 'call')).toThrow()
  })
})

describe('bsGreeks', () => {
  it('matches reference Greeks for the vanilla ATM call', () => {
    const g = bsGreeks(100, 100, 1, 0.05, 0, 0.2, 'call')
    expect(g.delta).toBeCloseTo(0.6368, 3)
    expect(g.gamma).toBeCloseTo(0.01876, 4)
    expect(g.vega).toBeCloseTo(37.524, 2)
    expect(g.theta).toBeCloseTo(-6.414, 2)
    expect(g.rho).toBeCloseTo(53.232, 2)
  })

  it('call and put deltas differ by the foreign discount factor', () => {
    const call = bsGreeks(100, 100, 1, 0.05, 0.02, 0.2, 'call')
    const put = bsGreeks(100, 100, 1, 0.05, 0.02, 0.2, 'put')
    expect(call.delta - put.delta).toBeCloseTo(Math.exp(-0.02), 6)
    expect(call.gamma).toBeCloseTo(put.gamma, 10)
    expect(call.vega).toBeCloseTo(put.vega, 10)
  })

  it('throws at expiry', () => {
    expect(() => bsGreeks(100, 100, 0, 0.05, 0, 0.2, 'call')).toThrow()
  })
})

describe('impliedVol', () => {
  it('round-trips a known vol', () => {
    const price = bsPrice(100, 105, 0.5, 0.04, 0, 0.27, 'put')
    expect(impliedVol(price, 100, 105, 0.5, 0.04, 0, 'put')).toBeCloseTo(0.27, 6)
  })

  it('rejects prices below intrinsic', () => {
    expect(() => impliedVol(0.01, 100, 50, 0.5, 0.04, 0, 'call')).toThrow()
  })
})
