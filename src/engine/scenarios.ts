/** Mission 5 automatic tester: runs the student's circuit + rules headlessly through several situations. */
import type { CircuitState } from './circuit/netlist'
import type { EnvControls } from './environment'
import { LabSim } from './firmware'
import type { Rule } from './rules'
import type { SoilCalibration } from './sensors'

export type Challenge = 'classroom' | 'plant' | 'pet'

export interface Expectation {
  key: 'fan' | 'anyLed' | 'ledRed' | 'ledGreen' | 'buzzer'
  on: boolean
  th: string
}

export interface Scenario {
  id: string
  th: string
  controls: Partial<EnvControls>
  /** initial physical state so the test does not need minutes of warm-up */
  env: { tempC?: number; lux?: number; soil?: number }
  /** someone (the pet) keeps moving in front of the PIR during the test */
  motion?: boolean
  expect: Expectation[]
}

export const SCENARIOS: Record<Challenge, Scenario[]> = {
  pet: [
    {
      id: 'hot-pet',
      th: 'บ่ายร้อนจัด + น้องแมวเดินเข้าบ้าน',
      controls: { heater: 100 },
      env: { tempC: 42 },
      motion: true,
      expect: [
        { key: 'fan', on: true, th: 'พัดลมเปิดคลายร้อน' },
        { key: 'anyLed', on: true, th: 'ไฟต้อนรับติด' },
      ],
    },
    {
      id: 'hot-empty',
      th: 'บ่ายร้อนจัด + น้องแมวออกไปเล่นข้างนอก',
      controls: { heater: 100 },
      env: { tempC: 42 },
      motion: false,
      expect: [
        { key: 'fan', on: true, th: 'พัดลมยังเปิด (บ้านไม่ร้อนสะสม)' },
        { key: 'anyLed', on: false, th: 'ไฟต้อนรับดับ (ประหยัดไฟ)' },
      ],
    },
    {
      id: 'cool-pet',
      th: 'อากาศเย็นสบาย + น้องแมวเดินเข้าบ้าน',
      controls: { heater: 0 },
      env: { tempC: 27 },
      motion: true,
      expect: [
        { key: 'fan', on: false, th: 'พัดลมปิด (ไม่หนาวเกิน)' },
        { key: 'anyLed', on: true, th: 'ไฟต้อนรับติด' },
      ],
    },
    {
      id: 'cool-empty',
      th: 'อากาศเย็นสบาย + บ้านว่าง',
      controls: { heater: 0 },
      env: { tempC: 27 },
      motion: false,
      expect: [
        { key: 'fan', on: false, th: 'พัดลมปิด' },
        { key: 'anyLed', on: false, th: 'ไฟดับ' },
      ],
    },
  ],
  classroom: [
    {
      id: 'hot-bright',
      th: 'ร้อนจัด + แดดส่องสว่าง',
      controls: { heater: 100, curtainOpen: true, lamp: 100 },
      env: { tempC: 42, lux: 1300 },
      expect: [
        { key: 'fan', on: true, th: 'พัดลมเปิด' },
        { key: 'anyLed', on: false, th: 'ไฟปิด' },
      ],
    },
    {
      id: 'hot-dark',
      th: 'ร้อนจัด + ห้องมืด',
      controls: { heater: 100, curtainOpen: false, lamp: 0 },
      env: { tempC: 42, lux: 20 },
      expect: [
        { key: 'fan', on: true, th: 'พัดลมเปิด' },
        { key: 'anyLed', on: true, th: 'ไฟเปิด' },
      ],
    },
    {
      id: 'cool-bright',
      th: 'อากาศเย็นสบาย + สว่าง',
      controls: { heater: 0, curtainOpen: true, lamp: 60 },
      env: { tempC: 27, lux: 940 },
      expect: [
        { key: 'fan', on: false, th: 'พัดลมปิด' },
        { key: 'anyLed', on: false, th: 'ไฟปิด' },
      ],
    },
    {
      id: 'cool-dark',
      th: 'อากาศเย็นสบาย + ห้องมืด',
      controls: { heater: 0, curtainOpen: false, lamp: 0 },
      env: { tempC: 27, lux: 20 },
      expect: [
        { key: 'fan', on: false, th: 'พัดลมปิด' },
        { key: 'anyLed', on: true, th: 'ไฟเปิด' },
      ],
    },
  ],
  plant: [
    {
      id: 'very-dry',
      th: 'ดินแห้งมาก (ลืมรดน้ำหลายวัน)',
      controls: {},
      env: { soil: 6 },
      expect: [
        { key: 'ledRed', on: true, th: 'LED แดงติด' },
        { key: 'buzzer', on: true, th: 'บัซเซอร์ดัง' },
        { key: 'ledGreen', on: false, th: 'LED เขียวดับ' },
      ],
    },
    {
      id: 'dry',
      th: 'ดินเริ่มแห้ง',
      controls: {},
      env: { soil: 20 },
      expect: [
        { key: 'ledRed', on: true, th: 'LED แดงติด' },
        { key: 'buzzer', on: true, th: 'บัซเซอร์ดัง' },
        { key: 'ledGreen', on: false, th: 'LED เขียวดับ' },
      ],
    },
    {
      id: 'moist',
      th: 'ดินชื้นพอดี',
      controls: {},
      env: { soil: 62 },
      expect: [
        { key: 'ledGreen', on: true, th: 'LED เขียวติด' },
        { key: 'ledRed', on: false, th: 'LED แดงดับ' },
        { key: 'buzzer', on: false, th: 'บัซเซอร์เงียบ' },
      ],
    },
    {
      id: 'wet',
      th: 'เพิ่งรดน้ำ ดินชุ่ม',
      controls: {},
      env: { soil: 90 },
      expect: [
        { key: 'ledGreen', on: true, th: 'LED เขียวติด' },
        { key: 'ledRed', on: false, th: 'LED แดงดับ' },
        { key: 'buzzer', on: false, th: 'บัซเซอร์เงียบ' },
      ],
    },
  ],
}

