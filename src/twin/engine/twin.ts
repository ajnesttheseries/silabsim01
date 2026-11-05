/**
 * What the digital twin "sees": readings derived from the real robot through the
 * fitted sensors, their sampling rates, the link delay and the calibration.
 * Also the alert rules and the automatic scenario test for the challenge.
 */
import { bearingBand, encoderAngle, encoderRaw, linkLoad, linkStatus, adcOf, tempFromAdc, tempMv, type Rates, type TempCal } from './daq'
import { SENSORS, type Mounts, type SensorId } from './robot'
import { armAngle, initTruth, ROOM_TEMP, SOC_RETURN, stepTruth, TEMP_DAMAGE, BEARING_LIFE, type Fault, type Truth } from './signals'

export interface TwinCfg {
  mounts: Mounts
  rates: Rates
  encoderOffset: number
  tempCal: TempCal
}

export interface Reading {
  angle: number | null
  temp: number | null
  /** bearing band vibration level (RMS, g); null when it cannot be measured */
  vib: number | null
  soc: number | null
  current: number | null
}

/** One sensor's value as the twin receives it, from the robot state it sampled. */
export function measureOne(s: SensorId, truth: Truth, cfg: TwinCfg, sampleT: number): number | null {
  const at = cfg.mounts[s]
  if (!at) return null
  const right = at === SENSORS[s].slot
  switch (s) {
    case 'angle': {
      const real = right ? (truth.moving ? armAngle(sampleT) : 0) : 0 // a misplaced encoder sits on a joint that does not move
      return encoderAngle(encoderRaw(real), cfg.encoderOffset)
    }
    case 'temp': {
      const real = right ? truth.temp : at === 'head' ? ROOM_TEMP + 2 : (truth.temp + ROOM_TEMP) / 2
      return tempFromAdc(adcOf(tempMv(real)), cfg.tempCal)
    }
    case 'vib':
      return bearingBand(cfg.rates.vib, right ? truth.bearingAmp : truth.bearingAmp * 0.1)
    case 'power':
      return right ? truth.soc : null
  }
}

/** Ring buffer of the robot's past states, so the twin can show them after the link delay. */
export class TruthHistory {
  private buf: Truth[] = []
  constructor(private readonly dt: number) {}
  push(s: Truth) {
    this.buf.push(s)
    if (this.buf.length > 4000) this.buf.splice(0, this.buf.length - 4000)
  }
  /** latest state at or before time t */
  at(t: number): Truth | null {
    if (!this.buf.length) return null
    const last = this.buf[this.buf.length - 1]
    const back = Math.round((last.t - t) / this.dt)
    const i = Math.max(0, Math.min(this.buf.length - 1, this.buf.length - 1 - back))
    return this.buf[i]
  }
}

/** Everything the twin shows at time `now`. */
export function twinReading(h: TruthHistory, now: number, cfg: TwinCfg): { reading: Reading; latency: number } {
  const link = linkStatus(linkLoad(cfg.rates, cfg.mounts))
  const one = (s: SensorId) => {
    const fs = Math.max(0.1, cfg.rates[s])
    const sampleT = Math.floor((now - link.latency) * fs) / fs // sample-and-hold at the sensor's rate
    const truth = h.at(sampleT)
    return truth ? measureOne(s, truth, cfg, sampleT) : null
  }
  const powerTruth = h.at(now - link.latency)
  return {
    reading: {
      angle: one('angle'),
      temp: one('temp'),
      vib: one('vib'),
      soc: one('power'),
      current: cfg.mounts.power === 'battery' && powerTruth ? powerTruth.current : null,
    },
    latency: link.latency,
  }
}

/** a motor temperature reading that cannot be real (e.g. uncalibrated conversion) */
export const implausibleTemp = (c: number | null) => c !== null && (c > 150 || c < -20)

/* ---------------- alerts ---------------- */
export type AlertKind = 'temp' | 'vib' | 'soc'
export interface AlertRules {
  /** warn when the knee motor is hotter than this (°C) */
  tempMax: number
  /** warn when the bearing band vibration exceeds this (g RMS) */
  vibMax: number
  /** send the robot to its dock when the battery falls below this (%) */
  socMin: number
}
export const DEFAULT_RULES = (): AlertRules => ({ tempMax: 100, vibMax: 1.5, socMin: 0 })
export const SOLUTION_RULES = (): AlertRules => ({ tempMax: 60, vibMax: 0.4, socMin: 20 })
export const ALERT_TH: Record<AlertKind, string> = { temp: 'มอเตอร์เข่าร้อนเกิน', vib: 'ลูกปืนสะโพกสั่นผิดปกติ', soc: 'แบตเตอรี่ใกล้หมด' }
export const ALERT_ACTION: Record<AlertKind, string> = { temp: 'หยุดพักให้มอเตอร์เย็นลง', vib: 'หยุดเต้นและแจ้งช่างเปลี่ยนลูกปืน', soc: 'เดินกลับแท่นชาร์จ' }

export function alertsOf(r: Reading, rules: AlertRules): AlertKind[] {
  const out: AlertKind[] = []
  if (r.temp !== null && r.temp > rules.tempMax) out.push('temp')
  if (r.vib !== null && r.vib > rules.vibMax) out.push('vib')
  if (r.soc !== null && r.soc < rules.socMin) out.push('soc')
  return out
}

