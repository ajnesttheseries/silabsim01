import type { ReactNode } from 'react'
import { CATALOG } from '../../engine/circuit/catalog'
import { useLab } from '../../store/lab'
import { Btn, Section } from '../common'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-sm text-cyan-100">{label}</p>
      {children}
    </div>
  )
}

function DataPath() {
  const r = useLab((s) => s.simView.readings)
  const env = useLab((s) => s.simView.env)
  const powered = useLab((s) => s.simView.powered)
  const report = useLab((s) => s.report)
  const comps = useLab((s) => s.circuit.components)
  const rows: Array<{ k: string; env: string; sensor: string; pin: string; value: string; ok: boolean }> = []
  for (const c of comps) {
    const m = report.modules[c.id]
    if (c.type === 'dht')
      rows.push({
        k: c.id,
        env: `อากาศ ${env.tempC.toFixed(2)} °C`,
        sensor: CATALOG.dht.nameTh,
        pin: m?.gpio ? `GPIO${m.gpio.gpio} (Digital)` : '—',
        value: r.temp == null ? 'NaN' : `${r.temp.toFixed(1)} °C`,
        ok: !!m?.ok && powered,
      })
    if (c.type === 'soil')
      rows.push({
        k: c.id,
        env: `ดิน ${env.soil.toFixed(0)}%`,
        sensor: CATALOG.soil.nameTh,
        pin: m?.gpio ? `GPIO${m.gpio.gpio} (${m.gpio.adc ?? 'ไม่มี ADC'})` : '—',
        value: r.soilAdc == null ? '--' : `ADC ${r.soilAdc}`,
        ok: !!m?.ok && powered,
      })
    if (c.type === 'pir')
      rows.push({
        k: c.id,
        env: env.time < env.motionUntil ? 'มีคนเดินผ่าน' : 'ไม่มีการเคลื่อนไหว',
        sensor: CATALOG.pir.nameTh,
        pin: m?.gpio ? `GPIO${m.gpio.gpio} (Digital)` : '—',
        value: r.pirWarming ? 'warm-up…' : r.motion == null ? '--' : r.motion ? 'HIGH' : 'LOW',
        ok: !!m?.ok && powered,
      })
  }
  for (const d of report.ldrs)
    rows.push({
      k: d.compId,
      env: `แสง ${Math.round(env.lux)} lux`,
      sensor: 'LDR + วงจรแบ่งแรงดัน',
      pin: d.gpio ? `GPIO${d.gpio.gpio} (${d.gpio.adc ?? 'ไม่มี ADC'})` : '—',
      value: r.light == null ? '--' : `ADC ${r.light}`,
      ok: d.status === 'ok' && powered,
    })
  return (
    <Section title="เส้นทางของข้อมูล: สภาพแวดล้อม → เซนเซอร์ → ขาสัญญาณ → บอร์ด → จอ">
      {!rows.length && <p className="text-sm text-slate-300">ยังไม่มีเซนเซอร์ในวงจร</p>}
      <div className="space-y-2">
        {rows.map((x) => (
          <div key={x.k} className={`flex flex-wrap items-center gap-1 rounded-xl p-2 text-xs ${x.ok ? 'bg-emerald-900/30' : 'bg-rose-900/30'}`}>
            <span className="rounded bg-white/10 px-1.5 py-0.5">{x.env}</span>→<span className="rounded bg-white/10 px-1.5 py-0.5">{x.sensor}</span>→
            <span className="rounded bg-white/10 px-1.5 py-0.5">{x.pin}</span>→<span className="rounded bg-white/10 px-1.5 py-0.5">บอร์ด</span>→
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono">{x.value}</span>
            {!x.ok && <span className="text-rose-200">(ข้อมูลไม่ถึงบอร์ด — ตรวจวงจร/จ่ายไฟ)</span>}
          </div>
        ))}
      </div>
    </Section>
  )
}

