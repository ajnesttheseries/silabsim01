/**
 * Stage patching model: devices, their connectors and the cables between them.
 * Connector families follow real gear: XLR (mic/line), Speakon (speaker level) and DMX
 * (3/5-pin XLR — physically fits an audio XLR, which is exactly why mistakes happen).
 */

export type PortKind = 'mic-out' | 'ch-in' | 'line-out' | 'line-in' | 'spk-out' | 'spk-in' | 'spk-link' | 'dmx-out' | 'dmx-in' | 'dmx-thru'
export type Family = 'xlr' | 'speakon' | 'dmx'

export type DeviceId =
  | 'micDyn'
  | 'micCond'
  | 'mixer'
  | 'amp'
  | 'spkL'
  | 'spkR'
  | 'wedge'
  | 'console'
  | 'par1'
  | 'par2'
  | 'par3'
  | 'par4'
  | 'mover1'
  | 'mover2'
  | 'term'

export interface PortDef {
  id: string
  device: DeviceId
  label: string
  kind: PortKind
}

export interface DeviceDef {
  id: DeviceId
  nameTh: string
  nameEn: string
  func: string
  caution: string
  ports: PortDef[]
}

const p = (device: DeviceId, key: string, label: string, kind: PortKind): PortDef => ({ id: `${device}.${key}`, device, label, kind })

