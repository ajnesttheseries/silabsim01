/**
 * Generic ESP32-like development board (no real brand).
 * 3.3 V logic, 12-bit ADC, WiFi. Pin capabilities follow the ESP32 datasheet
 * closely enough for teaching: GPIO34–39 are input-only, ADC2 cannot be used while WiFi is on.
 */
export type PowerPinKind = '3V3' | '5V' | 'GND'

export interface BoardPin {
  id: string // e.g. "GPIO25", "3V3", "GND1"
  label: string
  side: 'L' | 'R'
  index: number // position along the header (0 = nearest USB end)
  power?: PowerPinKind
  gpio?: number
  output: boolean
  adc?: 'ADC1' | 'ADC2'
  note?: string
}

const L: Array<[string, Partial<BoardPin>]> = [
  ['3V3', { power: '3V3' }],
  ['GND1', { power: 'GND' }],
  ['GPIO36', { gpio: 36, adc: 'ADC1', output: false, note: 'รับสัญญาณเข้าอย่างเดียว (input-only)' }],
  ['GPIO39', { gpio: 39, adc: 'ADC1', output: false, note: 'รับสัญญาณเข้าอย่างเดียว (input-only)' }],
  ['GPIO34', { gpio: 34, adc: 'ADC1', output: false, note: 'รับสัญญาณเข้าอย่างเดียว (input-only)' }],
  ['GPIO35', { gpio: 35, adc: 'ADC1', output: false, note: 'รับสัญญาณเข้าอย่างเดียว (input-only)' }],
  ['GPIO32', { gpio: 32, adc: 'ADC1' }],
  ['GPIO33', { gpio: 33, adc: 'ADC1' }],
  ['GPIO25', { gpio: 25, adc: 'ADC2' }],
  ['GPIO26', { gpio: 26, adc: 'ADC2' }],
  ['GPIO27', { gpio: 27, adc: 'ADC2' }],
  ['GPIO14', { gpio: 14, adc: 'ADC2' }],
  ['GPIO13', { gpio: 13, adc: 'ADC2' }],
  ['5V', { power: '5V', note: 'ไฟ 5V จากสาย USB (VIN)' }],
]
const R: Array<[string, Partial<BoardPin>]> = [
  ['GND2', { power: 'GND' }],
  ['GPIO23', { gpio: 23 }],
  ['GPIO22', { gpio: 22 }],
  ['GPIO21', { gpio: 21 }],
  ['GPIO19', { gpio: 19 }],
  ['GPIO18', { gpio: 18 }],
  ['GPIO5', { gpio: 5 }],
  ['GPIO17', { gpio: 17 }],
  ['GPIO16', { gpio: 16 }],
  ['GPIO4', { gpio: 4, adc: 'ADC2' }],
  ['GPIO2', { gpio: 2, adc: 'ADC2', note: 'ต่อกับ LED บนบอร์ด' }],
  ['GPIO15', { gpio: 15, adc: 'ADC2' }],
  ['GND3', { power: 'GND' }],
  ['3V3B', { power: '3V3' }],
]

function build(list: Array<[string, Partial<BoardPin>]>, side: 'L' | 'R'): BoardPin[] {
  return list.map(([id, p], index) => ({
    id,
    label: p.power ? (p.power === 'GND' ? 'GND' : p.power) : `G${p.gpio}`,
    side,
    index,
    output: p.power ? false : p.output ?? true,
    ...p,
  }))
}

export const BOARD_PINS: BoardPin[] = [...build(L, 'L'), ...build(R, 'R')]
export const BOARD_PIN_MAP: Record<string, BoardPin> = Object.fromEntries(BOARD_PINS.map((p) => [p.id, p]))

export const SUPPLY_VOLTAGE = 3.3
export const ADC_MAX = 4095
/** Recommended continuous current per GPIO (teaching value; ESP32 absolute max is ~40 mA). */
export const GPIO_SAFE_MA = 12
export const GPIO_WARN_MA = 20

export const boardNode = (pinId: string) => `mcu:${pinId}`
export function parseBoardNode(node: string): BoardPin | undefined {
  return node.startsWith('mcu:') ? BOARD_PIN_MAP[node.slice(4)] : undefined
}
