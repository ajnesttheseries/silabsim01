/** IF–THEN rule builder: evaluation + generated Arduino C++ / MicroPython (read-only view). */
import type { CircuitReport } from './circuit/validator'
import type { SoilCalibration } from './sensors'

export type SensorKey = 'temp' | 'humidity' | 'light' | 'soil' | 'motion'
export type ActuatorKey = 'ledRed' | 'ledGreen' | 'ledBlue' | 'buzzer' | 'fan'
export type Op = '>' | '<'

export interface Rule {
  id: string
  sensor: SensorKey
  op: Op
  value: number
  actuator: ActuatorKey
  action: 'on' | 'off'
  /** when the condition is false, do the opposite */
  otherwise: boolean
  enabled: boolean
}

export const SENSOR_INFO: Record<SensorKey, { th: string; unit: string; min: number; max: number; step: number; def: number }> = {
  temp: { th: 'อุณหภูมิ', unit: '°C', min: 20, max: 45, step: 0.5, def: 30 },
  humidity: { th: 'ความชื้นอากาศ', unit: '%RH', min: 20, max: 95, step: 1, def: 65 },
  light: { th: 'แสง (ค่า ADC)', unit: '', min: 0, max: 4095, step: 50, def: 2500 },
  soil: { th: 'ความชื้นในดิน', unit: '%', min: 0, max: 100, step: 1, def: 35 },
  motion: { th: 'การเคลื่อนไหว (PIR)', unit: '', min: 0, max: 1, step: 1, def: 0 },
}

export const ACTUATOR_INFO: Record<ActuatorKey, { th: string }> = {
  ledRed: { th: 'LED แดง' },
  ledGreen: { th: 'LED เขียว' },
  ledBlue: { th: 'LED น้ำเงิน' },
  buzzer: { th: 'บัซเซอร์' },
  fan: { th: 'พัดลม' },
}

export interface SensorValues {
  temp: number | null
  humidity: number | null
  light: number | null
  soil: number | null
  motion: boolean | null
}

export function conditionTrue(r: Rule, v: SensorValues): boolean | null {
  const x = r.sensor === 'motion' ? (v.motion == null ? null : v.motion ? 1 : 0) : v[r.sensor]
  if (x == null || Number.isNaN(x)) return null
  if (r.sensor === 'motion') return r.op === '>' ? x > r.value - 0.5 : x < r.value + 0.5
  return r.op === '>' ? x > r.value : x < r.value
}

/** Returns the commanded state per actuator (undefined = no rule decides it). Later rules win. */
export function evaluateRules(rules: Rule[], v: SensorValues): Partial<Record<ActuatorKey, boolean>> {
  const out: Partial<Record<ActuatorKey, boolean>> = {}
  for (const r of rules) {
    if (!r.enabled) continue
    const c = conditionTrue(r, v)
    if (c === null) continue // invalid sensor data → leave as is (safe behaviour)
    if (c) out[r.actuator] = r.action === 'on'
    else if (r.otherwise) out[r.actuator] = r.action !== 'on'
  }
  return out
}

/* ---------------- Code generation ---------------- */

export interface PinMap {
  dht?: number
  ldr?: number
  soil?: number
  pir?: number
  ledRed?: number
  ledGreen?: number
  ledBlue?: number
  buzzer?: number
  fan?: number
}

export function pinMapFromReport(rep: CircuitReport, comps: { id: string; type: string; variant?: unknown }[]): PinMap {
  const pm: PinMap = {}
  for (const c of comps) {
    if (c.type === 'dht') pm.dht ??= rep.modules[c.id]?.gpio?.gpio
    if (c.type === 'soil') pm.soil ??= rep.modules[c.id]?.gpio?.gpio
    if (c.type === 'pir') pm.pir ??= rep.modules[c.id]?.gpio?.gpio
  }
  const ldr = rep.ldrs.find((d) => d.gpio)
  if (ldr) pm.ldr = ldr.gpio!.gpio
  for (const l of rep.leds) {
    const g = l.drive?.kind === 'GPIO' ? l.drive.gpio?.gpio : undefined
    if (g === undefined) continue
    const key = l.color === 'red' ? 'ledRed' : l.color === 'green' ? 'ledGreen' : 'ledBlue'
    pm[key] ??= g
  }
  const bz = rep.buzzers.find((b) => b.drive?.kind === 'GPIO')
  if (bz) pm.buzzer = bz.drive!.gpio!.gpio
  const fan = rep.fans.find((f) => f.gpio)
  if (fan) pm.fan = fan.gpio!.gpio
  return pm
}

