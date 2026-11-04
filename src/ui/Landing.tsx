import { useState } from 'react'
import { useAv } from '../av/store'
import { AV_MISSIONS } from '../av/engine/missions'
import { AV_STAGES, CAREERS, PROGRAM, STAGES } from '../content'
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

interface LabCardProps {
  icon: string
  accent: 'cyan' | 'fuchsia'
  career: string
  careerEn: string
  title: string
  desc: string
  stages: Array<{ id: number; th: string; open: boolean }>
  done: number
  total: number
  started: boolean
  disabled: boolean
  onStart: () => void
  onRestart: () => void
}

function LabCard(p: LabCardProps) {
  const ring = p.accent === 'cyan' ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-fuchsia-400/60 bg-fuchsia-400/10'
  return (
    <div className={`flex flex-col rounded-3xl border p-4 ${ring}`}>
      <div className="mb-1 text-3xl">{p.icon}</div>
      <p className={`text-xs font-semibold ${p.accent === 'cyan' ? 'text-cyan-300' : 'text-fuchsia-300'}`}>{p.careerEn}</p>
      <h2 className="text-lg font-extrabold text-white">{p.career}</h2>
      <p className="mb-1 text-sm font-semibold text-slate-100">{p.title}</p>
      <p className="mb-3 text-sm text-slate-300">{p.desc}</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {p.stages.map((s) => (
          <Pill key={s.id} className={s.open ? 'bg-emerald-500/20 text-emerald-100' : 'bg-slate-600/40 text-slate-300'}>
            {s.open ? '🔓' : '🔒'} ด่าน {s.id}: {s.th}
            {!s.open && ' (เร็ว ๆ นี้)'}
          </Pill>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Btn variant="primary" className="px-5" onClick={p.onStart} disabled={p.disabled}>
          {p.started ? `▶ เล่นต่อ (ผ่าน ${p.done}/${p.total})` : '🚪 เข้าแล็บ'}
        </Btn>
        {p.started && (
          <Btn variant="ghost" onClick={p.onRestart}>
            เริ่มใหม่
          </Btn>
        )}
      </div>
    </div>
  )
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
  const avProgress = useAv((s) => s.progress)
  const avRestart = useAv((s) => s.restartAll)
  const [nick, setNick] = useState(profile.nickname)
  const [school, setSchool] = useState(profile.school)
  const webgl = hasWebGL()

  const saveProfile = () => setProfile({ nickname: nick.trim().slice(0, 30), school: school.trim().slice(0, 60) })
  const startAv = () => {
    saveProfile()
    if (!avProgress.startedAt) useAv.setState({ progress: { ...avProgress, startedAt: Date.now() } })
    setRoute('av')
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:pt-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.22),transparent_65%)]" />
        <header className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ByteBot size={52} />
            <div>
              <p className="text-xs font-semibold tracking-wide text-cyan-300">{PROGRAM.nameEn}</p>
              <p className="text-sm text-slate-300">
                {PROGRAM.nameTh} · {PROGRAM.faculty}
              </p>
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

        <section className="relative mb-6">
          <h1 className="neon-text mb-2 text-3xl font-extrabold leading-tight text-white sm:text-5xl">Virtual SI Lab</h1>
          <p className="mb-2 text-lg font-semibold text-cyan-100 sm:text-xl">ห้องปฏิบัติการวิศวกรรมเสมือนจริง ลองเป็นวิศวกรตัวจริงใน 15–20 นาที</p>
          <p className="mb-4 max-w-3xl text-slate-300">เลือกสายอาชีพที่สนใจ แล้วลงมือทำงานแบบวิศวกรจริงในแล็บ 3 มิติ ไม่ต้องมีพื้นฐานมาก่อน มีโหมดพาทำทีละขั้นให้ตลอดทาง</p>
          <div className="glass max-w-3xl rounded-2xl p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-cyan-100">ชื่อเล่น (ไม่บังคับ)</span>
                <input value={nick} onChange={(e) => setNick(e.target.value)} onBlur={saveProfile} maxLength={30} placeholder="เช่น น้องฟ้า" className="min-h-11 w-full rounded-xl border border-white/15 bg-ink-950/80 px-3 text-white outline-none focus:border-cyan-400" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-cyan-100">โรงเรียน (ไม่บังคับ)</span>
                <input value={school} onChange={(e) => setSchool(e.target.value)} onBlur={saveProfile} maxLength={60} placeholder="ชื่อโรงเรียน" className="min-h-11 w-full rounded-xl border border-white/15 bg-ink-950/80 px-3 text-white outline-none focus:border-cyan-400" />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-400">เราเก็บแค่ชื่อเล่นและชื่อโรงเรียน เพื่อแสดงบนใบประกาศและสถิติของกิจกรรมเท่านั้น</p>
            {!webgl && <p className="mt-3 rounded-xl bg-rose-950/80 p-3 text-sm text-rose-200">⚠️ เบราว์เซอร์นี้ไม่รองรับ WebGL จึงแสดงฉาก 3 มิติไม่ได้ ลองเปิดด้วย Chrome, Edge หรือ Safari รุ่นล่าสุด</p>}
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <LabCard
            icon="🤖"
            accent="cyan"
            career="วิศวกรระบบ AIoT และสมองกลฝังตัว"
            careerEn="AIoT & Embedded Control Systems Engineer"
            title="Virtual AIoT Lab: ฮาร์ดแวร์และเซนเซอร์"
            desc="ต่อวงจรบนเบรดบอร์ด ติดเซนเซอร์ อ่านค่าจากสภาพแวดล้อม แล้วตั้งกฎให้ระบบคิดและทำงานเอง"
            stages={STAGES}
            done={progress.completed.length}
            total={MISSIONS.length}
            started={progress.startedAt !== null}
            disabled={!webgl}
            onStart={() => {
              saveProfile()
              startLab()
            }}
            onRestart={() => ask('เริ่มแล็บ AIoT ใหม่ทั้งหมด? ความคืบหน้าและวงจรในเครื่องนี้จะถูกล้าง', restartAll)}
          />
          <LabCard
            icon="🎛️"
            accent="fuchsia"
            career="วิศวกรระบบภาพ เสียง และแสงอัจฉริยะ"
            careerEn="Intelligent AV & Lighting Systems Engineer"
            title="Virtual AV & Lighting Lab: แสงและเสียงบนเวที"
            desc="ต่อระบบไฟ DMX ผสมสีแสง ต่อระบบเสียงคอนเสิร์ต ปราบเสียงหอน แล้วสร้างโชว์ที่แสง เสียง และจอ LED ทำงานพร้อมกันอัตโนมัติ"
            stages={AV_STAGES}
            done={avProgress.completed.length}
            total={AV_MISSIONS.length}
            started={avProgress.startedAt !== null}
            disabled={!webgl}
            onStart={startAv}
            onRestart={() => ask('เริ่มแล็บ AV ใหม่ทั้งหมด? ความคืบหน้าในเครื่องนี้จะถูกล้าง', avRestart)}
          />
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-cyan-100">5 สายอาชีพของหลักสูตร {PROGRAM.short}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAREERS.map((c) => (
              <div key={c.id} className={`rounded-2xl border p-4 ${c.lab ? 'border-cyan-400/50 bg-cyan-400/5' : 'border-white/10 bg-ink-900/60'}`}>
                <div className="mb-1 text-2xl">{c.icon}</div>
                <p className="font-semibold text-white">{c.th}</p>
                <p className="mb-1 text-xs text-cyan-300">{c.en}</p>
                <p className="text-sm text-slate-300">{c.desc}</p>
                {c.lab ? (
                  <Btn
                    variant="soft"
                    className="mt-2"
                    disabled={!webgl}
                    onClick={() => {
                      if (c.lab === 'av') startAv()
                      else {
                        saveProfile()
                        startLab()
                      }
                    }}
                  >
                    🚪 เข้าแล็บสายนี้
                  </Btn>
                ) : (
                  <Pill className="mt-2 bg-slate-600/40 text-slate-200">🔒 แล็บเร็ว ๆ นี้</Pill>
                )}
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
        <p className="mt-6 text-center text-xs text-slate-500">แล็บใช้แบบจำลองอย่างง่ายเพื่อการเรียนรู้ ค่าที่แสดงเป็นค่าประมาณ ไม่ใช่โปรแกรมจำลองทางวิศวกรรมเต็มรูปแบบ</p>
      </div>
    </div>
  )
}
