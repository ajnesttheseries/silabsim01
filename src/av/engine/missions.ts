/** AV & Lighting lab — missions, guided steps and quizzes (Thai). */
import type { QuizQuestion } from '../../engine/quiz'
import type { Levels, MixerState, WedgePos } from './audio'
import { checkAddresses, colorName, CONSOLE_PATCH, type ColorName, type FixtureOutput } from './dmx'
import { DEVICES, type Cable, type DeviceId, type PatchReport } from './patch'
import type { Cue } from './show'

export interface AvCtx {
  cables: Cable[]
  patch: PatchReport
  addresses: Record<string, number>
  mixer: MixerState
  levels: Levels
  rig: Record<string, FixtureOutput>
  found: string[]
  miniQuizCorrect: number
  tutorial: { cam: boolean; select: boolean; cable: boolean }
  powerOrderOk: boolean
  gainOk: boolean
  loudOk: boolean
  answerOk: boolean
  cues: Cue[]
  showScore: { score: number; total: number } | null
  /** per-checkpoint pass for the live cue list */
  showCheckpoints: boolean[]
  challenge: 'concert' | 'exhibit' | null
  exhibitScore: { score: number; total: number } | null
  exhibitCheckpoints: boolean[]
  /** the visitor scene differs from the idle scene */
  scenesEdited: boolean
  finalDone: boolean
}

export interface AvObjective {
  id: string
  th: string
  check: (c: AvCtx) => boolean
}
export interface AvMission {
  id: number
  title: string
  short: string
  minutes: number
  intro: string
  objectives: AvObjective[]
  theory: { title: string; body: string[]; formula?: string }
  hints: [string, string]
}

export const COLOR_TARGETS: Record<string, ColorName> = { par1: 'yellow', par2: 'magenta', par3: 'cyan', par4: 'white' }
export const AV_FIND_LIST: DeviceId[] = ['par1', 'mover1', 'console', 'term', 'micDyn', 'micCond', 'mixer', 'amp', 'spkL', 'wedge']
export const AV_FIND_TARGET = 6

export const dmxDone = (c: AvCtx) => c.patch.dmxChain.length === 6 && c.patch.dmxTerminated
export const addrDone = (c: AvCtx) => checkAddresses(c.addresses).every((i) => i.severity === 'ok')
export const colorDone = (c: AvCtx, f: string) => {
  const o = c.rig[f]
  return !!o && o.intensity >= 0.4 && colorName(o.r, o.g, o.b) === COLOR_TARGETS[f]
}
export const audioDone = (c: AvCtx) =>
  c.patch.micChannel.micDyn !== null &&
  !!c.patch.speakerFeed.spkL &&
  !!c.patch.speakerFeed.spkR &&
  ['mainL', 'mainR'].includes(c.patch.speakerFeed.spkL.src) &&
  ['mainL', 'mainR'].includes(c.patch.speakerFeed.spkR.src) &&
  c.patch.impedance.A >= 4 &&
  c.patch.impedance.B >= 4