export function EnvPanel() {
  const c = useLab((s) => s.simView.controls)
  const env = useLab((s) => s.simView.env)
  const r = useLab((s) => s.simView.readings)
  const setControls = useLab((s) => s.setControls)
  const water = useLab((s) => s.water)
  const walk = useLab((s) => s.walk)
  const noise = useLab((s) => s.noise)
  const setNoise = useLab((s) => s.setNoise)
  const pirHold = useLab((s) => s.pirHold)
  const setPirHold = useLab((s) => s.setPirHold)
  const cal = useLab((s) => s.soilCal)
  const calibrate = useLab((s) => s.calibrate)
  const hasSoil = useLab((s) => s.circuit.components.some((x) => x.type === 'soil'))
  const hasPir = useLab((s) => s.circuit.components.some((x) => x.type === 'pir'))
  const fanBoard = useLab((s) => s.simView.actuators.fanSpeed)

  return (
    <div className="space-y-3">
      <Section title="ค่าจริงในห้อง (แบบจำลองสภาพแวดล้อม)">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-orange-500/15 p-2">
            🌡️ <b className="font-mono">{env.tempC.toFixed(1)}</b> °C
          </div>
          <div className="rounded-xl bg-sky-500/15 p-2">
            💧 <b className="font-mono">{env.rh.toFixed(0)}</b> %RH
          </div>
          <div className="rounded-xl bg-yellow-500/15 p-2">
            ☀️ <b className="font-mono">{Math.round(env.lux)}</b> lux
          </div>
          <div className="rounded-xl bg-emerald-500/15 p-2">
            🪴 <b className="font-mono">{env.soil.toFixed(0)}</b> %
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">นี่คือค่า "จริง" ที่ใช้คำนวณ ส่วนเซนเซอร์จะอ่านได้ค่าใกล้เคียงแต่มีความคลาดเคลื่อนและหน่วงเวลา{r.temp != null && ` (เซนเซอร์อ่านได้ ${r.temp.toFixed(1)} °C)`}</p>
      </Section>
      <Section title="ความร้อน">
        <Row label={`🔥 ฮีตเตอร์: ${c.heater}%`}>
          <input type="range" min={0} max={100} step={5} value={c.heater} onChange={(e) => setControls({ heater: Number(e.target.value) })} className="h-8 w-full accent-orange-400" aria-label="กำลังฮีตเตอร์" />
        </Row>
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant={c.fanManual ? 'primary' : 'soft'} onClick={() => setControls({ fanManual: !c.fanManual })}>
            🌀 พัดลมตั้งโต๊ะ: {c.fanManual ? 'เปิด' : 'ปิด'}
          </Btn>
          {fanBoard > 0 && <span className="text-xs text-emerald-300">พัดลม DC ที่บอร์ดสั่งกำลังหมุน</span>}
        </div>
      </Section>
      <Section title="แสง">
        <Row label={`💡 โคมไฟตั้งโต๊ะ (หรี่ได้): ${c.lamp}%`}>
          <input type="range" min={0} max={100} step={5} value={c.lamp} onChange={(e) => setControls({ lamp: Number(e.target.value) })} className="h-8 w-full accent-yellow-300" aria-label="ความสว่างโคมไฟ" />
        </Row>
        <Btn variant={c.curtainOpen ? 'soft' : 'primary'} onClick={() => setControls({ curtainOpen: !c.curtainOpen })}>
          🪟 {c.curtainOpen ? 'ปิดม่าน' : 'เปิดม่าน'}
        </Btn>
      </Section>
      <Section title="ดินและการเคลื่อนไหว">
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={water}>
            🚿 รดน้ำต้นไม้
          </Btn>
          <Btn variant="primary" onClick={walk}>
            🚶 เดินผ่านเซนเซอร์
          </Btn>
        </div>
        {hasSoil && (
          <div className="mt-3 rounded-xl bg-ink-800/60 p-2 text-sm">
            <p className="mb-1 font-semibold">Calibrate เซนเซอร์ความชื้นในดิน</p>
            <p className="mb-2 text-xs text-slate-300">
              ดินแห้ง = ค่า ADC สูง ดินเปียก = ค่าต่ำ · ตอนนี้: แห้ง {cal.dry} / เปียก {cal.wet} · อ่านได้ {r.soilAdc ?? '--'} ({r.soil ?? '--'}%)
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => calibrate('dry')}>บันทึกเป็นค่า "แห้ง"</Btn>
              <Btn onClick={() => calibrate('wet')}>บันทึกเป็นค่า "เปียก"</Btn>
              <Btn variant="ghost" onClick={() => calibrate('reset')}>
                ค่าเริ่มต้น
              </Btn>
            </div>
          </div>
        )}
        {hasPir && (
          <Row label={`PIR hold time: ${pirHold} วินาที (สัญญาณค้าง HIGH หลังพบการเคลื่อนไหว)`}>
            <input type="range" min={1} max={10} step={1} value={pirHold} onChange={(e) => setPirHold(Number(e.target.value))} className="h-8 w-full accent-violet-400" aria-label="PIR hold time" />
          </Row>
        )}
      </Section>
      <Section title="สัญญาณรบกวน (Noise)">
        <label className="flex min-h-11 items-center justify-between gap-2 text-sm">
          <span>ใส่ Gaussian noise ให้ค่าเซนเซอร์ (ของจริงมีเสมอ)</span>
          <input type="checkbox" className="h-6 w-6 accent-cyan-400" checked={noise} onChange={(e) => setNoise(e.target.checked)} />
        </label>
      </Section>
      <DataPath />
    </div>
  )
}
