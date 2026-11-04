import { BB_COLS, BB_ROWS, holeId, parseHole, type BBRow } from './breadboard'

export type ComponentType =
  | 'led'
  | 'resistor'
  | 'ldr'
  | 'dht'
  | 'buzzer'
  | 'soil'
  | 'pir'
  | 'driver'
  | 'fan'

/** Items that appear on the shelf. Some are fixed on the desk (board, breadboard) or are tools. */
export type ShelfItem = ComponentType | 'board' | 'breadboard' | 'jumper' | 'multimeter' | 'usb'

export type LedColor = 'red' | 'green' | 'blue'
export type ResistorValue = 220 | 1000 | 10000

export interface PlacedComponent {
  id: string
  type: ComponentType
  /** LED colour or resistor value */
  variant?: LedColor | ResistorValue
  /** Breadboard anchor hole for on-board parts (e.g. "bb:c10"); null for off-board modules */
  anchor: string | null
  /** Reverses pin order along the row (e.g. LED turned around) */
  flipped?: boolean
}

export interface PinDef {
  id: string
  label: string
  role: 'power' | 'ground' | 'signal' | 'passive' | 'anode' | 'cathode' | 'load'
}

export interface CatalogEntry {
  type: ShelfItem
  nameTh: string
  nameEn: string
  func: string
  pins: string
  caution: string
  /** Component pins in breadboard order (for on-board parts) */
  pinDefs?: PinDef[]
  /** Column offsets of each pin from the anchor (on-board parts only) */
  offsets?: number[]
  onBreadboard?: boolean
  /** Off-board modules live at a fixed spot in the scene */
  offBoard?: boolean
  analog?: boolean
}

export const LED_VF: Record<LedColor, number> = { red: 2.0, green: 3.0, blue: 3.0 }
export const LED_COLOR_TH: Record<LedColor, string> = { red: 'แดง', green: 'เขียว', blue: 'น้ำเงิน' }

/** 4-band colour code: digit, digit, multiplier, tolerance (gold = ±5 %). */
export const RESISTOR_BANDS: Record<ResistorValue, string[]> = {
  220: ['red', 'red', 'brown', 'gold'],
  1000: ['brown', 'black', 'red', 'gold'],
  10000: ['brown', 'black', 'orange', 'gold'],
}
export const BAND_TH: Record<string, string> = {
  black: 'ดำ',
  brown: 'น้ำตาล',
  red: 'แดง',
  orange: 'ส้ม',
  gold: 'ทอง',
}

