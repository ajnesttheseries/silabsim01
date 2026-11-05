/**
 * Digital Twin lab — the physical helper robot "NOVA-1", its parts, the sensors
 * students fit to it, and which part of the hologram twin each data stream builds.
 * Pure TypeScript (no React/three) so it can be unit-tested.
 */

export type SensorId = 'temp' | 'vib' | 'angle' | 'power'
export type SlotId = 'head' | 'shoulderR' | 'hip' | 'kneeR' | 'battery'
export type DeviceId = SlotId | 'gateway' | 'twin' | 'dashboard'
/** hologram parts; each appears when its data stream is live */
export type TwinPart = 'torso' | 'arms' | 'pelvis' | 'legs' | 'head'

export const ROBOT_NAME = 'NOVA-1'

export interface SensorSpec {
  id: SensorId
  nameTh: string
  nameEn: string
  measures: string
  /** where it belongs on the robot */
  slot: SlotId
  /** which twin part it brings to life */
  part: TwinPart
  /** bytes per sample sent over the data link */
  bytes: number
  /** highest frequency in the measured signal (Hz) */
  signalHz: number
  /** lowest sampling rate that still tracks the signal (Hz) */
  minRate: number
  why: string
}

export const SENSORS: Record<SensorId, SensorSpec> = {
  temp: {
    id: 'temp',
    nameTh: 'เซนเซอร์อุณหภูมิ',
    nameEn: 'Temperature sensor (analog, 10 mV/°C)',
    measures: 'อุณหภูมิของมอเตอร์ (°C)',
    slot: 'kneeR',
    part: 'legs',
    bytes: 2,
    signalHz: 0.05,
    minRate: 1,
    why: 'มอเตอร์เข่ารับน้ำหนักทั้งตัวตอนหุ่นเต้นและเดิน จึงร้อนที่สุด ถ้าร้อนเกินขดลวดจะไหม้',
  },
  vib: {
    id: 'vib',
    nameTh: 'เซนเซอร์ความสั่นสะเทือน',
    nameEn: 'Vibration sensor (3-axis accelerometer)',
    measures: 'ความสั่นของเฟือง (g)',
    slot: 'hip',
    part: 'pelvis',
    bytes: 6,
    signalHz: 180,
    minRate: 360,
    why: 'เฟืองทดรอบที่สะโพกหมุนตลอดเวลา ลูกปืนที่เริ่มสึกจะสั่นที่ความถี่สูง (ราว 180 Hz) ก่อนพังจริง',
  },
  angle: {
    id: 'angle',
    nameTh: 'เซนเซอร์มุมข้อต่อ',
    nameEn: 'Joint encoder (12-bit, 4096 counts/rev)',
    measures: 'มุมของแขน (องศา)',
    slot: 'shoulderR',
    part: 'arms',
    bytes: 2,
    signalHz: 0.5,
    minRate: 20,
    why: 'Encoder ที่ข้อไหล่บอกว่าแขนกางอยู่กี่องศา แฝดจะขยับแขนตามของจริง',
  },
  power: {
    id: 'power',
    nameTh: 'เซนเซอร์กระแสและพลังงาน',
    nameEn: 'Current / energy sensor',
    measures: 'กระแส (A) แรงดัน (V) และแบตเตอรี่คงเหลือ (%)',
    slot: 'battery',
    part: 'torso',
    bytes: 4,
    signalHz: 0.2,
    minRate: 1,
    why: 'วัดกระแสที่ไหลออกจากแบตเตอรี่ จึงรู้ว่าใช้พลังงานไปเท่าไรและเหลือพอทำงานอีกนานแค่ไหน',
  },
}
export const SENSOR_IDS = Object.keys(SENSORS) as SensorId[]

export interface DeviceInfo {
  nameTh: string
  nameEn: string
  func: string
  caution: string
}

