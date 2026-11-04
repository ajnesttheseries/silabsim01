/** Seeded pseudo-random generator (mulberry32) so simulations and tests are reproducible. */
export interface Rng {
  next(): number
  gaussian(sigma?: number): number
  range(min: number, max: number): number
}

export function createRng(seed = 1234): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let spare: number | null = null
  const gaussian = (sigma = 1) => {
    if (spare !== null) {
      const v = spare
      spare = null
      return v * sigma
    }
    // Box–Muller
    let u = 0
    let v = 0
    while (u === 0) u = next()
    while (v === 0) v = next()
    const mag = Math.sqrt(-2 * Math.log(u))
    spare = mag * Math.sin(2 * Math.PI * v)
    return mag * Math.cos(2 * Math.PI * v) * sigma
  }
  return { next, gaussian, range: (min, max) => min + (max - min) * next() }
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** First-order lag step: moves `x` toward `target` with time constant `tau` (seconds). */
export function lag(x: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target
  return x + (target - x) * (1 - Math.exp(-dt / tau))
}
