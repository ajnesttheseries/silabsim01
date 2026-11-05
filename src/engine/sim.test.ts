import { describe, expect, it } from 'vitest'
import { SOLUTIONS } from './circuit/solutions'
import { validateCircuit } from './circuit/validator'
import { toCsv } from './csv'
import { defaultControls, ENV_LIMITS, initialEnv, stepEnv, waterPlant, walkBy } from './environment'
import { LabSim } from './firmware'
import { FINAL_QUIZ, scoreQuiz } from './quiz'
import { createRng } from './rng'
import { evaluateRules, generateArduino, generateMicroPython, pinMapFromReport, type Rule } from './rules'
import { runScenarioTests } from './scenarios'
import { defaultSoilCal, dividerVoltage, initDht, initPir, ldrResistance, readLdr, soilPercent, stepDht, stepPir, voltsToAdc } from './sensors'

const run = (n: number, f: () => void) => {
  for (let i = 0; i < n; i++) f()
}

describe('environment model', () => {
  it('temperature changes gradually and converges to target', () => {
    let s = initialEnv()
    const c = { ...defaultControls(), heater: 100 }
    s = stepEnv(s, c, 0, 1)
    expect(s.tempC).toBeGreaterThan(28)
    expect(s.tempC).toBeLessThan(30) // no jump
    run(2000, () => (s = stepEnv(s, c, 0, 0.1)))
    expect(s.tempC).toBeCloseTo(43, 0)
  })
  it('clamps to the realistic room range and the fan cools', () => {
    let s = initialEnv()
    run(3000, () => (s = stepEnv(s, { ...defaultControls(), fanManual: true }, 0, 0.1)))
    expect(s.tempC).toBeGreaterThanOrEqual(ENV_LIMITS.tempMin)
    expect(s.tempC).toBeCloseTo(23, 0)
  })
  it('humidity falls when the air warms up', () => {
    let s = initialEnv()
    const rh0 = s.rh
    run(2000, () => (s = stepEnv(s, { ...defaultControls(), heater: 100 }, 0, 0.1)))
    expect(s.rh).toBeLessThan(rh0)
  })
  it('watering raises soil moisture gradually, then it dries out', () => {
    let s = initialEnv()
    const s0 = s.soil
    s = waterPlant(s)
    s = stepEnv(s, defaultControls(), 0, 0.1)
    expect(s.soil - s0).toBeLessThan(5)
    run(100, () => (s = stepEnv(s, defaultControls(), 0, 0.1)))
    expect(s.soil).toBeGreaterThan(s0 + 15)
    const peak = s.soil
    run(1000, () => (s = stepEnv(s, defaultControls(), 0, 0.1)))
    expect(s.soil).toBeLessThan(peak)
  })
  it('walk-by creates a short motion window', () => {
    let s = walkBy(initialEnv(), 2)
    expect(s.motionUntil).toBe(2)
    run(30, () => (s = stepEnv(s, defaultControls(), 0, 0.1)))
    expect(s.time).toBeGreaterThan(s.motionUntil)
  })
})

describe('DHT model', () => {
  const m = validateCircuit(SOLUTIONS.dht()).modules['dht1']
  it('samples only every 2 s, at 0.1 resolution, within accuracy', () => {
    const rng = createRng(1)
    const env = { ...initialEnv(), tempC: 31.4 }
    let s = initDht(rng, env)
    s.innerT = 31.4
    const samples = new Set<number>()
    let changes = 0
    let prev: number | null = null
    for (let t = 0; t < 20; t += 0.1) {
      s = stepDht(s, env, m, { rng, noise: true, powered: true, dt: 0.1, time: t })
      if (s.temp !== prev) changes++
      prev = s.temp
      if (s.temp !== null) samples.add(s.temp)
    }
    expect(changes).toBeLessThanOrEqual(11) // ≤ one new value per 2 s
    for (const v of samples) {
      expect(Math.abs(v - 31.4)).toBeLessThan(1.0)
      expect(Math.round(v * 10) / 10).toBe(v)
    }
  })
  it('responds with a delay to a step change', () => {
    const rng = createRng(2)
    let s = initDht(rng, initialEnv())
    const env = { ...initialEnv(), tempC: 40 }
    for (let t = 0; t < 4; t += 0.1) s = stepDht(s, env, m, { rng, noise: false, powered: true, dt: 0.1, time: t })
    expect(s.temp!).toBeLessThan(36)
  })
  it('returns NaN / error without power or with a broken circuit', () => {
    const rng = createRng(3)
    let s = initDht(rng, initialEnv())
    s = stepDht(s, initialEnv(), m, { rng, noise: true, powered: false, dt: 0.1, time: 0 })
    expect(s.temp).toBeNull()
    expect(s.error).toBe('no-power')
    const broken = SOLUTIONS.dht()
    broken.wires = broken.wires.filter((w) => w.a !== 'mcu:GPIO4')
    const mb = validateCircuit(broken).modules['dht1']
    s = stepDht(initDht(rng, initialEnv()), initialEnv(), mb, { rng, noise: true, powered: true, dt: 0.1, time: 0 })
    expect(s.temp).toBeNull()
    expect(s.error).toBe('no-response')
  })
})