export const AV_MISSIONS: AvMission[] = [
  {
    id: 0,
    title: 'เปิดม่านเวที',
    short: 'แนะนำแล็บ',
    minutes: 1,
    intro:
      'ยินดีต้อนรับสู่เวทีคอนเสิร์ต! วิศวกรระบบภาพ เสียง และแสงอัจฉริยะ คือคนที่ทำให้ไฟ เสียง และจอภาพทั้งเวทีทำงานพร้อมกันอย่างแม่นยำ ตั้งแต่คอนเสิร์ต สตูดิโอ ไปจนถึงอาคารอัจฉริยะ เริ่มจากฝึกใช้แล็บกันก่อน',
    objectives: [
      { id: 'cam', th: 'หมุนหรือซูมกล้อง (หรือกดปุ่มมุมกล้อง)', check: (c) => c.tutorial.cam },
      { id: 'select', th: 'แตะเลือกอุปกรณ์ในฉาก 1 ชิ้น', check: (c) => c.tutorial.select },
      { id: 'cable', th: 'ลองเสียบสาย 1 เส้น (กด "เสียบสาย" แล้วแตะช่อง OUT และช่อง IN)', check: (c) => c.tutorial.cable },
    ],
    theory: {
      title: 'งานของวิศวกรระบบภาพ เสียง และแสง',
      body: [
        'ระบบแสง: ไฟเวทีหลายสิบดวงถูกควบคุมด้วยโปรโตคอลดิจิทัล DMX512 จากคอนโซลตัวเดียว',
        'ระบบเสียง: เส้นทางสัญญาณ ไมค์ → มิกเซอร์ → แอมป์ → ลำโพง ต้องตั้งระดับให้เสียงดังชัดโดยไม่แตกและไม่หอน',
        'ระบบภาพ: จอ LED และโปรเจกเตอร์แสดงภาพประกอบโชว์',
        'ระบบอัตโนมัติ: Cue list และ Timecode ทำให้แสง เสียง ภาพ เปลี่ยนพร้อมกันตรงจังหวะเพลงทุกครั้ง',
      ],
    },
    hints: ['ลากบนฉากเพื่อหมุนกล้อง ใช้ล้อเมาส์หรือสองนิ้วเพื่อซูม', 'กดปุ่ม "🔌 เสียบสาย" แตะช่อง OUT ของอุปกรณ์หนึ่ง แล้วแตะช่อง IN ของอีกอุปกรณ์ ลบสายได้ภายหลัง'],
  },
  {
    id: 1,
    title: 'รู้จักอุปกรณ์บนเวที',
    short: 'รู้จักอุปกรณ์',
    minutes: 3,
    intro: 'แตะอุปกรณ์บนเวทีและโต๊ะควบคุม (FOH) เพื่ออ่านการ์ดข้อมูล แล้วตอบคำถามจับคู่สั้น ๆ',
    objectives: [
      { id: 'found', th: `แตะดูการ์ดอุปกรณ์อย่างน้อย ${AV_FIND_TARGET} ชิ้น`, check: (c) => c.found.length >= AV_FIND_TARGET },
      { id: 'quiz', th: 'ตอบ Mini quiz 3 ข้อให้ถูกทั้งหมด', check: (c) => c.miniQuizCorrect >= 3 },
    ],
    theory: {
      title: 'ระบบบนเวทีแบ่งเป็น 3 ส่วน',
      body: [
        'แสง: คอนโซล DMX → ไฟ LED PAR (สาดสี) และ Moving Head (สปอตที่ส่ายได้)',
        'เสียง: ไมโครโฟน → มิกเซอร์ (ตั้งระดับ/ผสมเสียง) → เพาเวอร์แอมป์ (ขยายกำลัง) → ลำโพงหลัก (PA) และลำโพงมอนิเตอร์บนเวที',
        'โต๊ะ FOH (Front of House) อยู่กลางผู้ชม เพื่อให้วิศวกรได้ยินและเห็นแบบเดียวกับผู้ชม',
      ],
    },
    hints: ['กดปุ่มกล้อง "ไฟบนทรัส" "เวที" และ "โต๊ะ FOH" แล้วแตะอุปกรณ์แต่ละชิ้น', 'อ่านการ์ดของคอนโซล DMX ลำโพงมอนิเตอร์ และเพาเวอร์แอมป์ แล้วกลับมาตอบคำถาม'],
  },
  {
    id: 2,
    title: 'ผสมสีแสงด้วย DMX',
    short: 'แสง DMX',
    minutes: 4,
    intro: 'ต่อสาย DMX จากคอนโซลพ่วงไปยังไฟทุกดวง ปิดท้ายด้วย Terminator ตั้ง address บนตัวไฟให้ตรงกับคอนโซล แล้วผสมแสงสีแดง เขียว น้ำเงิน ให้ได้สีตามโจทย์',
    objectives: [
      { id: 'chain', th: 'ต่อสาย DMX พ่วงครบ 6 ดวง และเสียบ Terminator ที่ดวงสุดท้าย', check: dmxDone },
      { id: 'addr', th: 'ตั้ง DMX address บนตัวไฟให้ตรงกับคอนโซลและไม่ทับกัน', check: addrDone },
      { id: 'colors', th: 'ผสมสี: PAR1 เหลือง · PAR2 ม่วงแดง · PAR3 ฟ้า · PAR4 ขาว', check: (c) => Object.keys(COLOR_TARGETS).every((f) => colorDone(c, f)) },
    ],
    theory: {
      title: 'DMX512 และการผสมสีแสงแบบบวก (Additive)',
      formula: 'address ดวงถัดไป = address ดวงนี้ + จำนวนช่อง',
      body: [
        'DMX512 ส่งค่า 512 ช่อง (1 Universe) วนซ้ำประมาณ 44 ครั้งต่อวินาที แต่ละช่องมีค่า 0–255',
        'ไฟแต่ละดวงอ่านเฉพาะช่องของตัวเอง เริ่มที่ address ที่ตั้งไว้ เช่น PAR 4 ช่องที่ address 5 ใช้ช่อง 5, 6, 7, 8',
        'สาย DMX ต่อพ่วงแบบ daisy-chain: OUT → IN → THRU → IN … และปิดท้ายด้วย Terminator 120Ω (ห้ามแยกสายแบบตัว Y ต้องใช้ DMX Splitter)',
        'แสงผสมแบบบวก: แดง + เขียว = เหลือง, แดง + น้ำเงิน = ม่วงแดง (Magenta), เขียว + น้ำเงิน = ฟ้า (Cyan), ครบสามสี = ขาว',
        'หมายเหตุ: โหมดช่องของไฟจริงมีหลายแบบ แล็บนี้ใช้โหมดย่อเพื่อให้เข้าใจง่าย',
      ],
    },
    hints: [
      'เริ่มจาก DMX OUT ของคอนโซล → DMX IN ของ PAR1 แล้วต่อ DMX THRU ของ PAR1 → DMX IN ของ PAR2 ไปเรื่อย ๆ',
      'ดูตาราง "Patch ในคอนโซล" ในแท็บแสง แล้วตั้ง address ของไฟแต่ละดวงให้ตรง: PAR1=1, PAR2=5, PAR3=9, PAR4=13, Mover1=17, Mover2=23 จากนั้นปรับ fader R/G/B',
    ],
  },
  {
    id: 3,
    title: 'ระบบเสียงเวที',
    short: 'ระบบเสียง',
    minutes: 4,
    intro: 'ต่อเส้นทางเสียง ไมค์ → มิกเซอร์ → เพาเวอร์แอมป์ → ลำโพงหลัก เปิดเครื่องให้ถูกลำดับ แล้วตั้ง Gain ให้นักร้องเสียงดังชัดโดยไม่แตก',
    objectives: [
      { id: 'chain', th: 'ต่อไมค์ไดนามิก → CH1, MAIN L/R → แอมป์ IN A/B, แอมป์ OUT A/B → ลำโพงซ้าย/ขวา', check: audioDone },
      { id: 'power', th: 'เปิดเครื่องตามลำดับ: มิกเซอร์ก่อน แล้วค่อยเปิดแอมป์', check: (c) => c.powerOrderOk },
      { id: 'gain', th: 'ตั้ง Gain ให้ค่าสูงสุดขณะร้องอยู่ช่วง −18 ถึง −3 dBFS และไม่แตก (ต่อเนื่อง 8 วินาที)', check: (c) => c.gainOk },
    ],
    theory: {
      title: 'Gain Staging: ตั้งระดับสัญญาณให้พอดี',
      formula: 'dBFS = SPL − 94 + ความไวไมค์ + Gain − 18',
      body: [
        'ไมค์ไดนามิกให้สัญญาณประมาณ −52 dBu เมื่อเสียง 94 dB SPL ซึ่งเบามาก Gain (พรีแอมป์) ขยายขึ้นมา 30–50 dB',
        'มิกเซอร์ดิจิทัลมีเพดานที่ 0 dBFS ถ้าเกินเสียงจะ "แตก" (Clipping) ควรให้ค่าสูงสุดอยู่ราว −18 ถึง −6 dBFS เผื่อไว้ (Headroom)',
        'ถ้า Gain สูงจนแตก การลด Fader ไม่ช่วย เพราะเสียงแตกไปแล้วตั้งแต่พรีแอมป์',
        'เปิดเครื่อง: ต้นทางก่อน (มิกเซอร์) แอมป์ทีหลังสุด และปิดแอมป์ก่อนเสมอ เพื่อกันเสียง "ปุ" กระแทกลำโพง',
        'หมายเหตุ: ค่าทั้งหมดเป็นแบบจำลองอย่างง่ายเพื่อการเรียนรู้',
      ],
    },
    hints: ['ต่อสายตามลำดับ ไมค์ไดนามิก OUT → มิกเซอร์ CH1 IN → MAIN L OUT → แอมป์ IN A → OUT A → ลำโพงซ้าย (ฝั่งขวาทำแบบเดียวกัน)', 'เปิดมิกเซอร์ก่อนแล้วค่อยเปิดแอมป์ กด "▶ ให้นักร้องซ้อมร้อง" แล้วเลื่อน Gain CH1 ไปราว 42–48 dB ดูแถบวัดให้อยู่ช่วงสีเขียว'],
  },
  {
    id: 4,
    title: 'ปราบเสียงหอน',
    short: 'เสียงหอน',
    minutes: 4,
    intro: 'วงอยากให้เสียงดังขึ้นถึงผู้ชม และนักร้องต้องได้ยินเสียงตัวเองจากลำโพงมอนิเตอร์ แต่พอเร่งแล้วเสียงหอน! จัดตำแหน่งลำโพงและตั้งระดับให้ดังโดยไม่หอน',
    objectives: [
      { id: 'mon', th: 'ต่อ MON OUT ของมิกเซอร์ → ลำโพงมอนิเตอร์', check: (c) => c.patch.wedgeSrc === 'mon' },
      { id: 'loud', th: `ผู้ชมที่ FOH ได้ยิน ≥ ${98} dB และนักร้องได้ยินมอนิเตอร์ ≥ ${102} dB โดยไม่หอน (ต่อเนื่อง 8 วินาที)`, check: (c) => c.loudOk },
      { id: 'answer', th: 'ตอบคำถาม "ทำไมลำโพงมอนิเตอร์ต้องหันเข้าหาด้านหลังของไมค์"', check: (c) => c.answerOk },
    ],
    theory: {
      title: 'เสียงหอน (Acoustic Feedback) และ Gain Before Feedback',
      formula: 'ระดับเสียงลดลง 6 dB เมื่อระยะทางเพิ่มเป็น 2 เท่า',
      body: [
        'เสียงหอนเกิดเมื่อเสียงจากลำโพงย้อนกลับเข้าไมค์ แล้วถูกขยายซ้ำวนเป็นลูป ถ้า "อัตราขยายรอบลูป" ถึง 0 dB เสียงจะดังขึ้นเองไม่หยุด',
        'ไมค์ cardioid รับเสียงด้านหน้ามากที่สุด และรับด้านหลังน้อยที่สุด (ลดลงราว 20–25 dB)',
        'จึงวางลำโพงหลักไว้หน้าแนวไมค์หันไปทางผู้ชม และวางลำโพงมอนิเตอร์หน้านักร้องหันเข้าหาด้านหลังของไมค์',
        'ไมค์ไดนามิกเหมาะกับเวทีมากกว่าคอนเดนเซอร์ เพราะความไวต่ำกว่า หอนยากกว่า',
        'กฎกำลังสองผกผัน (Inverse Square Law): ระยะเพิ่ม 2 เท่า เสียงลด 6 dB และเสียงเดินทาง 343 m/s ลำโพงที่อยู่ไกล 34 m ต้องหน่วงเวลา (delay) ราว 100 ms',
      ],
    },
    hints: [
      'แตะลำโพงมอนิเตอร์บนเวทีแล้วกด "ย้ายมาหน้านักร้อง" จากนั้นต่อ MON OUT → ลำโพงมอนิเตอร์ และเพิ่ม MON send ของ CH1',
      'ลำโพงหลักต้องอยู่ "หน้าเวที" ตั้ง Master ราว 0 ถึง +3 dB และ MON send CH1 ราว 0 dB ดูค่า "ระยะปลอดภัยก่อนหอน" ต้องติดลบ',
    ],
  },
  {
    id: 5,
    title: 'ภารกิจท้าทาย: ระบบที่ทำงานเองอัตโนมัติ',
    short: 'ระบบอัตโนมัติ',
    minutes: 5,
    intro:
      'เลือกโจทย์ 1 ข้อ: 🎤 โชว์เปิดคอนเสิร์ต — สร้าง Cue list ให้แสง เสียง และจอ LED เปลี่ยนตรงจังหวะเพลง หรือ 🏛️ นิทรรศการอินเทอร์แอคทีฟ — ตั้ง "ฉาก" ให้ห้องพิพิธภัณฑ์ดนตรีต้อนรับผู้ชมเองเมื่อเซนเซอร์ตรวจพบคนเดินเข้ามา',
    objectives: [
      { id: 'choose', th: 'เลือกโจทย์: โชว์คอนเสิร์ต หรือ นิทรรศการอินเทอร์แอคทีฟ', check: (c) => c.challenge !== null },
      {
        id: 'build',
        th: 'โชว์: สร้าง Cue อย่างน้อย 4 คิว · นิทรรศการ: ตั้งฉาก "มีผู้ชม" ให้ต่างจากฉาก "ไม่มีผู้ชม"',
        check: (c) => (c.challenge === 'concert' ? c.cues.length >= 4 : c.challenge === 'exhibit' ? c.scenesEdited : false),
      },
      {
        id: 'test',
        th: 'ผ่านการทดสอบอัตโนมัติครบทุกช่วง (โชว์ 4/4 · นิทรรศการ 2/2)',
        check: (c) =>
          c.challenge === 'concert' ? !!c.showScore && c.showScore.score >= 4 : c.challenge === 'exhibit' ? !!c.exhibitScore && c.exhibitScore.score >= c.exhibitScore.total : false,
      },
    ],
    theory: {
      title: 'Show Control: ให้ทุกระบบทำงานพร้อมกัน',
      body: [
        'Cue คือ "ภาพนิ่ง" ของสถานะทั้งเวที ณ เวลาหนึ่ง: สีและความสว่างของไฟ ทิศของ Moving Head ภาพบนจอ และไมค์เปิด/ปิด',
        'ในงานจริง Cue ถูกเรียกด้วย Timecode (SMPTE/LTC) จากเพลง หรือคำสั่ง MIDI/OSC ทำให้ทุกระบบตรงจังหวะทุกรอบการแสดง',
        'แนวคิดเดียวกันใช้ในนิทรรศการ พิพิธภัณฑ์ และอาคารอัจฉริยะ: เมื่อเซนเซอร์ตรวจพบคน แสง เสียง และจอเปลี่ยนเป็น "ฉาก" ที่ตั้งไว้อัตโนมัติ และกลับไปโหมดประหยัดพลังงานเมื่อไม่มีใคร นี่คือด้าน "เซนเซอร์และปัญญาประดิษฐ์ (Sensing & AI)" ของหลักสูตร',
        'ถ้า DMX address ผิดหรือสายขาด โชว์ที่โปรแกรมไว้ถูกก็ยังพังได้ วิศวกรจึงต้องตรวจทั้งระบบ ไม่ใช่แค่โปรแกรม',
      ],
    },
    hints: [
      'โชว์: สร้างคิวที่เวลา 0, 6, 14 และ 28 วินาทีตามตาราง "เป้าหมาย" | นิทรรศการ: ฉาก "ไม่มีผู้ชม" ให้ห้องสลัวประหยัดไฟ ฉาก "มีผู้ชม" ให้สปอตไลต์ส่องชิ้นงานและเปิดเสียงบรรยาย',
      'โชว์: 0 วิ PAR น้ำเงิน 40% ไมค์ปิด · 6 วิ Mover ส่องนักร้อง ไมค์เปิด · 14 วิ PAR แดง 100% Visualizer · 28 วิ Blackout | นิทรรศการ: ไม่มีผู้ชม = PAR ส้ม 20% Mover ปิด จอโลโก้ เสียงปิด · มีผู้ชม = PAR ส้ม 70% Mover ส่องชิ้นงาน จอข้อมูลนิทรรศการ เสียงเปิด',
    ],
  },
  {
    id: 6,
    title: 'ภารกิจสุดท้าย: สรุปและแบบทดสอบ',
    short: 'แบบทดสอบ',
    minutes: 3,
    intro: 'ทบทวนสิ่งที่ได้ลงมือทำด้วยแบบทดสอบ 5 ข้อ แล้วรับใบประกาศนักวิศวกรระบบภาพ เสียง และแสงฝึกหัด',
    objectives: [{ id: 'quiz', th: 'ทำแบบทดสอบ 5 ข้อให้ครบ', check: (c) => c.finalDone }],
    theory: {
      title: 'สิ่งที่ได้เรียนรู้ในด่านที่ 1',
      body: ['DMX512: address, daisy-chain, Terminator', 'การผสมสีแสงแบบบวก', 'Gain staging และ Clipping', 'เสียงหอนกับตำแหน่งลำโพงและไมค์ cardioid', 'Cue list และ Show control'],
    },
    hints: ['ทุกข้อมีคำอธิบายหลังตอบ', 'ย้อนอ่าน "ทฤษฎี" ของแต่ละภารกิจได้จากแผนที่ภารกิจ'],
  },
]

