/** Digital Twin lab (stage 1: Data Acquisition) — missions, guided steps and quizzes (Thai). */
import type { QuizQuestion } from '../../engine/quiz'
import { encoderOk, LINK_KBPS, rateChecks, SAFE_UTIL, tempCalOk, type LinkStatus, type Rates, type TempCal } from './daq'
import { DEVICES, mountReport, SENSORS, SLOT_TH, type DeviceId, type SensorId, type SlotId } from './robot'
import { BEARING_HZ } from './signals'
import { SOLUTION_RULES, type AlertRules } from './twin'

export interface TwinCtx {
  tutorial: { seenIntro?: boolean }
  found: string[]
  miniQuizCorrect: number
  mount: ReturnType<typeof mountReport>
  /** sensor the student is holding, ready to mount */
  picked: SensorId | null
  rates: Rates
  link: LinkStatus
  hold: boolean
  encoderOffset: number
  tempCal: TempCal
  rules: AlertRules
  /** per-scenario pass for the current settings (live) */
  testCheckpoints: boolean[]
  testScore: { score: number; total: number } | null
  finalDone: boolean
}

export interface TwinObjective {
  id: string
  th: string
  check: (c: TwinCtx) => boolean
}
export interface TwinMission {
  id: number
  title: string
  short: string
  minutes: number
  intro: string
  objectives: TwinObjective[]
  theory: { title: string; body: string[]; formula?: string }
  hints: [string, string]
}

export const TWIN_FIND_LIST: DeviceId[] = ['head', 'shoulderR', 'hip', 'kneeR', 'battery', 'gateway', 'twin', 'dashboard']
export const TWIN_FIND_TARGET = 5

const sensorOk = (c: TwinCtx, s: SensorId) => c.mount.sensors.find((x) => x.sensor === s)?.state === 'ok'
export const ratesOk = (c: TwinCtx) => {
  const r = rateChecks(c.rates)
  return r.vib && r.angle && r.temp && r.power && c.link.util <= SAFE_UTIL
}
export const syncOk = (c: TwinCtx) => c.mount.complete && c.link.latency < 0.2