export function formatOhms(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(2)} MΩ`
  if (v >= 1000) return `${+(v / 1000).toFixed(2)} kΩ`
  return `${Math.round(v)} Ω`
}

export const CATALOG: Record<ShelfItem, CatalogEntry> = {
  board: {
    type: 'board',
    nameTh: 'บอร์ดไมโครคอนโทรลเลอร์',
    nameEn: 'Microcontroller Board (ESP32-like)',
    func: 'สมองของระบบ อ่านค่าจากเซนเซอร์ ตัดสินใจ และสั่งงานอุปกรณ์ มี WiFi และ ADC 12 บิต (0–4095)',
    pins: '3V3, 5V, GND และขา GPIO หลายขา (บางขาอ่าน Analog ได้ บางขารับสัญญาณเข้าอย่างเดียว)',
    caution: 'ขาสัญญาณใช้แรงดัน 3.3V ห้ามป้อน 5V เข้าขา GPIO และขาหนึ่งจ่ายกระแสได้เพียงไม่กี่สิบมิลลิแอมป์',
  },
  breadboard: {
    type: 'breadboard',
    nameTh: 'เบรดบอร์ด',
    nameEn: 'Breadboard',
    func: 'แผงต่อวงจรทดลองแบบไม่ต้องบัดกรี รูในคอลัมน์เดียวกัน (A–E หรือ F–J) เชื่อมถึงกันภายใน',
    pins: 'ราง + / − สำหรับไฟเลี้ยงวิ่งยาวตลอดแนว ส่วนร่องกลางแยกครึ่งบนกับครึ่งล่างออกจากกัน',
    caution: 'ถ้าเสียบขาทั้งสองของอุปกรณ์ในคอลัมน์เดียวกัน ขาทั้งสองจะถูกลัดวงจรเข้าหากัน',
  },
  jumper: {
    type: 'jumper',
    nameTh: 'สายจัมเปอร์',
    nameEn: 'Jumper Wire',
    func: 'สายไฟสำหรับเชื่อมจุดต่าง ๆ ในวงจร',
    pins: 'แนวปฏิบัติ: แดง = ไฟเลี้ยง (VCC), ดำ = กราวด์ (GND), สีอื่น = สัญญาณ',
    caution: 'ใช้สีให้เป็นระบบ จะช่วยให้ตรวจวงจรง่ายและลดโอกาสต่อผิด',
  },
  multimeter: {
    type: 'multimeter',
    nameTh: 'มัลติมิเตอร์',
    nameEn: 'Multimeter',
    func: 'เครื่องวัดแรงดัน กระแส และความต้านทาน ใช้ตรวจว่าแต่ละจุดในวงจรมีไฟเท่าไร',
    pins: 'สายวัดสีแดง (+) และสีดำ (COM)',
    caution: 'ตั้งย่านวัดให้ถูกก่อนวัดเสมอ โดยเฉพาะเมื่อวัดกระแส',
  },
  usb: {
    type: 'usb',
    nameTh: 'สาย USB',
    nameEn: 'USB Cable',
    func: 'จ่ายไฟ 5V ให้บอร์ดและใช้ส่งข้อมูล (Serial) ไปยังคอมพิวเตอร์',
    pins: 'เสียบเข้าพอร์ต USB ของบอร์ด',
    caution: 'ถ้าไม่เสียบสาย USB บอร์ดจะไม่มีไฟเลี้ยงและไม่ทำงาน',
  },
  led: {
    type: 'led',
    nameTh: 'หลอด LED',
    nameEn: 'Light Emitting Diode',
    func: 'ให้แสงสว่างเมื่อมีกระแสไหลจากขา Anode ไป Cathode (ไหลทางเดียว)',
    pins: 'ขายาว = Anode (+), ขาสั้น = Cathode (−) ต่อลง GND',
    caution: 'ต้องต่อตัวต้านทานจำกัดกระแสเสมอ ไม่เช่นนั้นกระแสสูงเกินจน LED หรือขาบอร์ดเสียหาย',
    pinDefs: [
      { id: 'A', label: 'Anode (+) ขายาว', role: 'anode' },
      { id: 'K', label: 'Cathode (−) ขาสั้น', role: 'cathode' },
    ],
    offsets: [0, 1],
    onBreadboard: true,
  },
  resistor: {
    type: 'resistor',
    nameTh: 'ตัวต้านทาน',
    nameEn: 'Resistor',
    func: 'จำกัดกระแสไฟฟ้า และใช้สร้างวงจรแบ่งแรงดัน ค่าดูได้จากแถบสี',
    pins: '2 ขา ไม่มีขั้ว กลับด้านได้',
    caution: 'เลือกค่าให้เหมาะ ค่าน้อยเกินกระแสจะสูง ค่ามากเกิน LED จะสว่างน้อย',
    pinDefs: [
      { id: '1', label: 'ขา 1', role: 'passive' },
      { id: '2', label: 'ขา 2', role: 'passive' },
    ],
    offsets: [0, 4],
    onBreadboard: true,
  },
  ldr: {
    type: 'ldr',
    nameTh: 'ตัวต้านทานไวแสง',
    nameEn: 'LDR (Light Dependent Resistor)',
    func: 'ความต้านทานลดลงเมื่อได้รับแสงมากขึ้น ใช้คู่กับตัวต้านทาน 10kΩ เป็นวงจรแบ่งแรงดันเพื่อวัดแสง',
    pins: '2 ขา ไม่มีขั้ว',
    caution: 'อ่านเป็นสัญญาณ Analog ต้องต่อเข้าขาที่มี ADC เท่านั้น',
    pinDefs: [
      { id: '1', label: 'ขา 1', role: 'passive' },
      { id: '2', label: 'ขา 2', role: 'passive' },
    ],
    offsets: [0, 2],
    onBreadboard: true,
    analog: true,
  },
  dht: {
    type: 'dht',
    nameTh: 'เซนเซอร์อุณหภูมิและความชื้น',
    nameEn: 'Digital Temp & Humidity Sensor (DHT22-like)',
    func: 'วัดอุณหภูมิ (°C) และความชื้นสัมพัทธ์ (%RH) ส่งข้อมูลแบบดิจิทัลผ่านสายเส้นเดียว อ่านได้ทุก ~2 วินาที',
    pins: 'VCC (+), DATA (สัญญาณ), GND (−) — โมดูลมีตัวต้านทาน pull-up ในตัว',
    caution: 'ใช้ไฟ 3.3V กับบอร์ด 3.3V ถ้าจ่าย 5V ขา DATA จะมีแรงดัน 5V ซึ่งเกินที่ขาบอร์ดรับได้',
    pinDefs: [
      { id: 'VCC', label: 'VCC (+)', role: 'power' },
      { id: 'DATA', label: 'DATA', role: 'signal' },
      { id: 'GND', label: 'GND (−)', role: 'ground' },
    ],
    offsets: [0, 1, 2],
    onBreadboard: true,
  },
  buzzer: {
    type: 'buzzer',
    nameTh: 'บัซเซอร์',
    nameEn: 'Active Buzzer',
    func: 'ส่งเสียงเตือนเมื่อได้รับไฟ (แบบ Active มีวงจรกำเนิดเสียงในตัว)',
    pins: 'ขา + (ยาว) ต่อ GPIO, ขา − ต่อ GND',
    caution: 'มีขั้ว ถ้าต่อกลับขั้วจะไม่มีเสียง',
    pinDefs: [
      { id: 'P', label: 'ขา +', role: 'anode' },
      { id: 'N', label: 'ขา −', role: 'cathode' },
    ],
    offsets: [0, 2],
    onBreadboard: true,
  },
  soil: {
    type: 'soil',
    nameTh: 'เซนเซอร์ความชื้นในดิน',
    nameEn: 'Capacitive Soil Moisture Sensor',
    func: 'วัดความชื้นในดินแบบ Capacitive ให้ค่า Analog: ดินแห้ง = ค่า ADC สูง, ดินชื้น = ค่า ADC ต่ำ',
    pins: 'VCC, GND, AOUT (สัญญาณ Analog)',
    caution: 'ต้องต่อ AOUT เข้าขา ADC และควร Calibrate ค่าแห้ง/เปียกก่อนใช้งาน',
    pinDefs: [
      { id: 'VCC', label: 'VCC', role: 'power' },
      { id: 'GND', label: 'GND', role: 'ground' },
      { id: 'AOUT', label: 'AOUT', role: 'signal' },
    ],
    offBoard: true,
    analog: true,
  },
  pir: {
    type: 'pir',
    nameTh: 'เซนเซอร์ตรวจจับการเคลื่อนไหว',
    nameEn: 'PIR Motion Sensor',
    func: 'ตรวจจับรังสีอินฟราเรดจากร่างกายที่เคลื่อนที่ ส่งสัญญาณ Digital HIGH (3.3V) เมื่อพบการเคลื่อนไหว',
    pins: 'VCC (5V), OUT (สัญญาณ Digital), GND',
    caution: 'ต้องรอ warm-up หลังจ่ายไฟ และสัญญาณจะค้าง HIGH ไว้ช่วงหนึ่ง (hold time)',
    pinDefs: [
      { id: 'VCC', label: 'VCC (5V)', role: 'power' },
      { id: 'OUT', label: 'OUT', role: 'signal' },
      { id: 'GND', label: 'GND', role: 'ground' },
    ],
    offBoard: true,
  },
  driver: {
    type: 'driver',
    nameTh: 'โมดูลขับโหลด (MOSFET/รีเลย์)',
    nameEn: 'Load Driver Module',
    func: 'ใช้สัญญาณเล็ก ๆ จาก GPIO ไปเปิด-ปิดโหลดที่กินกระแสสูง เช่น พัดลมหรือมอเตอร์',
    pins: 'VCC (5V), GND, IN (สัญญาณจาก GPIO), OUT+ / OUT− ไปยังโหลด',
    caution: 'โหลดได้ไฟจาก 5V ผ่านโมดูล ไม่ได้ดึงกระแสจากขา GPIO โดยตรง',
    pinDefs: [
      { id: 'VCC', label: 'VCC (5V)', role: 'power' },
      { id: 'GND', label: 'GND', role: 'ground' },
      { id: 'IN', label: 'IN', role: 'signal' },
      { id: 'OUTP', label: 'OUT+', role: 'load' },
      { id: 'OUTN', label: 'OUT−', role: 'load' },
    ],
    offBoard: true,
  },
  fan: {
    type: 'fan',
    nameTh: 'พัดลม DC 5V',
    nameEn: 'DC Fan (Motor)',
    func: 'ระบายความร้อน ใช้มอเตอร์ซึ่งกินกระแสหลายร้อยมิลลิแอมป์',
    pins: 'ขา + และขา −',
    caution: 'ห้ามต่อตรงกับขา GPIO เพราะขาบอร์ดจ่ายกระแสไม่พอ ต้องขับผ่านโมดูลขับโหลด',
    pinDefs: [
      { id: 'P', label: 'ขา + (แดง)', role: 'power' },
      { id: 'N', label: 'ขา − (ดำ)', role: 'ground' },
    ],
    offBoard: true,
  },
}

export const COMPONENT_LIMITS: Partial<Record<ComponentType, number>> = {
  soil: 1,
  pir: 1,
  driver: 1,
  fan: 1,
  dht: 1,
  ldr: 2,
  buzzer: 1,
}

export function componentName(c: Pick<PlacedComponent, 'type' | 'variant'>): string {
  const e = CATALOG[c.type]
  if (c.type === 'led' && c.variant) return `LED ${LED_COLOR_TH[c.variant as LedColor]}`
  if (c.type === 'resistor' && c.variant) return `ตัวต้านทาน ${formatOhms(c.variant as number)}`
  return e.nameTh
}

export const pinNode = (compId: string, pin: string) => `cmp:${compId}:${pin}`
export function parsePinNode(node: string): { compId: string; pin: string } | undefined {
  const m = /^cmp:([^:]+):(.+)$/.exec(node)
  return m ? { compId: m[1], pin: m[2] } : undefined
}

/** Returns map pinId → hole for on-breadboard parts, or null if it does not fit. */
export function footprint(c: PlacedComponent): Record<string, string> | null {
  const e = CATALOG[c.type]
  if (!e.onBreadboard || !c.anchor || !e.pinDefs || !e.offsets) return null
  const h = parseHole(c.anchor)
  if (!h) return null
  const span = Math.max(...e.offsets)
  if (h.col + span > BB_COLS) return null
  const out: Record<string, string> = {}
  const defs = c.flipped ? [...e.pinDefs].reverse() : e.pinDefs
  defs.forEach((p, i) => {
    const col = h.col + e.offsets![i]
    out[p.id] = h.kind === 'rail' ? holeId(h.rail, col) : holeId(h.row as BBRow, col)
  })
  return out
}

/** Parts may only sit in the main area (rows a–j). */
export function canAnchorAt(type: ComponentType, anchor: string): boolean {
  const h = parseHole(anchor)
  if (!h || h.kind !== 'main') return false
  const span = Math.max(...(CATALOG[type].offsets ?? [0]))
  return h.col + span <= BB_COLS && BB_ROWS.includes(h.row)
}
