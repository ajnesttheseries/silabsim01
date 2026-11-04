/**
 * Half-size breadboard: 30 columns, rows a–e (top half) and f–j (bottom half),
 * plus two power rails on each side (top: tp/tn, bottom: bp/bn).
 * Internal connections match a real breadboard:
 *   - a..e of the same column are connected; f..j of the same column are connected
 *   - each rail line is connected along its full length
 *   - the centre gap separates e from f
 */
export const BB_COLS = 30
export const BB_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const
export type BBRow = (typeof BB_ROWS)[number]
export const BB_RAILS = ['tp', 'tn', 'bp', 'bn'] as const
export type BBRail = (typeof BB_RAILS)[number]

export const RAIL_LABEL: Record<BBRail, string> = {
  tp: 'ราง + บน',
  tn: 'ราง − บน',
  bp: 'ราง + ล่าง',
  bn: 'ราง − ล่าง',
}

export type Hole =
  | { kind: 'main'; row: BBRow; col: number }
  | { kind: 'rail'; rail: BBRail; col: number }

export const holeId = (row: BBRow | BBRail, col: number) => `bb:${row}${col}`

export function parseHole(node: string): Hole | undefined {
  const m = /^bb:(tp|tn|bp|bn|[a-j])(\d+)$/.exec(node)
  if (!m) return undefined
  const col = Number(m[2])
  if (col < 1 || col > BB_COLS) return undefined
  if (m[1].length === 2) return { kind: 'rail', rail: m[1] as BBRail, col }
  return { kind: 'main', row: m[1] as BBRow, col }
}

export function isValidHole(node: string) {
  return parseHole(node) !== undefined
}

/** Name of the internal strip this hole belongs to (holes on the same strip are connected). */
export function stripOf(node: string): string | undefined {
  const h = parseHole(node)
  if (!h) return undefined
  if (h.kind === 'rail') return `strip:${h.rail}`
  const half = BB_ROWS.indexOf(h.row) < 5 ? 'top' : 'bot'
  return `strip:${half}${h.col}`
}

export function describeHole(node: string): string {
  const h = parseHole(node)
  if (!h) return node
  if (h.kind === 'rail') return `${RAIL_LABEL[h.rail]} ช่อง ${h.col}`
  return `แถว ${h.row.toUpperCase()} คอลัมน์ ${h.col}`
}

export function allHoles(): string[] {
  const out: string[] = []
  for (let c = 1; c <= BB_COLS; c++) {
    for (const r of BB_ROWS) out.push(holeId(r, c))
    for (const r of BB_RAILS) out.push(holeId(r, c))
  }
  return out
}