export const TWIN_MISSIONS: TwinMission[] = [
  {
    id: 0,
    title: 'เปิดห้องแฝดดิจิทัล',
    short: 'แนะนำแล็บ',
    minutes: 1,
    intro: 'ยินดีต้อนรับสู่ห้องแล็บแฝดดิจิทัล! วันนี้น้องจะสร้าง "ร่างแฝดเสมือน" ของหุ่นยนต์ผู้ช่วย NOVA-1 ที่คอยเต้นและเล่นกับเด็ก ๆ ในโรงพยาบาล แฝดจะช่วยดูแลไม่ให้หุ่นพังกลางโชว์',
    objectives: [{ id: 'intro', th: 'อ่านแนะนำแล็บแล้วกด "เริ่มเลย"', check: (c) => !!c.tutorial.seenIntro }],
    theory: {
      title: 'แฝดดิจิทัลคืออะไร',
      body: [
        'แฝดดิจิทัล (Digital Twin) คือแบบจำลองในคอมพิวเตอร์ของสิ่งของจริง ที่อัปเดตตามข้อมูลจริงตลอดเวลา',
        'ต่างจากโมเดล 3D ธรรมดา เพราะแฝดรู้ว่าของจริงกำลังทำอะไร ร้อนแค่ไหน สั่นแค่ไหน ใช้พลังงานเท่าไร',
        'ใช้ดูแลเครื่องจักร โรงงาน อาคาร ไปจนถึงเมืองทั้งเมือง ให้รู้ปัญหาก่อนของจริงพัง',
        'ด่านที่ 1 นี้คือ "จำลองข้อมูลจริง (Data Acquisition)": ติดเซนเซอร์และส่งข้อมูลให้แฝดอย่างถูกต้อง',
      ],
    },
    hints: ['อ่านหน้าต่างแนะนำให้ครบ 3 หน้า แล้วกด "เริ่มเลย"', 'ลากบนฉากเพื่อหมุนกล้อง ใช้ล้อเมาส์หรือสองนิ้วเพื่อซูม'],
  },
  {
    id: 1,
    title: 'รู้จักหุ่นและแฝด',
    short: 'รู้จักหุ่น',
    minutes: 3,
    intro: 'แตะชิ้นส่วนของหุ่นยนต์จริงและอุปกรณ์ในห้อง อ่านการ์ดว่าแต่ละส่วนทำอะไร และจุดไหนที่อาจพังได้',
    objectives: [
      { id: 'find', th: `แตะดูชิ้นส่วนอย่างน้อย ${TWIN_FIND_TARGET} อย่าง`, check: (c) => c.found.length >= TWIN_FIND_TARGET },
      { id: 'quiz', th: 'ตอบ Mini quiz ถูกครบ 3 ข้อ', check: (c) => c.miniQuizCorrect >= 3 },
    ],
    theory: {
      title: 'ของจริง ↔ ข้อมูล ↔ แฝด',
      body: [
        'ของจริง (Physical): หุ่นยนต์ NOVA-1 ที่เต้นอยู่ในห้อง',
        'ข้อมูล (Data): เซนเซอร์วัดค่า แล้วเกตเวย์ (DAQ) ส่งข้อมูลผ่านช่องสัญญาณไร้สาย',
        'แฝด (Digital): โฮโลแกรมที่ขยับและเปลี่ยนสีตามข้อมูล พร้อมแดชบอร์ดเตือนเมื่อผิดปกติ',
        'ถ้าข้อมูลผิด แฝดก็ผิด วิศวกรแฝดดิจิทัลจึงต้องเลือกเซนเซอร์ ตำแหน่ง และความถี่ในการวัดให้ถูก',
      ],
    },
    hints: ['แตะชิ้นส่วนบนตัวหุ่น เช่น ข้อไหล่ เข่า สะโพก แบตเตอรี่ แล้วอ่านการ์ด', 'คำตอบ Mini quiz อยู่ในการ์ดของแต่ละชิ้นส่วนและในทฤษฎี'],
  },
  {
    id: 2,
    title: 'ติดเซนเซอร์ ประกอบร่างแฝด',
    short: 'ติดเซนเซอร์',
    minutes: 4,
    intro: 'หยิบเซนเซอร์จากถาดแล้วติดให้ถูกจุดบนหุ่นจริง ทุกครั้งที่ข้อมูลไหลเข้ามา ชิ้นส่วนของแฝดจะประกอบร่างขึ้นทีละชิ้น',
    objectives: [
      { id: 'temp', th: 'ติดเซนเซอร์อุณหภูมิที่มอเตอร์เข่าขวา', check: (c) => sensorOk(c, 'temp') },
      { id: 'vib', th: 'ติดเซนเซอร์ความสั่นสะเทือนที่เฟืองสะโพก', check: (c) => sensorOk(c, 'vib') },
      { id: 'angle', th: 'ติดเซนเซอร์มุมที่ข้อไหล่ขวา', check: (c) => sensorOk(c, 'angle') },
      { id: 'power', th: 'ติดเซนเซอร์กระแสที่สายแบตเตอรี่', check: (c) => sensorOk(c, 'power') },
      { id: 'complete', th: 'แฝดประกอบร่างครบทั้งตัว', check: (c) => c.mount.complete },
    ],
    theory: {
      title: 'วัดตรงไหน ได้ข้อมูลแบบนั้น',
      body: [
        'ติดเซนเซอร์ให้ใกล้ "จุดที่จะพัง" ที่สุด: ความร้อนวัดที่มอเตอร์ที่ทำงานหนัก ความสั่นวัดที่เฟืองและลูกปืน',
        'เซนเซอร์อุณหภูมิที่หัวหุ่นจะวัดได้แค่อุณหภูมิห้อง ทั้งที่มอเตอร์เข่าอาจร้อนเกือบไหม้',
        'Encoder ต้องอยู่บนแกนหมุนของข้อต่อ จึงบอกมุมได้จริง',
        'เซนเซอร์กระแสต้องอยู่บนสายหลักจากแบตเตอรี่ จึงรู้พลังงานที่ทั้งหุ่นใช้',
      ],
    },
    hints: ['ดูช่อง "วัดอะไร" ในแท็บเซนเซอร์ แล้วคิดว่าชิ้นส่วนไหนร้อน/สั่น/หมุน/ใช้ไฟ', 'อุณหภูมิ → เข่าขวา · ความสั่น → สะโพก · มุม → ไหล่ขวา · กระแส → แบตเตอรี่'],
  },
  {
    id: 3,
    title: 'วัดถี่แค่ไหนดี',
    short: 'อัตราการวัด',
    minutes: 4,
    intro: `ตั้งอัตราการวัด (Sampling rate) ให้แต่ละเซนเซอร์ วัดช้าไปแฝดจะเห็นข้อมูลเพี้ยน วัดถี่ไปข้อมูลจะล้นช่องสัญญาณ ${LINK_KBPS} kbps จนแฝดช้าตามหลังของจริง`,
    objectives: [
      { id: 'vib', th: `ความสั่นวัดถี่กว่า 2 × ${BEARING_HZ} = ${BEARING_HZ * 2} ครั้ง/วินาที (ไม่เกิดความถี่หลอก)`, check: (c) => rateChecks(c.rates).vib },
      { id: 'angle', th: `มุมแขนวัดอย่างน้อย ${SENSORS.angle.minRate} ครั้ง/วินาที แขนแฝดจะขยับลื่น`, check: (c) => rateChecks(c.rates).angle },
      { id: 'link', th: `ใช้ช่องสัญญาณไม่เกิน ${Math.round(SAFE_UTIL * 100)}% แฝดไม่ช้าตามหลัง`, check: (c) => c.mount.complete && c.link.util <= SAFE_UTIL },
    ],
    theory: {
      title: 'Sampling, Nyquist และงบช่องสัญญาณ',
      formula: 'fs > 2 × f สูงสุด · ข้อมูล = fs × ไบต์ × 8 บิต',
      body: [
        'ทฤษฎีบท Nyquist: ต้องวัดถี่กว่า 2 เท่าของความถี่สูงสุดในสัญญาณ ไม่เช่นนั้นจะเห็น "ความถี่หลอก" (Aliasing)',
        'ลูกปืนที่เริ่มสึกสั่นที่ 180 Hz ถ้าวัดแค่ 200 ครั้ง/วินาที แฝดจะเห็นเป็น 20 Hz ซึ่งไม่มีอยู่จริง',
        'อุณหภูมิเปลี่ยนช้ามาก วัด 1 ครั้ง/วินาทีก็พอ วัดถี่เกินแค่เปลืองช่องสัญญาณ',
        'ช่องสัญญาณมีจำกัด: ความสั่น 500 ครั้ง/วินาที × 6 ไบต์ × 8 = 24 kbps ถ้ารวมทุกเซนเซอร์เกินความจุ ข้อมูลจะต่อคิวจนแฝดช้าเป็นวินาที',
      ],
    },
    hints: ['ความสั่นต้องเกิน 360 แต่ถ้าตั้ง 1000 จะกินช่องสัญญาณ 48 kbps เกินความจุ', 'ลอง: อุณหภูมิ 1 · ความสั่น 500 · มุม 50 · กระแส 10 ครั้ง/วินาที'],
  },
  {
    id: 4,
    title: 'ปรับเทียบให้แฝดตรงกับของจริง',
    short: 'ปรับเทียบ',
    minutes: 3,
    intro: 'ตอนนี้แขนของแฝดกางไม่ตรงกับแขนจริง และอุณหภูมิที่แฝดแสดงก็ไม่ตรงกับเทอร์โมมิเตอร์อ้างอิง ต้องปรับเทียบ (Calibrate) ก่อนใช้งานจริง',
    objectives: [
      { id: 'zero', th: 'ตั้งศูนย์ Encoder: แขนแฝดตรงกับแขนจริง (ต่างกันไม่เกิน 2°)', check: (c) => encoderOk(c.encoderOffset) },
      { id: 'temp', th: 'ตั้งสูตรแปลงอุณหภูมิตาม Datasheet (ต่างจากของจริงไม่เกิน 1 °C)', check: (c) => tempCalOk(c.tempCal) },
      { id: 'sync', th: 'แฝดตามทันของจริง (ดีเลย์น้อยกว่า 0.2 วินาที)', check: syncOk },
    ],
    theory: {
      title: 'การปรับเทียบ (Calibration)',
      formula: 'มุม = (ค่าดิบ − ค่าศูนย์) × 360 / 4096 · อุณหภูมิ = (mV − 500) / 10',
      body: [
        'Encoder บอกตำแหน่งเป็นตัวเลข 0–4095 ต่อรอบ แต่ตอนประกอบ แม่เหล็กไม่ได้ตรงกับมุม 0° ของแขนพอดี',
        'วิธีแก้: ให้หุ่นยืนท่าเตรียม (แขนลง 0°) แล้วกด "ตั้งศูนย์" ระบบจะจำค่าดิบตอนนั้นเป็นจุด 0°',
        'เซนเซอร์อุณหภูมิแบบแอนะล็อกให้แรงดัน 500 mV ที่ 0 °C และเพิ่ม 10 mV ทุก 1 °C (ดูจาก Datasheet)',
        'ตรวจกับเครื่องมืออ้างอิงที่เชื่อถือได้เสมอ เช่น เทอร์โมมิเตอร์ที่ผ่านการสอบเทียบ',
      ],
    },
    hints: ['ต้องกด "ให้หุ่นยืนท่าเตรียม" ก่อน แล้วค่อยกด "ตั้งศูนย์" ถ้ากดตอนแขนกางอยู่ ศูนย์จะเพี้ยน', 'Datasheet: ที่ 0 °C ได้ 500 mV และเพิ่ม 10 mV ต่อ °C'],
  },
  {
    id: 5,
    title: 'ภารกิจท้าทาย: แฝดเฝ้าระวังหุ่นผู้ช่วย',
    short: 'เฝ้าระวัง',
    minutes: 5,
    intro: 'NOVA-1 ต้องเต้นให้เด็ก ๆ ดูทุกวันโดยไม่พังกลางโชว์ ตั้งเกณฑ์เตือนบนแฝด ให้หยุดหุ่นได้ทันเมื่อมีปัญหา แต่ไม่เตือนพร่ำเพรื่อตอนปกติ ระบบจะทดสอบ 4 สถานการณ์',
    objectives: [{ id: 'test', th: 'ผ่านการทดสอบอัตโนมัติครบ 4 สถานการณ์', check: (c) => !!c.testScore && c.testScore.score >= c.testScore.total }],
    theory: {
      title: 'การบำรุงรักษาเชิงพยากรณ์ (Predictive Maintenance)',
      body: [
        'แทนที่จะรอให้พังแล้วซ่อม แฝดดิจิทัลเฝ้าดูข้อมูลแล้วเตือนก่อนพัง ช่วยประหยัดและปลอดภัย',
        'เกณฑ์ต้องสูงกว่าค่าปกติ (ไม่เตือนผิด) แต่ต่ำกว่าจุดที่เสียหายพอสมควร (เตือนทัน รวมเวลาดีเลย์ของข้อมูลด้วย)',
        'ข้อมูลทุกขั้นที่ทำมาต้องถูก: เซนเซอร์ผิดที่ วัดช้าเกิน หรือไม่ได้ปรับเทียบ แฝดจะเตือนผิดหรือไม่เตือนเลย',
        'เวลาในแล็บถูกเร่งให้เร็วขึ้น เพื่อให้เห็นการเปลี่ยนแปลงภายในไม่กี่วินาที',
      ],
    },
    hints: ['ปกติมอเตอร์ร้อนไม่เกิน 42 °C และเสียหายที่ 85 °C · ลูกปืนปกติสั่น ~0.07 g · แบตปกติไม่ต่ำกว่า 65%', 'ลอง: อุณหภูมิ > 60 °C · ความสั่น > 0.4 g · แบตเตอรี่ < 20%'],
  },
  {
    id: 6,
    title: 'ภารกิจสุดท้าย: แบบทดสอบ',
    short: 'แบบทดสอบ',
    minutes: 3,
    intro: 'ทบทวนสิ่งที่ได้ลองทำ 5 ข้อ แล้วรับใบประกาศนักวิศวกรแฝดดิจิทัลฝึกหัด',
    objectives: [{ id: 'quiz', th: 'ทำแบบทดสอบครบ 5 ข้อ', check: (c) => c.finalDone }],
    theory: {
      title: 'เส้นทางของวิศวกรแฝดดิจิทัล',
      body: [
        'ด้านที่ 1 จำลองข้อมูลจริง (Data Acquisition): สิ่งที่ทำวันนี้ ติดเซนเซอร์ วัด ส่ง และปรับเทียบข้อมูล',
        'ด้านที่ 2 สร้างโมเดล 3 มิติ (3D Modeling): สร้างร่างแฝดที่สมจริงทั้งรูปทรงและการเคลื่อนไหว',
        'ด้านที่ 3 จำลองและควบคุม (Simulation & Control): ทดลองสถานการณ์ในแฝด แล้วสั่งงานของจริงผ่านแฝด',
      ],
    },
    hints: ['อ่านคำอธิบายหลังตอบแต่ละข้อ', 'ทบทวนได้จากปุ่ม "ทฤษฎี" ของแต่ละภารกิจ'],
  },
]

