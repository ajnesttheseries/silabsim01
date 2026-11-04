/**
 * Virtual firmware + simulation core. Glues A (environment), B (circuit report) and C (sensors):
 * reads sensors through the pins found in the netlist, runs IF–THEN rules, drives actuators,
 * and prints Serial lines. Pure TypeScript; the UI store wraps one instance.
 */
import { LED_VF, type LedColor } from './circuit/catalog'
import { SUPPLY_VOLTAGE } from './circuit/board'
import { emptyCircuit, type CircuitState } from './circuit/netlist'
import { validateCircuit, type CircuitReport } from './circuit/validator'
import { defaultControls, initialEnv, stepEnv, type EnvControls, type EnvState } from './environment'
import { createRng, clamp, type Rng } from './rng'
import { evaluateRules, pinMapFromReport, type ActuatorKey, type PinMap, type Rule, type SensorValues } from './rules'
import {
  defaultSoilCal,
  initDht,
  initPir,
  readLdr,
  readSoil,
  soilPercent,
  stepDht,
  stepPir,
  type DhtState,
  type LdrReading,
  type PirState,
  type SensorCtx,
  type SoilCalibration,
  type SoilReading,
} from './sensors'

export interface LedState {
  on: boolean
  brightness: number
  burnt: boolean
  overcurrent: boolean
  color: LedColor
}

export interface Actuators {
  leds: Record<string, LedState>
  fanSpeed: number
  buzzer: boolean
  /** aggregated by rule key */
  byKey: Record<ActuatorKey, boolean>
}

export interface Readings extends SensorValues {
  soilAdc: number | null
  dhtError?: string
  ldr?: LdrReading
  soilRead?: SoilReading
  pirWarming?: boolean
  hasDht: boolean
  hasLdr: boolean
  hasSoil: boolean
  hasPir: boolean
}

export interface LogRow {
  t: number
  temp: number | null
  humidity: number | null
  light: number | null
  soilAdc: number | null
  soilPct: number | null
  motion: number | null
  envTemp: number
  envLux: number
  envSoil: number
}

const ACT_KEYS: ActuatorKey[] = ['ledRed', 'ledGreen', 'ledBlue', 'buzzer', 'fan']
const COLOR_KEY: Record<LedColor, ActuatorKey> = { red: 'ledRed', green: 'ledGreen', blue: 'ledBlue' }

export const emptyReadings = (): Readings => ({
  temp: null,
  humidity: null,
  light: null,
  soil: null,
  motion: null,
  soilAdc: null,
  hasDht: false,
  hasLdr: false,
  hasSoil: false,
  hasPir: false,
})