export const avObjectives = (m: AvMission, c: AvCtx) => Object.fromEntries(m.objectives.map((o) => [o.id, o.check(c)]))

/* ---------------- question for mission 4 ---------------- */
export const M4_QUESTION = {
  q: 'ทำไมลำโพงมอนิเตอร์ต้องวางหน้านักร้องและหันเข้าหาด้านหลังของไมค์?',
  choices: [
    'เพราะไมค์ cardioid รับเสียงด้านหลังน้อยที่สุด เสียงจากมอนิเตอร์จึงย้อนเข้าไมค์น้อย หอนยาก',
    'เพราะลำโพงจะดังขึ้นเมื่อหันเข้าหาไมค์',
    'เพราะสายไฟสั้น ต่อได้ระยะนี้เท่านั้น',
    'เพราะไมค์รับเสียงจากด้านหลังได้ดีที่สุด',
  ],
  answer: 0,
}

/* ---------------- quizzes ---------------- */

export const AV_MINI_QUIZ: QuizQuestion[] = [
  {
    id: 'av-m-console',
    topic: 'จับคู่อุปกรณ์',
    q: 'คอนโซล DMX ทำหน้าที่อะไร?',
    choices: ['ขยายเสียงไมค์', 'ส่งคำสั่งดิจิทัลควบคุมสีและความสว่างของไฟทุกดวง', 'แสดงภาพบนจอ LED', 'จ่ายไฟฟ้า 220V ให้ไฟ'],
    answer: 1,
    explain: 'คอนโซลส่งข้อมูล DMX512 ซึ่งมี 512 ช่องต่อ 1 Universe ไปให้ไฟแต่ละดวงอ่านช่องของตัวเอง',
  },
  {
    id: 'av-m-wedge',
    topic: 'จับคู่อุปกรณ์',
    q: 'ลำโพงมอนิเตอร์ (Wedge) บนเวทีมีไว้เพื่ออะไร?',
    choices: ['ให้ผู้ชมแถวหลังได้ยิน', 'ให้นักร้อง/นักดนตรีได้ยินเสียงของตัวเองบนเวที', 'ใช้วัดความดังของห้อง', 'ใช้ต่อสาย DMX'],
    answer: 1,
    explain: 'บนเวทีเสียงลำโพงหลักหันไปทางผู้ชม นักดนตรีจึงต้องมีลำโพงมอนิเตอร์ของตัวเอง',
  },
  {
    id: 'av-m-amp',
    topic: 'จับคู่อุปกรณ์',
    q: 'เพาเวอร์แอมป์ทำหน้าที่อะไร?',
    choices: ['ผสมเสียงหลายช่อง', 'ขยายสัญญาณระดับไลน์ให้มีกำลังพอขับลำโพง', 'ลดเสียงหอนอัตโนมัติ', 'แปลงสัญญาณ DMX เป็นเสียง'],
    answer: 1,
    explain: 'มิกเซอร์ส่งสัญญาณระดับไลน์ (แรงดันต่ำ กำลังน้อย) แอมป์ขยายเป็นกำลังหลายร้อยวัตต์เพื่อขับลำโพง',
  },
]