export const DEVICES: Record<DeviceId, DeviceDef> = {
  micDyn: {
    id: 'micDyn',
    nameTh: 'ไมโครโฟนไดนามิก',
    nameEn: 'Dynamic Microphone (cardioid)',
    func: 'แปลงเสียงร้องเป็นสัญญาณไฟฟ้าระดับไมค์ (mic level) ทนทาน เหมาะกับเวทีและรับเสียงด้านหน้าเป็นหลัก (cardioid)',
    caution: 'สัญญาณไมค์เบามาก ต้องผ่านพรีแอมป์ (gain) ของมิกเซอร์ก่อนเสมอ',
    ports: [p('micDyn', 'out', 'OUT (XLR)', 'mic-out')],
  },
  micCond: {
    id: 'micCond',
    nameTh: 'ไมโครโฟนคอนเดนเซอร์',
    nameEn: 'Condenser Microphone',
    func: 'ไวต่อเสียงมาก ให้รายละเอียดสูง นิยมในสตูดิโอ ต้องใช้ไฟเลี้ยง Phantom +48V จากมิกเซอร์',
    caution: 'ความไวสูงทำให้เกิดเสียงหอนง่ายบนเวทีที่เสียงดัง',
    ports: [p('micCond', 'out', 'OUT (XLR)', 'mic-out')],
  },
  mixer: {
    id: 'mixer',
    nameTh: 'มิกเซอร์เสียง',
    nameEn: 'Audio Mixer (FOH)',
    func: 'รวมและปรับแต่งเสียงทุกช่อง: Gain (พรีแอมป์) ขยายสัญญาณไมค์, Fader ปรับความดังในมิกซ์, ส่งออก MAIN ไปลำโพงหลักและ MON ไปลำโพงมอนิเตอร์',
    caution: 'ตั้ง Gain ให้พอดีก่อน (สัญญาณสูงสุดไม่เกิน −6 dBFS) ถ้า Gain สูงเกินเสียงจะแตก ลด Fader ก็ไม่หาย',
    ports: [
      p('mixer', 'ch1', 'CH1 IN', 'ch-in'),
      p('mixer', 'ch2', 'CH2 IN', 'ch-in'),
      p('mixer', 'mainL', 'MAIN L OUT', 'line-out'),
      p('mixer', 'mainR', 'MAIN R OUT', 'line-out'),
      p('mixer', 'mon', 'MON OUT', 'line-out'),
    ],
  },
  amp: {
    id: 'amp',
    nameTh: 'เพาเวอร์แอมป์',
    nameEn: 'Power Amplifier (2 ch)',
    func: 'ขยายสัญญาณระดับไลน์จากมิกเซอร์ให้มีกำลังพอขับลำโพง มี 2 ช่อง (A/B) รับโหลดต่ำสุด 4Ω ต่อช่อง',
    caution: 'เปิดแอมป์เป็นเครื่องสุดท้าย และปิดเป็นเครื่องแรก เพื่อกันเสียง "ปุ" กระแทกลำโพง',
    ports: [
      p('amp', 'inA', 'IN A', 'line-in'),
      p('amp', 'inB', 'IN B', 'line-in'),
      p('amp', 'outA', 'OUT A (Speakon)', 'spk-out'),
      p('amp', 'outB', 'OUT B (Speakon)', 'spk-out'),
    ],
  },
  spkL: {
    id: 'spkL',
    nameTh: 'ลำโพงหลักซ้าย (PA)',
    nameEn: 'Main PA Speaker Left (8Ω)',
    func: 'ลำโพงหลักส่งเสียงไปยังผู้ชม ความต้านทาน 8Ω มีช่อง LINK ต่อพ่วงลำโพงอีกตัวแบบขนานได้',
    caution: 'ลำโพงต่อขนานกันความต้านทานรวมจะลดลง (8Ω สองตัว = 4Ω)',
    ports: [p('spkL', 'in', 'IN (Speakon)', 'spk-in'), p('spkL', 'link', 'LINK', 'spk-link')],
  },
  spkR: {
    id: 'spkR',
    nameTh: 'ลำโพงหลักขวา (PA)',
    nameEn: 'Main PA Speaker Right (8Ω)',
    func: 'ลำโพงหลักข้างขวา ทำงานคู่กับข้างซ้าย',
    caution: 'ควรวางหน้าแนวไมโครโฟน หันไปทางผู้ชม เพื่อลดเสียงหอน',
    ports: [p('spkR', 'in', 'IN (Speakon)', 'spk-in'), p('spkR', 'link', 'LINK', 'spk-link')],
  },
  wedge: {
    id: 'wedge',
    nameTh: 'ลำโพงมอนิเตอร์ (Wedge)',
    nameEn: 'Active Stage Monitor',
    func: 'ลำโพงมอนิเตอร์แบบมีแอมป์ในตัว วางบนเวทีให้นักร้องได้ยินเสียงตัวเอง รับสัญญาณจาก MON OUT',
    caution: 'ต้องหันหน้าเข้าหาด้านหลังของไมค์ cardioid (ด้านที่ไมค์รับเสียงน้อยที่สุด)',
    ports: [p('wedge', 'in', 'LINE IN (XLR)', 'line-in')],
  },
  console: {
    id: 'console',
    nameTh: 'คอนโซลควบคุมแสง (DMX)',
    nameEn: 'DMX Lighting Console',
    func: 'ส่งคำสั่ง DMX512 สูงสุด 512 ช่องต่อ 1 Universe แต่ละช่องมีค่า 0–255 เพื่อควบคุมไฟทุกดวง',
    caution: 'ตำแหน่ง (address) ที่ตั้งในคอนโซลต้องตรงกับ address ที่ตั้งบนตัวไฟ',
    ports: [p('console', 'out', 'DMX OUT', 'dmx-out')],
  },
  par1: parDef('par1', 1),
  par2: parDef('par2', 2),
  par3: parDef('par3', 3),
  par4: parDef('par4', 4),
  mover1: moverDef('mover1', 1),
  mover2: moverDef('mover2', 2),
  term: {
    id: 'term',
    nameTh: 'ตัวปิดท้ายสาย DMX',
    nameEn: 'DMX Terminator (120Ω)',
    func: 'ตัวต้านทาน 120Ω เสียบที่ DMX THRU ของไฟดวงสุดท้าย กันสัญญาณสะท้อนกลับในสาย',
    caution: 'ถ้าไม่มี สัญญาณ DMX อาจเพี้ยน ไฟกระพริบหรือเปลี่ยนสีเอง',
    ports: [p('term', 'in', 'IN', 'dmx-in')],
  },
}

function parDef(id: DeviceId, n: number): DeviceDef {
  return {
    id,
    nameTh: `ไฟ LED PAR ดวงที่ ${n}`,
    nameEn: `LED PAR RGB #${n} (4 ch)`,
    func: 'ไฟสาดสีบนเวที ผสมสีจากหลอด LED สีแดง เขียว น้ำเงิน ใช้ DMX 4 ช่อง: Dimmer, Red, Green, Blue',
    caution: 'ตั้ง DMX address บนตัวไฟให้ตรงกับคอนโซล และไม่ทับช่องของไฟดวงอื่น',
    ports: [p(id, 'in', 'DMX IN', 'dmx-in'), p(id, 'thru', 'DMX THRU', 'dmx-thru')],
  }
}
function moverDef(id: DeviceId, n: number): DeviceDef {
  return {
    id,
    nameTh: `ไฟ Moving Head ดวงที่ ${n}`,
    nameEn: `Moving Head Spot #${n} (6 ch)`,
    func: 'ไฟสปอตที่หมุนส่ายได้ ใช้ DMX 6 ช่อง (แบบย่อ): Pan, Tilt, Dimmer, Red, Green, Blue',
    caution: 'ของจริงมักใช้ 12–20 ช่อง แล็บนี้ใช้โหมดย่อเพื่อให้เข้าใจง่าย',
    ports: [p(id, 'in', 'DMX IN', 'dmx-in'), p(id, 'thru', 'DMX THRU', 'dmx-thru')],
  }
}