export function twinObjectives(m: TwinMission, c: TwinCtx): Record<string, boolean> {
  return Object.fromEntries(m.objectives.map((o) => [o.id, o.check(c)]))
}

export const TWIN_MINI_QUIZ: QuizQuestion[] = [
  {
    id: 'tw-m-what',
    topic: 'แฝดดิจิทัล',
    q: 'แฝดดิจิทัลต่างจากโมเดล 3D ธรรมดาอย่างไร?',
    choices: ['สวยกว่า', 'อัปเดตตามข้อมูลจริงจากเซนเซอร์ตลอดเวลา', 'ใช้แทนของจริงได้เลย ไม่ต้องมีของจริง', 'ไม่ต่างกัน'],
    answer: 1,
    explain: 'แฝดดิจิทัลเชื่อมกับของจริงด้วยข้อมูล จึงรู้สถานะจริง ณ ตอนนั้น ไม่ใช่แค่รูปร่าง',
  },
  {
    id: 'tw-m-gateway',
    topic: 'อุปกรณ์',
    q: 'เกตเวย์รับข้อมูล (DAQ) ทำหน้าที่อะไร?',
    choices: ['จ่ายไฟให้มอเตอร์', 'รวบรวมข้อมูลจากเซนเซอร์แล้วส่งให้แฝดแบบเรียลไทม์', 'ควบคุมการเต้นของหุ่น', 'ชาร์จแบตเตอรี่'],
    answer: 1,
    explain: 'เกตเวย์อ่านค่าจากเซนเซอร์ทุกตัว แล้วส่งผ่านช่องสัญญาณไปยังแฝดดิจิทัล',
  },
  {
    id: 'tw-m-where',
    topic: 'ตำแหน่งเซนเซอร์',
    q: 'ถ้าอยากรู้ว่ามอเตอร์เข่าใกล้ไหม้หรือยัง ควรติดเซนเซอร์อุณหภูมิที่ไหน?',
    choices: ['ที่หัวหุ่น', 'ที่มอเตอร์เข่า', 'ที่โต๊ะโฮโลแกรม', 'ที่ไหนก็ได้ ค่าเหมือนกัน'],
    answer: 1,
    explain: 'ต้องวัดใกล้จุดที่ร้อนจริง ที่หัวหุ่นวัดได้แค่อุณหภูมิห้อง',
  },
]

