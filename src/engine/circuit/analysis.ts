/**
 * Simplified DC analysis on top of the netlist. This is a teaching model, not SPICE:
 * it follows series chains through resistors to find what drives each part.
 */
import { SUPPLY_VOLTAGE, type BoardPin } from './board'
import { LED_VF, type LedColor, type PlacedComponent } from './catalog'
import type { Net, Netlist } from './netlist'

export type TerminalKind = 'GND' | '3V3' | '5V' | 'GPIO'

export interface Terminal {
  kind: TerminalKind
  gpio?: BoardPin
  /** total series resistance between start net and this terminal */
  r: number
  resistors: string[]
}

export function terminalOf(net: Net | undefined): Omit<Terminal, 'r' | 'resistors'> | undefined {
  if (!net) return undefined
  if (net.hasGnd) return { kind: 'GND' }
  if (net.has5v) return { kind: '5V' }
  if (net.has3v3) return { kind: '3V3' }
  if (net.gpios.length) return { kind: 'GPIO', gpio: net.gpios[0] }
  return undefined
}

export const terminalVoltage = (t: TerminalKind) => (t === '5V' ? 5 : t === 'GND' ? 0 : SUPPLY_VOLTAGE)

/** Breadth-first search through resistors (only) from a start net to supply/GPIO terminals. */
export function findTerminals(nl: Netlist, comps: PlacedComponent[], start: Net | undefined): Terminal[] {
  if (!start) return []
  const resistors = comps.filter((c) => c.type === 'resistor')
  const out: Terminal[] = []
  const best = new Map<string, number>([[start.id, 0]])
  const queue: Array<{ net: Net; r: number; via: string[] }> = [{ net: start, r: 0, via: [] }]
  while (queue.length) {
    const { net, r, via } = queue.shift()!
    const t = terminalOf(net)
    if (t) {
      out.push({ ...t, r, resistors: via })
      continue // terminals are sources/sinks; don't pass through them
    }
    for (const res of resistors) {
      if (via.includes(res.id)) continue
      const n1 = nl.pinNet(res.id, '1')
      const n2 = nl.pinNet(res.id, '2')
      if (!n1 || !n2 || n1.id === n2.id) continue
      const other = n1.id === net.id ? n2 : n2.id === net.id ? n1 : undefined
      if (!other) continue
      const nr = r + Number(res.variant ?? 0)
      if ((best.get(other.id) ?? Infinity) <= nr) continue
      best.set(other.id, nr)
      queue.push({ net: other, r: nr, via: [...via, res.id] })
    }
  }
  return out.sort((a, b) => a.r - b.r)
}

const isHigh = (t: Terminal) => t.kind !== 'GND'

export type LedStatus =
  | 'ok'
  | 'no-resistor'
  | 'reversed'
  | 'incomplete'
  | 'shorted'
  | 'input-only'
  | 'active-low'
  | 'too-dim'

export interface LedAnalysis {
  compId: string
  color: LedColor
  status: LedStatus
  drive?: Terminal
  resistance?: number
  /** forward current in mA when the source is HIGH */
  currentMa?: number
  missing?: 'anode' | 'cathode' | 'both'
}

export function analyzeLed(nl: Netlist, comps: PlacedComponent[], led: PlacedComponent): LedAnalysis {
  const color = (led.variant as LedColor) ?? 'red'
  const base = { compId: led.id, color }
  const an = nl.pinNet(led.id, 'A')
  const ca = nl.pinNet(led.id, 'K')
  if (an && ca && an.id === ca.id) return { ...base, status: 'shorted' }
  const fromA = findTerminals(nl, comps, an)
  const fromK = findTerminals(nl, comps, ca)
  const highA = fromA.filter(isHigh)
  const lowK = fromK.filter((t) => t.kind === 'GND')
  if (highA.length && lowK.length) {
    // pick the strongest (lowest resistance) path: the conservative choice for safety checks
    const drive = highA[0]
    const r = drive.r + lowK[0].r
    if (drive.kind === 'GPIO' && drive.gpio && !drive.gpio.output) {
      return { ...base, status: 'input-only', drive, resistance: r }
    }
    if (r === 0) return { ...base, status: 'no-resistor', drive, resistance: 0 }
    const i = ((terminalVoltage(drive.kind) - LED_VF[color]) / r) * 1000
    return { ...base, status: i < 0.2 ? 'too-dim' : 'ok', drive, resistance: r, currentMa: Math.max(0, i) }
  }
  const highK = fromK.filter(isHigh)
  const lowA = fromA.filter((t) => t.kind === 'GND')
  if (highK.length && lowA.length) return { ...base, status: 'reversed', resistance: highK[0].r + lowA[0].r }
  const supA = fromA.find((t) => t.kind === '3V3' || t.kind === '5V')
  const gpioK = fromK.find((t) => t.kind === 'GPIO')
  if (supA && gpioK) return { ...base, status: 'active-low', drive: gpioK, resistance: supA.r + gpioK.r }
  const missing = !fromA.length && !fromK.length ? 'both' : !highA.length && !highK.length ? 'anode' : 'cathode'
  return { ...base, status: 'incomplete', missing }
}

