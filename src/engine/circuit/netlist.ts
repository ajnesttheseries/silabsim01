import { BOARD_PINS, BOARD_PIN_MAP, boardNode, type BoardPin } from './board'
import { stripOf } from './breadboard'
import { CATALOG, footprint, pinNode, type PlacedComponent } from './catalog'

export type WireColor = 'red' | 'black' | 'yellow' | 'green' | 'blue' | 'orange' | 'white'

export interface Wire {
  id: string
  a: string
  b: string
  color: WireColor
}

export interface CircuitState {
  components: PlacedComponent[]
  wires: Wire[]
  usbConnected: boolean
}

export const emptyCircuit = (): CircuitState => ({ components: [], wires: [], usbConnected: false })

class UnionFind {
  private parent = new Map<string, string>()
  find(x: string): string {
    let p = this.parent.get(x)
    if (p === undefined) {
      this.parent.set(x, x)
      return x
    }
    if (p === x) return x
    p = this.find(p)
    this.parent.set(x, p)
    return p
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
  keys() {
    return [...this.parent.keys()]
  }
}

export interface Net {
  id: string
  nodes: string[]
  boardPins: BoardPin[]
  /** component pin nodes (cmp:id:pin) on this net */
  compPins: string[]
  hasGnd: boolean
  has3v3: boolean
  has5v: boolean
  /** GPIO pins attached to this net */
  gpios: BoardPin[]
}

export interface Netlist {
  nets: Net[]
  netOf(node: string): Net | undefined
  /** Net of a component pin */
  pinNet(compId: string, pin: string): Net | undefined
  /** Map component pin → physical hole (for on-board parts) */
  pinHole: Record<string, string>
  /** Holes occupied by components */
  occupied: Record<string, string>
}

/** Builds the netlist from placed components, wires and internal breadboard/board connections. */
export function buildNetlist(state: CircuitState): Netlist {
  const uf = new UnionFind()
  const pinHole: Record<string, string> = {}
  const occupied: Record<string, string> = {}

  // Board pins always exist; board ground pins are connected internally, as are both 3V3 pins.
  for (const p of BOARD_PINS) uf.find(boardNode(p.id))
  uf.union(boardNode('GND1'), boardNode('GND2'))
  uf.union(boardNode('GND1'), boardNode('GND3'))
  uf.union(boardNode('3V3'), boardNode('3V3B'))

  const touchHole = (hole: string) => {
    uf.find(hole)
    const s = stripOf(hole)
    if (s) uf.union(hole, s)
  }

  for (const c of state.components) {
    const e = CATALOG[c.type]
    for (const p of e.pinDefs ?? []) uf.find(pinNode(c.id, p.id))
    const fp = footprint(c)
    if (fp) {
      for (const [pin, hole] of Object.entries(fp)) {
        const n = pinNode(c.id, pin)
        pinHole[n] = hole
        occupied[hole] = c.id
        touchHole(hole)
        uf.union(n, hole)
      }
    }
    // Driver module: OUT+ is internally tied to VCC (low-side switch on OUT−).
    if (c.type === 'driver') uf.union(pinNode(c.id, 'OUTP'), pinNode(c.id, 'VCC'))
  }

  for (const w of state.wires) {
    for (const end of [w.a, w.b]) if (end.startsWith('bb:')) touchHole(end)
    uf.union(w.a, w.b)
  }

  const groups = new Map<string, string[]>()
  for (const k of uf.keys()) {
    if (k.startsWith('strip:')) continue
    const r = uf.find(k)
    const g = groups.get(r)
    if (g) g.push(k)
    else groups.set(r, [k])
  }

  const nets: Net[] = []
  const byNode = new Map<string, Net>()
  for (const [root, nodes] of groups) {
    const boardPins = nodes.filter((n) => n.startsWith('mcu:')).map((n) => BOARD_PIN_MAP[n.slice(4)])
    const net: Net = {
      id: root,
      nodes,
      boardPins,
      compPins: nodes.filter((n) => n.startsWith('cmp:')),
      hasGnd: boardPins.some((p) => p.power === 'GND'),
      has3v3: boardPins.some((p) => p.power === '3V3'),
      has5v: boardPins.some((p) => p.power === '5V'),
      gpios: boardPins.filter((p) => p.gpio !== undefined),
    }
    nets.push(net)
    for (const n of nodes) byNode.set(n, net)
  }

  return {
    nets,
    netOf: (node) => byNode.get(node) ?? (stripOf(node) ? byNode.get(uf.find(node)) : undefined),
    pinNet: (compId, pin) => byNode.get(pinNode(compId, pin)),
    pinHole,
    occupied,
  }
}

/** Nodes connected to a given node (for highlighting a whole net). */
export function connectedNodes(nl: Netlist, node: string): string[] {
  return nl.netOf(node)?.nodes ?? [node]
}