export const TWIN_FINAL_QUIZ: QuizQuestion[] = [
  {
    id: 'tw-q-nyquist',
    topic: 'Nyquist',
    q: 'สัญญาณสั่นสูงสุด 180 Hz ต้องวัดถี่อย่างน้อยกี่ครั้งต่อวินาทีจึงไม่เกิดความถี่หลอก?',
    choices: ['90', '180', 'มากกว่า 360', '1 ครั้งก็พอ'],
    answer: 2,
    explain: 'ตามทฤษฎีบท Nyquist ต้องวัดถี่กว่า 2 เท่าของความถี่สูงสุด คือมากกว่า 360 ครั้ง/วินาที',
  },
  {
    id: 'tw-q-budget',
    topic: 'ช่องสัญญาณ',
    q: 'เซนเซอร์ส่ง 500 ครั้ง/วินาที ครั้งละ 6 ไบต์ ใช้ช่องสัญญาณเท่าไร?',
    choices: ['3 kbps', '24 kbps', '500 kbps', '6 kbps'],
    answer: 1,
    explain: '500 × 6 ไบต์ × 8 บิต = 24,000 บิต/วินาที = 24 kbps',
  },
  {
    id: 'tw-q-zero',
    topic: 'การปรับเทียบ',
    q: 'ทำไมต้องให้หุ่นยืนท่าเตรียม (แขนลง 0°) ก่อนกด "ตั้งศูนย์" Encoder?',
    choices: ['เพื่อประหยัดแบต', 'เพราะระบบจะจำค่าดิบตอนนั้นเป็นมุม 0° ถ้าแขนกางอยู่ ศูนย์จะเพี้ยน', 'เพื่อให้เซนเซอร์เย็นลง', 'ไม่จำเป็น'],
    answer: 1,
    explain: 'การตั้งศูนย์คือการบอกระบบว่า "ตอนนี้คือ 0°" แขนจึงต้องอยู่ที่ 0° จริงตอนกด',
  },
  {
    id: 'tw-q-threshold',
    topic: 'เกณฑ์เตือน',
    q: 'ตั้งเกณฑ์เตือนอุณหภูมิต่ำกว่าค่าปกติตอนทำงาน (เช่น 35 °C) จะเกิดอะไรขึ้น?',
    choices: ['เตือนทันทุกครั้ง ดีที่สุด', 'เตือนผิด (False alarm) หุ่นถูกหยุดทั้งที่ไม่มีปัญหา', 'มอเตอร์เย็นลง', 'ไม่มีผล'],
    answer: 1,
    explain: 'เกณฑ์ต้องสูงกว่าค่าปกติ แต่ต่ำกว่าจุดเสียหายพอที่จะหยุดได้ทัน',
  },
  {
    id: 'tw-q-garbage',
    topic: 'คุณภาพข้อมูล',
    q: 'ถ้าเซนเซอร์ติดผิดที่ หรือไม่ได้ปรับเทียบ แฝดดิจิทัลจะเป็นอย่างไร?',
    choices: ['ยังแม่นยำเหมือนเดิม', 'แสดงข้อมูลที่ผิดและอาจเตือนผิดหรือไม่เตือนเลย', 'แก้ตัวเองได้อัตโนมัติ', 'หยุดทำงานทันที'],
    answer: 1,
    explain: 'แฝดดีได้เท่าข้อมูลที่ป้อนเข้าไป (Garbage in, garbage out)',
  },
]

