/** Reference ("answer") circuits used by hint level 3 and by unit tests. */
import type { PlacedComponent } from './catalog'
import type { CircuitState, Wire, WireColor } from './netlist'

let n = 0
const w = (a: string, b: string, color: WireColor): Wire => ({ id: `sw${++n}`, a, b, color })

const RAILS_TOP: Wire[] = [w('mcu:3V3', 'bb:tp1', 'red'), w('mcu:GND1', 'bb:tn1', 'black')]
const RAILS_BOTTOM: Wire[] = [w('mcu:3V3B', 'bb:bp1', 'red'), w('mcu:GND3', 'bb:bn1', 'black')]

export const LED_RED: { comps: PlacedComponent[]; wires: Wire[] } = {
  comps: [
    { id: 'r1', type: 'resistor', variant: 220, anchor: 'bb:a3' },
    { id: 'led1', type: 'led', variant: 'red', anchor: 'bb:b7' },
  ],
  wires: [w('mcu:GPIO18', 'bb:c3', 'yellow'), w('bb:c8', 'bb:tn8', 'black')],
}

export const LED_GREEN = {
  comps: [
    { id: 'r2', type: 'resistor', variant: 220, anchor: 'bb:a10' },
    { id: 'led2', type: 'led', variant: 'green', anchor: 'bb:b14' },
  ] as PlacedComponent[],
  wires: [w('mcu:GPIO19', 'bb:c10', 'green'), w('bb:c15', 'bb:tn15', 'black')],
}

export const DHT = {
  comps: [{ id: 'dht1', type: 'dht', anchor: 'bb:a24' }] as PlacedComponent[],
  wires: [w('bb:tp24', 'bb:b24', 'red'), w('mcu:GPIO4', 'bb:b25', 'yellow'), w('bb:b26', 'bb:tn26', 'black')],
}

export const LDR = {
  comps: [
    { id: 'ldr1', type: 'ldr', anchor: 'bb:f20' },
    { id: 'r3', type: 'resistor', variant: 10000, anchor: 'bb:g22' },
  ] as PlacedComponent[],
  wires: [w('bb:bp20', 'bb:h20', 'red'), w('mcu:GPIO34', 'bb:h22', 'orange'), w('bb:h26', 'bb:bn26', 'black')],
}

export const BUZZER = {
  comps: [{ id: 'bz1', type: 'buzzer', anchor: 'bb:f5' }] as PlacedComponent[],
  wires: [w('mcu:GPIO23', 'bb:g5', 'blue'), w('bb:g7', 'bb:bn7', 'black')],
}

export const FAN = {
  comps: [
    { id: 'drv1', type: 'driver', anchor: null },
    { id: 'fan1', type: 'fan', anchor: null },
  ] as PlacedComponent[],
  wires: [
    w('mcu:5V', 'cmp:drv1:VCC', 'red'),
    w('bb:tn28', 'cmp:drv1:GND', 'black'),
    w('mcu:GPIO26', 'cmp:drv1:IN', 'yellow'),
    w('cmp:drv1:OUTP', 'cmp:fan1:P', 'red'),
    w('cmp:drv1:OUTN', 'cmp:fan1:N', 'black'),
  ],
}

export const SOIL = {
  comps: [{ id: 'soil1', type: 'soil', anchor: null }] as PlacedComponent[],
  wires: [w('bb:tp29', 'cmp:soil1:VCC', 'red'), w('bb:tn29', 'cmp:soil1:GND', 'black'), w('mcu:GPIO32', 'cmp:soil1:AOUT', 'green')],
}

export const PIR = {
  comps: [{ id: 'pir1', type: 'pir', anchor: null }] as PlacedComponent[],
  wires: [w('mcu:5V', 'cmp:pir1:VCC', 'red'), w('bb:bn29', 'cmp:pir1:GND', 'black'), w('mcu:GPIO27', 'cmp:pir1:OUT', 'white')],
}

type Part = { comps: PlacedComponent[]; wires: Wire[] }
function compose(parts: Part[], rails: Wire[]): CircuitState {
  return {
    usbConnected: true,
    components: parts.flatMap((p) => p.comps.map((c) => ({ ...c }))),
    wires: [...rails, ...parts.flatMap((p) => p.wires)].map((x) => ({ ...x })),
  }
}

export const SOLUTIONS = {
  led: () => compose([LED_RED], RAILS_TOP),
  dht: () => compose([LED_RED, DHT], RAILS_TOP),
  ldr: () => compose([LED_RED, DHT, LDR], [...RAILS_TOP, ...RAILS_BOTTOM]),
  classroom: () => compose([LED_RED, DHT, LDR, FAN], [...RAILS_TOP, ...RAILS_BOTTOM]),
  plant: () => compose([LED_RED, LED_GREEN, BUZZER, SOIL], [...RAILS_TOP, ...RAILS_BOTTOM]),
}
export type SolutionKey = keyof typeof SOLUTIONS
