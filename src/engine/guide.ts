/**
 * Guided mode ("พาทำทีละขั้น"): step-by-step instructions built from the reference circuits.
 * The student still performs every action; a step counts as done when the live circuit
 * is electrically equivalent (any hole in the same breadboard strip is fine), or when the
 * whole sub-circuit already works the student's own way.
 */
import { stripOf } from './circuit/breadboard'
import { componentName, footprint, type ComponentType, type PlacedComponent, type ShelfItem } from './circuit/catalog'
import type { CircuitState, Netlist, WireColor } from './circuit/netlist'
import { BUS5V, BUZZER, DHT, FAN, LDR, LED_GREEN, LED_RED, PIR, RAILS_BOTTOM, RAILS_TOP, SOIL } from './circuit/solutions'
import type { MissionCtx } from './missions'
import type { ActuatorKey, Op, SensorKey } from './rules'

export interface GuideCtx extends MissionCtx {
  circuit: CircuitState
}

export type GuideCamera = 'overview' | 'shelf' | 'breadboard' | 'monitor'
export type GuidePanel = 'mission' | 'circuit' | 'env' | 'monitor' | 'rules'

export interface GuideStep {
  id: string
  kind: 'usb' | 'place' | 'install' | 'wire' | 'power' | 'observe' | 'rule' | 'choose' | 'test' | 'select' | 'info'
  title: string
  why: string
  comp?: PlacedComponent
  install?: ComponentType
  wire?: { a: string; b: string; color: WireColor }
  rule?: { sensor: SensorKey; op: Op; value: number; actuator: ActuatorKey }
  observe?: 'blink' | 'heater' | 'light' | 'ldrAnswer' | 'quiz' | 'miniQuiz'
  shelf?: ShelfItem
  camera?: GuideCamera
  panel?: GuidePanel
  check: (c: GuideCtx) => boolean
  /** a short message when the student did something close but wrong */
  wrong?: (c: GuideCtx) => string | null
}

export interface GuideResult {
  steps: Array<{ step: GuideStep; done: boolean }>
  current: GuideStep | null
  index: number
  total: number
  /** resolved node ids for the current wire step (module ids mapped to the real parts) */
  wireNodes?: [string, string] | null
  note: string | null
}

/* ---------------- helpers ---------------- */

const SOLUTION_IDS: Record<string, ComponentType> = { drv1: 'driver', fan1: 'fan', soil1: 'soil', pir1: 'pir' }

/** Map a reference node (e.g. cmp:drv1:VCC) to the student's actual part; null if not installed yet. */
export function resolveNode(node: string, circuit: CircuitState): string | null {
  const m = /^cmp:([^:]+):(.+)$/.exec(node)
  if (!m) return node
  const type = SOLUTION_IDS[m[1]]
  const c = type && circuit.components.find((x) => x.type === type)
  return c ? `cmp:${c.id}:${m[2]}` : null
}

function netKey(nl: Netlist, node: string): string | undefined {
  if (node.startsWith('bb:')) {
    const s = stripOf(node)
    return nl.nets.find((n) => n.nodes.some((x) => x.startsWith('bb:') && stripOf(x) === s))?.id
  }
  return nl.netOf(node)?.id
}

export function nodesConnected(c: GuideCtx, a: string, b: string): boolean {
  const ra = resolveNode(a, c.circuit)
  const rb = resolveNode(b, c.circuit)
  if (!ra || !rb) return false
  const ka = netKey(c.report.netlist, ra)
  const kb = netKey(c.report.netlist, rb)
  return !!ka && ka === kb
}

const stripsOf = (comp: PlacedComponent) => {
  const fp = footprint(comp)
  return fp ? Object.fromEntries(Object.entries(fp).map(([p, h]) => [p, stripOf(h)])) : null
}

export function isPlacedLike(c: GuideCtx, target: PlacedComponent): boolean {
  const want = stripsOf(target)
  if (!want) return false
  return c.circuit.components.some((x) => {
    if (x.type !== target.type || (target.variant !== undefined && x.variant !== target.variant)) return false
    const got = stripsOf(x)
    return !!got && Object.keys(want).every((p) => got[p] === want[p])
  })
}