export interface ScenarioResult {
  scenario: Scenario
  pass: boolean
  checks: Array<Expectation & { actual: boolean; ok: boolean }>
  readings: { temp: number | null; light: number | null; soil: number | null; motion: boolean | null }
}

export function runScenarioTests(
  challenge: Challenge,
  circuit: CircuitState,
  rules: Rule[],
  soilCal: SoilCalibration,
  seconds = 30,
): { results: ScenarioResult[]; score: number; total: number } {
  const results: ScenarioResult[] = []
  SCENARIOS[challenge].forEach((sc, i) => {
    const sim = new LabSim(1000 + i)
    sim.setCircuit(circuit)
    sim.rules = rules
    sim.soilCal = soilCal
    sim.controls = { ...sim.controls, ...sc.controls }
    sim.env = { ...sim.env, ...sc.env }
    sim.dht = { ...sim.dht, innerT: sim.env.tempC, innerRH: sim.env.rh }
    sim.setPower(true)
    const dt = 0.1
    for (let t = 0; t < seconds; t += dt) {
      // hold the soil level steady during a test scenario
      if (sc.env.soil !== undefined) sim.env = { ...sim.env, soil: sc.env.soil }
      if (sc.motion !== undefined) sim.env = { ...sim.env, motionUntil: sc.motion ? Infinity : -1 }
      sim.step(dt)
    }
    const a = sim.actuators.byKey
    const actual = (k: Expectation['key']) => (k === 'anyLed' ? a.ledRed || a.ledGreen || a.ledBlue : a[k])
    const checks = sc.expect.map((e) => ({ ...e, actual: actual(e.key), ok: actual(e.key) === e.on }))
    results.push({
      scenario: sc,
      pass: checks.every((c) => c.ok),
      checks,
      readings: { temp: sim.readings.temp, light: sim.readings.light, soil: sim.readings.soil, motion: sim.readings.hasPir ? sim.readings.motion : null },
    })
  })
  return { results, score: results.filter((r) => r.pass).length, total: results.length }
}