export const AV_FINAL_QUIZ: QuizQuestion[] = [
  {
    id: 'av-q-color',
    topic: 'การผสมสีแสง',
    q: 'เปิดไฟ LED สีแดงและสีเขียวเต็มที่พร้อมกัน (ปิดสีน้ำเงิน) จะได้แสงสีอะไร?',
    choices: ['น้ำตาล', 'เหลือง', 'ม่วง', 'ขาว'],
    answer: 1,
    explain: 'แสงผสมกันแบบบวก (Additive): แดง + เขียว = เหลือง ต่างจากการผสมสีน้ำหรือหมึกที่เป็นแบบลบ (Subtractive)',
  },
  {
    id: 'av-q-dmx',
    topic: 'DMX address',
    q: 'ไฟ PAR ใช้ 4 ช่อง ตั้ง address 5 ไว้ ไฟดวงถัดไปควรตั้ง address เท่าไรจึงจะไม่ทับกัน?',
    choices: ['6', '8', '9', '10'],
    answer: 2,
    explain: 'ดวงแรกใช้ช่อง 5, 6, 7, 8 ดวงถัดไปจึงเริ่มที่ 5 + 4 = 9',
  },
  {
    id: 'av-q-gain',
    topic: 'Gain staging',
    q: 'ถ้าเสียงร้องแตก (Clipping) เพราะตั้ง Gain สูงเกิน ควรแก้อย่างไร?',
    choices: ['ลด Fader ลง', 'ลด Gain ลงจนค่าสูงสุดอยู่ราว −18 ถึง −6 dBFS', 'เร่ง Master ขึ้น', 'เปลี่ยนสายลำโพง'],
    answer: 1,
    explain: 'เสียงแตกเกิดตั้งแต่พรีแอมป์ การลด Fader แค่ทำให้เสียงที่แตกแล้วเบาลง ต้องลด Gain ที่ต้นทาง',
  },
  {
    id: 'av-q-feedback',
    topic: 'เสียงหอน',
    q: 'ข้อใดช่วยลดเสียงหอนได้ดีที่สุด?',
    choices: [
      'วางลำโพงหลักไว้หลังนักร้อง หันเข้าหาไมค์',
      'ใช้ไมค์คอนเดนเซอร์ที่ไวกว่า',
      'วางลำโพงหลักหน้าแนวไมค์หันไปทางผู้ชม และให้มอนิเตอร์หันเข้าหาด้านหลังของไมค์ cardioid',
      'เร่ง Gain ให้สูงที่สุด',
    ],
    answer: 2,
    explain: 'เสียงหอนเกิดจากเสียงลำโพงย้อนเข้าไมค์เป็นลูป ต้องให้เสียงลำโพงเข้าไมค์น้อยที่สุด โดยอาศัยระยะ ทิศของลำโพง และด้านหลังของไมค์ที่รับเสียงน้อย',
  },
  {
    id: 'av-q-distance',
    topic: 'กฎกำลังสองผกผัน',
    q: 'ผู้ชมที่ยืนห่างลำโพง 2 เท่าของอีกคน จะได้ยินเสียงเบากว่าประมาณเท่าไร?',
    choices: ['เบาลง 1 dB', 'เบาลง 6 dB', 'เบาลงครึ่งหนึ่งของ dB', 'เท่าเดิม'],
    answer: 1,
    explain: 'ตามกฎกำลังสองผกผัน (Inverse Square Law) ระยะเพิ่ม 2 เท่า ระดับเสียง (SPL) ลดลงประมาณ 6 dB',
  },
]