/* ---------------- LDR voltage divider ---------------- */

export type DividerStatus =
  | 'ok'
  | 'shorted'
  | 'no-supply'
  | 'no-fixed-resistor'
  | 'no-gpio'
  | 'not-adc'
  | 'overvoltage'
  | 'input-short'

export interface DividerAnalysis {
  compId: string
  status: DividerStatus
  gpio?: BoardPin
  rFixed?: number
  fixedId?: string
  /** true when the LDR sits between VCC and the ADC node (ADC rises with light) */
  ldrOnTop?: boolean
  vin: number
}

export function analyzeLdr(nl: Netlist, comps: PlacedComponent[], ldr: PlacedComponent): DividerAnalysis {
  const base = { compId: ldr.id, vin: SUPPLY_VOLTAGE }
  const n1 = nl.pinNet(ldr.id, '1')
  const n2 = nl.pinNet(ldr.id, '2')
  if (!n1 || !n2) return { ...base, status: 'no-supply' }
  if (n1.id === n2.id) return { ...base, status: 'shorted' }
  const resistors = comps.filter((c) => c.type === 'resistor')

  const tryOrient = (end: Net, mid: Net): DividerAnalysis | undefined => {
    const t = terminalOf(end)
    if (!t || t.kind === 'GPIO') return undefined
    const ldrOnTop = t.kind !== 'GND'
    if (mid.hasGnd || mid.has3v3 || mid.has5v) return { ...base, status: 'input-short', ldrOnTop }
    // fixed resistor from mid to the opposite rail
    for (const r of resistors) {
      const a = nl.pinNet(r.id, '1')
      const b = nl.pinNet(r.id, '2')
      if (!a || !b) continue
      const other = a.id === mid.id ? b : b.id === mid.id ? a : undefined
      if (!other) continue
      const ot = terminalOf(other)
      const opposite = ldrOnTop ? ot?.kind === 'GND' : ot?.kind === '3V3' || ot?.kind === '5V'
      if (!opposite) continue
      const vin = ldrOnTop ? terminalVoltage(t.kind) : terminalVoltage(ot!.kind)
      const res = { ...base, rFixed: Number(r.variant), fixedId: r.id, ldrOnTop, vin }
      if (!mid.gpios.length) return { ...res, status: 'no-gpio' }
      const gpio = mid.gpios[0]
      if (vin > SUPPLY_VOLTAGE + 0.01) return { ...res, gpio, status: 'overvoltage' }
      if (!gpio.adc) return { ...res, gpio, status: 'not-adc' }
      return { ...res, gpio, status: 'ok' }
    }
    return {
      ...base,
      ldrOnTop,
      gpio: mid.gpios[0],
      vin: terminalVoltage(t.kind),
      status: mid.gpios.length ? 'no-fixed-resistor' : 'no-gpio',
    }
  }
  const results = [tryOrient(n1, n2), tryOrient(n2, n1)].filter(Boolean) as DividerAnalysis[]
  const order: DividerStatus[] = ['ok', 'not-adc', 'overvoltage', 'no-gpio', 'no-fixed-resistor', 'input-short']
  results.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
  if (results.length) return results[0]
  return { ...base, status: 'no-supply', gpio: n1.gpios[0] ?? n2.gpios[0] }
}

/* ---------------- 3-pin modules (DHT, soil, PIR) ---------------- */

export type ModuleProblem =
  | 'no-vcc'
  | 'no-gnd'
  | 'reversed-power'
  | 'signal-floating'
  | 'signal-shorted'
  | 'input-only'
  | 'not-adc'
  | 'adc2'
  | 'vcc-5v-logic'
  | 'needs-5v'
  | 'power-short'

export interface ModuleAnalysis {
  compId: string
  ok: boolean
  /** problems that prevent correct readings */
  errors: ModuleProblem[]
  /** works but with caveats */
  warnings: ModuleProblem[]
  gpio?: BoardPin
  vcc?: TerminalKind
}