function placeWrong(c: GuideCtx, target: PlacedComponent): string | null {
  const want = stripsOf(target)
  if (!want) return null
  const wantSet = new Set(Object.values(want))
  for (const x of c.circuit.components) {
    const got = stripsOf(x)
    if (!got) continue
    const same = Object.values(got).every((s) => wantSet.has(s)) && Object.values(got).length === wantSet.size
    if (!same) continue
    if (x.type !== target.type) return `ตำแหน่งนี้มี${componentName(x)}อยู่ ย้ายออกก่อน แล้ววางตามจุดที่กระพริบ`
    if (target.variant !== undefined && x.variant !== target.variant)
      return `วาง${componentName(x)}ไว้แล้ว แต่ขั้นนี้ต้องใช้${componentName(target)} แตะชิ้นนั้นแล้วกด "นำออก" แล้ววางใหม่`
    return `${componentName(x)} ถูกวางกลับด้าน แตะที่ชิ้นนั้นแล้วกด "🔄 กลับด้าน"`
  }
  return null
}

const hole = (h: string) => {
  const m = /^bb:([a-j]|tp|tn|bp|bn)(\d+)$/.exec(h)
  if (!m) return h
  const rail: Record<string, string> = { tp: 'ราง + บน', tn: 'ราง − บน', bp: 'ราง + ล่าง', bn: 'ราง − ล่าง' }
  return rail[m[1]] ? `${rail[m[1]]}` : `แถว ${m[1].toUpperCase()} คอลัมน์ ${m[2]}`
}

/* ---------------- building blocks ---------------- */

type Block = 'ledRed' | 'ledGreen' | 'dht' | 'ldr' | 'buzzer' | 'fan' | 'soil' | 'pir'

const BLOCK_DONE: Record<Block, (c: GuideCtx) => boolean> = {
  ledRed: (c) => c.report.leds.some((l) => l.status === 'ok' && l.color === 'red' && l.drive?.kind === 'GPIO'),
  ledGreen: (c) => c.report.leds.some((l) => l.status === 'ok' && l.color === 'green' && l.drive?.kind === 'GPIO'),
  dht: (c) => c.circuit.components.some((x) => x.type === 'dht' && c.report.modules[x.id]?.ok),
  ldr: (c) => c.report.ldrs.some((d) => d.status === 'ok'),
  buzzer: (c) => c.report.buzzers.some((b) => b.status === 'ok' && b.drive?.kind === 'GPIO'),
  fan: (c) => c.report.fans.some((f) => f.status === 'via-driver'),
  soil: (c) => c.circuit.components.some((x) => x.type === 'soil' && c.report.modules[x.id]?.ok),
  pir: (c) => c.circuit.components.some((x) => x.type === 'pir' && c.report.modules[x.id]?.ok),
}

function wireStep(block: Block, id: string, wire: { a: string; b: string; color: WireColor }, title: string, why: string, camera: GuideCamera = 'breadboard'): GuideStep {
  return {
    id: `${block}:${id}`,
    kind: 'wire',
    title,
    why,
    wire,
    camera,
    check: (c) => BLOCK_DONE[block](c) || nodesConnected(c, wire.a, wire.b),
    wrong: (c) => {
      const last = c.circuit.wires[c.circuit.wires.length - 1]
      if (!last || nodesConnected(c, wire.a, wire.b)) return null
      const ra = resolveNode(wire.a, c.circuit)
      const rb = resolveNode(wire.b, c.circuit)
      const touch = (n: string, t: string | null) => !!t && (n === t || (n.startsWith('bb:') && t.startsWith('bb:') && stripOf(n) === stripOf(t)))
      const oneEnd = touch(last.a, ra) || touch(last.b, ra) || touch(last.a, rb) || touch(last.b, rb)
      return oneEnd ? 'สายล่าสุดต่อถูกแค่ปลายเดียว ปลายอีกข้างต้องไปที่จุดกระพริบอีกจุด กด "↶ ลบสายล่าสุด" แล้วลองใหม่' : null
    },
  }
}

function placeStep(block: Block, comp: PlacedComponent, title: string, why: string): GuideStep {
  return {
    id: `${block}:place-${comp.id}`,
    kind: 'place',
    title,
    why,
    comp,
    shelf: comp.type,
    camera: 'breadboard',
    check: (c) => BLOCK_DONE[block](c) || isPlacedLike(c, comp),
    wrong: (c) => placeWrong(c, comp),
  }
}

