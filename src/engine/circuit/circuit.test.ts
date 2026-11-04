import { describe, expect, it } from 'vitest'
import { stripOf } from './breadboard'
import { footprint, type PlacedComponent } from './catalog'
import { buildNetlist, type CircuitState, type Wire } from './netlist'
import { SOLUTIONS } from './solutions'
import { validateCircuit } from './validator'

let wid = 0
const W = (a: string, b: string, color: Wire['color'] = 'yellow'): Wire => ({ id: `t${++wid}`, a, b, color })
const C = (components: PlacedComponent[], wires: Wire[], usb = true): CircuitState => ({ components, wires, usbConnected: usb })
const codes = (s: CircuitState) => validateCircuit(s).issues.map((i) => i.code)

describe('breadboard internal connections', () => {
  it('connects a–e in a column, f–j in a column, and not across the gap', () => {
    expect(stripOf('bb:a5')).toBe(stripOf('bb:e5'))
    expect(stripOf('bb:f5')).toBe(stripOf('bb:j5'))
    expect(stripOf('bb:e5')).not.toBe(stripOf('bb:f5'))
    expect(stripOf('bb:a5')).not.toBe(stripOf('bb:a6'))
  })
  it('connects power rails along their whole length', () => {
    expect(stripOf('bb:tp1')).toBe(stripOf('bb:tp30'))
    expect(stripOf('bb:tp1')).not.toBe(stripOf('bb:tn1'))
  })
  it('places component pins per footprint and flips', () => {
    const led: PlacedComponent = { id: 'l', type: 'led', variant: 'red', anchor: 'bb:c10' }
    expect(footprint(led)).toEqual({ A: 'bb:c10', K: 'bb:c11' })
    expect(footprint({ ...led, flipped: true })).toEqual({ K: 'bb:c10', A: 'bb:c11' })
    expect(footprint({ id: 'r', type: 'resistor', variant: 220, anchor: 'bb:a28' })).toBeNull()
  })
})

describe('netlist', () => {
  it('joins a wire to a hole and through the strip to a component pin', () => {
    const s = C([{ id: 'r', type: 'resistor', variant: 220, anchor: 'bb:a3' }], [W('mcu:GPIO18', 'bb:e3')])
    const nl = buildNetlist(s)
    const net = nl.pinNet('r', '1')!
    expect(net.gpios.map((g) => g.gpio)).toEqual([18])
    expect(nl.pinNet('r', '2')!.gpios).toHaveLength(0)
  })
  it('ties board ground pins together internally', () => {
    const nl = buildNetlist(C([], []))
    expect(nl.netOf('mcu:GND1')).toBe(nl.netOf('mcu:GND3'))
  })
})

describe('validator: power', () => {
  it('detects missing USB', () => {
    expect(codes(C([], [], false))).toContain('no-usb')
  })
  it('detects a direct 3V3–GND short and cuts power', () => {
    const r = validateCircuit(C([], [W('mcu:3V3', 'bb:tp1', 'red'), W('mcu:GND1', 'bb:tp5', 'black')]))
    expect(r.shorted).toBe(true)
    expect(r.issues[0].code).toBe('short-vcc-gnd')
    expect(r.issues[0].severity).toBe('danger')
  })
  it('detects 3V3 shorted to 5V', () => {
    expect(validateCircuit(C([], [W('mcu:3V3', 'mcu:5V')])).shorted).toBe(true)
  })
})

