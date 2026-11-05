/**
 * Data acquisition: sampling rates, aliasing, the wireless link budget, and sensor
 * calibration (encoder zero offset, analog temperature conversion).
 */
import { SENSOR_IDS, SENSORS, type Mounts, type SensorId } from './robot'
import { BEARING_HZ, GEAR_HZ } from './signals'

export const RATE_OPTIONS = [1, 10, 20, 50, 100, 200, 500, 1000] as const
export type Rates = Record<SensorId, number>
export const DEFAULT_RATES = (): Rates => ({ temp: 10, vib: 100, angle: 10, power: 10 })
export const SOLUTION_RATES = (): Rates => ({ temp: 1, vib: 500, angle: 50, power: 10 })

/** wireless link from the robot's gateway to the twin (kbit/s) */
export const LINK_KBPS = 40
/** keep the link below this share of its capacity so the queue never builds up */
export const SAFE_UTIL = 0.8

/** Bits per second each mounted sensor sends: rate × bytes × 8. */
export function sensorKbps(s: SensorId, rate: number) {
  return (rate * SENSORS[s].bytes * 8) / 1000
}

export function linkLoad(rates: Rates, mounts: Mounts) {
  return SENSOR_IDS.reduce((sum, s) => sum + (mounts[s] ? sensorKbps(s, rates[s]) : 0), 0)
}

export interface LinkStatus {
  kbps: number
  util: number
  /** end-to-end delay from the robot to the twin (s) */
  latency: number
  /** share of samples lost when the link is overloaded (0–1) */
  drop: number
  level: 'ok' | 'busy' | 'overload'
}

export function linkStatus(kbps: number): LinkStatus {
  const util = kbps / LINK_KBPS
  if (util <= SAFE_UTIL) return { kbps, util, latency: 0.04 + 0.08 * util, drop: 0, level: 'ok' }
  if (util <= 1) return { kbps, util, latency: 0.1 + 1.2 * (util - SAFE_UTIL), drop: 0, level: 'busy' }
  return { kbps, util, latency: 1.5 + 6 * (util - 1), drop: 1 - 1 / util, level: 'overload' }
}

/** Frequency a tone of f Hz appears at when sampled at fs Hz (folding about fs/2). */
export function aliasHz(f: number, fs: number) {
  return Math.abs(f - fs * Math.round(f / fs))
}

export interface VibPeak {
  name: string
  trueHz: number
  seenHz: number
  amp: number
  aliased: boolean
}

export function vibPeaks(fs: number, bearingAmp: number): VibPeak[] {
  return [
    { name: 'เฟือง', trueHz: GEAR_HZ, amp: 0.3 },
    { name: 'ลูกปืน', trueHz: BEARING_HZ, amp: bearingAmp },
  ].map((p) => {
    const seenHz = aliasHz(p.trueHz, fs)
    return { ...p, seenHz, aliased: Math.abs(seenHz - p.trueHz) > 0.5 }
  })
}

/** The bearing band level (RMS, g) can only be measured when fs is above twice 180 Hz. */
export function bearingBand(fs: number, bearingAmp: number): number | null {
  return fs > 2 * BEARING_HZ ? bearingAmp / Math.SQRT2 : null
}

export function rateChecks(rates: Rates) {
  return {
    vib: rates.vib > 2 * BEARING_HZ,
    angle: rates.angle >= SENSORS.angle.minRate,
    temp: rates.temp >= SENSORS.temp.minRate,
    power: rates.power >= SENSORS.power.minRate,
  }
}

/* ---------------- encoder ---------------- */
export const ENC_COUNTS = 4096
/** the encoder magnet was fitted 45° away from the arm's zero (counts) */
export const ENC_ZERO_RAW = 512
const mod = (a: number, n: number) => ((a % n) + n) % n
const wrap180 = (d: number) => (d > 180 ? d - 360 : d)

export const encoderRaw = (angleDeg: number) => mod(Math.round((angleDeg / 360) * ENC_COUNTS) + ENC_ZERO_RAW, ENC_COUNTS)
export const encoderAngle = (raw: number, offset: number) => wrap180((mod(raw - offset, ENC_COUNTS) * 360) / ENC_COUNTS)
/** degrees the twin's arm is off by because of the zero offset */
export const encoderErrorDeg = (offset: number) => Math.abs(wrap180((mod(ENC_ZERO_RAW - offset, ENC_COUNTS) * 360) / ENC_COUNTS))
export const encoderOk = (offset: number) => encoderErrorDeg(offset) < 2

/* ---------------- analog temperature sensor ---------------- */
export interface TempCal {
  /** output at 0 °C (mV) */
  offsetMv: number
  /** sensitivity (mV per °C) */
  mvPerC: number
}
/** datasheet: 500 mV at 0 °C, +10 mV per °C */
export const TEMP_DATASHEET: TempCal = { offsetMv: 500, mvPerC: 10 }
export const DEFAULT_TEMP_CAL = (): TempCal => ({ offsetMv: 0, mvPerC: 1 })
export const tempMv = (c: number) => TEMP_DATASHEET.offsetMv + TEMP_DATASHEET.mvPerC * c
export const adcOf = (mv: number) => Math.max(0, Math.min(4095, Math.round((mv / 3300) * 4095)))
export const tempFromAdc = (adc: number, cal: TempCal) => ((adc * 3300) / 4095 - cal.offsetMv) / Math.max(0.1, cal.mvPerC)
/** the conversion matches the real temperature at both a cool and a hot motor */
export const tempCalOk = (cal: TempCal) => [25, 75].every((c) => Math.abs(tempFromAdc(adcOf(tempMv(c)), cal) - c) < 1)
