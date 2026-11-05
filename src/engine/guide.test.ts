import { describe, expect, it } from 'vitest'
import type { PlacedComponent } from './circuit/catalog'
import { emptyCircuit, type CircuitState } from './circuit/netlist'
import { validateCircuit } from './circuit/validator'
import { emptyReadings } from './firmware'
import { computeGuide, resolveNode, type GuideCtx, type GuideStep } from './guide'
import type { Rule } from './rules'
import { runScenarioTests, type Challenge } from './scenarios'
import { defaultSoilCal } from './sensors'

interface World {
  circuit: CircuitState
  rules: Rule[]
  powered: boolean
  challenge: Challenge | null
  flags: { blink: boolean; obsT: number; obsL: number; answer: boolean; auto: { score: number; total: number } | null }
}

const newWorld = (): World => ({
  circuit: emptyCircuit(),
  rules: [],
  powered: false,
  challenge: null,
  flags: { blink: false, obsT: 0, obsL: 0, answer: false, auto: null },
})

function ctx(w: World): GuideCtx {
  const report = validateCircuit(w.circuit)
  return {
    circuit: w.circuit,
    report,
    usb: w.circuit.usbConnected,
    powered: w.powered && w.circuit.usbConnected && !report.shorted,
    readings: emptyReadings(),
    actuators: { leds: {}, fanSpeed: 0, buzzer: false, byKey: { ledRed: false, ledGreen: false, ledBlue: false, buzzer: false, fan: false } },
    found: [],
    miniQuizCorrect: 0,
    tutorial: { cam: false, select: false, wire: false },
    blinkUsed: w.flags.blink,
    obs: { tMin: 0, tMax: w.flags.obsT, lMin: 0, lMax: w.flags.obsL },
    ldrAnswerCorrect: w.flags.answer,
    challenge: w.challenge,
    rules: w.rules,
    autoTest: w.flags.auto,
    finalDone: false,
  }
}

let n = 0
/** Performs what a student following the guide would do for one step. */
function act(w: World, s: GuideStep) {
  const c = w.circuit
  switch (s.kind) {
    case 'usb':
      w.circuit = { ...c, usbConnected: true }
      break
    case 'place':
      w.circuit = { ...c, components: [...c.components, { ...(s.comp as PlacedComponent), id: `${s.comp!.type}-${++n}` }] }
      break
    case 'install':
      w.circuit = { ...c, components: [...c.components, { id: `${s.install}-${++n}`, type: s.install!, anchor: null }] }
      break
    case 'wire': {
      const a = resolveNode(s.wire!.a, c)!
      const b = resolveNode(s.wire!.b, c)!
      w.circuit = { ...c, wires: [...c.wires, { id: `w${++n}`, a, b, color: s.wire!.color }] }
      break
    }
    case 'power':
      w.powered = true
      break
    case 'rule':
      w.rules = [...w.rules, { id: `r${++n}`, ...s.rule!, action: 'on', otherwise: true, enabled: true }]
      break
    case 'choose':
      break
    case 'test': {
      const r = runScenarioTests(w.challenge!, w.circuit, w.rules, defaultSoilCal())
      w.flags.auto = { score: r.score, total: r.total }
      break
    }
    case 'observe':
      if (s.observe === 'blink') w.flags.blink = true
      if (s.observe === 'heater') w.flags.obsT = 3
      if (s.observe === 'light') w.flags.obsL = 2000
      if (s.observe === 'ldrAnswer') w.flags.answer = true
      break
  }
}

function walk(mission: number, w: World, maxSteps = 80) {
  const visited: string[] = []
  for (let i = 0; i < maxSteps; i++) {
    const g = computeGuide(mission, ctx(w))
    if (!g.current) return { g, visited }
    expect(visited).not.toContain(g.current.id) // a step must not repeat once acted on
    visited.push(g.current.id)
    act(w, g.current)
  }
  throw new Error('guide did not finish')
}