export const DEVICES: Record<DeviceId, DeviceInfo> = {
  head: {
    nameTh: 'หัวหุ่น: กล้องและไมค์',
    nameEn: 'Head: camera & microphones',
    func: 'ให้หุ่นมองเห็นและฟังเสียงเด็ก ๆ เพื่อเล่นและพูดคุยได้',
    caution: 'อุณหภูมิที่หัวคืออุณหภูมิห้องเกือบทั้งหมด ไม่ได้บอกว่ามอเตอร์ร้อนหรือไม่',
  },
  shoulderR: {
    nameTh: 'ข้อไหล่ขวา: เซอร์โวมอเตอร์',
    nameEn: 'Right shoulder: servo motor',
    func: 'หมุนแขนขึ้นลงตอนโบกมือและเต้น',
    caution: 'ถ้ารู้มุมผิด แฝดจะขยับแขนไม่ตรงของจริง ต้องตั้งศูนย์ (Zero) ก่อนใช้',
  },
  hip: {
    nameTh: 'สะโพก: เฟืองทดรอบ',
    nameEn: 'Hip: gearbox',
    func: 'ทดรอบมอเตอร์ให้มีแรงบิดพอยกทั้งตัวขณะเต้น',
    caution: 'ลูกปืนสึกจะสั่นแรงขึ้นทีละน้อย ถ้าปล่อยไว้ เฟืองอาจแตกกลางโชว์',
  },
  kneeR: {
    nameTh: 'เข่าขวา: มอเตอร์ขา',
    nameEn: 'Right knee: leg motor',
    func: 'งอและยืดเข่า รับน้ำหนักทั้งตัว',
    caution: 'ทำงานหนักที่สุด ถ้าร้อนเกิน 85 °C ขดลวดจะเสียหาย',
  },
  battery: {
    nameTh: 'แบตเตอรี่ 24 V',
    nameEn: '24 V battery pack',
    func: 'จ่ายไฟให้มอเตอร์ทุกตัวและคอมพิวเตอร์ในตัวหุ่น',
    caution: 'ต้องเหลืออย่างน้อย 10% เพื่อให้หุ่นเดินกลับแท่นชาร์จได้เอง',
  },
  gateway: {
    nameTh: 'เกตเวย์รับข้อมูล (DAQ)',
    nameEn: 'Data acquisition gateway',
    func: 'รวบรวมข้อมูลจากเซนเซอร์ทุกตัว แล้วส่งให้แฝดดิจิทัลแบบเรียลไทม์ผ่านช่องสัญญาณไร้สาย',
    caution: 'ช่องสัญญาณส่งได้ไม่เกิน 40 kbps ถ้าส่งข้อมูลเยอะเกิน แฝดจะช้าตามหลังของจริง',
  },
  twin: {
    nameTh: 'โต๊ะโฮโลแกรมแฝดดิจิทัล',
    nameEn: 'Digital twin hologram',
    func: 'แสดง "ร่างแฝด" ของหุ่นที่ขยับและเปลี่ยนสีตามข้อมูลจริง ทุกชิ้นส่วนมาจากข้อมูลเซนเซอร์',
    caution: 'แฝดดีได้เท่าข้อมูลที่ป้อน เซนเซอร์ผิดที่หรือไม่ได้ปรับเทียบ แฝดจะ "โกหก"',
  },
  dashboard: {
    nameTh: 'จอแดชบอร์ด',
    nameEn: 'Monitoring dashboard',
    func: 'แสดงค่าทุกตัวและเตือนเมื่อมีอะไรผิดปกติ',
    caution: 'ตั้งเกณฑ์เตือนต่ำไปจะเตือนพร่ำเพรื่อ สูงไปจะเตือนช้าเกินจนหุ่นพัง',
  },
}

export const SLOT_TH: Record<SlotId, string> = {
  head: 'หัว',
  shoulderR: 'ข้อไหล่ขวา',
  hip: 'เฟืองสะโพก',
  kneeR: 'มอเตอร์เข่าขวา',
  battery: 'สายแบตเตอรี่',
}

export const PART_TH: Record<TwinPart, string> = { torso: 'ลำตัว', arms: 'แขน', pelvis: 'สะโพก', legs: 'ขา', head: 'หัว' }

export type Mounts = Record<SensorId, SlotId | null>
export const emptyMounts = (): Mounts => ({ temp: null, vib: null, angle: null, power: null })
export const SOLUTION_MOUNTS = (): Mounts => ({ temp: 'kneeR', vib: 'hip', angle: 'shoulderR', power: 'battery' })

/** Why a sensor in the wrong place gives misleading data. */
function wrongReason(s: SensorId, at: SlotId): string {
  if (s === 'temp') return at === 'head' ? 'หัวหุ่นไม่มีมอเตอร์ใหญ่ อ่านได้แค่อุณหภูมิห้อง แฝดจะไม่รู้ว่ามอเตอร์เข่ากำลังร้อน' : `ที่${SLOT_TH[at]}ไม่ใช่จุดที่ร้อนที่สุด ควรวัดที่มอเตอร์ที่รับน้ำหนักมากที่สุด`
  if (s === 'vib') return 'ความสั่นที่ผิดปกติเกิดที่ลูกปืนในเฟืองทดรอบ ถ้าติดไกลจากเฟือง สัญญาณจะอ่อนจนมองไม่เห็นตอนลูกปืนเริ่มสึก'
  if (s === 'angle') return 'Encoder ต้องอยู่บนแกนหมุนของข้อต่อที่จะวัดมุม ติดที่อื่นจะไม่รู้ว่าแขนกางกี่องศา'
  return 'ต้องวัดกระแสบนสายที่ออกจากแบตเตอรี่ จึงจะรู้พลังงานที่ทั้งหุ่นใช้จริง'
}

export interface MountStatus {
  sensor: SensorId
  at: SlotId | null
  state: 'none' | 'ok' | 'wrong'
  message: string
}

export function mountReport(m: Mounts): { sensors: MountStatus[]; parts: TwinPart[]; complete: boolean } {
  const sensors = SENSOR_IDS.map<MountStatus>((s) => {
    const at = m[s]
    if (!at) return { sensor: s, at, state: 'none', message: `ยังไม่ได้ติด ${SENSORS[s].nameTh}` }
    if (at === SENSORS[s].slot) return { sensor: s, at, state: 'ok', message: `${SENSORS[s].nameTh} ที่${SLOT_TH[at]}: ส่งข้อมูลให้แฝดสร้าง${PART_TH[SENSORS[s].part]}แล้ว` }
    return { sensor: s, at, state: 'wrong', message: `${SENSORS[s].nameTh} ติดที่${SLOT_TH[at]} ไม่ถูกจุด: ${wrongReason(s, at)}` }
  })
  const parts = sensors.filter((x) => x.state === 'ok').map((x) => SENSORS[x.sensor].part)
  const complete = parts.length === SENSOR_IDS.length
  if (complete) parts.push('head')
  return { sensors, parts, complete }
}

/** Which sensor (if any) occupies a slot. */
export const sensorAt = (m: Mounts, slot: SlotId): SensorId | null => SENSOR_IDS.find((s) => m[s] === slot) ?? null
