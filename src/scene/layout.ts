/**
 * World layout shared by rendering and hit-testing. 1 unit ≈ 10 cm (desk is 1.6 m × 0.8 m).
 * The breadboard and board are drawn ~5× larger than life so holes are easy to tap on a phone.
 */
import { BB_COLS, BB_RAILS, BB_ROWS, holeId, parseHole, type BBRail, type BBRow } from '../engine/circuit/breadboard'
import { BOARD_PINS, BOARD_PIN_MAP } from '../engine/circuit/board'
import { CATALOG, type ComponentType, type PlacedComponent, footprint, parsePinNode } from '../engine/circuit/catalog'

export type V3 = [number, number, number]

export const DESK = { w: 16, d: 8, top: 0, thickness: 0.35, floorY: -7.4 }

/* ---------- breadboard ---------- */
export const BB = {
  pitch: 0.13,
  cx: -0.55,
  cz: 0.65,
  baseH: 0.12,
  get top() {
    return this.baseH
  },
}
const ROW_Z: Record<BBRow | BBRail, number> = {
  tp: -7.6,
  tn: -6.6,
  a: -5,
  b: -4,
  c: -3,
  d: -2,
  e: -1,
  f: 1,
  g: 2,
  h: 3,
  i: 4,
  j: 5,
  bn: 6.6,
  bp: 7.6,
}
export const BB_WIDTH = (BB_COLS + 1.6) * BB.pitch
export const BB_DEPTH = 17.2 * BB.pitch
export const colX = (col: number) => BB.cx + (col - (BB_COLS + 1) / 2) * BB.pitch
export const rowZ = (row: BBRow | BBRail) => BB.cz + ROW_Z[row] * BB.pitch

export function holePos(node: string): V3 | undefined {
  const h = parseHole(node)
  if (!h) return undefined
  return [colX(h.col), BB.top, rowZ(h.kind === 'rail' ? h.rail : h.row)]
}

/** Snap a point on the breadboard plane to the nearest hole id (or undefined if too far). */
export function nearestHole(x: number, z: number, maxDist = BB.pitch * 0.75): string | undefined {
  const col = Math.round((x - BB.cx) / BB.pitch + (BB_COLS + 1) / 2)
  if (col < 1 || col > BB_COLS) return undefined
  let best: string | undefined
  let bd = Infinity
  for (const r of [...BB_ROWS, ...BB_RAILS]) {
    const d = Math.abs(rowZ(r) - z)
    if (d < bd) {
      bd = d
      best = holeId(r, col)
    }
  }
  const dx = Math.abs(colX(col) - x)
  return Math.hypot(dx, bd) <= maxDist ? best : undefined
}

/** Nearest valid anchor (main area) for placing a part. */
export function nearestAnchor(x: number, z: number): string | undefined {
  const col = Math.round((x - BB.cx) / BB.pitch + (BB_COLS + 1) / 2)
  if (col < 1 || col > BB_COLS) return undefined
  let best: BBRow | undefined
  let bd = Infinity
  for (const r of BB_ROWS) {
    const d = Math.abs(rowZ(r) - z)
    if (d < bd) {
      bd = d
      best = r
    }
  }
  return bd < BB.pitch * 2 && best ? holeId(best, col) : undefined
}

/* ---------- microcontroller board ---------- */
export const BOARD = { cx: -3.55, cz: 0.65, w: 1.05, l: 3.2, h: 0.32, pinPitch: 0.2 }
export function boardPinPos(pinId: string): V3 | undefined {
  const p = BOARD_PIN_MAP[pinId]
  if (!p) return undefined
  const x = BOARD.cx + (p.side === 'L' ? -1 : 1) * (BOARD.w / 2 - 0.1)
  const z = BOARD.cz - BOARD.l / 2 + 0.35 + p.index * BOARD.pinPitch
  return [x, BOARD.h * 0.63 + 0.12, z]
}
export const USB_PORT: V3 = [BOARD.cx, BOARD.h * 0.6, BOARD.cz - BOARD.l / 2 - 0.05]
export const CHIP_POS: V3 = [BOARD.cx, BOARD.h + 0.1, BOARD.cz + 0.4]

