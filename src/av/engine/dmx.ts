/**
 * DMX512 lighting model. One universe = 512 channels, each 0–255.
 * A fixture with start address A and footprint N listens to channels A … A+N−1.
 * The console patch (where the console *thinks* each fixture is) is fixed;
 * students must set each fixture's own address to match it.
 */
import type { DeviceId } from './patch'

export const UNIVERSE = 512

export type FixtureType = 'par' | 'mover'
export const PROFILE: Record<FixtureType, string[]> = {
  par: ['Dimmer', 'Red', 'Green', 'Blue'],
  mover: ['Pan', 'Tilt', 'Dimmer', 'Red', 'Green', 'Blue'],
}
export const PROFILE_TH: Record<string, string> = { Dimmer: 'ความสว่าง', Red: 'แดง', Green: 'เขียว', Blue: 'น้ำเงิน', Pan: 'ส่ายซ้าย-ขวา', Tilt: 'ก้ม-เงย' }

export const FIXTURES: Array<{ id: DeviceId; type: FixtureType }> = [
  { id: 'par1', type: 'par' },
  { id: 'par2', type: 'par' },
  { id: 'par3', type: 'par' },
  { id: 'par4', type: 'par' },
  { id: 'mover1', type: 'mover' },
  { id: 'mover2', type: 'mover' },
]
export const fixtureType = (id: string): FixtureType => (id.startsWith('mover') ? 'mover' : 'par')
export const footprintOf = (id: string) => PROFILE[fixtureType(id)].length

/** Where the console is programmed to find each fixture (addresses are 1-based). */
export const CONSOLE_PATCH: Record<string, number> = { par1: 1, par2: 5, par3: 9, par4: 13, mover1: 17, mover2: 23 }
/** Fixtures leave the factory at address 1. */
export const defaultAddresses = (): Record<string, number> => Object.fromEntries(FIXTURES.map((f) => [f.id, 1]))

/** Console fader values per fixture, in profile order (0–255). */
export type ConsoleValues = Record<string, number[]>
export const defaultConsole = (): ConsoleValues =>
  Object.fromEntries(FIXTURES.map((f) => [f.id, f.type === 'par' ? [0, 0, 0, 0] : [128, 96, 0, 255, 255, 255]]))

export function buildUniverse(values: ConsoleValues): number[] {
  const u = new Array<number>(UNIVERSE).fill(0)
  for (const [id, vals] of Object.entries(values)) {
    const start = CONSOLE_PATCH[id]
    vals.forEach((v, i) => {
      const ch = start - 1 + i
      if (ch >= 0 && ch < UNIVERSE) u[ch] = Math.max(0, Math.min(255, Math.round(v)))
    })
  }
  return u
}

export interface FixtureOutput {
  /** 0–1 light colour after dimming */
  r: number
  g: number
  b: number
  intensity: number
  /** degrees */
  pan: number
  tilt: number
  receiving: boolean
  flicker: boolean
}

/** What a fixture actually does: it reads channels from *its own* address. */
export function fixtureOutput(id: string, address: number, universe: number[], receiving: boolean, terminated: boolean, noise = 0): FixtureOutput {
  const t = fixtureType(id)
  const prof = PROFILE[t]
  const read = (name: string) => {
    const ch = address - 1 + prof.indexOf(name)
    return ch >= 0 && ch < UNIVERSE ? universe[ch] : 0
  }
  if (!receiving) return { r: 0, g: 0, b: 0, intensity: 0, pan: 0, tilt: 0, receiving: false, flicker: false }
  // unterminated line: reflections corrupt some frames
  const flicker = !terminated && noise > 0.82
  const dim = flicker ? (noise - 0.82) / 0.18 : read('Dimmer') / 255
  const r = (read('Red') / 255) * dim
  const g = (read('Green') / 255) * dim
  const b = (read('Blue') / 255) * dim
  const pan = t === 'mover' ? ((read('Pan') - 128) / 128) * 90 : 0
  const tilt = t === 'mover' ? (read('Tilt') / 255) * 90 : 0
  return { r, g, b, intensity: Math.max(r, g, b), pan, tilt, receiving: true, flicker }
}

