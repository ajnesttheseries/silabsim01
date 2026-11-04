/**
 * C) Sensor models. They read the environment (A) only when the circuit analysis (B) says
 * the sensor is wired correctly; otherwise they return what a real board would see.
 */
import { ADC_MAX, SUPPLY_VOLTAGE } from './circuit/board'
import type { DividerAnalysis, ModuleAnalysis } from './circuit/analysis'
import { isMotion, type EnvState } from './environment'
import { clamp, lag, type Rng } from './rng'

export const round1 = (x: number) => Math.round(x * 10) / 10

export interface SensorCtx {
  rng: Rng
  noise: boolean
  powered: boolean
  dt: number
  time: number
}

const g = (ctx: SensorCtx, sigma: number) => (ctx.noise ? ctx.rng.gaussian(sigma) : 0)

/* ---------- Digital temperature / humidity (DHT22-like) ---------- */

export const DHT_SPEC = {
  intervalS: 2,
  responseTauS: 6,
  resolution: 0.1,
  tempAccuracy: 0.5,
  rhAccuracy: 2,
  noiseT: 0.12,
  noiseRH: 0.6,
}

export interface DhtState {
  innerT: number
  innerRH: number
  lastSample: number
  temp: number | null
  rh: number | null
  error?: 'no-power' | 'no-response' | 'timeout'
  offsetT: number
  offsetRH: number
}

export function initDht(rng: Rng, env: EnvState): DhtState {
  return {
    innerT: env.tempC,
    innerRH: env.rh,
    lastSample: -Infinity,
    temp: null,
    rh: null,
    // per-device calibration error within the datasheet accuracy
    offsetT: rng.range(-0.3, 0.3),
    offsetRH: rng.range(-1.5, 1.5),
  }
}

export function stepDht(s: DhtState, env: EnvState, m: ModuleAnalysis | undefined, ctx: SensorCtx): DhtState {
  const n = { ...s }
  // the sensing element has thermal mass: it follows the air with a delay
  n.innerT = lag(s.innerT, env.tempC, ctx.dt, DHT_SPEC.responseTauS)
  n.innerRH = lag(s.innerRH, env.rh, ctx.dt, DHT_SPEC.responseTauS)
  if (ctx.time - s.lastSample < DHT_SPEC.intervalS) return n
  n.lastSample = ctx.time
  if (!ctx.powered || !m || m.errors.includes('no-vcc') || m.errors.includes('no-gnd') || m.errors.includes('reversed-power') || m.errors.includes('power-short')) {
    return { ...n, temp: null, rh: null, error: 'no-power' }
  }
  if (!m.ok) return { ...n, temp: null, rh: null, error: m.errors.includes('input-only') ? 'timeout' : 'no-response' }
  return {
    ...n,
    temp: round1(n.innerT + s.offsetT + g(ctx, DHT_SPEC.noiseT)),
    rh: round1(clamp(n.innerRH + s.offsetRH + g(ctx, DHT_SPEC.noiseRH), 0, 100)),
    error: undefined,
  }
}

/* ---------- LDR + voltage divider → 12-bit ADC ---------- */

export const LDR_SPEC = { r10: 20000, gamma: 0.7, rMin: 100, rMax: 1_000_000, adcNoise: 6 }

/** LDR resistance follows an approximate power law: R = R10 · (lux/10)^(−γ) */
export function ldrResistance(lux: number): number {
  return clamp(LDR_SPEC.r10 * Math.pow(Math.max(lux, 0.01) / 10, -LDR_SPEC.gamma), LDR_SPEC.rMin, LDR_SPEC.rMax)
}

/** V_out = V_in × R_bottom / (R_top + R_bottom) */
export function dividerVoltage(vin: number, rTop: number, rBottom: number) {
  return (vin * rBottom) / (rTop + rBottom)
}

export const voltsToAdc = (v: number) => clamp(Math.round((v / SUPPLY_VOLTAGE) * ADC_MAX), 0, ADC_MAX)

export interface LdrReading {
  adc: number | null
  volts: number | null
  rLdr: number
  /** why the reading is unusable / odd */
  note?: 'floating' | 'stuck-high' | 'stuck-low' | 'no-adc' | 'no-power' | 'overvoltage'
}