function installStep(block: Block, type: ComponentType, title: string, why: string): GuideStep {
  return {
    id: `${block}:install-${type}`,
    kind: 'install',
    title,
    why,
    install: type,
    shelf: type,
    camera: 'shelf',
    check: (c) => BLOCK_DONE[block](c) || c.circuit.components.some((x) => x.type === type),
  }
}

const [W3V3, WGND1] = RAILS_TOP
const [W3V3B, WGND3] = RAILS_BOTTOM
const railGndTop = (b: Block) => wireStep(b, 'gnd-top', WGND1, 'ต่อสายดำจากขา GND ของบอร์ดไปที่ราง − (บน)', 'ทั้งแถวของราง − จะกลายเป็นกราวด์ อุปกรณ์ทุกตัวใช้ GND ร่วมกันจากรางนี้')
const rail3v3Top = (b: Block) => wireStep(b, '3v3-top', W3V3, 'ต่อสายแดงจากขา 3V3 ไปที่ราง + (บน)', 'ราง + จะมีไฟ 3.3V ไว้เลี้ยงเซนเซอร์ สีแดงคือไฟเลี้ยงตามแนวปฏิบัติ')
const rail3v3Bottom = (b: Block) => wireStep(b, '3v3-bot', W3V3B, 'ต่อสายแดงจากขา 3V3 อีกขาหนึ่ง ไปที่ราง + (ล่าง)', 'เพิ่มไฟ 3.3V ให้ครึ่งล่างของเบรดบอร์ด')
const railGndBottom = (b: Block) => wireStep(b, 'gnd-bot', WGND3, 'ต่อสายดำจาก GND อีกขาหนึ่ง ไปที่ราง − (ล่าง)', 'เพิ่มกราวด์ให้ครึ่งล่างของเบรดบอร์ด')

function ledBlock(block: 'ledRed' | 'ledGreen'): GuideStep[] {
  const part = block === 'ledRed' ? LED_RED : LED_GREEN
  const [r, led] = part.comps
  const [wSig, wGnd] = part.wires
  const rFp = footprint(r)!
  const lFp = footprint(led)!
  const color = block === 'ledRed' ? 'แดง' : 'เขียว'
  const gpio = wSig.a.replace('mcu:GPIO', 'G')
  return [
    railGndTop(block),
    placeStep(block, r, `วางตัวต้านทาน 220Ω (แถบ แดง-แดง-น้ำตาล) ที่${hole(rFp['1'])} ถึงคอลัมน์ ${rFp['2'].replace(/\D/g, '')}`, 'ตัวต้านทานจำกัดกระแส: (3.3 − V_LED) / 220Ω ได้กระแสไม่กี่มิลลิแอมป์ ปลอดภัยทั้ง LED และขาบอร์ด'),
    placeStep(
      block,
      led,
      `วาง LED ${color}: ขายาว (Anode) ที่คอลัมน์ ${lFp.A.replace(/\D/g, '')} ขาสั้น (Cathode) ที่คอลัมน์ ${lFp.K.replace(/\D/g, '')}`,
      'ขายาวอยู่คอลัมน์เดียวกับปลายตัวต้านทาน จึงเชื่อมกันภายในเบรดบอร์ด กระแสไหลจาก Anode ไป Cathode ได้ทางเดียว',
    ),
    wireStep(block, 'sig', wSig, `ต่อสายสัญญาณจากขา ${gpio} ของบอร์ดไปที่${hole(wSig.b)}`, `${gpio} คือขาที่บอร์ดสั่ง HIGH (3.3V) ให้ LED ติด หรือ LOW (0V) ให้ดับ`),
    wireStep(block, 'gnd', wGnd, `ต่อสายดำจาก${hole(wGnd.a)} (ขาสั้นของ LED) ลงราง −`, 'ให้กระแสไหลกลับลงกราวด์ครบวงจร ถ้าวงจรไม่ครบ LED จะไม่ติด'),
  ]
}

