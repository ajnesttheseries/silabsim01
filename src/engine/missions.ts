/** Mission content (Thai) and objective checks. Checks are pure functions over a context snapshot. */
import type { ShelfItem } from './circuit/catalog'
import type { SolutionKey } from './circuit/solutions'
import type { CircuitReport } from './circuit/validator'
import type { Readings, Actuators } from './firmware'
import type { Rule } from './rules'
import type { Challenge } from './scenarios'

export interface MissionCtx {
  report: CircuitReport
  usb: boolean
  powered: boolean
  readings: Readings
  actuators: Actuators
  found: ShelfItem[]
  miniQuizCorrect: number
  tutorial: { cam: boolean; select: boolean; wire: boolean; seenIntro?: boolean }
  blinkUsed: boolean
  obs: { tMin: number; tMax: number; lMin: number; lMax: number }
  ldrAnswerCorrect: boolean
  challenge: Challenge | null
  rules: Rule[]
  autoTest: { score: number; total: number } | null
  finalDone: boolean
}

export interface Objective {
  id: string
  th: string
  check: (c: MissionCtx) => boolean
}

export interface Mission {
  id: number
  title: string
  short: string
  minutes: number
  intro: string
  objectives: Objective[]
  theory: { title: string; body: string[]; formula?: string }
  hints: [string, string]
  solution?: SolutionKey | ((c: MissionCtx) => SolutionKey | undefined)
}

export const FIND_TARGET = 6
export const FIND_LIST: ShelfItem[] = ['board', 'breadboard', 'jumper', 'usb', 'led', 'resistor', 'dht', 'ldr', 'soil', 'pir', 'buzzer', 'driver', 'fan', 'multimeter']

const ledOk = (c: MissionCtx) => c.report.leds.some((l) => l.status === 'ok' && l.drive?.kind === 'GPIO')
const anyLedLit = (c: MissionCtx) => Object.values(c.actuators.leds).some((l) => l.on && !l.overcurrent)
const dhtOk = (c: MissionCtx) => Object.entries(c.report.modules).some(([, m]) => m.ok && m.compId.startsWith('dht'))
const ldrOk = (c: MissionCtx) => c.report.ldrs.some((d) => d.status === 'ok')
const softOk = (c: MissionCtx, prefix: string) => Object.values(c.report.modules).some((m) => m.ok && m.compId.startsWith(prefix))
const ruleUses = (c: MissionCtx, sensor: Rule['sensor'], act: Rule['actuator'][]) =>
  c.rules.some((r) => r.enabled && r.sensor === sensor && act.includes(r.actuator))

