import { GPIO_SAFE_MA, GPIO_WARN_MA, type BoardPin } from './board'
import { componentName, formatOhms, pinNode, type PlacedComponent } from './catalog'
import { buildNetlist, type CircuitState, type Netlist } from './netlist'
import {
  analyzeBuzzer,
  analyzeFan,
  analyzeLdr,
  analyzeLed,
  analyzeModule,
  type BuzzerAnalysis,
  type DividerAnalysis,
  type FanAnalysis,
  type LedAnalysis,
  type ModuleAnalysis,
  type ModuleProblem,
} from './analysis'

export type Severity = 'danger' | 'error' | 'warning' | 'info' | 'ok'

export interface Issue {
  severity: Severity
  code: string
  message: string
  explain?: string
  compIds?: string[]
  nodes?: string[]
}

export interface CircuitReport {
  netlist: Netlist
  issues: Issue[]
  /** VCC–GND short: simulated supply must be cut */
  shorted: boolean
  leds: LedAnalysis[]
  ldrs: DividerAnalysis[]
  modules: Record<string, ModuleAnalysis>
  buzzers: BuzzerAnalysis[]
  fans: FanAnalysis[]
  /** GPIO number → names of parts using it */
  gpioUsage: Record<number, string[]>
}

const gpioName = (g?: BoardPin) => (g?.gpio !== undefined ? `GPIO${g.gpio}` : 'GPIO')

const MODULE_MSG: Record<ModuleProblem, (name: string, sig: string) => Omit<Issue, 'code' | 'compIds'>> = {
  'no-vcc': (n) => ({
    severity: 'error',
    message: `${n} ยังไม่ได้รับไฟเลี้ยง (VCC)`,
    explain: 'ต่อขา VCC ของเซนเซอร์ไปที่ 3V3 (หรือรางไฟ + ที่ต่อกับ 3V3) เซนเซอร์ที่ไม่มีไฟจะอ่านค่าไม่ได้',
  }),
  'no-gnd': (n) => ({
    severity: 'error',
    message: `${n} ยังไม่ได้ต่อกราวด์ (GND)`,
    explain: 'กระแสต้องไหลครบวงจร ต่อขา GND ของเซนเซอร์ลงขา GND ของบอร์ดหรือราง −',
  }),
  'reversed-power': (n) => ({
    severity: 'danger',
    message: `${n} ต่อขั้วไฟกลับ (VCC ↔ GND)`,
    explain: 'ของจริงเซนเซอร์อาจร้อนและเสียหายทันที ให้สลับสาย VCC กับ GND ให้ถูก',
  }),
  'power-short': (n) => ({
    severity: 'danger',
    message: `ขา VCC และ GND ของ ${n} ถูกเชื่อมเข้าหากัน`,
    explain: 'ตรวจว่าขาทั้งสองไม่ได้อยู่ในคอลัมน์หรือรางเดียวกัน',
  }),
  'signal-floating': (n, s) => ({
    severity: 'error',
    message: `ขา ${s} ของ${n}ยังไม่ได้ต่อกับ GPIO`,
    explain: 'บอร์ดต้องมีสายเชื่อมจากขาสัญญาณของเซนเซอร์มายังขา GPIO จึงจะรับข้อมูลได้ ถ้าปล่อยลอยไว้จะอ่านได้ค่าสุ่มหรืออ่านไม่ได้',
  }),
  'signal-shorted': (n, s) => ({
    severity: 'error',
    message: `ขา ${s} ของ${n}ถูกต่อเข้ากับไฟเลี้ยงหรือกราวด์`,
    explain: 'ขาสัญญาณต้องต่อกับ GPIO เท่านั้น ถ้าต่อกับ 3V3/GND ค่าที่อ่านได้จะค้างอยู่ค่าเดียว',
  }),
  'input-only': (n, s) => ({
    severity: 'error',
    message: `${n}: ขา ${s} ต่อกับ GPIO ที่รับสัญญาณเข้าได้อย่างเดียว`,
    explain: 'เซนเซอร์แบบสายเดียวต้องให้บอร์ดส่งสัญญาณเริ่มต้นออกไปก่อน ขา GPIO34–39 ส่งสัญญาณออกไม่ได้ ให้ย้ายไปขาอื่น เช่น GPIO4',
  }),
  'not-adc': (n, s) => ({
    severity: 'error',
    message: `${n}เป็นเซนเซอร์ Analog แต่ขา ${s} ต่อกับขาที่ไม่มี ADC`,
    explain: 'สัญญาณ Analog ต้องอ่านด้วยตัวแปลง ADC ให้ใช้ขา ADC1 เช่น GPIO32–GPIO35',
  }),
  adc2: (n) => ({
    severity: 'warning',
    message: `${n}ต่อกับขา ADC2`,
    explain: 'บนบอร์ดตระกูล ESP32 ขา ADC2 ใช้อ่านค่าไม่ได้ขณะเปิด WiFi ถ้าจะส่งข้อมูลขึ้นคลาวด์ในด่านถัดไป ควรย้ายไปขา ADC1 (GPIO32–35)',
  }),
  'vcc-5v-logic': (n) => ({
    severity: 'warning',
    message: `${n}ได้รับไฟ 5V ทำให้ขา DATA มีแรงดัน 5V`,
    explain: 'บอร์ดนี้ใช้ลอจิก 3.3V การป้อน 5V เข้าขา GPIO อาจทำให้ขาเสียหาย ให้จ่ายไฟเซนเซอร์จาก 3V3 แทน',
  }),
  'needs-5v': (n) => ({
    severity: 'error',
    message: `${n}ได้รับไฟเพียง 3.3V ซึ่งไม่พอ`,
    explain: 'โมดูล PIR ทั่วไปต้องการไฟเลี้ยงประมาณ 5V (ขาเอาต์พุตยังเป็น 3.3V ปลอดภัยกับบอร์ด) ให้ต่อ VCC ไปที่ขา 5V',
  }),
}