/* ---------------- guided steps ---------------- */
export interface TwinGuideStep {
  id: string
  kind: 'info' | 'select' | 'mount' | 'rate' | 'link' | 'pose' | 'zero' | 'tempcal' | 'rule' | 'test' | 'observe'
  title: string
  why: string
  device?: DeviceId
  sensor?: SensorId
  slot?: SlotId
  rate?: number
  rule?: keyof AlertRules
  value?: number
  camera?: 'overview' | 'robot' | 'twin' | 'tray'
  panel?: 'mission' | 'sensors' | 'data' | 'calib' | 'monitor'
  observe?: 'miniQuiz' | 'quiz'
  check: (c: TwinCtx) => boolean
}

const RULE_STEP: Record<keyof AlertRules, { title: string; why: string }> = {
  tempMax: { title: 'ตั้งเตือนเมื่อมอเตอร์เข่าร้อนเกิน 60 °C', why: 'ปกติร้อนไม่เกิน 42 °C และเสียหายที่ 85 °C ตั้ง 60 จะไม่เตือนผิดและยังหยุดได้ทัน' },
  vibMax: { title: 'ตั้งเตือนเมื่อลูกปืนสั่นเกิน 0.4 g', why: 'ลูกปืนดีสั่นราว 0.07 g พอเริ่มสึกจะสูงขึ้นเรื่อย ๆ ถึง 0.85 g' },
  socMin: { title: 'ตั้งให้กลับแท่นชาร์จเมื่อแบตต่ำกว่า 20%', why: 'หุ่นต้องเหลืออย่างน้อย 10% เพื่อเดินกลับเอง ตั้ง 20% เผื่อไว้' },
}