export const MISSIONS: Mission[] = [
  {
    id: 0,
    title: 'เปิดประตูแล็บ',
    short: 'แนะนำแล็บ',
    minutes: 1,
    intro:
      'ยินดีต้อนรับสู่ห้องแล็บ AIoT! วิศวกรระบบ AIoT และสมองกลฝังตัวคือคนที่ "ใส่สมองอัจฉริยะ" ให้อุปกรณ์ธรรมดา ให้มันรับรู้สภาพแวดล้อม คิด และทำงานเองได้',
    // intro only: closing the welcome window passes this mission and opens mission 1
    // (the old camera/select/wire practice left a stray wire behind in later missions)
    objectives: [{ id: 'intro', th: 'อ่านแนะนำแล็บแล้วกด "เริ่มเลย"', check: (c) => !!c.tutorial.seenIntro }],
    theory: {
      title: 'AIoT คืออะไร',
      body: [
        'IoT (Internet of Things) คืออุปกรณ์ที่เชื่อมต่ออินเทอร์เน็ตได้ เช่น เซนเซอร์อุณหภูมิที่ส่งค่าขึ้นแอปมือถือ',
        'AI (Artificial Intelligence) ทำให้อุปกรณ์วิเคราะห์ข้อมูลและตัดสินใจได้เอง',
        'AIoT = AI + IoT: อุปกรณ์ที่รับรู้ คิด และสั่งงานได้เอง ระบบสมองกลฝังตัว (Embedded System) คือคอมพิวเตอร์ขนาดเล็กที่ฝังอยู่ในอุปกรณ์ เช่น บอร์ดไมโครคอนโทรลเลอร์',
        'ในด่านที่ 1 นี้ เราจะเริ่มจากพื้นฐานที่สุด: ฮาร์ดแวร์และเซนเซอร์ "ตาและหู" ของระบบ',
      ],
    },
    hints: ['อ่านหน้าต่างแนะนำให้ครบ 3 หน้า แล้วกด "เริ่มเลย"', 'ลากนิ้วหรือเมาส์บนฉากเพื่อหมุนกล้อง ใช้สองนิ้วหรือล้อเมาส์เพื่อซูม'],
  },
  {
    id: 1,
    title: 'รู้จักอุปกรณ์',
    short: 'รู้จักอุปกรณ์',
    minutes: 3,
    intro: 'วิศวกรต้องรู้จักเครื่องมือของตัวเอง ไปที่ชั้นวางอุปกรณ์ แตะแต่ละชิ้นเพื่ออ่านการ์ดข้อมูล แล้วลองตอบคำถามจับคู่สั้น ๆ',
    objectives: [
      { id: 'found', th: `แตะดูการ์ดอุปกรณ์บนชั้นวางอย่างน้อย ${FIND_TARGET} ชิ้น`, check: (c) => c.found.length >= FIND_TARGET },
      { id: 'quiz', th: 'ตอบ Mini quiz จับคู่อุปกรณ์กับหน้าที่ให้ถูกทั้ง 3 ข้อ', check: (c) => c.miniQuizCorrect >= 3 },
    ],
    theory: {
      title: 'ส่วนประกอบของระบบสมองกลฝังตัว',
      body: [
        'อินพุต (Input) คือเซนเซอร์ที่รับรู้โลกภายนอก เช่น อุณหภูมิ แสง ความชื้น การเคลื่อนไหว',
        'ตัวประมวลผล (Processor) คือบอร์ดไมโครคอนโทรลเลอร์ที่รันโปรแกรม',
        'เอาต์พุต (Output/Actuator) คืออุปกรณ์ที่ลงมือทำ เช่น LED บัซเซอร์ พัดลม',
        'เบรดบอร์ดและสายจัมเปอร์ช่วยให้ต่อวงจรทดลองได้โดยไม่ต้องบัดกรี',
      ],
    },
    hints: ['กดปุ่มกล้อง "ชั้นวาง" เพื่อซูมไปที่ชั้นวาง แล้วแตะกล่องอุปกรณ์ทีละชิ้น', 'การ์ดของแต่ละอุปกรณ์บอกหน้าที่ไว้ อ่านการ์ดของ LDR, บอร์ด และ PIR แล้วกลับมาตอบคำถาม'],
  },
  {
    id: 2,
    title: 'Hello Hardware! ต่อวงจร LED',
    short: 'วงจร LED',
    minutes: 4,
    intro: 'งานแรกของวิศวกรสมองกลฝังตัวทั่วโลกคือ "ทำให้ไฟ LED ติด" ต่อวงจร GPIO → ตัวต้านทาน → LED (ขายาว Anode) → LED (ขาสั้น Cathode) → GND แล้วจ่ายไฟ',
    objectives: [
      { id: 'usb', th: 'เสียบสาย USB ให้บอร์ด (แตะสาย USB บนชั้นวาง)', check: (c) => c.usb },
      { id: 'circuit', th: 'ต่อวงจร LED พร้อมตัวต้านทานจำกัดกระแสจากขา GPIO ลง GND', check: ledOk },
      { id: 'lit', th: 'กด Power ON แล้วสั่ง LED ติด (แท็บ "กฎ" → ทดสอบสั่งงาน หรือปุ่มกระพริบ)', check: anyLedLit },
      { id: 'blink', th: 'กดปุ่ม "สั่งกระพริบ" ให้ LED กระพริบ', check: (c) => c.blinkUsed && ledOk(c) },
    ],
    theory: {
      title: 'กฎของโอห์มกับ LED',
      formula: 'R = (V_supply − V_LED) / I',
      body: [
        'ขา GPIO ของบอร์ดจ่ายแรงดัน 3.3V เมื่อสั่ง HIGH',
        'LED สีแดงมีแรงดันตกคร่อม (V_f) ประมาณ 2.0V ส่วนสีเขียว/น้ำเงินประมาณ 3.0V',
        'ถ้าต้องการกระแส 10 mA (0.01 A): R = (3.3 − 2.0) / 0.01 ≈ 130 Ω',
        'ตัวต้านทานมีค่ามาตรฐาน เราเลือกค่าที่ใกล้และ "สูงกว่า" เพื่อความปลอดภัย คือ 220 Ω ซึ่งให้กระแส ≈ 5.9 mA',
        'LED มีขั้ว: ขายาว = Anode (+) ขาสั้น = Cathode (−) ต่อกลับขั้วไฟจะไม่ติด',
        'หมายเหตุ: ค่าในแล็บนี้คำนวณจากแบบจำลองอย่างง่ายเพื่อการเรียนรู้ ไม่ใช่โปรแกรมจำลองวงจรเต็มรูปแบบ (SPICE)',
      ],
    },
    hints: [
      'เริ่มจากต่อสายจาก GND ของบอร์ดไปยังราง − ของเบรดบอร์ด แล้ววางตัวต้านทาน 220Ω และ LED ให้ขาอยู่คอลัมน์ต่อกัน',
      'ขา GPIO (เช่น G18) → รูในคอลัมน์เดียวกับขาหนึ่งของตัวต้านทาน; ขาอีกข้างของตัวต้านทานอยู่คอลัมน์เดียวกับขายาวของ LED; ขาสั้นของ LED → สายดำไปราง −',
    ],
    solution: 'led',
  },
  {
    id: 3,
    title: 'ติดตั้งเซนเซอร์อุณหภูมิและความชื้น',
    short: 'เซนเซอร์อุณหภูมิ',
    minutes: 4,
    intro: 'ระบบอัจฉริยะต้อง "รับรู้" สภาพแวดล้อมได้ ติดตั้งเซนเซอร์วัดอุณหภูมิและความชื้นแบบดิจิทัล ต่อ VCC (3.3V), GND และ DATA → GPIO แล้วลองเปิดฮีตเตอร์หรือพัดลม',
    objectives: [
      { id: 'wired', th: 'ต่อเซนเซอร์: VCC → 3V3, GND → GND, DATA → GPIO', check: dhtOk },
      { id: 'reading', th: 'จ่ายไฟแล้วเห็นค่าอุณหภูมิบน Serial Monitor', check: (c) => c.powered && c.readings.temp != null },
      { id: 'change', th: 'ปรับฮีตเตอร์/พัดลม จนค่าที่อ่านได้เปลี่ยนอย่างน้อย 2 °C', check: (c) => c.obs.tMax - c.obs.tMin >= 2 },
    ],
    theory: {
      title: 'เซนเซอร์ไม่ได้อ่านค่าได้ทันทีและไม่สมบูรณ์แบบ',
      body: [
        'เซนเซอร์แบบนี้ส่งข้อมูลดิจิทัลผ่านสายเส้นเดียว และอ่านค่าได้ประมาณทุก 2 วินาที ถ้าอ่านถี่กว่านั้นจะได้ค่าเดิม',
        'ตัวเซนเซอร์มีมวล ต้องใช้เวลาให้อุณหภูมิของตัวมันเองเท่ากับอากาศ (เวลาตอบสนอง)',
        'ค่าคลาดเคลื่อนประมาณ ±0.5 °C และ ±2–5 %RH และมีสัญญาณรบกวน (noise) เล็กน้อย ลองปิด noise ในแท็บสภาพแวดล้อมเพื่อเปรียบเทียบ',
        'ถ้าไม่มีไฟเลี้ยงหรือสายสัญญาณหลุด โปรแกรมจะอ่านได้ "NaN" (Not a Number) ซึ่งวิศวกรต้องเขียนโค้ดรองรับกรณีนี้',
      ],
    },
    hints: [
      'เสียบเซนเซอร์ลงเบรดบอร์ด ขาทั้ง 3 จะอยู่ 3 คอลัมน์ติดกัน: VCC, DATA, GND',
      'ต่อราง + ให้มีไฟจากขา 3V3 ก่อน จากนั้นต่อ VCC → ราง +, GND → ราง −, DATA → ขา G4 ด้วยสายสีเหลือง',
    ],
    solution: 'dht',
  },
  {
    id: 4,
    title: 'วัดแสงด้วย LDR และวงจรแบ่งแรงดัน',
    short: 'วัดแสง LDR',
    minutes: 4,
    intro: 'บอร์ดอ่าน "ความต้านทาน" ตรง ๆ ไม่ได้ แต่อ่าน "แรงดัน" ได้ด้วย ADC เราจึงต่อ LDR กับตัวต้านทาน 10kΩ เป็นวงจรแบ่งแรงดัน แล้วต่อจุดกลางเข้าขา ADC',
    objectives: [
      { id: 'wired', th: 'ต่อ LDR + 10kΩ เป็นวงจรแบ่งแรงดัน แล้วต่อจุดกลางเข้าขา ADC', check: ldrOk },
      { id: 'change', th: 'หรี่/เปิดไฟโคมหรือปิดม่าน จนค่า ADC เปลี่ยนอย่างน้อย 800', check: (c) => c.obs.lMax - c.obs.lMin >= 800 },
      { id: 'answer', th: 'ตอบคำถาม "แสงมากขึ้น ค่าเพิ่มหรือลด เพราะอะไร" ให้ถูก', check: (c) => c.ldrAnswerCorrect },
    ],
    theory: {
      title: 'วงจรแบ่งแรงดันและ ADC 12 บิต',
      formula: 'V_out = V_in × R2 / (R1 + R2)',
      body: [
        'R1 คือตัวต้านทานฝั่งไฟ 3.3V และ R2 คือตัวต้านทานฝั่ง GND ส่วน V_out คือแรงดันที่จุดกลาง',
        'LDR มีความต้านทานลดลงเมื่อแสงมากขึ้น (ประมาณ ~20kΩ ที่ 10 lux และเหลือไม่ถึง 1kΩ ในแสงจ้า)',
        'ADC 12 บิตแปลงแรงดัน 0–3.3V เป็นตัวเลข 0–4095: ADC = V_out / 3.3 × 4095',
        'ตัวอย่าง: LDR = 10kΩ, R2 = 10kΩ → V_out = 1.65V → ADC ≈ 2048',
        'ข้อควรรู้: ADC ของบอร์ดตระกูล ESP32 ของจริงไม่เป็นเส้นตรงทั้งช่วง และอิ่มตัวใกล้ ~3.1V แล็บนี้ใช้แบบจำลองเส้นตรงเพื่อให้เข้าใจง่าย',
      ],
    },
    hints: [
      'วาง LDR และตัวต้านทาน 10kΩ ให้มีขาหนึ่งอยู่ในคอลัมน์เดียวกัน คอลัมน์นั้นคือ "จุดกลาง"',
      'ขาอีกข้างของ LDR → ราง + (3V3), ขาอีกข้างของ 10kΩ → ราง − (GND), จุดกลาง → ขา G34 (ADC1) ด้วยสายสีส้ม',
    ],
    solution: 'ldr',
  },
  {
    id: 5,
    title: 'ภารกิจท้าทาย: ระบบอัจฉริยะทำงานเอง',
    short: 'ภารกิจท้าทาย',
    minutes: 5,
    intro: 'ถึงเวลาเป็นวิศวกรตัวจริง! เลือกโจทย์ 1 ข้อ ต่อวงจรเพิ่ม และตั้งกฎใน Rule Builder ให้ระบบทำงานเองโดยไม่ต้องกดสั่ง จากนั้นกด "ทดสอบอัตโนมัติ"',
    objectives: [
      { id: 'choose', th: 'เลือกโจทย์ 1 ข้อ: บ้านสัตว์เลี้ยง, ห้องเรียน หรือกระถางต้นไม้อัจฉริยะ', check: (c) => c.challenge !== null },
      {
        id: 'wired',
        th: 'ต่อวงจรที่โจทย์ต้องการครบ (ดูรายการในแผงภารกิจ)',
        check: (c) =>
          c.challenge === 'classroom'
            ? dhtOk(c) && ldrOk(c) && ledOk(c) && c.report.fans.some((f) => f.status === 'via-driver')
            : c.challenge === 'plant'
              ? softOk(c, 'soil') &&
                c.report.leds.some((l) => l.status === 'ok' && l.color === 'red' && l.drive?.kind === 'GPIO') &&
                c.report.leds.some((l) => l.status === 'ok' && l.color === 'green' && l.drive?.kind === 'GPIO') &&
                c.report.buzzers.some((b) => b.status === 'ok' && b.drive?.kind === 'GPIO')
              : c.challenge === 'pet'
                ? dhtOk(c) && softOk(c, 'pir') && ledOk(c) && c.report.fans.some((f) => f.status === 'via-driver')
                : false,
      },
      {
        id: 'rules',
        th: 'ตั้งกฎ IF–THEN ใน Rule Builder ให้ครบตามโจทย์',
        check: (c) =>
          c.challenge === 'classroom'
            ? ruleUses(c, 'temp', ['fan']) && ruleUses(c, 'light', ['ledRed', 'ledGreen', 'ledBlue'])
            : c.challenge === 'plant'
              ? ruleUses(c, 'soil', ['ledRed']) && ruleUses(c, 'soil', ['ledGreen']) && ruleUses(c, 'soil', ['buzzer'])
              : c.challenge === 'pet'
                ? ruleUses(c, 'temp', ['fan']) && ruleUses(c, 'motion', ['ledRed', 'ledGreen', 'ledBlue'])
                : false,
      },
      { id: 'test', th: 'ผ่านการทดสอบอัตโนมัติอย่างน้อย 3 จาก 4 สถานการณ์', check: (c) => !!c.autoTest && c.autoTest.score >= 3 },
    ],
    theory: {
      title: 'จากเงื่อนไขง่าย ๆ สู่ Edge AI',
      body: [
        'ระบบควบคุมแบบเงื่อนไข (Rule-based) ใช้ IF–THEN: ถ้าอุณหภูมิ > 30 °C แล้วเปิดพัดลม',
        'มอเตอร์พัดลมกินกระแสหลายร้อยมิลลิแอมป์ ขา GPIO จ่ายได้แค่ไม่กี่สิบมิลลิแอมป์ จึงต้องใช้โมดูลขับโหลด (MOSFET/รีเลย์) เป็น "สวิตช์" ที่ GPIO สั่งได้',
        'การตั้งค่าเกณฑ์ (threshold) ต้องเผื่อ noise ด้วย ไม่เช่นนั้นอุปกรณ์จะเปิด-ปิดถี่ ๆ เมื่อค่าอยู่ใกล้เกณฑ์ (ในงานจริงใช้ hysteresis)',
        'ในด่านที่ 2 (Edge AI) เราจะให้บอร์ด "เรียนรู้" รูปแบบจากข้อมูลแทนการตั้งกฎเอง',
      ],
    },
    hints: [
      'บ้านสัตว์เลี้ยง: เซนเซอร์อุณหภูมิ + PIR (ไฟ 5V) + LED + โมดูลขับโหลดกับพัดลม | ห้องเรียน: เซนเซอร์อุณหภูมิ + LDR + LED + พัดลม | กระถาง: เซนเซอร์ดิน + LED แดง/เขียว + บัซเซอร์',
      'บ้านสัตว์เลี้ยง: "อุณหภูมิ > 32 → เปิดพัดลม" และ "การเคลื่อนไหว ตรวจพบ → เปิด LED" | ห้องเรียน: "อุณหภูมิ > 32 → พัดลม" และ "แสง < 2500 → LED" | กระถาง: "ดิน < 35% → LED แดง/บัซเซอร์" และ "ดิน > 35% → LED เขียว"',
    ],
    solution: (c) => (c.challenge === 'plant' ? 'plant' : c.challenge === 'classroom' ? 'classroom' : c.challenge === 'pet' ? 'pet' : undefined),
  },
  {
    id: 6,
    title: 'ภารกิจสุดท้าย: สรุปและแบบทดสอบ',
    short: 'แบบทดสอบ',
    minutes: 3,
    intro: 'ทบทวนสิ่งที่ได้ลงมือทำด้วยแบบทดสอบ 5 ข้อ แล้วรับใบประกาศนักวิศวกร AIoT ฝึกหัด',
    objectives: [{ id: 'quiz', th: 'ทำแบบทดสอบ 5 ข้อให้ครบ', check: (c) => c.finalDone }],
    theory: {
      title: 'สิ่งที่ได้เรียนรู้ในด่านที่ 1',
      body: [
        'การเลือกอุปกรณ์และอ่านขาต่อ',
        'กฎของโอห์มและการจำกัดกระแส LED',
        'สัญญาณ Digital (DHT, PIR) และ Analog (LDR, ความชื้นในดิน) ผ่าน ADC 12 บิต',
        'การขับโหลดกระแสสูงผ่านโมดูลขับโหลด',
        'การตั้งเงื่อนไขให้ระบบทำงานเอง',
      ],
    },
    hints: ['ทุกข้อมีคำอธิบายหลังตอบ ลองนึกถึงสิ่งที่เจอในแล็บ', 'ย้อนกลับไปอ่าน "ทฤษฎี" ของแต่ละภารกิจได้จากแผนที่ภารกิจ'],
  },
]

export function objectivesStatus(m: Mission, c: MissionCtx): Record<string, boolean> {
  return Object.fromEntries(m.objectives.map((o) => [o.id, o.check(c)]))
}