describe('LDR model', () => {
  it('resistance falls as light rises (power law)', () => {
    expect(ldrResistance(10)).toBeCloseTo(20000, -1)
    expect(ldrResistance(1000)).toBeLessThan(ldrResistance(100))
    expect(ldrResistance(0.01)).toBeLessThanOrEqual(1_000_000)
  })
  it('divider formula and 12-bit ADC conversion', () => {
    expect(dividerVoltage(3.3, 10000, 10000)).toBeCloseTo(1.65)
    expect(voltsToAdc(3.3)).toBe(4095)
    expect(voltsToAdc(0)).toBe(0)
    expect(voltsToAdc(1.65)).toBe(2048)
  })
  it('ADC rises with light when LDR is on top, falls when on the bottom', () => {
    const ctx = { rng: createRng(4), noise: false, powered: true, dt: 0.1, time: 0 }
    const top = validateCircuit(SOLUTIONS.ldr()).ldrs[0]
    expect(readLdr(top, 1000, ctx).adc!).toBeGreaterThan(readLdr(top, 20, ctx).adc!)
    const s = SOLUTIONS.ldr()
    s.wires = s.wires.map((w) => (w.a === 'bb:bp20' ? { ...w, a: 'bb:bn20' } : w.a === 'bb:h26' ? { ...w, b: 'bb:bp26' } : w))
    const bottom = validateCircuit(s).ldrs[0]
    expect(readLdr(bottom, 1000, ctx).adc!).toBeLessThan(readLdr(bottom, 20, ctx).adc!)
  })
  it('a floating input jumps randomly; a non-ADC pin gives no reading', () => {
    const ctx = { rng: createRng(5), noise: true, powered: true, dt: 0.1, time: 0 }
    const s = SOLUTIONS.ldr()
    s.wires = s.wires.filter((w) => w.a !== 'bb:bp20' && w.a !== 'bb:h26')
    const d = validateCircuit(s).ldrs[0]
    const vals = new Set(Array.from({ length: 10 }, () => readLdr(d, 300, ctx).adc))
    expect(vals.size).toBeGreaterThan(5)
    const s2 = SOLUTIONS.ldr()
    s2.wires = s2.wires.map((w) => (w.a === 'mcu:GPIO34' ? { ...w, a: 'mcu:GPIO21' } : w))
    expect(readLdr(validateCircuit(s2).ldrs[0], 300, ctx).adc).toBeNull()
  })
})

describe('soil + PIR models', () => {
  it('soil percent from calibration (dry = high ADC)', () => {
    const cal = defaultSoilCal()
    expect(soilPercent(cal.dry, cal)).toBe(0)
    expect(soilPercent(cal.wet, cal)).toBe(100)
    expect(soilPercent(2000, { dry: 3000, wet: 1000 })).toBe(50)
  })
  it('PIR warms up, then holds HIGH after motion', () => {
    const m = validateCircuit(SOLUTIONS.classroom()).modules // no PIR here
    expect(m['pir1']).toBeUndefined()
    const rng = createRng(6)
    const s0 = { ...SOLUTIONS.led(), components: [{ id: 'p', type: 'pir' as const, anchor: null }], wires: [
      { id: 'a', a: 'mcu:5V', b: 'cmp:p:VCC', color: 'red' as const },
      { id: 'b', a: 'mcu:GND1', b: 'cmp:p:GND', color: 'black' as const },
      { id: 'c', a: 'mcu:GPIO27', b: 'cmp:p:OUT', color: 'white' as const },
    ] }
    const pm = validateCircuit(s0).modules['p']
    let env = walkBy(initialEnv(), 100)
    let p = initPir()
    for (let t = 0; t < 5; t += 0.1) p = stepPir(p, { ...env, time: t }, pm, { rng, noise: true, powered: true, dt: 0.1, time: t })
    expect(p.warming).toBe(true)
    expect(p.out).toBe(false)
    for (let t = 5; t < 12; t += 0.1) p = stepPir(p, { ...env, time: t }, pm, { rng, noise: true, powered: true, dt: 0.1, time: t })
    expect(p.out).toBe(true)
    env = { ...env, motionUntil: 12 }
    for (let t = 12; t < 13.5; t += 0.1) p = stepPir(p, { ...env, time: t }, pm, { rng, noise: true, powered: true, dt: 0.1, time: t })
    expect(p.out).toBe(true) // still in hold time
    for (let t = 13.5; t < 17; t += 0.1) p = stepPir(p, { ...env, time: t }, pm, { rng, noise: true, powered: true, dt: 0.1, time: t })
    expect(p.out).toBe(false)
  })
})