describe('validator: LED', () => {
  it('reference circuit is correct with ≈5.9 mA through 220 Ω', () => {
    const r = validateCircuit(SOLUTIONS.led())
    expect(r.leds[0].status).toBe('ok')
    expect(r.leds[0].currentMa).toBeCloseTo(((3.3 - 2.0) / 220) * 1000, 3)
    expect(r.leds[0].drive?.gpio?.gpio).toBe(18)
    expect(r.issues.filter((i) => i.severity === 'error' || i.severity === 'danger')).toHaveLength(0)
  })
  it('computes current for 1 kΩ and 10 kΩ', () => {
    const s = SOLUTIONS.led()
    s.components[0].variant = 1000
    expect(validateCircuit(s).leds[0].currentMa).toBeCloseTo(1.3, 3)
    s.components[0].variant = 10000
    const r = validateCircuit(s)
    expect(r.leds[0].currentMa).toBeCloseTo(0.13, 3)
    expect(r.leds[0].status).toBe('too-dim')
  })
  it('green LED with 220 Ω gets ≈1.4 mA (higher V_f)', () => {
    const s = SOLUTIONS.led()
    s.components[1].variant = 'green'
    expect(validateCircuit(s).leds[0].currentMa).toBeCloseTo(((3.3 - 3.0) / 220) * 1000, 3)
  })
  it('flags a missing current-limiting resistor', () => {
    const s = C(
      [{ id: 'l', type: 'led', variant: 'red', anchor: 'bb:b7' }],
      [W('mcu:GPIO18', 'bb:c7'), W('bb:c8', 'bb:tn8', 'black'), W('mcu:GND1', 'bb:tn1', 'black')],
    )
    const r = validateCircuit(s)
    expect(r.leds[0].status).toBe('no-resistor')
    expect(codes(s)).toContain('led-no-resistor')
  })
  it('flags a reversed LED', () => {
    const s = SOLUTIONS.led()
    s.components[1].flipped = true
    expect(validateCircuit(s).leds[0].status).toBe('reversed')
  })
  it('flags an LED driven from an input-only pin', () => {
    const s = SOLUTIONS.led()
    s.wires = s.wires.map((w) => (w.a === 'mcu:GPIO18' ? { ...w, a: 'mcu:GPIO34' } : w))
    expect(validateCircuit(s).leds[0].status).toBe('input-only')
  })
  it('flags a missing ground', () => {
    const s = SOLUTIONS.led()
    s.wires = s.wires.filter((w) => w.b !== 'bb:tn8')
    const r = validateCircuit(s)
    expect(r.leds[0].status).toBe('incomplete')
    expect(r.leds[0].missing).toBe('cathode')
  })
  it('placing both legs in one column shorts the LED', () => {
    const s = SOLUTIONS.led()
    s.wires.push(W('bb:d7', 'bb:d8'))
    expect(validateCircuit(s).leds[0].status).toBe('shorted')
  })
})