/* ---------------- automatic scenario test ---------------- */
export interface TestScenario {
  id: 'normal' | 'overheat' | 'bearing' | 'lowbatt'
  th: string
  fault: Fault
  start: { temp: number; soc: number }
  faultAt: number | null
  expect: AlertKind | null
}

export const TEST_SCENARIOS: TestScenario[] = [
  { id: 'normal', th: 'วันปกติ: NOVA-1 เต้นให้เด็ก ๆ ในห้องเด็กเล่นดู', fault: 'none', start: { temp: 34, soc: 70 }, faultAt: null, expect: null },
  { id: 'overheat', th: 'มอเตอร์เข่าขวาฝืด ร้อนขึ้นเรื่อย ๆ', fault: 'overheat', start: { temp: 38, soc: 70 }, faultAt: 5, expect: 'temp' },
  { id: 'bearing', th: 'ลูกปืนในเฟืองสะโพกเริ่มสึก', fault: 'bearing', start: { temp: 34, soc: 70 }, faultAt: 5, expect: 'vib' },
  { id: 'lowbatt', th: 'แบตเตอรี่เสื่อม ไฟหมดเร็วกว่าปกติ', fault: 'lowbatt', start: { temp: 34, soc: 26 }, faultAt: 0, expect: 'soc' },
]

export interface Checkpoint {
  id: string
  th: string
  pass: boolean
  checks: Array<{ th: string; ok: boolean }>
  note: string
}

const DT = 0.05
const DURATION = 60

export function runScenario(sc: TestScenario, cfg: TwinCfg, rules: AlertRules): Checkpoint {
  const h = new TruthHistory(DT)
  let s = initTruth({ temp: sc.start.temp, soc: sc.start.soc, fault: sc.fault, faultAt: sc.faultAt })
  h.push(s)
  let stopped = false
  const first: Partial<Record<AlertKind, { t: number; value: number }>> = {}
  let damaged: string | null = null
  let peakTemp = s.temp
  for (let t = DT; t <= DURATION + 1e-9; t += DT) {
    s = stepTruth(s, DT, { hold: false, stopped })
    h.push(s)
    peakTemp = Math.max(peakTemp, s.temp)
    if (!damaged && s.temp >= TEMP_DAMAGE) damaged = `มอเตอร์ร้อนถึง ${TEMP_DAMAGE} °C ขดลวดเสียหาย`
    if (!damaged && s.moving && s.fault === 'bearing' && s.faultAt !== null && s.t - s.faultAt >= BEARING_LIFE) damaged = 'ลูกปืนแตกกลางโชว์'
    if (!damaged && s.moving && s.soc < SOC_RETURN) damaged = `แบตเหลือต่ำกว่า ${SOC_RETURN}% เดินกลับแท่นชาร์จไม่ไหว`
    const { reading } = twinReading(h, s.t, cfg)
    for (const a of alertsOf(reading, rules)) {
      if (!first[a]) first[a] = { t: s.t, value: a === 'temp' ? reading.temp! : a === 'vib' ? reading.vib! : reading.soc! }
      stopped = true // safe stop / return to dock
    }
  }
  const fired = Object.keys(first) as AlertKind[]
  const fmt = (a: AlertKind) => {
    const f = first[a]!
    return `${f.t.toFixed(1)} วิ (${a === 'temp' ? `${f.value.toFixed(1)} °C` : a === 'vib' ? `${f.value.toFixed(2)} g` : `${f.value.toFixed(1)}%`})`
  }
  if (!sc.expect) {
    const ok = fired.length === 0
    return {
      id: sc.id,
      th: sc.th,
      pass: ok,
      checks: [{ th: 'ไม่เตือนผิด (False alarm) ตอนทุกอย่างปกติ หุ่นเต้นได้ครบ 60 วินาที', ok }],
      note: ok ? `อุณหภูมิสูงสุด ${peakTemp.toFixed(1)} °C ปกติดี` : `เตือนผิด: ${fired.map((a) => `${ALERT_TH[a]} ที่ ${fmt(a)}`).join(', ')} โชว์ถูกหยุดโดยไม่จำเป็น`,
    }
  }
  const caught = !!first[sc.expect]
  const wrongFirst = fired.some((a) => a !== sc.expect && (!caught || first[a]!.t < first[sc.expect!]!.t))
  const checks = [
    { th: `แฝดตรวจพบ "${ALERT_TH[sc.expect]}"`, ok: caught },
    { th: 'หยุดหุ่นได้ทันก่อนเสียหาย', ok: !damaged },
    { th: 'เตือนถูกเรื่อง ไม่ใช่เตือนเรื่องอื่นก่อน', ok: !wrongFirst },
  ]
  return {
    id: sc.id,
    th: sc.th,
    pass: checks.every((c) => c.ok),
    checks,
    note: damaged ? `ไม่ทัน: ${damaged}` : caught ? `เตือนที่ ${fmt(sc.expect)} แล้ว${ALERT_ACTION[sc.expect]}` : 'ไม่มีการเตือนเลย',
  }
}

export function runTwinTest(cfg: TwinCfg, rules: AlertRules) {
  const checkpoints = TEST_SCENARIOS.map((sc) => runScenario(sc, cfg, rules))
  return { checkpoints, score: checkpoints.filter((c) => c.pass).length, total: checkpoints.length }
}