/* ---------------- guided steps ---------------- */

export interface AvGuideStep {
  id: string
  kind: 'info' | 'select' | 'cable' | 'address' | 'color' | 'power' | 'observe' | 'move' | 'cue' | 'test' | 'choose' | 'scene' | 'exhibitTest'
  scene?: 'idle' | 'visitor'
  title: string
  why: string
  cable?: { from: string; to: string }
  fixture?: string
  value?: number
  color?: ColorName
  device?: DeviceId
  power?: 'mixer' | 'amp'
  move?: { what: 'wedge'; to: WedgePos }
  checkpoint?: number
  camera?: 'overview' | 'truss' | 'stage' | 'foh' | 'rack'
  panel?: 'mission' | 'patch' | 'light' | 'sound' | 'show'
  observe?: 'gain' | 'loud' | 'answer' | 'miniQuiz' | 'quiz'
  check: (c: AvCtx) => boolean
}

const has = (c: AvCtx, from: string, to: string) => c.cables.some((x) => x.from === from && x.to === to)
const cableStep = (from: string, to: string, title: string, why: string, block: (c: AvCtx) => boolean, camera: AvGuideStep['camera']): AvGuideStep => ({
  id: `cable:${from}>${to}`,
  kind: 'cable',
  title,
  why,
  cable: { from, to },
  camera,
  check: (c) => block(c) || has(c, from, to),
})