export function twinGuideSteps(mission: number): TwinGuideStep[] {
  switch (mission) {
    case 0:
      return [{ id: 'm0-intro', kind: 'info', title: 'อ่านแนะนำแล็บแล้วกด "เริ่มเลย"', why: 'จากนั้นภารกิจที่ 1 จะเริ่มเอง และโหมดพาทำจะชี้จุดที่ต้องแตะทีละขั้น', check: (c) => !!c.tutorial.seenIntro }]
    case 1:
      return [
        ...(['shoulderR', 'kneeR', 'hip', 'battery', 'gateway', 'twin'] as DeviceId[]).map<TwinGuideStep>((d) => ({
          id: `m1-${d}`,
          kind: 'select',
          title: `แตะ "${DEVICES[d].nameTh}" แล้วอ่านการ์ด`,
          why: d === 'twin' ? 'นี่คือร่างแฝดที่น้องจะสร้างในภารกิจถัดไป' : d === 'gateway' ? 'ทุกข้อมูลวิ่งผ่านกล่องนี้ก่อนถึงแฝด' : 'รู้หน้าที่และจุดที่อาจพัง',
          device: d,
          camera: d === 'twin' ? 'twin' : d === 'gateway' ? 'tray' : 'robot',
          check: (c) => c.found.includes(d) || c.found.length >= TWIN_FIND_TARGET,
        })),
        { id: 'm1-quiz', kind: 'observe', observe: 'miniQuiz', title: 'ตอบ Mini quiz 3 ข้อในแผงภารกิจ', why: 'ทบทวนความต่างของของจริง ข้อมูล และแฝด', panel: 'mission', check: (c) => c.miniQuizCorrect >= 3 },
      ]
    case 2:
      return (['temp', 'vib', 'angle', 'power'] as SensorId[]).map<TwinGuideStep>((s) => ({
        id: `mount-${s}`,
        kind: 'mount',
        title: `หยิบ "${SENSORS[s].nameTh}" แล้วติดที่${SLOT_TH[SENSORS[s].slot]}`,
        why: SENSORS[s].why,
        sensor: s,
        slot: SENSORS[s].slot,
        camera: 'robot',
        check: (c) => sensorOk(c, s),
      }))
    case 3:
      return [
        { id: 'rate-vib', kind: 'rate', sensor: 'vib', rate: 500, title: 'ตั้งความสั่นเป็น 500 ครั้ง/วินาที', why: `ลูกปืนสั่น ${BEARING_HZ} Hz ต้องวัดถี่กว่า ${BEARING_HZ * 2} ครั้ง/วินาที ไม่เช่นนั้นจะเห็นความถี่หลอก`, panel: 'data', check: (c) => rateChecks(c.rates).vib && c.rates.vib <= 500 },
        { id: 'rate-angle', kind: 'rate', sensor: 'angle', rate: 50, title: 'ตั้งมุมแขนเป็น 50 ครั้ง/วินาที', why: 'แขนแฝดจะขยับลื่นตามแขนจริง ไม่กระตุก', panel: 'data', check: (c) => rateChecks(c.rates).angle },
        { id: 'rate-temp', kind: 'rate', sensor: 'temp', rate: 1, title: 'ลดอุณหภูมิเหลือ 1 ครั้ง/วินาที', why: 'อุณหภูมิเปลี่ยนช้ามาก วัดถี่เกินแค่เปลืองช่องสัญญาณ', panel: 'data', check: (c) => c.link.util <= SAFE_UTIL || c.rates.temp <= 1 },
        { id: 'link', kind: 'link', title: `ดูแถบช่องสัญญาณให้ไม่เกิน ${Math.round(SAFE_UTIL * 100)}%`, why: 'ถ้าข้อมูลล้น ข้อมูลจะต่อคิว แฝดจะช้าตามหลังของจริงหลายวินาที', panel: 'data', check: (c) => c.link.util <= SAFE_UTIL },
      ]
    case 4:
      return [
        { id: 'pose', kind: 'pose', title: 'กด "ให้หุ่นยืนท่าเตรียม" (แขนลง 0°)', why: 'ต้องให้แขนอยู่ที่ 0° จริงก่อน ระบบจึงจำจุดนี้เป็นศูนย์ได้ถูก', panel: 'calib', camera: 'robot', check: (c) => c.hold || encoderOk(c.encoderOffset) },
        { id: 'zero', kind: 'zero', title: 'กด "ตั้งศูนย์ Encoder"', why: 'ระบบจำค่าดิบตอนแขนอยู่ 0° แล้วลบออกทุกครั้ง แขนแฝดจะตรงกับของจริง', panel: 'calib', camera: 'twin', check: (c) => encoderOk(c.encoderOffset) },
        { id: 'tempcal', kind: 'tempcal', title: 'ตั้งสูตรอุณหภูมิตาม Datasheet: 500 mV ที่ 0 °C และ 10 mV/°C', why: 'เทียบกับเทอร์โมมิเตอร์อ้างอิง ค่าของแฝดต้องตรงกับของจริง', panel: 'calib', check: (c) => tempCalOk(c.tempCal) },
        { id: 'sync', kind: 'info', title: 'ปล่อยให้หุ่นเต้นต่อ แล้วดูว่าแฝดตามทันของจริง', why: 'ดีเลย์ต้องน้อยกว่า 0.2 วินาที ถ้าไม่ผ่าน กลับไปลดอัตราการวัดในแท็บข้อมูล', panel: 'calib', check: syncOk },
      ]
    case 5:
      return [
        ...(['tempMax', 'vibMax', 'socMin'] as Array<keyof AlertRules>).map<TwinGuideStep>((r, i) => ({
          id: `rule-${r}`,
          kind: 'rule',
          rule: r,
          value: SOLUTION_RULES()[r],
          title: RULE_STEP[r].title,
          why: RULE_STEP[r].why,
          panel: 'monitor',
          check: (c) => !!c.testCheckpoints[i + 1] || (c.testScore?.score ?? 0) >= 4,
        })),
        { id: 'normal', kind: 'info', title: 'ตรวจว่าวันปกติไม่มีการเตือนผิด', why: 'ถ้ามีเตือนผิด ให้เพิ่มเกณฑ์ขึ้นเล็กน้อย (ไม่ควรต่ำกว่าค่าปกติ)', panel: 'monitor', check: (c) => !!c.testCheckpoints[0] },
        { id: 'test', kind: 'test', title: 'กด "🧪 ทดสอบแฝดอัตโนมัติ"', why: 'ระบบจำลอง 4 สถานการณ์ ใช้ข้อมูลผ่านเซนเซอร์ อัตราการวัด และการปรับเทียบที่น้องตั้งไว้จริง', panel: 'monitor', check: (c) => !!c.testScore && c.testScore.score >= c.testScore.total },
      ]
    case 6:
      return [{ id: 'quiz', kind: 'observe', observe: 'quiz', title: 'ทำแบบทดสอบ 5 ข้อในแผงภารกิจ', why: 'ทุกข้อมีคำอธิบายหลังตอบ', panel: 'mission', check: (c) => c.finalDone }]
    default:
      return []
  }
}

export function twinGuide(mission: number, c: TwinCtx) {
  const steps = twinGuideSteps(mission).map((step) => ({ step, done: step.check(c) }))
  const index = steps.findIndex((s) => !s.done)
  const current = index >= 0 ? steps[index].step : null
  let note: string | null = null
  if (current?.kind === 'mount' && current.sensor) {
    const st = c.mount.sensors.find((x) => x.sensor === current.sensor)
    if (st?.state === 'wrong') note = st.message
  }
  if (mission === 3 && c.link.util > 1) note = `ช่องสัญญาณล้น (${Math.round(c.link.util * 100)}%) แฝดช้าตามหลัง ${c.link.latency.toFixed(1)} วินาที ลองลดอัตราการวัดที่ไม่จำเป็น`
  if (mission === 4 && current?.kind === 'zero' && !c.hold) note = 'หุ่นยังเต้นอยู่ ถ้ากดตั้งศูนย์ตอนนี้ ศูนย์จะเพี้ยน กด "ให้หุ่นยืนท่าเตรียม" ก่อน'
  return { steps, index: index >= 0 ? index : steps.length, total: steps.length, current, note }
}