const VAR: Record<SensorKey, string> = { temp: 'temp', humidity: 'humidity', light: 'light', soil: 'soilPct', motion: 'motion' }
const CONST: Record<ActuatorKey, string> = { ledRed: 'LED_RED_PIN', ledGreen: 'LED_GREEN_PIN', ledBlue: 'LED_BLUE_PIN', buzzer: 'BUZZER_PIN', fan: 'FAN_PIN' }
const PY: Record<ActuatorKey, string> = { ledRed: 'led_red', ledGreen: 'led_green', ledBlue: 'led_blue', buzzer: 'buzzer', fan: 'fan' }

function usedSensors(rules: Rule[]): SensorKey[] {
  const s = new Set<SensorKey>(rules.filter((r) => r.enabled).map((r) => r.sensor))
  return (['temp', 'humidity', 'light', 'soil', 'motion'] as SensorKey[]).filter((k) => s.has(k))
}
function usedActuators(rules: Rule[]): ActuatorKey[] {
  return [...new Set(rules.filter((r) => r.enabled).map((r) => r.actuator))]
}
const pinOr = (p: number | undefined) => (p === undefined ? '-1 /* ยังไม่ได้ต่อ */' : String(p))
const pinOrPy = (p: number | undefined) => (p === undefined ? '-1  # ยังไม่ได้ต่อ' : String(p))
const fmt = (r: Rule) => (r.sensor === 'motion' ? (r.op === '>' ? '== 1' : '== 0') : `${r.op} ${r.value}`)

export function generateArduino(rules: Rule[], pm: PinMap, cal: SoilCalibration): string {
  const sensors = usedSensors(rules)
  const acts = usedActuators(rules)
  const L: string[] = ['// โค้ดนี้สร้างอัตโนมัติจากกฎที่ตั้งไว้ (Arduino C++ สำหรับบอร์ดตระกูล ESP32)']
  const needDht = sensors.includes('temp') || sensors.includes('humidity')
  if (needDht) L.push('#include <DHT.h>', '')
  if (needDht) L.push(`#define DHT_PIN ${pinOr(pm.dht)}`, '#define DHT_TYPE DHT22')
  if (sensors.includes('light')) L.push(`const int LDR_PIN = ${pinOr(pm.ldr)};   // ขา ADC`)
  if (sensors.includes('soil')) L.push(`const int SOIL_PIN = ${pinOr(pm.soil)};  // ขา ADC`, `const int SOIL_DRY = ${cal.dry};  // ค่า ADC ตอนดินแห้ง`, `const int SOIL_WET = ${cal.wet};  // ค่า ADC ตอนดินเปียก`)
  if (sensors.includes('motion')) L.push(`const int PIR_PIN = ${pinOr(pm.pir)};`)
  for (const a of acts) L.push(`const int ${CONST[a]} = ${pinOr(pm[a])};`)
  if (needDht) L.push('', 'DHT dht(DHT_PIN, DHT_TYPE);')
  L.push('', 'void setup() {', '  Serial.begin(115200);')
  if (needDht) L.push('  dht.begin();')
  if (sensors.includes('motion')) L.push('  pinMode(PIR_PIN, INPUT);')
  for (const a of acts) L.push(`  pinMode(${CONST[a]}, OUTPUT);`)
  L.push('}', '', 'void loop() {')
  if (sensors.includes('temp')) L.push('  float temp = dht.readTemperature();      // °C')
  if (sensors.includes('humidity')) L.push('  float humidity = dht.readHumidity();     // %RH')
  if (sensors.includes('light')) L.push('  int light = analogRead(LDR_PIN);          // 0–4095 (ADC 12 บิต)')
  if (sensors.includes('soil')) L.push('  int soilRaw = analogRead(SOIL_PIN);', '  int soilPct = constrain(map(soilRaw, SOIL_DRY, SOIL_WET, 0, 100), 0, 100);')
  if (sensors.includes('motion')) L.push('  int motion = digitalRead(PIR_PIN);        // HIGH = มีการเคลื่อนไหว')
  if (needDht) L.push('', '  if (isnan(temp) || isnan(humidity)) {', '    Serial.println("Sensor Error");', '    delay(2000);', '    return;', '  }')
  for (const r of rules.filter((x) => x.enabled)) {
    const on = r.action === 'on' ? 'HIGH' : 'LOW'
    const off = r.action === 'on' ? 'LOW' : 'HIGH'
    L.push('', `  // ถ้า ${SENSOR_INFO[r.sensor].th} ${fmt(r)} แล้ว ${r.action === 'on' ? 'เปิด' : 'ปิด'} ${ACTUATOR_INFO[r.actuator].th}`)
    L.push(`  if (${VAR[r.sensor]} ${fmt(r)}) {`, `    digitalWrite(${CONST[r.actuator]}, ${on});`)
    if (r.otherwise) L.push('  } else {', `    digitalWrite(${CONST[r.actuator]}, ${off});`)
    L.push('  }')
  }
  L.push('', `  delay(${needDht ? 2000 : 500});  // ${needDht ? 'DHT22 อ่านได้ทุก ~2 วินาที' : 'รอเล็กน้อยก่อนอ่านรอบถัดไป'}`, '}')
  return L.join('\n')
}