function dhtBlock(): GuideStep[] {
  const [d] = DHT.comps
  const [wV, wD, wG] = DHT.wires
  return [
    rail3v3Top('dht'),
    railGndTop('dht'),
    placeStep('dht', d, 'วางเซนเซอร์อุณหภูมิและความชื้นที่แถว A คอลัมน์ 24–26 (ขา VCC · DATA · GND)', 'ขาทั้ง 3 อยู่คนละคอลัมน์ จึงต่อสายแยกกันได้ในคอลัมน์ของแต่ละขา'),
    wireStep('dht', 'vcc', wV, 'ต่อสายแดงจากราง + ไปคอลัมน์ 24 (ขา VCC)', 'เซนเซอร์ต้องมีไฟเลี้ยง 3.3V จึงจะทำงาน ถ้าไม่มีไฟจะอ่านได้ NaN'),
    wireStep('dht', 'data', wD, 'ต่อสายเหลืองจากขา G4 ไปคอลัมน์ 25 (ขา DATA)', 'ข้อมูลอุณหภูมิ/ความชื้นถูกส่งแบบดิจิทัลผ่านสายเส้นเดียวนี้'),
    wireStep('dht', 'gnd', wG, 'ต่อสายดำจากคอลัมน์ 26 (ขา GND) ลงราง −', 'ครบวงจรไฟเลี้ยงของเซนเซอร์'),
  ]
}

function ldrBlock(): GuideStep[] {
  const [l, r] = LDR.comps
  const [wV, wA, wG] = LDR.wires
  return [
    rail3v3Bottom('ldr'),
    railGndBottom('ldr'),
    placeStep('ldr', l, 'วาง LDR ที่แถว F คอลัมน์ 20 และ 22', 'LDR คือตัวต้านทานที่ค่าเปลี่ยนตามแสง'),
    placeStep('ldr', r, 'วางตัวต้านทาน 10kΩ (แถบ น้ำตาล-ดำ-ส้ม) ที่แถว G คอลัมน์ 22–26', 'คอลัมน์ 22 ที่ LDR กับ 10kΩ มาเจอกัน คือ "จุดกลาง" ของวงจรแบ่งแรงดัน'),
    wireStep('ldr', 'vcc', wV, 'ต่อสายแดงจากราง + (ล่าง) ไปคอลัมน์ 20 (ขาอีกข้างของ LDR)', 'LDR อยู่ฝั่ง 3.3V (R1) เมื่อแสงมากขึ้น แรงดันที่จุดกลางจะสูงขึ้น'),
    wireStep('ldr', 'adc', wA, 'ต่อสายส้มจากขา G34 ไปคอลัมน์ 22 (จุดกลาง)', 'G34 มี ADC1 แปลงแรงดัน 0–3.3V เป็นตัวเลข 0–4095'),
    wireStep('ldr', 'gnd', wG, 'ต่อสายดำจากคอลัมน์ 26 (ปลาย 10kΩ) ลงราง − (ล่าง)', 'ตัวต้านทาน 10kΩ คือ R2 ฝั่ง GND ของวงจรแบ่งแรงดัน'),
  ]
}

function buzzerBlock(): GuideStep[] {
  const [b] = BUZZER.comps
  const [wS, wG] = BUZZER.wires
  return [
    railGndBottom('buzzer'),
    placeStep('buzzer', b, 'วางบัซเซอร์ที่แถว F: ขา + คอลัมน์ 5 ขา − คอลัมน์ 7', 'บัซเซอร์แบบ Active มีขั้ว ขา + ต้องรับสัญญาณจาก GPIO'),
    wireStep('buzzer', 'sig', wS, 'ต่อสายน้ำเงินจากขา G23 ไปคอลัมน์ 5', 'บอร์ดสั่ง HIGH เมื่อต้องการให้เตือน'),
    wireStep('buzzer', 'gnd', wG, 'ต่อสายดำจากคอลัมน์ 7 ลงราง − (ล่าง)', 'ครบวงจรของบัซเซอร์'),
  ]
}

const bus5v = (b: Block) =>
  wireStep(b, 'bus5v', BUS5V.wires[0], 'ต่อสายแดงจากขา 5V ของบอร์ด ไปที่แถว F คอลัมน์ 30', 'คอลัมน์ 30 (แถว F–J) กลายเป็นจุดแจกไฟ 5V ให้โมดูลหลายตัว เพราะขาบอร์ดหนึ่งขาเสียบสายได้เส้นเดียว')

