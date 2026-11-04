import { useState } from 'react'
import { CAREERS, PROGRAM, STAGES } from '../content'
import { MISSIONS } from '../engine/missions'
import { useLab } from '../store/lab'
import { Btn, ByteBot, Pill } from './common'

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function Landing() {
  const profile = useLab((s) => s.profile)
  const progress = useLab((s) => s.progress)
  const setProfile = useLab((s) => s.setProfile)
  const startLab = useLab((s) => s.startLab)
  const restartAll = useLab((s) => s.restartAll)
  const ask = useLab((s) => s.ask)
  const presenter = useLab((s) => s.presenter)
  const setPresenter = useLab((s) => s.setPresenter)
  const setRoute = useLab((s) => s.setRoute)
  const [nick, setNick] = useState(profile.nickname)
  const [school, setSchool] = useState(profile.school)
  const webgl = hasWebGL()
  const started = progress.startedAt !== null
  const done = progress.completed.length

  const go = () => {
    setProfile({ nickname: nick.trim().slice(0, 30), school: school.trim().slice(0, 60) })
    startLab()
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:pt-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.25),transparent_65%)]" />
        <header className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ByteBot size={52} />
            <div>
              <p className="text-xs font-semibold tracking-wide text-cyan-300">{PROGRAM.nameEn}</p>
              <p className="text-sm text-slate-300">{PROGRAM.nameTh} · {PROGRAM.faculty}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => setPresenter(!presenter)} aria-pressed={presenter}>
              📽️ {presenter ? 'ปิดโหมดนำเสนอ' : 'โหมดนำเสนอ'}
            </Btn>
            <Btn variant="ghost" onClick={() => setRoute('staff')}>
              👩‍🏫 ผู้สอน/สตาฟ
            </Btn>
          </div>
        </header>

        <section className="relative mb-8 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <Pill className="mb-3 bg-cyan-400/15 text-cyan-200">ด่านที่ 1 · ฮาร์ดแวร์และเซนเซอร์ (Hardware &amp; Sensors)</Pill>
            <h1 className="neon-text mb-3 text-3xl font-extrabold leading-tight text-white sm:text-5xl">Virtual AIoT Lab</h1>
            <p className="mb-2 text-lg font-semibold text-cyan-100 sm:text-xl">ห้องปฏิบัติการวิศวกรรม AIoT และสมองกลฝังตัวเสมือนจริง</p>
            <p className="mb-5 text-slate-300">
              ลองเป็น <b className="text-cyan-200">วิศวกรระบบ AIoT และสมองกลฝังตัว</b> (AIoT &amp; Embedded Control Systems Engineer) ด้วยตัวเอง: เลือกอุปกรณ์ ต่อวงจรบนเบรดบอร์ด ติดตั้งเซนเซอร์ อ่านค่าจากสภาพแวดล้อม แล้วสั่งให้ระบบ "คิดและทำงานเอง" ใช้เวลาประมาณ 15–20 นาที ไม่ต้องมีพื้นฐานมาก่อน
            </p>
            <div className="glass rounded-2xl p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-cyan-100">ชื่อเล่น (ไม่บังคับ)</span>
                  <input
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    maxLength={30}
                    placeholder="เช่น น้องฟ้า"
                    className="min-h-11 w-full rounded-xl border border-white/15 bg-ink-950/80 px-3 text-white outline-none focus:border-cyan-400"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-cyan-100">โรงเรียน (ไม่บังคับ)</span>
                  <input
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    maxLength={60}
                    placeholder="ชื่อโรงเรียน"
                    className="min-h-11 w-full rounded-xl border border-white/15 bg-ink-950/80 px-3 text-white outline-none focus:border-cyan-400"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-400">เราเก็บแค่ชื่อเล่นและชื่อโรงเรียน เพื่อแสดงบนใบประกาศและสถิติของกิจกรรมเท่านั้น</p>
              {!webgl && (
                <p className="mt-3 rounded-xl bg-rose-950/80 p-3 text-sm text-rose-200">
                  ⚠️ เบราว์เซอร์นี้ไม่รองรับ WebGL จึงแสดงฉาก 3 มิติไม่ได้ ลองเปิดด้วย Chrome, Edge หรือ Safari รุ่นล่าสุด และเปิด "การเร่งด้วยฮาร์ดแวร์" ในการตั้งค่าเบราว์เซอร์
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn variant="primary" className="px-6 text-base" onClick={go} disabled={!webgl}>
                  {started ? `▶ เล่นต่อ (ผ่านแล้ว ${done}/${MISSIONS.length})` : '🚪 เปิดประตูแล็บ'}
                </Btn>
                {started && (
                  <Btn variant="ghost" onClick={() => ask('เริ่มใหม่ทั้งหมด? ความคืบหน้าและวงจรในเครื่องนี้จะถูกล้าง', restartAll)}>
                    เริ่มใหม่ทั้งหมด
                  </Btn>
                )}
              </div>
            </div>
          </div>
          <div className="glass relative overflow-hidden rounded-3xl p-5">
            <p className="mb-3 text-sm font-bold text-cyan-200">ใส่สมองอัจฉริยะให้อุปกรณ์</p>
            <svg viewBox="0 0 240 170" className="w-full" aria-label="แอนิเมชันใส่ชิปสมองกลเข้าไปในอุปกรณ์">
              <rect x="40" y="60" width="160" height="90" rx="16" fill="#0f1f47" stroke="#38bdf8" strokeWidth="2" />
              <circle cx="75" cy="105" r="16" fill="#1e293b" stroke="#64748b" />
              <circle cx="165" cy="105" r="10" fill="#22c55e" className="anim-glow" />
              <rect x="105" y="85" width="40" height="40" rx="6" fill="none" stroke="#22d3ee" strokeDasharray="4 4" />
              <g className="anim-chip">
                <rect x="108" y="88" width="34" height="34" rx="5" fill="#0b1226" stroke="#22d3ee" strokeWidth="2.5" />
                {[0, 1, 2, 3].map((i) => (
                  <g key={i} stroke="#22d3ee" strokeWidth="2">
                    <line x1={113 + i * 8} y1="88" x2={113 + i * 8} y2="82" />
                    <line x1={113 + i * 8} y1="122" x2={113 + i * 8} y2="128" />
                  </g>
                ))}
                <text x="125" y="110" textAnchor="middle" fontSize="10" fill="#a5f3fc" fontWeight="700">AI</text>
              </g>
              <path d="M30 40 q20 -20 40 0" stroke="#fde047" strokeWidth="2" fill="none" className="anim-glow" />
              <text x="20" y="30" fontSize="10" fill="#fde047">แสง</text>
              <text x="190" y="40" fontSize="10" fill="#fb923c">อุณหภูมิ</text>
              <path d="M200 46 v10" stroke="#fb923c" strokeWidth="2" />
            </svg>
            <p className="text-xs text-slate-300">เซนเซอร์ = ตาและหู · บอร์ด = สมอง · LED/พัดลม = มือที่ลงมือทำ</p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-cyan-100">แผนที่ภารกิจสาย AIoT</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {STAGES.map((s) => (
              <div key={s.id} className={`rounded-2xl border p-4 ${s.open ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 bg-ink-900/60 opacity-75'}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-cyan-200">ด่านที่ {s.id}</span>
                  {s.open ? <Pill className="bg-emerald-400/20 text-emerald-200">เปิดแล้ว</Pill> : <Pill className="bg-slate-500/30 text-slate-200">🔒 เร็ว ๆ นี้</Pill>}
                </div>
                <p className="font-semibold text-white">{s.th}</p>
                <p className="mb-1 text-xs text-cyan-300">{s.en}</p>
                <p className="text-sm text-slate-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-cyan-100">5 สายอาชีพของหลักสูตร {PROGRAM.short}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAREERS.map((c) => (
              <div key={c.id} className={`rounded-2xl border p-4 ${c.thisLab ? 'border-cyan-400/70 bg-cyan-400/10' : 'border-white/10 bg-ink-900/60'}`}>
                <div className="mb-1 text-2xl">{c.icon}</div>
                <p className="font-semibold text-white">{c.th}</p>
                <p className="mb-1 text-xs text-cyan-300">{c.en}</p>
                <p className="text-sm text-slate-300">{c.desc}</p>
                {c.thisLab && <Pill className="mt-2 bg-cyan-400/25 text-cyan-100">← แล็บนี้</Pill>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-ink-900/60 p-4">
          <h2 className="mb-2 text-lg font-bold text-cyan-100">หลักสูตรนี้เหมาะกับใคร</h2>
          <ul className="grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
            {PROGRAM.fit.map((f) => (
              <li key={f}>✔️ {f}</li>
            ))}
          </ul>
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">แล็บนี้ใช้แบบจำลองอย่างง่ายเพื่อการเรียนรู้ ค่าที่แสดงเป็นค่าประมาณ ไม่ใช่โปรแกรมจำลองวงจรเต็มรูปแบบ (SPICE)</p>
      </div>
    </div>
  )
}