export function validateCircuit(state: CircuitState): CircuitReport {
  const nl = buildNetlist(state)
  const comps = state.components
  const issues: Issue[] = []
  const gpioUsage: Record<number, string[]> = {}
  const useGpio = (g: BoardPin | undefined, who: string) => {
    if (g?.gpio === undefined) return
    ;(gpioUsage[g.gpio] ??= []).includes(who) || gpioUsage[g.gpio].push(who)
  }
  const name = (c: PlacedComponent) => componentName(c)

  // 1) Power availability
  if (!state.usbConnected) {
    issues.push({
      severity: 'error',
      code: 'no-usb',
      message: 'ยังไม่ได้เสียบสาย USB ให้บอร์ด',
      explain: 'บอร์ดได้ไฟเลี้ยง 5V จากสาย USB หยิบสาย USB จากชั้นวางแล้วเสียบเข้าบอร์ดก่อน',
    })
  }

  // 2) Supply shorts
  let shorted = false
  for (const net of nl.nets) {
    if (net.hasGnd && (net.has3v3 || net.has5v)) {
      shorted = true
      issues.push({
        severity: 'danger',
        code: 'short-vcc-gnd',
        message: `ลัดวงจร! ${net.has5v ? '5V' : '3V3'} ต่อตรงกับ GND`,
        explain: 'ไฟเลี้ยงไหลลงกราวด์โดยไม่มีอะไรต้านทาน กระแสสูงมากจนบอร์ดหรือสาย USB เสียหายได้ ระบบตัดไฟจำลองให้แล้ว ลองหาสายที่ต่อราง + กับราง − ถึงกัน',
        nodes: net.nodes.filter((n) => n.startsWith('bb:') || n.startsWith('mcu:')),
      })
    } else if (net.has3v3 && net.has5v) {
      shorted = true
      issues.push({
        severity: 'danger',
        code: 'short-3v3-5v',
        message: 'ขา 3V3 ต่อตรงกับขา 5V',
        explain: 'แหล่งจ่ายสองแรงดันชนกัน ตัวควบคุมแรงดันบนบอร์ดอาจเสียหาย แยกสองรางนี้ออกจากกัน',
        nodes: net.nodes.filter((n) => n.startsWith('bb:') || n.startsWith('mcu:')),
      })
    }
    if (net.gpios.length > 1) {
      issues.push({
        severity: 'warning',
        code: 'gpio-gpio',
        message: `ขา ${net.gpios.map((g) => `GPIO${g.gpio}`).join(' กับ ')} ถูกต่อเข้าหากัน`,
        explain: 'ถ้าขาหนึ่งสั่ง HIGH อีกขาสั่ง LOW จะเกิดกระแสไหลระหว่างขาสูงเกินไป',
      })
    }
    if (net.gpios.length && (net.hasGnd || net.has3v3 || net.has5v) && !(net.hasGnd && (net.has3v3 || net.has5v))) {
      issues.push({
        severity: 'warning',
        code: 'gpio-to-supply',
        message: `ขา ${net.gpios.map((g) => `GPIO${g.gpio}`).join(', ')} ต่อตรงกับ ${net.hasGnd ? 'GND' : net.has5v ? '5V' : '3V3'}`,
        explain: net.has5v
          ? 'ขา GPIO รับแรงดันได้สูงสุดประมาณ 3.3V การต่อ 5V เข้าตรง ๆ อาจทำให้ขาเสียหาย'
          : 'ถ้าบอร์ดสั่งขานี้เป็นเอาต์พุตในสถานะตรงข้าม จะเป็นการลัดวงจรขา GPIO',
      })
    }
  }

  // 3) Two-terminal parts with both legs on one net
  for (const c of comps) {
    if (c.type !== 'resistor') continue
    const a = nl.pinNet(c.id, '1')
    const b = nl.pinNet(c.id, '2')
    if (a && b && a.id === b.id && (a.nodes.length > 2 || a.hasGnd || a.has3v3)) {
      issues.push({
        severity: 'info',
        code: 'resistor-bypassed',
        message: `${name(c)} ถูกลัดขา (ขาทั้งสองอยู่บนจุดเชื่อมเดียวกัน)`,
        explain: 'กระแสจะไหลข้ามตัวต้านทานไปเลย ทำให้ตัวต้านทานไม่มีผล',
        compIds: [c.id],
      })
    }
  }

  // 4) LEDs
  const leds = comps.filter((c) => c.type === 'led').map((c) => analyzeLed(nl, comps, c))
  for (const a of leds) {
    const c = comps.find((x) => x.id === a.compId)!
    const n = name(c)
    const nodes = [pinNode(c.id, 'A'), pinNode(c.id, 'K')]
    const push = (severity: Severity, code: string, message: string, explain?: string) =>
      issues.push({ severity, code, message, explain, compIds: [c.id], nodes })
    switch (a.status) {
      case 'no-resistor':
        push(
          'danger',
          'led-no-resistor',
          `${n} ยังไม่มีตัวต้านทานจำกัดกระแส`,
          'LED ต่อตรงกับแหล่งจ่ายจะมีกระแสไหลสูงเกินพิกัด ทำให้ LED และขาบอร์ดเสียหาย ใส่ตัวต้านทาน 220Ω ระหว่างขา GPIO กับขา Anode',
        )
        break
      case 'reversed':
        push(
          'error',
          'led-reversed',
          `${n} ต่อกลับขั้ว จึงไม่ติด`,
          'LED ให้กระแสไหลทางเดียวจาก Anode (ขายาว) ไป Cathode (ขาสั้น) ให้หมุนกลับด้าน LED โดยให้ขายาวอยู่ฝั่งตัวต้านทาน/GPIO และขาสั้นลง GND',
        )
        break
      case 'shorted':
        push('error', 'led-shorted', `ขาทั้งสองของ ${n} อยู่บนจุดเชื่อมเดียวกัน`, 'ย้าย LED ให้ขาแต่ละข้างอยู่คนละคอลัมน์')
        break
      case 'input-only':
        push(
          'error',
          'led-input-only',
          `${n} ต่อกับ ${gpioName(a.drive?.gpio)} ซึ่งเป็นขารับสัญญาณเข้าอย่างเดียว`,
          'ขา GPIO34–39 ส่งไฟออกไม่ได้ ให้ย้ายไปใช้ขาเอาต์พุต เช่น GPIO2, GPIO4, GPIO18',
        )
        break
      case 'active-low':
        push(
          'info',
          'led-active-low',
          `${n} ต่อแบบ 3V3 → LED → GPIO (active-low)`,
          'วงจรนี้ใช้ได้จริงในงานวิศวกรรม แต่ภารกิจในแล็บนี้ให้ต่อแบบ GPIO → ตัวต้านทาน → LED → GND เพื่อให้สั่ง HIGH แล้วไฟติด',
        )
        break
      case 'incomplete':
        push(
          'error',
          'led-incomplete',
          a.missing === 'cathode' ? `ขา Cathode ของ ${n} ยังไม่ได้ต่อลง GND` : `${n} ยังไม่ได้รับไฟจาก GPIO`,
          a.missing === 'cathode'
            ? 'ต่อขาสั้น (Cathode) ไปยังราง − ที่ต่อกับ GND ของบอร์ด'
            : 'ต่อสายจากขา GPIO ไปยังตัวต้านทาน แล้วต่อตัวต้านทานเข้าขายาว (Anode) ของ LED',
        )
        break
      case 'too-dim':
        push(
          'warning',
          'led-too-dim',
          `${n} ได้กระแสน้อยมาก (${a.currentMa!.toFixed(2)} mA) แทบมองไม่เห็นแสง`,
          `ความต้านทานรวม ${formatOhms(a.resistance!)} มากเกินไป ลองใช้ค่าที่น้อยลง เช่น 220Ω`,
        )
        break
      case 'ok': {
        const i = a.currentMa!
        if (a.drive?.kind === 'GPIO' && i > GPIO_WARN_MA) {
          push('warning', 'led-high-current', `${n} มีกระแส ${i.toFixed(1)} mA สูงเกินที่ขา GPIO ควรจ่าย`, `ขา GPIO ควรจ่ายไม่เกินประมาณ ${GPIO_SAFE_MA} mA ให้เพิ่มค่าตัวต้านทาน`)
        } else {
          push(
            'ok',
            'led-ok',
            `${n}: กระแส ≈ ${i.toFixed(1)} mA (R = ${formatOhms(a.resistance!)}) ${a.drive?.kind === 'GPIO' ? `ควบคุมด้วย ${gpioName(a.drive.gpio)}` : `ติดตลอดจาก ${a.drive?.kind}`}`,
            i < 2 ? 'LED ติดแต่ค่อนข้างหรี่ เพราะแรงดันตกคร่อม LED สูงเมื่อเทียบกับ 3.3V' : undefined,
          )
        }
        break
      }
    }
    useGpio(a.drive?.gpio, n)
  }

  // 5) LDR dividers
  const ldrs = comps.filter((c) => c.type === 'ldr').map((c) => analyzeLdr(nl, comps, c))
  for (const d of ldrs) {
    const c = comps.find((x) => x.id === d.compId)!
    const push = (severity: Severity, code: string, message: string, explain?: string) =>
      issues.push({ severity, code, message, explain, compIds: [c.id, ...(d.fixedId ? [d.fixedId] : [])] })
    switch (d.status) {
      case 'ok':
        push(
          'ok',
          'ldr-ok',
          `วงจรแบ่งแรงดัน LDR + ${formatOhms(d.rFixed!)} ต่อเข้า ${gpioName(d.gpio)} (${d.gpio!.adc})`,
          d.ldrOnTop ? 'LDR อยู่ฝั่ง 3V3: แสงมากขึ้น → ค่า ADC สูงขึ้น' : 'LDR อยู่ฝั่ง GND: แสงมากขึ้น → ค่า ADC ลดลง',
        )
        if (d.rFixed !== 10000)
          push('info', 'ldr-r-value', `ตัวต้านทานคู่กับ LDR คือ ${formatOhms(d.rFixed!)}`, 'ค่าที่นิยมคือ 10kΩ ซึ่งใกล้กับความต้านทานของ LDR ในแสงห้อง ทำให้ช่วงค่าที่อ่านได้กว้างที่สุด')
        if (d.gpio?.adc === 'ADC2') push('warning', 'ldr-adc2', `${gpioName(d.gpio)} เป็นขา ADC2`, 'ขา ADC2 อ่านค่าไม่ได้ขณะเปิด WiFi ควรใช้ GPIO32–35 (ADC1)')
        break
      case 'not-adc':
        push('error', 'ldr-not-adc', `LDR ต่อเข้า ${gpioName(d.gpio)} ซึ่งไม่มี ADC`, 'แรงดันจากวงจรแบ่งแรงดันเป็นสัญญาณ Analog ต้องอ่านด้วยขา ADC เช่น GPIO34 หรือ GPIO32')
        break
      case 'no-gpio':
        push('error', 'ldr-no-gpio', 'จุดกลางของวงจรแบ่งแรงดันยังไม่ได้ต่อเข้าขา ADC', 'ต่อสายจากจุดที่ LDR กับตัวต้านทาน 10kΩ มาเจอกัน ไปยังขา ADC เช่น GPIO34')
        break
      case 'no-fixed-resistor':
        push(
          'error',
          'ldr-no-divider',
          'LDR ยังไม่ครบวงจรแบ่งแรงดัน (ขาดตัวต้านทานคู่)',
          'ถ้ามีแค่ LDR ต่อไฟ ขา ADC จะเห็นแรงดันเกือบเท่าเดิมตลอดไม่ว่าแสงจะเปลี่ยนแค่ไหน ต้องมีตัวต้านทาน 10kΩ จากจุดกลางลง GND',
        )
        break
      case 'overvoltage':
        push('danger', 'ldr-overvoltage', 'วงจรแบ่งแรงดันใช้ไฟ 5V', 'แรงดันที่จุดกลางอาจสูงเกิน 3.3V ซึ่งเกินที่ขา ADC รับได้ ให้ใช้ไฟ 3V3')
        break
      case 'input-short':
        push('error', 'ldr-input-short', 'จุดกลางของวงจร LDR ถูกต่อตรงกับไฟเลี้ยงหรือกราวด์', 'ค่าที่อ่านจะค้างที่ 0 หรือ 4095 ตลอด ไม่ตอบสนองต่อแสง')
        break
      case 'shorted':
        push('error', 'ldr-shorted', 'ขาทั้งสองของ LDR อยู่บนจุดเชื่อมเดียวกัน', 'ย้าย LDR ให้ขาแต่ละข้างอยู่คนละคอลัมน์')
        break
      case 'no-supply':
        push('error', 'ldr-no-supply', 'LDR ยังไม่ได้ต่อกับไฟเลี้ยง', 'ต่อขาหนึ่งของ LDR ไปที่ 3V3 ขาอีกข้างเป็นจุดกลางที่ต่อกับตัวต้านทาน 10kΩ ลง GND')
        break
    }
    useGpio(d.gpio, 'LDR')
  }

  // 6) 3-pin sensor modules
  const modules: Record<string, ModuleAnalysis> = {}
  for (const c of comps.filter((x) => x.type === 'dht' || x.type === 'soil' || x.type === 'pir')) {
    const m = analyzeModule(nl, c)
    modules[c.id] = m
    const sig = c.type === 'soil' ? 'AOUT' : c.type === 'pir' ? 'OUT' : 'DATA'
    for (const p of [...m.errors, ...m.warnings]) {
      issues.push({ code: `${c.type}-${p}`, compIds: [c.id], ...MODULE_MSG[p](name(c), sig) })
    }
    if (m.ok) {
      issues.push({
        severity: 'ok',
        code: `${c.type}-ok`,
        message: `${name(c)} ต่อครบ: VCC (${m.vcc}), GND และ ${sig} → ${gpioName(m.gpio)}`,
        compIds: [c.id],
      })
    }
    useGpio(m.gpio, name(c))
  }

  // 7) Buzzer
  const buzzers = comps.filter((c) => c.type === 'buzzer').map((c) => analyzeBuzzer(nl, comps, c))
  for (const b of buzzers) {
    const msg: Record<BuzzerAnalysis['status'], [Severity, string, string?]> = {
      ok: ['ok', `บัซเซอร์ต่อครบ ${b.drive?.kind === 'GPIO' ? `ควบคุมด้วย ${gpioName(b.drive.gpio)}` : 'ดังตลอดจากไฟเลี้ยง'}`],
      reversed: ['error', 'บัซเซอร์ต่อกลับขั้ว จึงไม่มีเสียง', 'ขา + (ยาว) ต้องต่อกับ GPIO และขา − ต่อ GND'],
      incomplete: ['error', 'บัซเซอร์ยังต่อไม่ครบวงจร', 'ต่อขา + ไปที่ GPIO และขา − ลง GND'],
      shorted: ['error', 'ขาทั้งสองของบัซเซอร์อยู่บนจุดเชื่อมเดียวกัน'],
      'input-only': ['error', `บัซเซอร์ต่อกับ ${gpioName(b.drive?.gpio)} ซึ่งส่งไฟออกไม่ได้`, 'ย้ายไปใช้ขาเอาต์พุต เช่น GPIO23'],
    }
    const [severity, message, explain] = msg[b.status]
    issues.push({ severity, code: `buzzer-${b.status}`, message, explain, compIds: [b.compId] })
    useGpio(b.drive?.gpio, 'บัซเซอร์')
  }

  // 8) Fan
  const fans = comps.filter((c) => c.type === 'fan').map((c) => analyzeFan(nl, comps, c))
  for (const f of fans) {
    const ids = [f.compId, ...(f.driverId ? [f.driverId] : [])]
    const push = (severity: Severity, code: string, message: string, explain?: string) =>
      issues.push({ severity, code, message, explain, compIds: ids })
    if (f.status === 'direct-gpio') {
      push(
        'error',
        'fan-direct-gpio',
        `พัดลมต่อตรงกับ ${gpioName(f.gpio)} — ขาบอร์ดจ่ายกระแสไม่พอ`,
        'มอเตอร์พัดลมต้องการกระแสหลายร้อยมิลลิแอมป์ แต่ขา GPIO จ่ายได้เพียงไม่กี่สิบมิลลิแอมป์ พัดลมจะไม่หมุนและขาบอร์ดอาจเสียหาย ให้ต่อผ่านโมดูลขับโหลด',
      )
    } else if (f.status === 'always-on') {
      push('warning', 'fan-always-on', 'พัดลมต่อตรงกับไฟเลี้ยง จะหมุนตลอดและบอร์ดสั่งปิดไม่ได้', 'ต่อพัดลมเข้า OUT+/OUT− ของโมดูลขับโหลด แล้วต่อขา IN ของโมดูลกับ GPIO')
    } else if (f.status === 'reversed') {
      push('error', 'fan-reversed', 'พัดลมต่อกลับขั้วที่ OUT+/OUT−', 'พัดลม DC แบบนี้จะไม่หมุนเมื่อกลับขั้ว ให้ต่อขา + กับ OUT+ และขา − กับ OUT−')
    } else if (f.status === 'incomplete') {
      push('error', 'fan-incomplete', 'พัดลมยังต่อไม่ครบ', 'ต่อขา + ของพัดลมกับ OUT+ และขา − กับ OUT− ของโมดูลขับโหลด')
    }
    for (const d of f.driverIssues) {
      const m: Record<typeof d, [Severity, string, string]> = {
        'no-vcc': ['error', 'โมดูลขับโหลดยังไม่มีไฟเลี้ยง', 'ต่อขา VCC ของโมดูลเข้ากับขา 5V ของบอร์ด (ไฟสำหรับพัดลม)'],
        'vcc-3v3': ['warning', 'โมดูลขับโหลดได้ไฟเพียง 3.3V', 'พัดลม 5V จะหมุนช้าและแรงลมน้อย ควรต่อ VCC กับขา 5V'],
        'no-gnd': ['error', 'โมดูลขับโหลดยังไม่ได้ต่อ GND', 'ต่อขา GND ของโมดูลเข้ากับ GND ของบอร์ด (กราวด์ร่วม)'],
        'in-floating': ['error', 'ขา IN ของโมดูลขับโหลดยังไม่ได้ต่อกับ GPIO', 'ต่อขา IN กับขา GPIO เอาต์พุต เช่น GPIO26 เพื่อให้บอร์ดสั่งเปิด/ปิดพัดลม'],
        'in-input-only': ['error', 'ขา IN ของโมดูลต่อกับขาที่ส่งสัญญาณออกไม่ได้', 'ย้ายไปใช้ขาเอาต์พุต เช่น GPIO26'],
      }
      const [s, msg, ex] = m[d]
      push(s, `driver-${d}`, msg, ex)
    }
    if (f.status === 'via-driver') push('ok', 'fan-ok', `พัดลมต่อผ่านโมดูลขับโหลด ควบคุมด้วย ${gpioName(f.gpio)}`)
    if (f.gpio) useGpio(f.gpio, 'พัดลม')
  }

  // 9) Shared GPIO
  for (const [g, users] of Object.entries(gpioUsage)) {
    if (users.length > 1)
      issues.push({
        severity: 'warning',
        code: 'gpio-shared',
        message: `GPIO${g} ถูกใช้ร่วมกันโดย ${users.join(', ')}`,
        explain: 'โดยทั่วไปหนึ่งขาควรทำหน้าที่เดียว ให้แยกแต่ละอุปกรณ์ไปใช้คนละขา',
      })
  }

  // 10) Wire colour convention (good practice only)
  for (const w of state.wires) {
    const net = nl.netOf(w.a)
    if (!net) continue
    if (w.color === 'red' && net.hasGnd && !net.has3v3 && !net.has5v)
      issues.push({ severity: 'info', code: 'wire-color', message: 'ใช้สายสีแดงกับ GND', explain: 'แนวปฏิบัติที่ดี: สีดำสำหรับ GND และสีแดงสำหรับไฟเลี้ยง จะช่วยให้คนอื่นอ่านวงจรเข้าใจง่าย' })
    if (w.color === 'black' && (net.has3v3 || net.has5v) && !net.hasGnd)
      issues.push({ severity: 'info', code: 'wire-color', message: 'ใช้สายสีดำกับไฟเลี้ยง', explain: 'แนวปฏิบัติที่ดี: สีแดงสำหรับไฟเลี้ยง (VCC) และสีดำสำหรับ GND' })
  }

  // de-duplicate wire colour hints
  const seen = new Set<string>()
  const deduped = issues.filter((i) => {
    if (i.code !== 'wire-color') return true
    const k = i.code + i.message
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const order: Severity[] = ['danger', 'error', 'warning', 'info', 'ok']
  deduped.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))

  return { netlist: nl, issues: deduped, shorted, leds, ldrs, modules, buzzers, fans, gpioUsage }
}