function pirBlock(): GuideStep[] {
  const [wV, wG, wO] = PIR.wires
  return [
    railGndBottom('pir'),
    bus5v('pir'),
    installStep('pir', 'pir', 'ติดตั้งเซนเซอร์ตรวจจับการเคลื่อนไหว (PIR) หน้าบ้านสัตว์เลี้ยง', 'PIR ตรวจจับความร้อนจากร่างกายที่เคลื่อนที่ ใช้ได้ทั้งคนและสัตว์'),
    wireStep('pir', 'vcc', wV, 'ต่อสายแดงจากแถว H คอลัมน์ 30 (5V) ไปขา VCC ของ PIR', 'โมดูล PIR ทั่วไปต้องการไฟ 5V', 'overview'),
    wireStep('pir', 'gnd', wG, 'ต่อสายดำจากราง − (ล่าง) ไปขา GND ของ PIR', 'กราวด์ร่วมกับบอร์ด', 'overview'),
    wireStep('pir', 'out', wO, 'ต่อสายขาวจากขา G27 ไปขา OUT ของ PIR', 'OUT ส่งสัญญาณดิจิทัล HIGH (3.3V) เมื่อมีน้องแมวเดินผ่าน ปลอดภัยกับขาบอร์ด', 'overview'),
  ]
}

function fanBlock(): GuideStep[] {
  const [wV, wG, wIn, wP, wN] = FAN.wires
  return [
    railGndTop('fan'),
    bus5v('fan'),
    installStep('fan', 'driver', 'ติดตั้งโมดูลขับโหลด (แตะกล่อง "โมดูลขับโหลด" บนชั้นวาง แล้วกด ติดตั้ง)', 'ขา GPIO จ่ายกระแสได้แค่ไม่กี่สิบมิลลิแอมป์ ส่วนมอเตอร์ต้องการหลายร้อย จึงต้องมี "สวิตช์" ที่ GPIO สั่งได้'),
    installStep('fan', 'fan', 'ติดตั้งพัดลม DC 5V', 'พัดลมตัวนี้จะถูกบอร์ดสั่งเปิด-ปิดผ่านโมดูลขับโหลด'),
    wireStep('fan', 'vcc', wV, 'ต่อสายแดงจากแถว G คอลัมน์ 30 (5V) ไปขา VCC ของโมดูลขับโหลด', 'ไฟ 5V สำหรับมอเตอร์มาจากสาย USB โดยตรง ไม่ได้ดึงจากขา GPIO', 'overview'),
    wireStep('fan', 'gnd', wG, 'ต่อสายดำจากราง − ไปขา GND ของโมดูล', 'โมดูลกับบอร์ดต้องใช้กราวด์ร่วมกัน สัญญาณจึงจะอ้างอิงตรงกัน', 'overview'),
    wireStep('fan', 'in', wIn, 'ต่อสายเหลืองจากขา G26 ไปขา IN ของโมดูล', 'สัญญาณสั่งเปิด/ปิดพัดลม ใช้กระแสน้อยมาก', 'overview'),
    wireStep('fan', 'p', wP, 'ต่อสายแดงจาก OUT+ ของโมดูลไปขา + ของพัดลม', 'ด้านโหลดของโมดูล', 'overview'),
    wireStep('fan', 'n', wN, 'ต่อสายดำจาก OUT− ของโมดูลไปขา − ของพัดลม', 'โมดูลตัด/ต่อกราวด์ของพัดลมตามคำสั่งจาก IN', 'overview'),
  ]
}

function soilBlock(): GuideStep[] {
  const [wV, wG, wA] = SOIL.wires
  return [
    rail3v3Top('soil'),
    railGndTop('soil'),
    installStep('soil', 'soil', 'ติดตั้งเซนเซอร์ความชื้นในดิน (ปักลงกระถาง)', 'เซนเซอร์แบบ Capacitive วัดความชื้นโดยไม่สัมผัสดินด้วยโลหะ จึงไม่เป็นสนิม'),
    wireStep('soil', 'vcc', wV, 'ต่อสายแดงจากราง + ไปขา VCC ของเซนเซอร์ดิน', 'ไฟเลี้ยง 3.3V', 'overview'),
    wireStep('soil', 'gnd', wG, 'ต่อสายดำจากราง − ไปขา GND ของเซนเซอร์ดิน', 'กราวด์ร่วม', 'overview'),
    wireStep('soil', 'aout', wA, 'ต่อสายเขียวจากขา G32 ไปขา AOUT ของเซนเซอร์ดิน', 'AOUT เป็นสัญญาณ Analog ต้องเข้าขา ADC1 อย่าง G32', 'overview'),
  ]
}

/* ---------------- non-circuit steps ---------------- */

