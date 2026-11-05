/**
 * The "real world": what the physical robot is actually doing. Simple, deterministic
 * models (time is sped up so changes are visible within seconds — noted in the UI).
 */

export type Fault = 'none' | 'overheat' | 'bearing' | 'lowbatt'

export const DANCE_HZ = 0.5
export const GEAR_HZ = 60
export const BEARING_HZ = 180
/** knee motor winding is damaged at this temperature (°C) */
export const TEMP_DAMAGE = 85
/** the robot needs this much battery (%) to walk back to its charging dock */
export const SOC_RETURN = 10
/** a worn bearing breaks this long (s) after the wear starts, if the robot keeps dancing */
export const BEARING_LIFE = 25
export const ROOM_TEMP = 26

export interface Truth {
  t: number
  /** right shoulder angle (degrees, 0 = arm down) */
  angle: number
  /** right knee motor temperature (°C) */
  temp: number
  /** battery state of charge (%) */
  soc: number
  current: number
  voltage: number
  /** amplitude of the 180 Hz bearing vibration (g) */
  bearingAmp: number
  moving: boolean
  fault: Fault
  faultAt: number | null
}

export interface StepOpts {
  /** "ready pose": arm held at 0° (used to zero the encoder) */
  hold: boolean
  /** safe-stopped by an alert or sent back to the dock */
  stopped: boolean
}

export const armAngle = (t: number) => 50 + 40 * Math.sin(2 * Math.PI * DANCE_HZ * t)

export function initTruth(o: { temp?: number; soc?: number; fault?: Fault; faultAt?: number | null } = {}): Truth {
  const temp = o.temp ?? 34
  const soc = o.soc ?? 70
  return {
    t: 0,
    angle: armAngle(0),
    temp,
    soc,
    current: 3.5,
    voltage: 21 + (4.2 * soc) / 100,
    bearingAmp: 0.1,
    moving: true,
    fault: o.fault ?? 'none',
    faultAt: o.faultAt ?? null,
  }
}

const active = (s: Truth, f: Fault) => s.fault === f && s.faultAt !== null && s.t >= s.faultAt

/** Advance the physical robot by dt seconds. */
export function stepTruth(s: Truth, dt: number, o: StepOpts): Truth {
  const t = s.t + dt
  const moving = !o.hold && !o.stopped
  const angle = moving ? armAngle(t) : 0
  const next: Truth = { ...s, t, angle, moving }
  // knee motor heat: first-order lag towards a load-dependent target
  const hot = active(next, 'overheat') && moving
  const target = hot ? 100 : moving ? 42 : 30
  next.temp = s.temp + (target - s.temp) * (1 - Math.exp(-dt / 12))
  // battery
  next.current = moving ? 3.5 + (hot ? 1 : 0) : 1.2
  const drain = 0.019 * (active(next, 'lowbatt') ? 5 : 1)
  next.soc = Math.max(0, s.soc - next.current * drain * dt)
  next.voltage = 21 + (4.2 * next.soc) / 100
  // bearing wear grows only while the robot keeps working; stopping freezes it
  next.bearingAmp = !active(next, 'bearing') ? 0.1 : moving ? Math.min(1.2, s.bearingAmp + 0.08 * dt) : s.bearingAmp
  return next
}

/** Instantaneous hip vibration (g): gear mesh at 60 Hz plus the bearing tone at 180 Hz. */
export const vibAt = (t: number, bearingAmp: number) => 0.3 * Math.sin(2 * Math.PI * GEAR_HZ * t) + bearingAmp * Math.sin(2 * Math.PI * BEARING_HZ * t + 0.7)