describe('validator: sensors', () => {
  it('DHT reference circuit is correct', () => {
    const r = validateCircuit(SOLUTIONS.dht())
    const m = r.modules['dht1']
    expect(m.ok).toBe(true)
    expect(m.gpio?.gpio).toBe(4)
  })
  it('DHT without VCC / GND / DATA', () => {
    const base = SOLUTIONS.dht()
    const noVcc = { ...base, wires: base.wires.filter((w) => w.a !== 'bb:tp24') }
    expect(validateCircuit(noVcc).modules['dht1'].errors).toContain('no-vcc')
    const noGnd = { ...base, wires: base.wires.filter((w) => w.a !== 'bb:b26') }
    expect(validateCircuit(noGnd).modules['dht1'].errors).toContain('no-gnd')
    const noData = { ...base, wires: base.wires.filter((w) => w.a !== 'mcu:GPIO4') }
    expect(validateCircuit(noData).modules['dht1'].errors).toContain('signal-floating')
    expect(codes(noData)).toContain('dht-signal-floating')
  })
  it('DHT DATA on an input-only pin is an error; 5V supply is a warning', () => {
    const s = SOLUTIONS.dht()
    s.wires = s.wires.map((w) => (w.a === 'mcu:GPIO4' ? { ...w, a: 'mcu:GPIO35' } : w))
    expect(validateCircuit(s).modules['dht1'].errors).toContain('input-only')
    const s5 = SOLUTIONS.dht()
    s5.wires = s5.wires.map((w) => (w.a === 'bb:tp24' ? { ...w, a: 'mcu:5V' } : w))
    const m = validateCircuit(s5).modules['dht1']
    expect(m.ok).toBe(true)
    expect(m.warnings).toContain('vcc-5v-logic')
  })
  it('LDR divider is recognised in both orientations', () => {
    const r = validateCircuit(SOLUTIONS.ldr())
    expect(r.ldrs[0].status).toBe('ok')
    expect(r.ldrs[0].ldrOnTop).toBe(true)
    expect(r.ldrs[0].rFixed).toBe(10000)
    // swap the rails: LDR to GND, resistor to 3V3
    const s = SOLUTIONS.ldr()
    s.wires = s.wires.map((w) => (w.a === 'bb:bp20' ? { ...w, a: 'bb:bn20' } : w.a === 'bb:h26' ? { ...w, b: 'bb:bp26' } : w))
    const r2 = validateCircuit(s)
    expect(r2.ldrs[0].status).toBe('ok')
    expect(r2.ldrs[0].ldrOnTop).toBe(false)
  })
  it('LDR on a non-ADC pin, and without the fixed resistor', () => {
    const s = SOLUTIONS.ldr()
    s.wires = s.wires.map((w) => (w.a === 'mcu:GPIO34' ? { ...w, a: 'mcu:GPIO18' } : w))
    // GPIO18 is also used by the LED in this circuit; the LDR still must be flagged not-ADC
    expect(validateCircuit(s).ldrs[0].status).toBe('not-adc')
    const s2 = SOLUTIONS.ldr()
    s2.components = s2.components.filter((c) => c.id !== 'r3')
    expect(validateCircuit(s2).ldrs[0].status).toBe('no-fixed-resistor')
  })
  it('soil sensor on non-ADC pin is an error, ADC2 is a warning', () => {
    const s = SOLUTIONS.plant()
    expect(validateCircuit(s).modules['soil1'].ok).toBe(true)
    s.wires = s.wires.map((w) => (w.a === 'mcu:GPIO32' ? { ...w, a: 'mcu:GPIO21' } : w))
    expect(validateCircuit(s).modules['soil1'].errors).toContain('not-adc')
    const s2 = SOLUTIONS.plant()
    s2.wires = s2.wires.map((w) => (w.a === 'mcu:GPIO32' ? { ...w, a: 'mcu:GPIO25' } : w))
    expect(validateCircuit(s2).modules['soil1'].warnings).toContain('adc2')
  })
  it('PIR needs 5V', () => {
    const s = C([{ id: 'p', type: 'pir', anchor: null }], [W('mcu:3V3', 'cmp:p:VCC'), W('mcu:GND1', 'cmp:p:GND'), W('mcu:GPIO27', 'cmp:p:OUT')])
    expect(validateCircuit(s).modules['p'].errors).toContain('needs-5v')
    s.wires[0] = W('mcu:5V', 'cmp:p:VCC')
    expect(validateCircuit(s).modules['p'].ok).toBe(true)
  })
  it('reversed power on a module is dangerous', () => {
    const s = C([{ id: 'p', type: 'soil', anchor: null }], [W('mcu:GND1', 'cmp:p:VCC'), W('mcu:3V3', 'cmp:p:GND'), W('mcu:GPIO32', 'cmp:p:AOUT')])
    expect(validateCircuit(s).modules['p'].errors).toContain('reversed-power')
  })
})

describe('validator: fan / high current load', () => {
  it('fan through the driver module is correct', () => {
    const r = validateCircuit(SOLUTIONS.classroom())
    expect(r.fans[0].status).toBe('via-driver')
    expect(r.fans[0].gpio?.gpio).toBe(26)
    expect(r.issues.filter((i) => i.severity === 'error' || i.severity === 'danger')).toHaveLength(0)
  })
  it('fan wired straight to a GPIO is flagged', () => {
    const s = C([{ id: 'f', type: 'fan', anchor: null }], [W('mcu:GPIO26', 'cmp:f:P'), W('mcu:GND1', 'cmp:f:N')])
    expect(validateCircuit(s).fans[0].status).toBe('direct-gpio')
    expect(codes(s)).toContain('fan-direct-gpio')
  })
  it('driver without IN signal is flagged', () => {
    const s = SOLUTIONS.classroom()
    s.wires = s.wires.filter((w) => w.b !== 'cmp:drv1:IN')
    const r = validateCircuit(s)
    expect(r.fans[0].status).toBe('driver-problem')
    expect(r.fans[0].driverIssues).toContain('in-floating')
  })
})

describe('validator: buzzer', () => {
  it('plant reference has a working buzzer, reversed buzzer is flagged', () => {
    const s = SOLUTIONS.plant()
    expect(validateCircuit(s).buzzers[0].status).toBe('ok')
    s.components = s.components.map((c) => (c.type === 'buzzer' ? { ...c, flipped: true } : c))
    expect(validateCircuit(s).buzzers[0].status).toBe('reversed')
  })
})