const usbStep: GuideStep = {
  id: 'usb',
  kind: 'usb',
  title: 'เสียบสาย USB ให้บอร์ด (แตะ "สาย USB" บนชั้นวาง)',
  why: 'บอร์ดได้ไฟเลี้ยง 5V และส่งข้อมูล Serial ผ่านสาย USB',
  shelf: 'usb',
  camera: 'shelf',
  check: (c) => c.usb,
}
const powerStep = (id: string): GuideStep => ({
  id: `power-${id}`,
  kind: 'power',
  title: 'กดปุ่ม ⚡ เพื่อจ่ายไฟ (Power ON)',
  why: 'จ่ายไฟให้บอร์ดเริ่มรันโปรแกรม และดูผลบน Serial Monitor',
  check: (c) => c.powered,
})
const ruleStep = (id: string, sensor: SensorKey, op: Op, value: number, actuator: ActuatorKey, title: string, why: string): GuideStep => ({
  id: `rule-${id}`,
  kind: 'rule',
  title,
  why,
  rule: { sensor, op, value, actuator },
  panel: 'rules',
  check: (c) => c.rules.some((r) => r.enabled && r.sensor === sensor && r.actuator === actuator && r.action === 'on' && r.op === op),
})

/* ---------------- per mission ---------------- */

function mission0(): GuideStep[] {
  return [
    { id: 'm0-cam', kind: 'info', title: 'ลากบนฉากเพื่อหมุนกล้อง หรือกดปุ่ม 🎥 มุมกล้องด้านบน', why: 'ดูโต๊ะแล็บได้รอบทิศ ใช้ล้อเมาส์หรือสองนิ้วเพื่อซูม', check: (c) => c.tutorial.cam },
    { id: 'm0-select', kind: 'select', title: 'แตะวัตถุ 1 ชิ้น เช่น บอร์ดหรือเบรดบอร์ด', why: 'เมื่อแตะ จะมีการ์ดข้อมูลขึ้นมาบอกหน้าที่ของอุปกรณ์', camera: 'breadboard', check: (c) => c.tutorial.select },
    { id: 'm0-wire', kind: 'info', title: 'กด "〰️ ต่อสาย" แล้วแตะรูบนเบรดบอร์ด 2 รู', why: 'นี่คือวิธีต่อสายทุกเส้นในแล็บ (ลบสายนี้ทีหลังได้)', camera: 'breadboard', check: (c) => c.tutorial.wire },
  ]
}

function mission1(): GuideStep[] {
  const items: ShelfItem[] = ['board', 'breadboard', 'led', 'resistor', 'dht', 'ldr']
  const names: Record<string, string> = { board: 'บอร์ดไมโครคอนโทรลเลอร์', breadboard: 'เบรดบอร์ด', led: 'หลอด LED', resistor: 'ตัวต้านทาน', dht: 'เซนเซอร์อุณหภูมิและความชื้น', ldr: 'ตัวต้านทานไวแสง (LDR)' }
  return [
    ...items.map<GuideStep>((i) => ({
      id: `m1-${i}`,
      kind: 'select',
      title: `แตะกล่อง "${names[i]}" บนชั้นวาง แล้วอ่านการ์ด`,
      why: 'รู้หน้าที่ ขาต่อ และข้อควรระวังของอุปกรณ์ก่อนนำไปใช้',
      shelf: i,
      camera: 'shelf',
      check: (c) => c.found.includes(i) || c.found.length >= 6,
    })),
    { id: 'm1-quiz', kind: 'observe', observe: 'miniQuiz', title: 'ตอบ Mini quiz 3 ข้อในแผงภารกิจ', why: 'ทบทวนหน้าที่ของอุปกรณ์ที่เพิ่งอ่าน', panel: 'mission', check: (c) => c.miniQuizCorrect >= 3 },
  ]
}