/* ---------- off-board modules (fixed spots) ---------- */
export const SPOTS = {
  driver: { pos: [2.2, 0, 2.6] as V3, rotY: 0 },
  fan: { pos: [3.75, 0, 2.35] as V3, rotY: -0.35 },
  deskFan: { pos: [7.0, 0, 0.7] as V3, rotY: -Math.PI / 2 + 0.25 },
  plant: { pos: [5.6, 0, 2.7] as V3, rotY: 0 },
  soil: { pos: [5.6, 0, 2.7] as V3, rotY: 0 },
  pir: { pos: [2.7, 0, -1.7] as V3, rotY: 0.3 },
  heater: { pos: [6.6, 0, -1.6] as V3, rotY: -0.6 },
  lamp: { pos: [-0.8, 0, -2.9] as V3, rotY: 0 },
  monitor: { pos: [2.9, 0, -3.0] as V3, rotY: -0.18 },
  psu: { pos: [6.6, 0, -3.3] as V3, rotY: -0.3 },
  multimeter: { pos: [-6.4, 0, 2.6] as V3, rotY: 0.4 },
  iron: { pos: [-5.0, 0, 3.1] as V3, rotY: 0.2 },
  magnifier: { pos: [-6.9, 0, 0.2] as V3, rotY: 0.5 },
}
/** header pin positions relative to each module origin (local, before rotation) */
const MODULE_PINS: Record<'driver' | 'pir' | 'soil' | 'fan', Record<string, V3>> = {
  driver: { VCC: [-0.36, 0.22, -0.32], GND: [-0.12, 0.22, -0.32], IN: [0.12, 0.22, -0.32], OUTP: [-0.18, 0.28, 0.34], OUTN: [0.18, 0.28, 0.34] },
  pir: { VCC: [-0.2, 0.62, 0.32], OUT: [0, 0.62, 0.32], GND: [0.2, 0.62, 0.32] },
  soil: { VCC: [-0.2, 1.62, -0.25], GND: [0, 1.62, -0.25], AOUT: [0.2, 1.62, -0.25] },
  fan: { P: [-0.12, 0.25, 0.55], N: [0.12, 0.25, 0.55] },
}
export const SOIL_SENSOR_OFFSET: V3 = [0, 0, -0.25]

function rotY([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, y, -x * s + z * c]
}
export function modulePinPos(type: ComponentType, pin: string): V3 | undefined {
  const table = MODULE_PINS[type as keyof typeof MODULE_PINS]
  const spot = SPOTS[type as keyof typeof SPOTS]
  if (!table || !spot || !table[pin]) return undefined
  const r = rotY(table[pin], spot.rotY)
  return [spot.pos[0] + r[0], spot.pos[1] + r[1], spot.pos[2] + r[2]]
}

/** World position of any wire endpoint node. */
export function nodePos(node: string, comps: PlacedComponent[]): V3 | undefined {
  if (node.startsWith('bb:')) return holePos(node)
  if (node.startsWith('mcu:')) return boardPinPos(node.slice(4))
  const p = parsePinNode(node)
  if (!p) return undefined
  const c = comps.find((x) => x.id === p.compId)
  if (!c) return undefined
  if (CATALOG[c.type].onBreadboard) {
    const fp = footprint(c)
    return fp ? holePos(fp[p.pin]) : undefined
  }
  return modulePinPos(c.type, p.pin)
}

/* ---------- shelf ---------- */
export const SHELF = { x0: -7.4, x1: -1.6, z: -3.45, tiers: [0.95, 2.05], depth: 0.9 }
export const SHELF_ORDER = [
  'board',
  'breadboard',
  'jumper',
  'usb',
  'led',
  'resistor',
  'multimeter',
  'dht',
  'ldr',
  'soil',
  'pir',
  'buzzer',
  'driver',
  'fan',
] as const
export function binPos(i: number): V3 {
  const perTier = 7
  const tier = Math.floor(i / perTier)
  const k = i % perTier
  const w = (SHELF.x1 - SHELF.x0) / perTier
  return [SHELF.x0 + w * (k + 0.5), SHELF.tiers[tier], SHELF.z]
}
export const BIN_W = (SHELF.x1 - SHELF.x0) / 7

/* ---------- cameras ---------- */
export type CameraPreset = 'overview' | 'shelf' | 'breadboard' | 'monitor'
export const CAMERAS: Record<CameraPreset, { pos: V3; target: V3; th: string }> = {
  overview: { pos: [0.6, 7.2, 10.5], target: [0, 0.3, 0], th: 'ภาพรวม' },
  shelf: { pos: [-4.5, 3.4, 3.2], target: [-4.5, 1.5, -3.4], th: 'ชั้นวาง' },
  breadboard: { pos: [-1.4, 4.4, 4.0], target: [-1.4, 0, 0.75], th: 'เบรดบอร์ด' },
  monitor: { pos: [2.6, 2.4, 1.4], target: [2.9, 1.5, -3.0], th: 'จอมอนิเตอร์' },
}

export const allBoardPins = BOARD_PINS