export interface AddressIssue {
  severity: 'error' | 'warning' | 'ok'
  code: string
  message: string
  explain?: string
  fixtures: string[]
}

export function checkAddresses(addr: Record<string, number>): AddressIssue[] {
  const out: AddressIssue[] = []
  const ids = FIXTURES.map((f) => f.id)
  for (const id of ids) {
    const a = addr[id]
    const n = footprintOf(id)
    if (!Number.isInteger(a) || a < 1 || a + n - 1 > UNIVERSE)
      out.push({ severity: 'error', code: 'addr-range', message: `${id.toUpperCase()}: address ${a} ใช้ไม่ได้`, explain: `ต้องอยู่ระหว่าง 1 ถึง ${UNIVERSE - n + 1} เพราะไฟดวงนี้ใช้ ${n} ช่อง`, fixtures: [id] })
  }
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a1 = addr[ids[i]]
      const a2 = addr[ids[j]]
      const e1 = a1 + footprintOf(ids[i]) - 1
      const e2 = a2 + footprintOf(ids[j]) - 1
      if (a1 <= e2 && a2 <= e1)
        out.push({
          severity: 'warning',
          code: 'addr-overlap',
          message: `${ids[i].toUpperCase()} (ช่อง ${a1}–${e1}) ทับช่องกับ ${ids[j].toUpperCase()} (ช่อง ${a2}–${e2})`,
          explain: 'ไฟที่ฟังช่องเดียวกันจะทำงานตามกัน สั่งแยกกันไม่ได้ ให้ตั้ง address ดวงถัดไป = address ดวงก่อน + จำนวนช่องของดวงก่อน',
          fixtures: [ids[i], ids[j]],
        })
    }
  for (const id of ids)
    if (addr[id] !== CONSOLE_PATCH[id])
      out.push({
        severity: 'error',
        code: 'addr-mismatch',
        message: `${id.toUpperCase()} ตั้ง address ${addr[id]} แต่คอนโซลส่งคำสั่งให้ที่ช่อง ${CONSOLE_PATCH[id]}`,
        explain: 'ไฟจะอ่านคำสั่งผิดช่อง เช่น อ่านค่าสีของไฟดวงอื่นแทน',
        fixtures: [id],
      })
  if (!out.length) out.push({ severity: 'ok', code: 'addr-ok', message: 'ตั้ง DMX address ตรงกับคอนโซลครบทุกดวง และไม่มีช่องทับกัน', fixtures: ids })
  return out
}

/* ---------------- colour ---------------- */

export type ColorName = 'black' | 'red' | 'green' | 'blue' | 'yellow' | 'magenta' | 'cyan' | 'white' | 'amber' | 'mixed'
export const COLOR_TH: Record<ColorName, string> = {
  black: 'ดับ (ดำ)',
  red: 'แดง',
  green: 'เขียว',
  blue: 'น้ำเงิน',
  yellow: 'เหลือง',
  magenta: 'ม่วงแดง (Magenta)',
  cyan: 'ฟ้า (Cyan)',
  white: 'ขาว',
  amber: 'ส้ม (Amber)',
  mixed: 'สีผสมอื่น',
}
export const COLOR_RGB: Record<Exclude<ColorName, 'mixed'>, [number, number, number]> = {
  black: [0, 0, 0],
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  magenta: [255, 0, 255],
  cyan: [0, 255, 255],
  white: [255, 255, 255],
  amber: [255, 128, 0],
}

/** Classify an RGB light (0–1 each) into a named additive colour. */
export function colorName(r: number, g: number, b: number): ColorName {
  const m = Math.max(r, g, b)
  if (m < 0.08) return 'black'
  const on = (x: number) => x / m > 0.6
  const off = (x: number) => x / m < 0.25
  const R = on(r)
  const G = on(g)
  const B = on(b)
  if (R && G && B) return 'white'
  if (R && G && off(b)) return 'yellow'
  if (R && B && off(g)) return 'magenta'
  if (G && B && off(r)) return 'cyan'
  if (R && off(g) && off(b)) return 'red'
  if (G && off(r) && off(b)) return 'green'
  if (B && off(r) && off(g)) return 'blue'
  if (R && g / m > 0.3 && g / m <= 0.6 && off(b)) return 'amber'
  return 'mixed'
}
