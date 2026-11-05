import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { downloadText, toCsv } from '../../engine/csv'
import { fmtClock, type LogRow } from '../../engine/firmware'
import { sim, useLab } from '../../store/lab'
import { Btn, Section } from '../common'

function Serial() {
  const len = useLab((s) => s.simView.serialLen)
  const box = useRef<HTMLDivElement>(null)
  const [follow, setFollow] = useState(true)
  const lines = useMemo(() => sim.serial.slice(-120), [len])
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [lines, follow])
  return (
    <Section
      title="Serial Monitor (115200 baud)"
      right={
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-cyan-400" /> เลื่อนตาม
        </label>
      }
    >
      <div ref={box} className="h-48 overflow-y-auto scroll-thin rounded-xl bg-black/70 p-2 font-mono text-[11px] leading-relaxed text-emerald-300" aria-live="off">
        {lines.length === 0 && <p className="text-slate-500">ยังไม่มีข้อมูล — เสียบ USB และกด ⚡ Power ON</p>}
        {lines.map((l, i) => (
          <div key={i} className={l.includes('!!') ? 'text-rose-400' : l.includes('NaN') ? 'text-amber-300' : ''}>
            {l}
          </div>
        ))}
      </div>
    </Section>
  )
}

type Key = 'temp' | 'humidity' | 'light' | 'soilAdc' | 'motion'
const SERIES: Array<{ k: Key; th: string; color: string; unit: string }> = [
  { k: 'temp', th: 'อุณหภูมิ', color: '#fb923c', unit: '°C' },
  { k: 'humidity', th: 'ความชื้นอากาศ', color: '#38bdf8', unit: '%RH' },
  { k: 'light', th: 'แสง (ADC)', color: '#fde047', unit: '' },
  { k: 'soilAdc', th: 'ความชื้นในดิน (ADC)', color: '#4ade80', unit: '' },
  { k: 'motion', th: 'PIR', color: '#c084fc', unit: '' },
]

function Charts() {
  const len = useLab((s) => s.simView.logLen)
  const [win, setWin] = useState(60)
  const data = useMemo(() => {
    const now = sim.env.time
    return sim.log.filter((r) => r.t >= now - win)
  }, [len, win])
  const has = (k: Key) => data.some((d) => d[k] != null)
  const shown = SERIES.filter((s) => has(s.k))
  return (
    <Section
      title="กราฟ Real-time"
      right={
        <div className="flex gap-1">
          {[30, 60, 300].map((w) => (
            <button key={w} onClick={() => setWin(w)} className={`min-h-9 rounded-lg px-2 text-xs ${win === w ? 'bg-cyan-500 text-on-accent' : 'bg-white/10'}`}>
              {w === 300 ? '5 นาที' : w === 60 ? '1 นาที' : '30 วิ'}
            </button>
          ))}
        </div>
      }
    >
      {!shown.length && <p className="text-sm text-slate-300">ยังไม่มีค่าเซนเซอร์ให้แสดง ต่อเซนเซอร์และจ่ายไฟก่อน</p>}
      <div className="space-y-2">
        {shown.map((s) => (
          <div key={s.k}>
            <p className="text-xs" style={{ color: s.color }}>
              {s.th} {s.unit && `(${s.unit})`}
            </p>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="t" tickFormatter={(t: number) => fmtClock(t)} tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={30} />
                  <YAxis domain={s.k === 'motion' ? [0, 1] : ['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 10 }} width={46} />
                  <Tooltip contentStyle={{ background: 'var(--color-ink-900)', color: 'var(--color-slate-100)', border: '1px solid #22d3ee55', fontSize: 12 }} labelFormatter={(t) => fmtClock(Number(t))} />
                  <Line type={s.k === 'motion' ? 'stepAfter' : 'monotone'} dataKey={s.k} stroke={s.color} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-400">เส้นที่ขาดหายคือช่วงที่อ่านค่าไม่ได้ (NaN) เช่น ยังไม่จ่ายไฟหรือวงจรผิด</p>
    </Section>
  )
}

const CSV_HEAD = ['เวลา (s)', 'อุณหภูมิ (°C)', 'ความชื้น (%RH)', 'แสง (ADC)', 'ดิน (ADC)', 'ดิน (%)', 'PIR', 'อุณหภูมิจริง (°C)', 'แสงจริง (lux)', 'ดินจริง (%)']
const row = (r: LogRow) => [r.t, r.temp, r.humidity, r.light, r.soilAdc, r.soilPct, r.motion, r.envTemp, r.envLux, r.envSoil]

function DataLog() {
  const len = useLab((s) => s.simView.logLen)
  const rows = useMemo(() => sim.log.slice(-12).reverse(), [len])
  return (
    <Section
      title="ตารางบันทึกข้อมูล (Data Log)"
      right={
        <Btn variant="primary" onClick={() => downloadText(`aiot-lab-log-${Date.now()}.csv`, toCsv(CSV_HEAD, sim.log.map(row)))} disabled={!len}>
          ⬇ CSV
        </Btn>
      }
    >
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[480px] text-left font-mono text-[11px]">
          <thead className="text-cyan-200">
            <tr>
              {['เวลา', 'Temp', 'RH', 'Light', 'Soil', 'PIR', 'จริง °C', 'จริง lux'].map((h) => (
                <th key={h} className="px-1 py-1 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.t} className="border-t border-white/5">
                <td className="px-1">{fmtClock(r.t)}</td>
                <td className="px-1">{r.temp ?? '–'}</td>
                <td className="px-1">{r.humidity ?? '–'}</td>
                <td className="px-1">{r.light ?? '–'}</td>
                <td className="px-1">{r.soilAdc ?? '–'}</td>
                <td className="px-1">{r.motion ?? '–'}</td>
                <td className="px-1 text-slate-400">{r.envTemp.toFixed(1)}</td>
                <td className="px-1 text-slate-400">{r.envLux}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-400">บันทึกทุก 1 วินาที (เวลาจำลอง) เก็บล่าสุดได้ 30 นาที ไฟล์ CSV เปิดด้วย Excel/Google Sheets ได้</p>
    </Section>
  )
}

function MeterReadout() {
  const measure = useLab((s) => s.measure)
  const setMode = useLab((s) => s.setMode)
  return (
    <Section title="📟 มัลติมิเตอร์ (วัดแรงดันเทียบกับ GND)">
      <p className="mb-2 font-mono text-2xl text-amber-300">{measure ? (measure.volts == null ? 'ลอย / ไม่ทราบค่า' : `${measure.volts.toFixed(2)} V`) : '— V'}</p>
      <Btn onClick={() => setMode('measure')}>เริ่มวัด (แตะจุดในวงจร)</Btn>
    </Section>
  )
}

export function MonitorPanel() {
  return (
    <div className="space-y-3">
      <Serial />
      <Charts />
      <DataLog />
      <MeterReadout />
    </div>
  )
}