describe('virtual firmware', () => {
  it('lights the LED only when the GPIO is HIGH and power is on', () => {
    const sim = new LabSim()
    sim.setCircuit(SOLUTIONS.led())
    sim.manual.ledRed = true
    sim.step(0.1)
    expect(sim.actuators.byKey.ledRed).toBe(false) // power off
    expect(sim.setPower(true).ok).toBe(true)
    sim.step(0.1)
    expect(sim.actuators.byKey.ledRed).toBe(true)
    expect(sim.measure('bb:c3')).toBeCloseTo(3.3)
  })
  it('refuses power on a shorted circuit and cuts power when a short appears', () => {
    const sim = new LabSim()
    const s = SOLUTIONS.led()
    sim.setCircuit(s)
    sim.setPower(true)
    sim.setCircuit({ ...s, wires: [...s.wires, { id: 'x', a: 'bb:tp5', b: 'bb:tn5', color: 'red' }] })
    expect(sim.powerOn).toBe(false)
    expect(sim.tripped).toBe(true)
    expect(sim.setPower(true)).toEqual({ ok: false, reason: 'short' })
  })
  it('an LED without resistor flashes then is damaged', () => {
    const sim = new LabSim()
    sim.setCircuit({
      usbConnected: true,
      components: [{ id: 'l', type: 'led', variant: 'red', anchor: 'bb:b7' }],
      wires: [
        { id: '1', a: 'mcu:GPIO18', b: 'bb:c7', color: 'yellow' },
        { id: '2', a: 'bb:c8', b: 'bb:tn8', color: 'black' },
        { id: '3', a: 'mcu:GND1', b: 'bb:tn1', color: 'black' },
      ],
    })
    sim.manual.ledRed = true
    sim.setPower(true)
    sim.step(0.1)
    expect(sim.actuators.leds['l'].overcurrent).toBe(true)
    run(20, () => sim.step(0.1))
    expect(sim.actuators.leds['l'].burnt).toBe(true)
  })
  it('prints serial lines with temperature', () => {
    const sim = new LabSim()
    sim.setCircuit(SOLUTIONS.dht())
    sim.setPower(true)
    run(50, () => sim.step(0.1))
    expect(sim.serial.some((l) => /Temp: \d+\.\d °C \| Humidity: \d+\.\d %/.test(l))).toBe(true)
  })
  it('rules close the loop: hot room turns the fan on, which cools the room', () => {
    const sim = new LabSim()
    sim.setCircuit(SOLUTIONS.classroom())
    sim.rules = [{ id: 'r', sensor: 'temp', op: '>', value: 30, actuator: 'fan', action: 'on', otherwise: true, enabled: true }]
    sim.controls.heater = 100
    sim.setPower(true)
    run(600, () => sim.step(0.1))
    expect(sim.actuators.fanSpeed).toBe(1)
  })
})

describe('rules + codegen', () => {
  const rules: Rule[] = [
    { id: 'a', sensor: 'temp', op: '>', value: 30, actuator: 'fan', action: 'on', otherwise: true, enabled: true },
    { id: 'b', sensor: 'light', op: '<', value: 2500, actuator: 'ledRed', action: 'on', otherwise: true, enabled: true },
  ]
  it('evaluates with else branch and ignores invalid data', () => {
    expect(evaluateRules(rules, { temp: 32, humidity: 50, light: 3000, soil: null, motion: null })).toEqual({ fan: true, ledRed: false })
    expect(evaluateRules(rules, { temp: null, humidity: null, light: 1000, soil: null, motion: null })).toEqual({ ledRed: true })
  })
  it('generates code with the real pin numbers from the netlist', () => {
    const s = SOLUTIONS.classroom()
    const pm = pinMapFromReport(validateCircuit(s), s.components)
    expect(pm).toMatchObject({ dht: 4, ldr: 34, fan: 26, ledRed: 18 })
    const ino = generateArduino(rules, pm, defaultSoilCal())
    expect(ino).toContain('#define DHT_PIN 4')
    expect(ino).toContain('const int FAN_PIN = 26;')
    expect(ino).toContain('if (temp > 30) {')
    expect(ino).toContain('analogRead(LDR_PIN)')
    const py = generateMicroPython(rules, pm, defaultSoilCal())
    expect(py).toContain('fan = Pin(26, Pin.OUT)')
    expect(py).toContain('if light < 2500:')
  })
})