export function analyzeModule(nl: Netlist, comp: PlacedComponent): ModuleAnalysis {
  const sigPin = comp.type === 'soil' ? 'AOUT' : comp.type === 'pir' ? 'OUT' : 'DATA'
  const vccNet = nl.pinNet(comp.id, 'VCC')
  const gndNet = nl.pinNet(comp.id, 'GND')
  const sigNet = nl.pinNet(comp.id, sigPin)
  const errors: ModuleProblem[] = []
  const warnings: ModuleProblem[] = []
  const vccT = terminalOf(vccNet)?.kind
  const gndOk = !!gndNet?.hasGnd && !gndNet.has3v3 && !gndNet.has5v
  if (vccNet && gndNet && vccNet.id === gndNet.id) errors.push('power-short')
  else if (vccT === 'GND' && (gndNet?.has3v3 || gndNet?.has5v)) errors.push('reversed-power')
  else {
    if (vccT !== '3V3' && vccT !== '5V') errors.push('no-vcc')
    if (!gndOk) errors.push('no-gnd')
  }
  let gpio: BoardPin | undefined
  if (!sigNet || (!sigNet.gpios.length && !sigNet.hasGnd && !sigNet.has3v3 && !sigNet.has5v)) {
    errors.push('signal-floating')
  } else if (sigNet.hasGnd || sigNet.has3v3 || sigNet.has5v) {
    errors.push('signal-shorted')
  } else {
    gpio = sigNet.gpios[0]
    if (comp.type === 'dht' && !gpio.output) errors.push('input-only')
    if (comp.type === 'soil') {
      if (!gpio.adc) errors.push('not-adc')
      else if (gpio.adc === 'ADC2') warnings.push('adc2')
    }
  }
  if (comp.type === 'pir' && vccT === '3V3') errors.push('needs-5v')
  if (comp.type === 'dht' && vccT === '5V') warnings.push('vcc-5v-logic')
  return { compId: comp.id, ok: errors.length === 0, errors, warnings, gpio, vcc: vccT }
}

/* ---------------- Buzzer ---------------- */

export interface BuzzerAnalysis {
  compId: string
  status: 'ok' | 'reversed' | 'incomplete' | 'shorted' | 'input-only'
  drive?: Terminal
}

export function analyzeBuzzer(nl: Netlist, comps: PlacedComponent[], bz: PlacedComponent): BuzzerAnalysis {
  const p = nl.pinNet(bz.id, 'P')
  const n = nl.pinNet(bz.id, 'N')
  if (p && n && p.id === n.id) return { compId: bz.id, status: 'shorted' }
  const fromP = findTerminals(nl, comps, p)
  const fromN = findTerminals(nl, comps, n)
  const high = fromP.find(isHigh)
  if (high && fromN.some((t) => t.kind === 'GND')) {
    if (high.kind === 'GPIO' && high.gpio && !high.gpio.output) return { compId: bz.id, status: 'input-only', drive: high }
    return { compId: bz.id, status: 'ok', drive: high }
  }
  if (fromN.some(isHigh) && fromP.some((t) => t.kind === 'GND')) return { compId: bz.id, status: 'reversed' }
  return { compId: bz.id, status: 'incomplete' }
}

/* ---------------- Fan + driver module ---------------- */

export interface FanAnalysis {
  compId: string
  status: 'via-driver' | 'direct-gpio' | 'always-on' | 'incomplete' | 'reversed' | 'driver-problem'
  driverId?: string
  gpio?: BoardPin
  /** problems of the driver module itself */
  driverIssues: Array<'no-vcc' | 'vcc-3v3' | 'no-gnd' | 'in-floating' | 'in-input-only'>
}

export function analyzeFan(nl: Netlist, comps: PlacedComponent[], fan: PlacedComponent): FanAnalysis {
  const p = nl.pinNet(fan.id, 'P')
  const n = nl.pinNet(fan.id, 'N')
  const base = { compId: fan.id, driverIssues: [] as FanAnalysis['driverIssues'] }
  const gp = p?.gpios[0] ?? n?.gpios[0]
  if (gp) return { ...base, status: 'direct-gpio', gpio: gp }
  const driver = comps.find((c) => c.type === 'driver')
  if (driver) {
    const op = nl.pinNet(driver.id, 'OUTP')
    const on = nl.pinNet(driver.id, 'OUTN')
    const forward = p && n && op && on && p.id === op.id && n.id === on.id
    const backward = p && n && op && on && p.id === on.id && n.id === op.id
    if (forward || backward) {
      const issues: FanAnalysis['driverIssues'] = []
      const vcc = nl.pinNet(driver.id, 'VCC')
      const gnd = nl.pinNet(driver.id, 'GND')
      const inn = nl.pinNet(driver.id, 'IN')
      if (!vcc?.has5v && !vcc?.has3v3) issues.push('no-vcc')
      else if (!vcc.has5v) issues.push('vcc-3v3')
      if (!gnd?.hasGnd) issues.push('no-gnd')
      const g = inn?.gpios[0]
      if (!g) issues.push('in-floating')
      else if (!g.output) issues.push('in-input-only')
      if (backward) return { ...base, status: 'reversed', driverId: driver.id, gpio: g, driverIssues: issues }
      const blocking = issues.filter((i) => i !== 'vcc-3v3')
      return { ...base, status: blocking.length ? 'driver-problem' : 'via-driver', driverId: driver.id, gpio: g, driverIssues: issues }
    }
  }
  if ((p?.has5v || p?.has3v3) && n?.hasGnd) return { ...base, status: 'always-on' }
  return { ...base, status: 'incomplete' }
}
