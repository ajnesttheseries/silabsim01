/**
 * A) Environment model. Physical quantities change gradually (first-order lag), never jump.
 * Time constants are shortened compared with a real room so changes are visible within a class period.
 */
import { clamp, lag } from './rng'

export interface EnvControls {
  /** heater power 0–100 % */
  heater: number
  /** desk fan switched on by hand (independent of the board) */
  fanManual: boolean
  /** desk lamp dimmer 0–100 % */
  lamp: number
  curtainOpen: boolean
}

export interface EnvState {
  tempC: number
  rh: number
  lux: number
  /** soil moisture 0–100 % (0 = bone dry, 100 = saturated) */
  soil: number
  /** water poured but not yet absorbed */
  pendingWater: number
  /** sim time until which someone is moving in front of the PIR */
  motionUntil: number
  time: number
}

export const ENV_LIMITS = { tempMin: 20, tempMax: 45, baseTemp: 28 }
export const TAU = { temp: 20, rh: 15, lux: 0.4, soilDry: 150, soilAbsorb: 3 }

export const defaultControls = (): EnvControls => ({ heater: 0, fanManual: false, lamp: 0, curtainOpen: true })

export const initialEnv = (): EnvState => ({
  tempC: ENV_LIMITS.baseTemp,
  rh: 60,
  lux: 420,
  soil: 45,
  pendingWater: 0,
  motionUntil: -1,
  time: 0,
})

/** Steady-state targets for the given controls. `fanSpeed` 0–1 comes from manual switch or the board. */
export function envTargets(c: EnvControls, fanSpeed: number, soil: number) {
  const temp = clamp(ENV_LIMITS.baseTemp + (c.heater / 100) * 15 - fanSpeed * 5, ENV_LIMITS.tempMin, ENV_LIMITS.tempMax)
  // warmer air holds more water vapour, so relative humidity falls as temperature rises
  const rh = clamp(60 - (temp - ENV_LIMITS.baseTemp) * 2.2 + (soil - 45) * 0.05 + fanSpeed * -2, 25, 90)
  const lux = (c.curtainOpen ? 400 : 20) + (c.lamp / 100) * 900
  return { temp, rh, lux }
}

export function stepEnv(s: EnvState, c: EnvControls, boardFanSpeed: number, dt: number): EnvState {
  const fanSpeed = Math.max(c.fanManual ? 1 : 0, boardFanSpeed)
  const t = envTargets(c, fanSpeed, s.soil)
  const absorbed = s.pendingWater * (1 - Math.exp(-dt / TAU.soilAbsorb))
  const soil = clamp(lag(s.soil, 5, dt, TAU.soilDry) + absorbed, 0, 100)
  return {
    tempC: clamp(lag(s.tempC, t.temp, dt, TAU.temp), ENV_LIMITS.tempMin, ENV_LIMITS.tempMax),
    rh: lag(s.rh, t.rh, dt, TAU.rh),
    lux: Math.max(0, lag(s.lux, t.lux, dt, TAU.lux)),
    soil,
    pendingWater: s.pendingWater - absorbed,
    motionUntil: s.motionUntil,
    time: s.time + dt,
  }
}

export const waterPlant = (s: EnvState): EnvState => ({ ...s, pendingWater: Math.min(100 - s.soil, s.pendingWater + 25) })
export const walkBy = (s: EnvState, seconds = 2.5): EnvState => ({ ...s, motionUntil: s.time + seconds })
export const isMotion = (s: EnvState) => s.time < s.motionUntil