describe('mission 5 automatic tests', () => {
  it('classroom reference solution passes all scenarios', () => {
    const rules: Rule[] = [
      { id: 'a', sensor: 'temp', op: '>', value: 32, actuator: 'fan', action: 'on', otherwise: true, enabled: true },
      { id: 'b', sensor: 'light', op: '<', value: 2500, actuator: 'ledRed', action: 'on', otherwise: true, enabled: true },
    ]
    const r = runScenarioTests('classroom', SOLUTIONS.classroom(), rules, defaultSoilCal())
    expect(r.score).toBe(4)
  })
  it('fan wired directly to GPIO fails the hot scenarios', () => {
    const s = SOLUTIONS.classroom()
    s.components = s.components.filter((c) => c.type !== 'driver')
    s.wires = s.wires.filter((w) => !w.a.startsWith('cmp:drv1') && !w.b.startsWith('cmp:drv1'))
    s.wires.push({ id: 'x', a: 'mcu:GPIO26', b: 'cmp:fan1:P', color: 'yellow' }, { id: 'y', a: 'bb:tn28', b: 'cmp:fan1:N', color: 'black' })
    const rules: Rule[] = [{ id: 'a', sensor: 'temp', op: '>', value: 32, actuator: 'fan', action: 'on', otherwise: true, enabled: true }]
    const r = runScenarioTests('classroom', s, rules, defaultSoilCal())
    expect(r.results.find((x) => x.scenario.id === 'hot-dark')!.pass).toBe(false)
  })
  it('smart pet home: reference circuit is clean and passes all four situations', () => {
    const s = SOLUTIONS.pet()
    expect(validateCircuit(s).issues.filter((i) => i.severity === 'error' || i.severity === 'danger')).toEqual([])
    const rules: Rule[] = [
      { id: 'a', sensor: 'temp', op: '>', value: 32, actuator: 'fan', action: 'on', otherwise: true, enabled: true },
      { id: 'b', sensor: 'motion', op: '>', value: 1, actuator: 'ledGreen', action: 'on', otherwise: true, enabled: true },
    ]
    const r = runScenarioTests('pet', s, rules, defaultSoilCal())
    expect(r.results.filter((x) => !x.pass).map((x) => x.scenario.id)).toEqual([])
    expect(r.score).toBe(4)
    // without the motion rule the welcome light never reacts to the pet
    expect(runScenarioTests('pet', s, rules.slice(0, 1), defaultSoilCal()).score).toBe(2)
  })
  it('plant reference solution passes', () => {
    const rules: Rule[] = [
      { id: 'a', sensor: 'soil', op: '<', value: 35, actuator: 'ledRed', action: 'on', otherwise: true, enabled: true },
      { id: 'b', sensor: 'soil', op: '<', value: 35, actuator: 'buzzer', action: 'on', otherwise: true, enabled: true },
      { id: 'c', sensor: 'soil', op: '>', value: 35, actuator: 'ledGreen', action: 'on', otherwise: true, enabled: true },
    ]
    expect(runScenarioTests('plant', SOLUTIONS.plant(), rules, defaultSoilCal()).score).toBe(4)
    expect(runScenarioTests('plant', SOLUTIONS.plant(), rules.slice(0, 1), defaultSoilCal()).score).toBe(0)
  })
})

describe('quiz + csv', () => {
  it('scores answers', () => {
    expect(scoreQuiz(FINAL_QUIZ, FINAL_QUIZ.map((q) => q.answer))).toBe(5)
    expect(scoreQuiz(FINAL_QUIZ, [null, null, null, null, null])).toBe(0)
    for (const q of FINAL_QUIZ) expect(q.choices).toHaveLength(4)
  })
  it('escapes CSV values and adds BOM', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'he said "hi"'], [1, null]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"x,y","he said ""hi"""')
    expect(csv).toContain('1,')
  })
})