export const PORTS: Record<string, PortDef> = Object.fromEntries(Object.values(DEVICES).flatMap((d) => d.ports.map((x) => [x.id, x])))
export const FIXTURE_IDS: DeviceId[] = ['par1', 'par2', 'par3', 'par4', 'mover1', 'mover2']

export const familyOf = (k: PortKind): Family =>
  k === 'spk-out' || k === 'spk-in' || k === 'spk-link' ? 'speakon' : k.startsWith('dmx') ? 'dmx' : 'xlr'
const isSource = (k: PortKind) => k === 'mic-out' || k === 'line-out' || k === 'spk-out' || k === 'spk-link' || k === 'dmx-out' || k === 'dmx-thru'

export interface Cable {
  id: string
  /** source side (output / thru / link) */
  from: string
  /** destination side (input) */
  to: string
}

export type CableCheck = { ok: true; from: string; to: string } | { ok: false; reason: string }

/** Normalises two tapped ports into a cable direction, or explains why they cannot be joined. */
export function orientCable(a: string, b: string): CableCheck {
  const pa = PORTS[a]
  const pb = PORTS[b]
  if (!pa || !pb) return { ok: false, reason: 'ไม่พบช่องต่อนี้' }
  if (pa.device === pb.device) return { ok: false, reason: 'ต่อช่องของอุปกรณ์ตัวเดียวกันเข้าหากันไม่ได้' }
  const sa = isSource(pa.kind)
  const sb = isSource(pb.kind)
  if (sa === sb)
    return { ok: false, reason: sa ? 'ทั้งสองช่องเป็นช่องสัญญาณออก (OUT) ต้องต่อจาก OUT ไปยัง IN' : 'ทั้งสองช่องเป็นช่องสัญญาณเข้า (IN) ต้องต่อจาก OUT ไปยัง IN' }
  const fa = familyOf(pa.kind)
  const fb = familyOf(pb.kind)
  const physical = (x: Family) => (x === 'dmx' ? 'xlr' : x) // DMX uses XLR-shaped plugs
  if (physical(fa) !== physical(fb))
    return { ok: false, reason: `หัวต่อไม่เข้ากัน: ${fa === 'speakon' || fb === 'speakon' ? 'ช่องลำโพงใช้หัว Speakon ส่วนอีกช่องเป็นหัว XLR' : 'หัวต่อคนละแบบ'}` }
  return sa ? { ok: true, from: a, to: b } : { ok: true, from: b, to: a }
}

export const cableFamily = (c: Cable): Family => {
  const f1 = familyOf(PORTS[c.from].kind)
  const f2 = familyOf(PORTS[c.to].kind)
  return f1 === 'dmx' || f2 === 'dmx' ? 'dmx' : f1
}

/* ---------------- analysis ---------------- */

export type Severity = 'danger' | 'error' | 'warning' | 'info' | 'ok'
export interface PatchIssue {
  severity: Severity
  code: string
  message: string
  explain?: string
  ports?: string[]
}

export type MainSource = 'mainL' | 'mainR' | 'mon' | 'mic' | 'none'

export interface PatchReport {
  issues: PatchIssue[]
  /** which mixer channel each mic feeds (or null) */
  micChannel: Record<'micDyn' | 'micCond', 'ch1' | 'ch2' | null>
  /** source feeding each amp input */
  ampIn: Record<'A' | 'B', MainSource>
  /** speakers driven by each amp channel (parallel chain) */
  ampLoad: Record<'A' | 'B', Array<'spkL' | 'spkR'>>
  /** amp channel (and its source) for each main speaker */
  speakerFeed: Record<'spkL' | 'spkR', { ch: 'A' | 'B'; src: MainSource } | null>
  /** load impedance per amp channel in ohms (Infinity = open) */
  impedance: Record<'A' | 'B', number>
  wedgeSrc: MainSource
  /** DMX chain from the console, in order */
  dmxChain: DeviceId[]
  dmxTerminated: boolean
  dmxReceiving: Record<string, boolean>
}

const SPK_OHMS = 8
export const AMP_MIN_OHMS = 4