export function guideSteps(mission: number, c: Pick<GuideCtx, 'challenge' | 'report'>): GuideStep[] {
  switch (mission) {
    case 0:
      return mission0()
    case 1:
      return mission1()
    case 2:
      return [
        usbStep,
        ...ledBlock('ledRed'),
        powerStep('m2'),
        { id: 'm2-blink', kind: 'observe', observe: 'blink', title: 'กด "✨ สั่งกระพริบ" ในแผงภารกิจ', why: 'บอร์ดสลับ HIGH/LOW ทุกครึ่งวินาที นี่คือโปรแกรม "Blink" ที่วิศวกรทุกคนเริ่มต้น', panel: 'mission', check: (x) => x.blinkUsed },
      ]
    case 3:
      return [
        usbStep,
        ...dhtBlock(),
        powerStep('m3'),
        {
          id: 'm3-heat',
          kind: 'observe',
          observe: 'heater',
          title: 'เปิดฮีตเตอร์ แล้วดูค่าอุณหภูมิบน Serial Monitor ค่อย ๆ เพิ่ม',
          why: 'อากาศอุ่นขึ้นช้า ๆ (ความเฉื่อยทางความร้อน) และเซนเซอร์อ่านค่าได้ทุก ~2 วินาที',
          panel: 'env',
          check: (x) => x.obs.tMax - x.obs.tMin >= 2,
        },
      ]
    case 4:
      return [
        usbStep,
        ...ldrBlock(),
        powerStep('m4'),
        {
          id: 'm4-light',
          kind: 'observe',
          observe: 'light',
          title: 'เปิดไฟโคมให้สว่าง แล้วปิดไฟและปิดม่าน สังเกตค่า ADC',
          why: 'แสงเปลี่ยน → ความต้านทาน LDR เปลี่ยน → แรงดันที่จุดกลางเปลี่ยน → ค่า ADC เปลี่ยน',
          panel: 'env',
          check: (x) => x.obs.lMax - x.obs.lMin >= 800,
        },
        { id: 'm4-answer', kind: 'observe', observe: 'ldrAnswer', title: 'ตอบคำถาม "แสงมากขึ้น ค่า ADC เพิ่มหรือลด" ในแผงภารกิจ', why: 'อธิบายผลด้วยสูตรวงจรแบ่งแรงดัน', panel: 'mission', check: (x) => x.ldrAnswerCorrect },
      ]
    case 5: {
      const choose: GuideStep = { id: 'm5-choose', kind: 'choose', title: 'เลือกโจทย์ในแผงภารกิจ: บ้านสัตว์เลี้ยง ห้องเรียน หรือกระถางต้นไม้อัจฉริยะ', why: 'วิศวกรเริ่มจากเข้าใจโจทย์ก่อนออกแบบวงจร', panel: 'mission', check: (x) => x.challenge !== null }
      const test: GuideStep = { id: 'm5-test', kind: 'test', title: 'กด "🧪 ทดสอบอัตโนมัติ"', why: 'ระบบจำลองหลายสถานการณ์เพื่อพิสูจน์ว่าระบบทำงานเองได้ถูกต้อง', panel: 'mission', check: (x) => !!x.autoTest && x.autoTest.score >= 3 }
      if (c.challenge === 'classroom') {
        const ldrTop = c.report.ldrs.find((d) => d.status === 'ok')?.ldrOnTop ?? true
        return [
          choose,
          usbStep,
          ...ledBlock('ledRed'),
          ...dhtBlock(),
          ...ldrBlock(),
          ...fanBlock(),
          ruleStep('temp', 'temp', '>', 32, 'fan', 'ตั้งกฎ: ถ้า อุณหภูมิ > 32 °C แล้ว เปิดพัดลม (ไม่เช่นนั้นปิด)', 'เกณฑ์ 32 °C สูงกว่าอุณหภูมิห้องปกติ (~28 °C) พัดลมจึงไม่เปิดทั้งวัน'),
          ruleStep(
            'light',
            'light',
            ldrTop ? '<' : '>',
            ldrTop ? 2500 : 1200,
            'ledRed',
            ldrTop ? 'ตั้งกฎ: ถ้า แสง (ADC) < 2500 แล้ว เปิด LED แดง' : 'ตั้งกฎ: ถ้า แสง (ADC) > 1200 แล้ว เปิด LED แดง',
            ldrTop ? 'LDR อยู่ฝั่ง 3.3V ห้องมืดจึงได้ค่า ADC ต่ำ' : 'LDR ของน้องอยู่ฝั่ง GND ห้องมืดจึงได้ค่า ADC สูง เครื่องหมายจึงกลับกัน',
          ),
          test,
        ]
      }
      if (c.challenge === 'pet')
        return [
          choose,
          usbStep,
          ...ledBlock('ledGreen'),
          ...dhtBlock(),
          ...fanBlock(),
          ...pirBlock(),
          ruleStep('pet-temp', 'temp', '>', 32, 'fan', 'ตั้งกฎ: ถ้า อุณหภูมิ > 32 °C แล้ว เปิดพัดลม (ไม่เช่นนั้นปิด)', 'สัตว์เลี้ยงขนหนาร้อนง่าย เปิดพัดลมเมื่อจำเป็น และปิดเองเมื่อเย็นแล้วเพื่อประหยัดไฟ'),
          ruleStep('pet-motion', 'motion', '>', 1, 'ledGreen', 'ตั้งกฎ: ถ้า การเคลื่อนไหว "ตรวจพบ" แล้ว เปิด LED เขียว (ไฟต้อนรับ)', 'เมื่อ PIR เห็นน้องแมวเดินเข้ามา ไฟต้อนรับจะติดเอง และดับเมื่อไม่มีใคร'),
          test,
        ]
      if (c.challenge === 'plant')
        return [
          choose,
          usbStep,
          ...ledBlock('ledRed'),
          ...ledBlock('ledGreen'),
          ...buzzerBlock(),
          ...soilBlock(),
          ruleStep('red', 'soil', '<', 35, 'ledRed', 'ตั้งกฎ: ถ้า ความชื้นในดิน < 35% แล้ว เปิด LED แดง', 'ดินแห้ง → เตือนด้วยไฟแดง'),
          ruleStep('buzz', 'soil', '<', 35, 'buzzer', 'ตั้งกฎ: ถ้า ความชื้นในดิน < 35% แล้ว เปิดบัซเซอร์', 'เตือนด้วยเสียงด้วย คนที่ไม่ได้มองก็รู้'),
          ruleStep('green', 'soil', '>', 35, 'ledGreen', 'ตั้งกฎ: ถ้า ความชื้นในดิน > 35% แล้ว เปิด LED เขียว', 'ดินชื้นพอ → ไฟเขียวบอกว่าปกติ'),
          test,
        ]
      return [choose]
    }
    case 6:
      return [{ id: 'm6-quiz', kind: 'observe', observe: 'quiz', title: 'ทำแบบทดสอบ 5 ข้อในแผงภารกิจ', why: 'ทุกข้อมีคำอธิบายหลังตอบ', panel: 'mission', check: (x) => x.finalDone }]
    default:
      return []
  }
}