const PAR_NAMES: Record<string, string> = { par1: 'PAR1', par2: 'PAR2', par3: 'PAR3', par4: 'PAR4', mover1: 'Mover1', mover2: 'Mover2' }

export function avGuideSteps(mission: number, ctx?: Pick<AvCtx, 'challenge'>): AvGuideStep[] {
  switch (mission) {
    case 0:
      return [
        { id: 'm0-cam', kind: 'info', title: 'ลากบนฉากเพื่อหมุนกล้อง หรือกดปุ่ม 🎥 มุมกล้อง', why: 'ดูเวทีได้รอบทิศ ใช้ล้อเมาส์หรือสองนิ้วเพื่อซูม', check: (c) => c.tutorial.cam },
        { id: 'm0-select', kind: 'select', title: 'แตะอุปกรณ์ 1 ชิ้น เช่น ไฟบนทรัสหรือลำโพง', why: 'จะมีการ์ดข้อมูลบอกหน้าที่ของอุปกรณ์', check: (c) => c.tutorial.select },
        { id: 'm0-cable', kind: 'info', title: 'กด "🔌 เสียบสาย" แล้วแตะช่อง OUT และช่อง IN อย่างละ 1 ช่อง', why: 'นี่คือวิธีต่อสายทุกเส้นในแล็บ ลบสายนี้ทีหลังได้', camera: 'foh', check: (c) => c.tutorial.cable },
      ]
    case 1:
      return [
        ...(['par1', 'mover1', 'console', 'mixer', 'amp', 'wedge'] as DeviceId[]).map<AvGuideStep>((d) => ({
          id: `m1-${d}`,
          kind: 'select',
          title: `แตะ "${DEVICES[d].nameTh}" แล้วอ่านการ์ด`,
          why: 'รู้หน้าที่และข้อควรระวังก่อนใช้งานจริง',
          device: d,
          camera: d === 'par1' || d === 'mover1' ? 'truss' : d === 'wedge' ? 'stage' : d === 'amp' ? 'rack' : 'foh',
          check: (c) => c.found.includes(d) || c.found.length >= AV_FIND_TARGET,
        })),
        { id: 'm1-quiz', kind: 'observe', observe: 'miniQuiz', title: 'ตอบ Mini quiz 3 ข้อในแผงภารกิจ', why: 'ทบทวนหน้าที่ของอุปกรณ์', panel: 'mission', check: (c) => c.miniQuizCorrect >= 3 },
      ]
    case 2: {
      const chain: Array<[string, string, string]> = [
        ['console.out', 'par1.in', 'ต่อสาย DMX จาก DMX OUT ของคอนโซล ไปยัง DMX IN ของ PAR1'],
        ['par1.thru', 'par2.in', 'ต่อจาก DMX THRU ของ PAR1 ไปยัง DMX IN ของ PAR2'],
        ['par2.thru', 'par3.in', 'ต่อจาก DMX THRU ของ PAR2 ไปยัง DMX IN ของ PAR3'],
        ['par3.thru', 'par4.in', 'ต่อจาก DMX THRU ของ PAR3 ไปยัง DMX IN ของ PAR4'],
        ['par4.thru', 'mover1.in', 'ต่อจาก DMX THRU ของ PAR4 ไปยัง DMX IN ของ Mover1'],
        ['mover1.thru', 'mover2.in', 'ต่อจาก DMX THRU ของ Mover1 ไปยัง DMX IN ของ Mover2'],
        ['mover2.thru', 'term.in', 'เสียบ Terminator ที่ DMX THRU ของ Mover2 (ดวงสุดท้าย)'],
      ]
      return [
        ...chain.map(([f, t, title], i) =>
          cableStep(f, t, title, i === 0 ? 'สัญญาณ DMX เริ่มที่คอนโซล แล้วพ่วงต่อทีละดวง (daisy-chain)' : i === chain.length - 1 ? 'Terminator 120Ω กันสัญญาณสะท้อนที่ปลายสาย ไม่ให้ไฟกระพริบเพี้ยน' : 'THRU ส่งสัญญาณเดิมต่อไปยังดวงถัดไป ทุกดวงได้ข้อมูลครบทั้ง 512 ช่อง', dmxDone, i === 0 ? 'foh' : 'truss'),
        ),
        ...(['par1', 'par2', 'par3', 'par4', 'mover1', 'mover2'] as const).map<AvGuideStep>((f) => ({
          id: `addr-${f}`,
          kind: 'address',
          title: `ตั้ง address ของ ${PAR_NAMES[f]} เป็น ${CONSOLE_PATCH[f]}`,
          why: f === 'par1' ? 'คอนโซลส่งคำสั่งของ PAR1 ที่ช่อง 1–4 ไฟต้องฟังช่องเดียวกัน' : `ดวงก่อนหน้าใช้ช่องไปแล้ว จึงเริ่มที่ ${CONSOLE_PATCH[f]} (address ก่อนหน้า + จำนวนช่อง)`,
          fixture: f,
          value: CONSOLE_PATCH[f],
          panel: 'light',
          camera: 'truss',
          check: (c) => c.addresses[f] === CONSOLE_PATCH[f],
        })),
        ...(Object.entries(COLOR_TARGETS) as Array<[string, ColorName]>).map<AvGuideStep>(([f, col]) => ({
          id: `color-${f}`,
          kind: 'color',
          title: `ผสมสีให้ ${PAR_NAMES[f]} เป็นสี${{ yellow: 'เหลือง', magenta: 'ม่วงแดง', cyan: 'ฟ้า', white: 'ขาว' }[col as 'yellow']}`,
          why:
            col === 'yellow'
              ? 'Dimmer สูง + แดง + เขียว (ปิดน้ำเงิน) แสงแดงบวกเขียวได้เหลือง'
              : col === 'magenta'
                ? 'Dimmer สูง + แดง + น้ำเงิน (ปิดเขียว)'
                : col === 'cyan'
                  ? 'Dimmer สูง + เขียว + น้ำเงิน (ปิดแดง)'
                  : 'Dimmer สูง + แดง + เขียว + น้ำเงิน เต็มทั้งสามสี',
          fixture: f,
          color: col,
          panel: 'light',
          camera: 'stage',
          check: (c) => colorDone(c, f),
        })),
      ]
    }
    case 3:
      return [
        cableStep('micDyn.out', 'mixer.ch1', 'ต่อสาย XLR จากไมค์ไดนามิก ไปยัง CH1 IN ของมิกเซอร์', 'สัญญาณไมค์เบามาก ต้องเข้าพรีแอมป์ของมิกเซอร์ก่อน', audioDone, 'stage'),
        cableStep('mixer.mainL', 'amp.inA', 'ต่อ MAIN L OUT ของมิกเซอร์ → IN A ของเพาเวอร์แอมป์', 'มิกเซอร์ส่งเสียงที่ผสมแล้ว (ระดับไลน์) ไปให้แอมป์ขยาย', audioDone, 'rack'),
        cableStep('mixer.mainR', 'amp.inB', 'ต่อ MAIN R OUT → IN B ของแอมป์', 'ช่องขวาแยกเป็นแอมป์ช่อง B', audioDone, 'rack'),
        cableStep('amp.outA', 'spkL.in', 'ต่อสายลำโพง (Speakon) จาก OUT A → ลำโพงหลักซ้าย', 'สายลำโพงรับกำลังสูง ต้องใช้หัว Speakon ไม่ใช่ XLR', audioDone, 'stage'),
        cableStep('amp.outB', 'spkR.in', 'ต่อ OUT B → ลำโพงหลักขวา', 'ลำโพงละ 8Ω ต่อช่องละตัว แอมป์ทำงานสบาย', audioDone, 'stage'),
        { id: 'pwr-mixer', kind: 'power', power: 'mixer', title: 'เปิดสวิตช์มิกเซอร์ก่อน', why: 'เปิดต้นทางก่อน ให้สัญญาณนิ่งก่อนเปิดแอมป์', panel: 'sound', check: (c) => c.powerOrderOk || c.mixer.mixerOn },
        { id: 'pwr-amp', kind: 'power', power: 'amp', title: 'แล้วจึงเปิดเพาเวอร์แอมป์', why: 'แอมป์เปิดเป็นเครื่องสุดท้ายเสมอ กันเสียง "ปุ" กระแทกลำโพง', panel: 'sound', check: (c) => c.powerOrderOk },
        { id: 'gain', kind: 'observe', observe: 'gain', title: 'กด "▶ ซ้อมร้อง" แล้วเลื่อน Gain CH1 จนแถบวัดสูงสุดอยู่ช่วงสีเขียว (−18 ถึง −3 dBFS)', why: 'Gain สูงไปเสียงแตก ต่ำไปเสียงเบาและซ่า ช่วงสีเขียวคือพอดีและมี Headroom', panel: 'sound', check: (c) => c.gainOk },
      ]
    case 4:
      return [
        { id: 'move-wedge', kind: 'move', move: { what: 'wedge', to: 'front' }, title: 'ย้ายลำโพงมอนิเตอร์มาไว้หน้านักร้อง หันเข้าหานักร้อง', why: 'ด้านหลังของไมค์ cardioid รับเสียงน้อยที่สุด เสียงมอนิเตอร์จึงย้อนเข้าไมค์น้อย', camera: 'stage', check: (c) => c.mixer.wedgePos === 'front' },
        cableStep('mixer.mon', 'wedge.in', 'ต่อ MON OUT ของมิกเซอร์ → LINE IN ของลำโพงมอนิเตอร์', 'MON เป็นมิกซ์แยกสำหรับนักดนตรี ปรับได้ไม่กระทบเสียงที่ผู้ชมได้ยิน', (c) => c.patch.wedgeSrc === 'mon', 'stage'),
        { id: 'loud', kind: 'observe', observe: 'loud', title: 'กด "▶ ซ้อมร้อง" เพิ่ม Master ให้ FOH ≥ 98 dB และ MON send CH1 ให้มอนิเตอร์ ≥ 102 dB', why: 'ดูค่า "ระยะปลอดภัยก่อนหอน" ต้องติดลบตลอด ถ้าเข้าใกล้ 0 dB ให้ลดลงเล็กน้อย', panel: 'sound', check: (c) => c.loudOk },
        { id: 'answer', kind: 'observe', observe: 'answer', title: 'ตอบคำถามในแผงภารกิจ', why: 'อธิบายได้ว่าทำไมจึงจัดลำโพงแบบนี้', panel: 'mission', check: (c) => c.answerOk },
      ]
    case 5: {
      const choose: AvGuideStep = { id: 'm5-choose', kind: 'choose', title: 'เลือกโจทย์ในแผงภารกิจ: โชว์คอนเสิร์ต หรือ นิทรรศการอินเทอร์แอคทีฟ', why: 'งาน AV มีทั้งเวทีบันเทิงและนิทรรศการ ลองเลือกแบบที่สนใจ', panel: 'mission', check: (c) => c.challenge !== null }
      if (ctx?.challenge === 'exhibit')
        return [
          choose,
          { id: 'scene-idle', kind: 'scene', scene: 'idle', title: 'ตั้งฉาก "ไม่มีผู้ชม": PAR ส้มหรี่ 20% · Mover ปิด · จอโลโก้ · เสียงบรรยายปิด', why: 'เมื่อไม่มีใคร ห้องยังสว่างพอดูปลอดภัย แต่ประหยัดพลังงานและไม่ส่งเสียงรบกวน', panel: 'show', check: (c) => !!c.exhibitCheckpoints[0] },
          { id: 'scene-visitor', kind: 'scene', scene: 'visitor', title: 'ตั้งฉาก "มีผู้ชม": สปอตไลต์ส่องชิ้นงาน · PAR ส้ม 70% · จอข้อมูลนิทรรศการ · เสียงบรรยายเปิด', why: 'เซนเซอร์ตรวจพบคน ระบบจึงปรับแสง เสียง และจอพร้อมกัน เพื่อดึงความสนใจไปที่ชิ้นงาน', panel: 'show', check: (c) => !!c.exhibitCheckpoints[1] },
          { id: 'exhibit-test', kind: 'exhibitTest', title: 'กด "🧪 ทดสอบนิทรรศการอัตโนมัติ"', why: 'ตรวจทั้งค่าฉากและฮาร์ดแวร์จริง: สาย DMX, address และระบบเสียงต้องพร้อม', panel: 'show', check: (c) => !!c.exhibitScore && c.exhibitScore.score >= c.exhibitScore.total },
        ]
      if (ctx?.challenge !== 'concert') return [choose]
      return [
        choose,
        { id: 'cue-0', kind: 'cue', checkpoint: 0, title: 'คิวอินโทร (0 วิ): PAR น้ำเงินหรี่ ๆ · Mover ปิด · จอโลโก้ · ไมค์ปิด', why: 'สร้างบรรยากาศก่อนนักร้องขึ้น ปิดไมค์กันเสียงรบกวน', panel: 'show', check: (c) => !!c.showCheckpoints[0] },
        { id: 'cue-1', kind: 'cue', checkpoint: 1, title: 'คิวท่อนแรก (6 วิ): Mover ส่องนักร้อง · ไมค์เปิด · จอเนื้อเพลง', why: 'สปอตไลต์ดึงสายตาผู้ชมไปที่นักร้อง', panel: 'show', check: (c) => !!c.showCheckpoints[1] },
        { id: 'cue-2', kind: 'cue', checkpoint: 2, title: 'คิวท่อนฮุก (14 วิ): PAR แดง 100% · จอภาพเต้นตามเพลง · ไมค์เปิด', why: 'ท่อนฮุกคือจุดพีคของเพลง แสงต้องสว่างและเร้าใจที่สุด', panel: 'show', check: (c) => !!c.showCheckpoints[2] },
        { id: 'cue-3', kind: 'cue', checkpoint: 3, title: 'คิวจบ (28 วิ): Blackout ไฟดับ จอปิด ไมค์ปิด', why: 'Blackout เป็นสัญญาณให้ผู้ชมรู้ว่าเพลงจบ', panel: 'show', check: (c) => !!c.showCheckpoints[3] },
        { id: 'test', kind: 'test', title: 'กด "🧪 ทดสอบโชว์อัตโนมัติ"', why: 'ตรวจทั้งโปรแกรมคิวและฮาร์ดแวร์จริง (สาย DMX, address, ระบบเสียง)', panel: 'show', check: (c) => !!c.showScore && c.showScore.score >= 4 },
      ]
    }
    case 6:
      return [{ id: 'quiz', kind: 'observe', observe: 'quiz', title: 'ทำแบบทดสอบ 5 ข้อในแผงภารกิจ', why: 'ทุกข้อมีคำอธิบายหลังตอบ', panel: 'mission', check: (c) => c.finalDone }]
    default:
      return []
  }
}

export function avGuide(mission: number, c: AvCtx) {
  const steps = avGuideSteps(mission, c).map((step) => ({ step, done: step.check(c) }))
  const index = steps.findIndex((s) => !s.done)
  const current = index >= 0 ? steps[index].step : null
  let note: string | null = null
  if (current?.kind === 'cable' && current.cable) {
    const usedFrom = c.cables.find((x) => x.from === current.cable!.from)
    const usedTo = c.cables.find((x) => x.to === current.cable!.to)
    if (usedFrom || usedTo) note = 'ช่องที่ต้องใช้มีสายเส้นอื่นเสียบอยู่ แตะสายนั้นแล้วกด "ถอดสาย" ก่อน หรือกด "↶ ถอดสายล่าสุด"'
  }
  if (c.levels.feedback) note = 'เสียงหอน! ลด Master หรือ MON send ลงทันที แล้วตรวจตำแหน่งลำโพง'
  return { steps, current, index: index >= 0 ? index : steps.length, total: steps.length, note }
}