export function analyzePatch(cables: Cable[]): PatchReport {
  const issues: PatchIssue[] = []
  const into = new Map<string, string>() // to -> from
  const outOf = new Map<string, string>() // from -> to
  for (const c of cables) {
    into.set(c.to, c.from)
    outOf.set(c.from, c.to)
  }
  const src = (port: string) => into.get(port)
  const srcDevice = (port: string) => {
    const s = src(port)
    return s ? PORTS[s] : undefined
  }

  // cross-system mistakes (DMX into audio or audio into DMX)
  for (const c of cables) {
    const kf = PORTS[c.from].kind
    const kt = PORTS[c.to].kind
    const dmxF = kf.startsWith('dmx')
    const dmxT = kt.startsWith('dmx')
    if (dmxF !== dmxT)
      issues.push({
        severity: 'error',
        code: 'dmx-audio-mix',
        message: dmxF ? 'ต่อสาย DMX เข้าช่องเสียง' : 'ต่อสายเสียงเข้าช่อง DMX ของไฟ',
        explain: 'DMX ใช้หัว XLR เหมือนสายเสียงก็จริง แต่เป็นสัญญาณดิจิทัลควบคุมไฟ คนละระบบกับสัญญาณเสียง จึงใช้งานร่วมกันไม่ได้',
        ports: [c.from, c.to],
      })
    if (kf === 'line-out' && kt === 'ch-in')
      issues.push({ severity: 'warning', code: 'mixer-loop', message: 'ต่อเอาต์พุตของมิกเซอร์ย้อนกลับเข้าช่องอินพุต', explain: 'สัญญาณจะวนรอบ (loop) และอาจหอนได้', ports: [c.from, c.to] })
  }

  // microphones
  const micChannel: PatchReport['micChannel'] = { micDyn: null, micCond: null }
  for (const mic of ['micDyn', 'micCond'] as const) {
    const to = outOf.get(`${mic}.out`)
    if (!to) continue
    const k = PORTS[to].kind
    if (k === 'ch-in') micChannel[mic] = to === 'mixer.ch1' ? 'ch1' : 'ch2'
    else if (k === 'line-in')
      issues.push({
        severity: 'error',
        code: 'mic-to-line',
        message: `${DEVICES[mic].nameTh}ต่อตรงเข้า${PORTS[to].device === 'amp' ? 'แอมป์' : 'ลำโพงมอนิเตอร์'}`,
        explain: 'สัญญาณไมค์เบากว่าระดับไลน์หลายร้อยเท่า (ราว 40–60 dB) ต้องผ่านพรีแอมป์ (Gain) ในมิกเซอร์ก่อน เสียงจึงจะดังพอและคุมได้',
        ports: [`${mic}.out`, to],
      })
  }

  const mainSrc = (port: string): MainSource => {
    const s = srcDevice(port)
    if (!s) return 'none'
    if (s.id === 'mixer.mainL') return 'mainL'
    if (s.id === 'mixer.mainR') return 'mainR'
    if (s.id === 'mixer.mon') return 'mon'
    if (s.kind === 'mic-out') return 'mic'
    return 'none'
  }
  const ampIn = { A: mainSrc('amp.inA'), B: mainSrc('amp.inB') }
  const wedgeSrc = mainSrc('wedge.in')

  // speaker chains: amp OUT -> spk IN -> spk LINK -> spk IN ...
  const ampLoad: PatchReport['ampLoad'] = { A: [], B: [] }
  const speakerFeed: PatchReport['speakerFeed'] = { spkL: null, spkR: null }
  for (const ch of ['A', 'B'] as const) {
    let port = outOf.get(`amp.out${ch}`)
    const seen = new Set<string>()
    while (port && PORTS[port].kind === 'spk-in' && !seen.has(port)) {
      seen.add(port)
      const spk = PORTS[port].device as 'spkL' | 'spkR'
      ampLoad[ch].push(spk)
      speakerFeed[spk] = { ch, src: ampIn[ch] }
      port = outOf.get(`${spk}.link`)
    }
  }
  const impedance = {
    A: ampLoad.A.length ? SPK_OHMS / ampLoad.A.length : Infinity,
    B: ampLoad.B.length ? SPK_OHMS / ampLoad.B.length : Infinity,
  }
  for (const ch of ['A', 'B'] as const) {
    if (impedance[ch] < AMP_MIN_OHMS)
      issues.push({
        severity: 'error',
        code: 'amp-low-impedance',
        message: `แอมป์ช่อง ${ch} มีโหลด ${impedance[ch].toFixed(1)}Ω ต่ำกว่า ${AMP_MIN_OHMS}Ω`,
        explain: 'ลำโพงที่ต่อขนานกันทำให้ความต้านทานรวมลดลง (8Ω ÷ จำนวนลำโพง) แอมป์ต้องจ่ายกระแสมากเกินจนเข้าโหมดป้องกัน (Protect) และตัดเสียง',
      })
    else if (ampLoad[ch].length === 2)
      issues.push({ severity: 'info', code: 'amp-parallel', message: `แอมป์ช่อง ${ch} ขับลำโพง 2 ตัวแบบขนาน = 4Ω`, explain: 'ยังอยู่ในพิกัดของแอมป์ (ต่ำสุด 4Ω) แต่ลำโพงทั้งสองจะได้เสียงช่องเดียวกัน' })
    if (ampIn[ch] === 'mon' && ampLoad[ch].length)
      issues.push({ severity: 'warning', code: 'pa-gets-mon', message: `ลำโพงหลักบนแอมป์ช่อง ${ch} ได้รับสัญญาณ MON`, explain: 'MON คือมิกซ์สำหรับนักดนตรีบนเวที ลำโพงหลักควรรับจาก MAIN L/R' })
  }

  // DMX chain from the console
  const dmxChain: DeviceId[] = []
  let dmxTerminated = false
  let next = outOf.get('console.out')
  const visited = new Set<string>()
  while (next && !visited.has(next)) {
    visited.add(next)
    const port = PORTS[next]
    if (port.kind !== 'dmx-in') break
    if (port.device === 'term') {
      dmxTerminated = true
      break
    }
    dmxChain.push(port.device)
    next = outOf.get(`${port.device}.thru`)
  }
  const dmxReceiving = Object.fromEntries(FIXTURE_IDS.map((f) => [f, dmxChain.includes(f)]))
  const missing = FIXTURE_IDS.filter((f) => !dmxChain.includes(f))
  if (dmxChain.length && missing.length)
    issues.push({ severity: 'error', code: 'dmx-missing', message: `ไฟยังไม่ได้รับสัญญาณ DMX: ${missing.map((f) => DEVICES[f].nameTh.replace('ไฟ ', '')).join(', ')}`, explain: 'ต่อสายจาก DMX THRU ของไฟดวงก่อนหน้า ไปยัง DMX IN ของดวงถัดไป (ต่อพ่วงแบบ daisy-chain)' })
  if (!dmxChain.length && cables.some((c) => familyOf(PORTS[c.to].kind) === 'dmx'))
    issues.push({ severity: 'error', code: 'dmx-no-console', message: 'สาย DMX ยังไม่ได้เริ่มจากคอนโซล', explain: 'สัญญาณ DMX ต้องเริ่มที่ DMX OUT ของคอนโซลแล้วพ่วงต่อไปทีละดวง' })
  if (dmxChain.length && !dmxTerminated)
    issues.push({
      severity: 'warning',
      code: 'dmx-no-term',
      message: 'ปลายสาย DMX ยังไม่มีตัวปิดท้าย (Terminator 120Ω)',
      explain: 'สัญญาณดิจิทัลจะสะท้อนกลับที่ปลายสาย ทำให้ไฟบางดวงกระพริบหรือเพี้ยน เสียบ Terminator ที่ DMX THRU ของไฟดวงสุดท้าย',
    })
  if (dmxChain.length === FIXTURE_IDS.length && dmxTerminated)
    issues.push({ severity: 'ok', code: 'dmx-ok', message: `สาย DMX ครบ ${dmxChain.length} ดวง และมี Terminator ปิดท้าย` })

  // audio chain summary
  const micUsed = micChannel.micDyn || micChannel.micCond
  if (micUsed && (ampIn.A === 'mainL' || ampIn.A === 'mainR' || ampIn.B === 'mainL' || ampIn.B === 'mainR') && (speakerFeed.spkL || speakerFeed.spkR))
    issues.push({ severity: 'ok', code: 'audio-ok', message: 'เส้นทางเสียง ไมค์ → มิกเซอร์ → แอมป์ → ลำโพงหลัก ครบแล้ว' })
  for (const spk of ['spkL', 'spkR'] as const) {
    const f = speakerFeed[spk]
    if (f && f.src === 'mic')
      issues.push({ severity: 'error', code: 'pa-raw-mic', message: `${DEVICES[spk].nameTh}ได้รับสัญญาณไมค์ตรงจากแอมป์`, explain: 'ต้องให้ไมค์เข้ามิกเซอร์ แล้วส่ง MAIN OUT ไปแอมป์' })
  }
  return { issues, micChannel, ampIn, ampLoad, speakerFeed, impedance, wedgeSrc, dmxChain, dmxTerminated, dmxReceiving }
}