export function computeGuide(mission: number, c: GuideCtx): GuideResult {
  // Several blocks share the same rail wire: keep one step, done only when it is done for every block
  const byKey = new Map<string, GuideStep>()
  const list: GuideStep[] = []
  for (const s of guideSteps(mission, c)) {
    const key = s.wire ? `${s.wire.a}>${s.wire.b}` : s.id
    const prev = byKey.get(key)
    if (prev) {
      const a = prev.check
      prev.check = (x) => a(x) && s.check(x)
      continue
    }
    const copy = { ...s }
    byKey.set(key, copy)
    list.push(copy)
  }
  const steps = list.map((step) => ({ step, done: step.check(c) }))
  const index = steps.findIndex((s) => !s.done)
  const current = index >= 0 ? steps[index].step : null
  let note: string | null = null
  // every step of a block is done but the block still does not work (e.g. an extra wrong wire)
  const brokenBlock = (Object.keys(BLOCK_DONE) as Block[]).find((b) => {
    const own = steps.filter((s) => s.step.id.startsWith(`${b}:`))
    return own.length > 0 && own.every((s) => s.done) && !BLOCK_DONE[b](c)
  })
  if (c.report.shorted) note = 'ลัดวงจรอยู่! ระบบตัดไฟแล้ว กด "↶ ลบสายล่าสุด" หรือหาสายที่ต่อราง + กับราง − ถึงกัน'
  else if (current?.wrong) note = current.wrong(c)
  if (!note && brokenBlock) note = 'ทุกขั้นดูครบแล้ว แต่วงจรบางส่วนยังไม่ทำงาน ไปที่แท็บ "วงจร" แล้วกด "ตรวจวงจร" เพื่อดูจุดที่ผิด'
  const wireNodes = current?.wire ? ([resolveNode(current.wire.a, c.circuit), resolveNode(current.wire.b, c.circuit)] as [string | null, string | null]) : null
  return {
    steps,
    current,
    index: index >= 0 ? index : steps.length,
    total: steps.length,
    wireNodes: wireNodes && wireNodes[0] && wireNodes[1] ? (wireNodes as [string, string]) : null,
    note,
  }
}