export function generateMicroPython(rules: Rule[], pm: PinMap, cal: SoilCalibration): string {
  const sensors = usedSensors(rules)
  const acts = usedActuators(rules)
  const needDht = sensors.includes('temp') || sensors.includes('humidity')
  const L: string[] = ['# โค้ดนี้สร้างอัตโนมัติจากกฎที่ตั้งไว้ (MicroPython สำหรับบอร์ดตระกูล ESP32)', 'from machine import Pin, ADC', 'import time']
  if (needDht) L.push('import dht')
  L.push('')
  if (needDht) L.push(`sensor = dht.DHT22(Pin(${pinOrPy(pm.dht)}))`)
  if (sensors.includes('light')) L.push(`ldr = ADC(Pin(${pinOrPy(pm.ldr)}))`, 'ldr.atten(ADC.ATTN_11DB)  # อ่านแรงดันได้เกือบเต็ม 0–3.3V')
  if (sensors.includes('soil')) L.push(`soil = ADC(Pin(${pinOrPy(pm.soil)}))`, 'soil.atten(ADC.ATTN_11DB)', `SOIL_DRY, SOIL_WET = ${cal.dry}, ${cal.wet}`)
  if (sensors.includes('motion')) L.push(`pir = Pin(${pinOrPy(pm.pir)}, Pin.IN)`)
  for (const a of acts) L.push(`${PY[a]} = Pin(${pinOrPy(pm[a])}, Pin.OUT)`)
  L.push('', 'while True:')
  if (needDht) L.push('    try:', '        sensor.measure()', '    except OSError:', '        print("Sensor Error")', '        time.sleep(2)', '        continue')
  if (sensors.includes('temp')) L.push('    temp = sensor.temperature()        # °C')
  if (sensors.includes('humidity')) L.push('    humidity = sensor.humidity()       # %RH')
  if (sensors.includes('light')) L.push('    light = ldr.read()                 # 0–4095')
  if (sensors.includes('soil')) L.push('    soil_raw = soil.read()', '    soilPct = max(0, min(100, (SOIL_DRY - soil_raw) * 100 // (SOIL_DRY - SOIL_WET)))')
  if (sensors.includes('motion')) L.push('    motion = pir.value()               # 1 = มีการเคลื่อนไหว')
  for (const r of rules.filter((x) => x.enabled)) {
    const on = r.action === 'on' ? 1 : 0
    L.push('', `    # ถ้า ${SENSOR_INFO[r.sensor].th} ${fmt(r)} แล้ว ${r.action === 'on' ? 'เปิด' : 'ปิด'} ${ACTUATOR_INFO[r.actuator].th}`)
    L.push(`    if ${VAR[r.sensor]} ${fmt(r)}:`, `        ${PY[r.actuator]}.value(${on})`)
    if (r.otherwise) L.push('    else:', `        ${PY[r.actuator]}.value(${1 - on})`)
  }
  L.push('', `    time.sleep(${needDht ? 2 : 0.5})`)
  return L.join('\n')
}