export const fmtClock = (s: number) => {
  const t = Math.max(0, Math.floor(s))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export class LabSim {
  env: EnvState = initialEnv()
  controls: EnvControls = defaultControls()
  rng: Rng
  noise = true
  powerOn = false
  circuit: CircuitState = emptyCircuit()
  report: CircuitReport
  pins: PinMap = {}
  rules: Rule[] = []
  soilCal: SoilCalibration = defaultSoilCal()
  pirHoldS = 3
  /** manual test switches (used when no rule controls that actuator) */
  manual: Partial<Record<ActuatorKey, boolean>> = {}
  blink: Partial<Record<ActuatorKey, boolean>> = {}
  dht: DhtState
  pir: PirState = initPir()
  readings: Readings = emptyReadings()
  actuators: Actuators = { leds: {}, fanSpeed: 0, buzzer: false, byKey: { ledRed: false, ledGreen: false, ledBlue: false, buzzer: false, fan: false } }
  gpioOut: Record<number, boolean> = {}
  serial: string[] = []
  log: LogRow[] = []
  bootTime = 0
  /** time the LED has been over-driven, per component */
  private overTime: Record<string, number> = {}
  private burnt = new Set<string>()
  private lastPrint = -Infinity
  private lastLog = -Infinity
  /** set when a short trips the virtual supply */
  tripped = false

  constructor(seed = 42) {
    this.rng = createRng(seed)
    this.report = validateCircuit(this.circuit)
    this.dht = initDht(this.rng, this.env)
  }

  get powered() {
    return this.powerOn && this.circuit.usbConnected && !this.report.shorted
  }

  setCircuit(c: CircuitState) {
    this.circuit = c
    this.report = validateCircuit(c)
    this.pins = pinMapFromReport(this.report, c.components)
    // a fixed LED gets a fresh part (the burnt one is "replaced")
    for (const id of [...this.burnt]) {
      const l = this.report.leds.find((x) => x.compId === id)
      if (!l || l.status !== 'no-resistor') this.burnt.delete(id)
    }
    if (this.powerOn && this.report.shorted) {
      this.powerOn = false
      this.tripped = true
      this.print('!! Brownout: supply shorted — power cut')
    }
  }

  setPower(on: boolean): { ok: boolean; reason?: 'short' | 'usb' } {
    if (on && this.report.shorted) return { ok: false, reason: 'short' }
    if (on && !this.circuit.usbConnected) return { ok: false, reason: 'usb' }
    if (on && !this.powerOn) {
      this.bootTime = this.env.time
      this.lastPrint = -Infinity
      this.tripped = false
      this.powerOn = true
      this.print('ets boot... AIoT Lab board v1.0 (3.3V logic, ADC 12-bit)')
      this.print('Serial 115200 baud — ready')
    } else if (!on) this.powerOn = false
    return { ok: true }
  }

  /** monotonically increasing counters (arrays are capped, so their length stops changing) */
  serialCount = 0
  logCount = 0

  private print(line: string) {
    this.serialCount++
    this.serial.push(`[${fmtClock(this.env.time - this.bootTime)}] ${line}`)
    if (this.serial.length > 400) this.serial.splice(0, this.serial.length - 400)
  }

  step(dt: number) {
    const powered = this.powered
    const ctx: SensorCtx = { rng: this.rng, noise: this.noise, powered, dt, time: this.env.time }
    const comps = this.circuit.components
    const dhtComp = comps.find((c) => c.type === 'dht')
    const soilComp = comps.find((c) => c.type === 'soil')
    const pirComp = comps.find((c) => c.type === 'pir')
    const ldrA = this.report.ldrs[0]

    // --- sensors (C) ---
    const r = emptyReadings()
    r.hasDht = !!dhtComp
    r.hasLdr = !!ldrA
    r.hasSoil = !!soilComp
    r.hasPir = !!pirComp
    if (dhtComp) {
      this.dht = stepDht(this.dht, this.env, this.report.modules[dhtComp.id], ctx)
      r.temp = this.dht.temp
      r.humidity = this.dht.rh
      r.dhtError = this.dht.error
    }
    if (ldrA) {
      r.ldr = readLdr(ldrA, this.env.lux, ctx)
      r.light = r.ldr.adc
    }
    if (soilComp) {
      r.soilRead = readSoil(this.report.modules[soilComp.id], this.env.soil, ctx)
      r.soilAdc = r.soilRead.adc
      r.soil = r.soilAdc == null ? null : soilPercent(r.soilAdc, this.soilCal)
    }
    if (pirComp) {
      const m = this.report.modules[pirComp.id]
      this.pir = stepPir(this.pir, this.env, m, ctx, this.pirHoldS)
      r.pirWarming = this.pir.warming
      if (!powered || !m?.gpio) r.motion = null
      else if (!m.ok) r.motion = this.rng.next() < 0.5 // floating input reads random levels
      else r.motion = this.pir.out
    }
    this.readings = r

    // --- firmware logic ---
    const commanded: Partial<Record<ActuatorKey, boolean>> = {}
    const blinkPhase = Math.floor((this.env.time - this.bootTime) / 0.5) % 2 === 0
    for (const k of ACT_KEYS) {
      if (this.blink[k]) commanded[k] = blinkPhase
      else if (this.manual[k] !== undefined) commanded[k] = this.manual[k]
    }
    Object.assign(commanded, evaluateRules(this.rules, r))
    this.gpioOut = {}
    if (powered) for (const k of ACT_KEYS) if (this.pins[k] !== undefined && commanded[k]) this.gpioOut[this.pins[k]!] = true

    // --- actuators (physical result) ---
    const leds: Record<string, LedState> = {}
    const byKey: Record<ActuatorKey, boolean> = { ledRed: false, ledGreen: false, ledBlue: false, buzzer: false, fan: false }
    for (const l of this.report.leds) {
      const st: LedState = { on: false, brightness: 0, burnt: this.burnt.has(l.compId), overcurrent: false, color: l.color }
      const sourceHigh = powered && !!l.drive && (l.drive.kind !== 'GPIO' || !!this.gpioOut[l.drive.gpio!.gpio!])
      if (l.status === 'no-resistor' && sourceHigh && !st.burnt) {
        st.overcurrent = true
        st.on = true
        st.brightness = 2.5
        this.overTime[l.compId] = (this.overTime[l.compId] ?? 0) + dt
        if (this.overTime[l.compId] > 1.2) {
          this.burnt.add(l.compId)
          st.burnt = true
          st.on = false
          this.print(`!! Overcurrent on ${l.drive?.kind === 'GPIO' ? `GPIO${l.drive.gpio?.gpio}` : l.drive?.kind}: LED damaged (simulated)`)
        }
      } else if ((l.status === 'ok' || l.status === 'too-dim') && sourceHigh) {
        st.on = true
        st.brightness = clamp(l.currentMa! / 8, 0.06, 1.3)
      }
      if (st.on) byKey[COLOR_KEY[l.color]] = true
      leds[l.compId] = st
    }
    let fanSpeed = 0
    for (const f of this.report.fans) {
      if (!powered) continue
      if (f.status === 'via-driver' && f.gpio && this.gpioOut[f.gpio.gpio!]) fanSpeed = f.driverIssues.includes('vcc-3v3') ? 0.5 : 1
      if (f.status === 'always-on') fanSpeed = 1
    }
    byKey.fan = fanSpeed > 0
    let buzzer = false
    for (const b of this.report.buzzers) {
      if (b.status === 'ok' && powered && b.drive && (b.drive.kind !== 'GPIO' || this.gpioOut[b.drive.gpio!.gpio!])) buzzer = true
    }
    byKey.buzzer = buzzer
    this.actuators = { leds, fanSpeed, buzzer, byKey }

    // --- environment (A) evolves, including feedback from the fan ---
    this.env = stepEnv(this.env, this.controls, fanSpeed, dt)

    // --- serial + data log every 1 s ---
    if (powered && this.env.time - this.lastPrint >= 1) {
      this.lastPrint = this.env.time
      this.print(this.serialLine())
    }
    if (this.env.time - this.lastLog >= 1) {
      this.lastLog = this.env.time
      this.logCount++
      this.log.push({
        t: Math.round(this.env.time),
        temp: powered ? r.temp : null,
        humidity: powered ? r.humidity : null,
        light: r.light,
        soilAdc: r.soilAdc,
        soilPct: r.soil,
        motion: r.motion == null ? null : r.motion ? 1 : 0,
        envTemp: +this.env.tempC.toFixed(2),
        envLux: Math.round(this.env.lux),
        envSoil: +this.env.soil.toFixed(1),
      })
      if (this.log.length > 1800) this.log.splice(0, this.log.length - 1800)
    }
  }

  serialLine(): string {
    const r = this.readings
    const parts: string[] = []
    if (r.hasDht) {
      if (r.temp == null) parts.push(`Temp: NaN | Humidity: NaN (Sensor Error${r.dhtError === 'no-power' ? ': no power' : r.dhtError === 'timeout' ? ': timeout' : ': no response'})`)
      else parts.push(`Temp: ${r.temp.toFixed(1)} °C | Humidity: ${r.humidity!.toFixed(1)} %`)
    }
    if (r.hasLdr) parts.push(r.light == null ? 'Light ADC: --' : `Light ADC: ${r.light}`)
    if (r.hasSoil) parts.push(r.soilAdc == null ? 'Soil ADC: --' : `Soil ADC: ${r.soilAdc} (${r.soil} %)`)
    if (r.hasPir) parts.push(r.pirWarming ? 'Motion: warming up' : `Motion: ${r.motion == null ? '--' : r.motion ? 1 : 0}`)
    const outs = ACT_KEYS.filter((k) => this.pins[k] !== undefined).map((k) => `${k}=${this.gpioOut[this.pins[k]!] ? 'ON' : 'off'}`)
    if (!parts.length) parts.push('Board running. No sensors attached')
    if (outs.length) parts.push(outs.join(' '))
    return parts.join(' | ')
  }

  /** Multimeter: DC voltage of the net containing `node` relative to GND; null = floating/unknown. */
  measure(node: string): number | null {
    const net = this.report.netlist.netOf(node)
    if (!net) return null
    if (!this.powered) return 0
    if (net.hasGnd) return 0
    if (net.has5v) return 5
    if (net.has3v3) return SUPPLY_VOLTAGE
    for (const g of net.gpios) if (g.output && this.pins && Object.values(this.pins).includes(g.gpio)) return this.gpioOut[g.gpio!] ? SUPPLY_VOLTAGE : 0
    for (const d of this.report.ldrs) {
      if (d.status === 'ok' && d.gpio && net.gpios.includes(d.gpio)) return this.readings.ldr?.volts ?? null
    }
    for (const l of this.report.leds) {
      const st = this.actuators.leds[l.compId]
      if (!st?.on || !l.currentMa || !l.drive) continue
      const nl = this.report.netlist
      const iA = l.currentMa / 1000
      const rLow = l.resistance! - l.drive.r // resistance between cathode and GND
      if (nl.pinNet(l.compId, 'A')?.id === net.id) return +(LED_VF[l.color] + iA * rLow).toFixed(2)
      if (nl.pinNet(l.compId, 'K')?.id === net.id) return +(iA * rLow).toFixed(2)
    }
    for (const c of this.circuit.components) {
      const m = this.report.modules[c.id]
      if (!m?.ok) continue
      const sig = c.type === 'soil' ? 'AOUT' : c.type === 'pir' ? 'OUT' : 'DATA'
      if (this.report.netlist.pinNet(c.id, sig)?.id !== net.id) continue
      if (c.type === 'soil') return this.readings.soilAdc == null ? null : +((this.readings.soilAdc / 4095) * SUPPLY_VOLTAGE).toFixed(2)
      if (c.type === 'pir') return this.readings.motion ? SUPPLY_VOLTAGE : 0
      if (c.type === 'dht') return SUPPLY_VOLTAGE // idle line is pulled up
    }
    return null
  }
}