export function readLdr(d: DividerAnalysis | undefined, lux: number, ctx: SensorCtx): LdrReading {
  const rLdr = ldrResistance(lux)
  if (!d) return { adc: null, volts: null, rLdr }
  if (!ctx.powered) return { adc: null, volts: null, rLdr, note: 'no-power' }
  switch (d.status) {
    case 'ok':
    case 'overvoltage': {
      const v = d.ldrOnTop ? dividerVoltage(d.vin, rLdr, d.rFixed!) : dividerVoltage(d.vin, d.rFixed!, rLdr)
      const adc = clamp(voltsToAdc(v) + Math.round(g(ctx, LDR_SPEC.adcNoise)), 0, ADC_MAX)
      return { adc, volts: v, rLdr, note: d.status === 'overvoltage' ? 'overvoltage' : undefined }
    }
    case 'no-fixed-resistor': {
      // high-impedance ADC input pulled to the LDR's rail: the value hardly changes with light
      const high = d.ldrOnTop
      const adc = clamp((high ? ADC_MAX - 8 : 4) + Math.round(g(ctx, 3)), 0, ADC_MAX)
      return { adc, volts: (adc / ADC_MAX) * SUPPLY_VOLTAGE, rLdr, note: high ? 'stuck-high' : 'stuck-low' }
    }
    case 'input-short':
      return { adc: d.ldrOnTop ? 0 : ADC_MAX, volts: null, rLdr, note: d.ldrOnTop ? 'stuck-low' : 'stuck-high' }
    case 'no-supply':
      if (d.gpio) return floating(ctx, rLdr)
      return { adc: null, volts: null, rLdr }
    case 'not-adc':
      return { adc: null, volts: null, rLdr, note: 'no-adc' }
    default:
      return { adc: null, volts: null, rLdr }
  }
}

/** A floating ADC input picks up noise and jumps around randomly. */
export function floating(ctx: SensorCtx, rLdr = 0): LdrReading {
  return { adc: Math.round(ctx.rng.range(200, 3900)), volts: null, rLdr, note: 'floating' }
}

/* ---------- Capacitive soil moisture ---------- */

export const SOIL_SPEC = { adcDry: 3050, adcWet: 1300, noise: 10 }

export interface SoilCalibration {
  dry: number
  wet: number
}
export const defaultSoilCal = (): SoilCalibration => ({ dry: SOIL_SPEC.adcDry, wet: SOIL_SPEC.adcWet })

/** dry soil → high ADC, wet soil → low ADC (typical capacitive probe) */
export const soilTrueAdc = (soil: number) => SOIL_SPEC.adcDry - ((SOIL_SPEC.adcDry - SOIL_SPEC.adcWet) * clamp(soil, 0, 100)) / 100

export function soilPercent(adc: number, cal: SoilCalibration): number {
  if (cal.dry === cal.wet) return 0
  return clamp(Math.round(((cal.dry - adc) / (cal.dry - cal.wet)) * 100), 0, 100)
}

export interface SoilReading {
  adc: number | null
  note?: 'floating' | 'no-adc' | 'no-power'
}

export function readSoil(m: ModuleAnalysis | undefined, soil: number, ctx: SensorCtx): SoilReading {
  if (!m) return { adc: null }
  if (!ctx.powered) return { adc: null, note: 'no-power' }
  if (m.errors.includes('not-adc')) return { adc: null, note: 'no-adc' }
  if (m.errors.includes('signal-floating')) return { adc: null }
  if (!m.ok) {
    // unpowered probe on a connected ADC pin: input floats
    if (m.gpio) return { adc: Math.round(ctx.rng.range(100, 3500)), note: 'floating' }
    return { adc: null, note: 'no-power' }
  }
  return { adc: clamp(Math.round(soilTrueAdc(soil) + g(ctx, SOIL_SPEC.noise)), 0, ADC_MAX) }
}

/* ---------- PIR motion ---------- */

export const PIR_SPEC = { warmupS: 10, holdS: 3 }

export interface PirState {
  poweredSince: number | null
  holdUntil: number
  out: boolean
  warming: boolean
}

export const initPir = (): PirState => ({ poweredSince: null, holdUntil: -1, out: false, warming: false })

export function stepPir(s: PirState, env: EnvState, m: ModuleAnalysis | undefined, ctx: SensorCtx, holdS = PIR_SPEC.holdS): PirState {
  const supplied = ctx.powered && !!m && !m.errors.some((e) => e === 'no-vcc' || e === 'no-gnd' || e === 'needs-5v' || e === 'reversed-power' || e === 'power-short')
  if (!supplied) return { ...initPir() }
  const since = s.poweredSince ?? ctx.time
  const warming = ctx.time - since < PIR_SPEC.warmupS
  if (warming) return { poweredSince: since, holdUntil: -1, out: false, warming: true }
  let holdUntil = s.holdUntil
  if (isMotion(env)) holdUntil = ctx.time + holdS // retriggerable
  return { poweredSince: since, holdUntil, out: ctx.time < holdUntil, warming: false }
}