describe('guided mode', () => {
  it('mission 2 starts with USB, then guides a working LED circuit to the end', () => {
    const w = newWorld()
    expect(computeGuide(2, ctx(w)).current?.kind).toBe('usb')
    const { g, visited } = walk(2, w)
    expect(g.index).toBe(g.total)
    expect(visited[0]).toBe('usb')
    expect(visited.at(-1)).toBe('m2-blink')
    const led = validateCircuit(w.circuit).leds[0]
    expect(led.status).toBe('ok')
    expect(led.currentMa).toBeCloseTo(5.9, 1)
  })

  it('missions 3 and 4 build on each other and produce working sensors', () => {
    const w = newWorld()
    walk(2, w)
    walk(3, w)
    const r3 = validateCircuit(w.circuit)
    expect(Object.values(r3.modules).some((m) => m.ok)).toBe(true)
    walk(4, w)
    const r4 = validateCircuit(w.circuit)
    expect(r4.ldrs[0].status).toBe('ok')
    expect(r4.issues.filter((i) => i.severity === 'danger' || i.severity === 'error')).toHaveLength(0)
  })

  it('mission 5 classroom: following every step passes the automatic test', () => {
    const w = newWorld()
    w.challenge = 'classroom'
    const { g } = walk(5, w)
    expect(g.current).toBeNull()
    expect(w.flags.auto?.score).toBe(4)
  })

  it('mission 5 plant: following every step passes the automatic test', () => {
    const w = newWorld()
    w.challenge = 'plant'
    walk(5, w)
    expect(w.flags.auto?.score).toBe(4)
  })

  it('mission 5 smart pet home: following every step passes the automatic test', () => {
    const w = newWorld()
    w.challenge = 'pet'
    const { g } = walk(5, w)
    expect(g.current).toBeNull()
    expect(w.flags.auto?.score).toBe(4)
    const r = validateCircuit(w.circuit)
    expect(Object.values(r.modules).filter((m) => m.ok)).toHaveLength(2) // DHT + PIR
    expect(r.fans[0].status).toBe('via-driver')
  })

  it('accepts any hole in the same breadboard column', () => {
    const w = newWorld()
    w.circuit.usbConnected = true
    w.circuit.wires.push({ id: 'g', a: 'mcu:GND1', b: 'bb:tn15', color: 'black' }) // another hole on the same rail
    expect(computeGuide(2, ctx(w)).steps.find((s) => s.step.id.endsWith('gnd-top'))?.done).toBe(true)
  })

  it('explains a reversed LED instead of silently waiting', () => {
    const w = newWorld()
    w.circuit.usbConnected = true
    w.circuit.wires.push({ id: 'g', a: 'mcu:GND1', b: 'bb:tn1', color: 'black' })
    w.circuit.components.push({ id: 'r', type: 'resistor', variant: 220, anchor: 'bb:a3' }, { id: 'l', type: 'led', variant: 'red', anchor: 'bb:b7', flipped: true })
    const g = computeGuide(2, ctx(w))
    expect(g.current?.kind).toBe('place')
    expect(g.note).toContain('กลับด้าน')
  })

  it('skips the steps of a block the student already built their own way', () => {
    const w = newWorld()
    w.circuit = {
      usbConnected: true,
      components: [
        { id: 'r', type: 'resistor', variant: 1000, anchor: 'bb:f20' },
        { id: 'l', type: 'led', variant: 'red', anchor: 'bb:g24' },
      ],
      wires: [
        { id: '1', a: 'mcu:GPIO21', b: 'bb:j20', color: 'yellow' },
        { id: '2', a: 'bb:j25', b: 'mcu:GND2', color: 'black' },
      ],
    }
    expect(validateCircuit(w.circuit).leds[0].status).toBe('ok')
    const g = computeGuide(2, ctx(w))
    expect(g.current?.kind).toBe('power')
  })

  it('reports a short circuit while guiding', () => {
    const w = newWorld()
    w.circuit.usbConnected = true
    w.circuit.wires.push({ id: 's', a: 'mcu:3V3', b: 'mcu:GND1', color: 'red' })
    expect(computeGuide(2, ctx(w)).note).toContain('ลัดวงจร')
  })
})
