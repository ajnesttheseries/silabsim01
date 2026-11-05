import { lazy, Suspense, useEffect, useState } from 'react'
import { TWIN_STAGES } from '../../content'
import { useLab } from '../../store/lab'
import { Btn, ByteBot, fmtDuration, Modal, Pill, ThemeToggle } from '../../ui/common'
import { LabSheet } from '../../ui/LabSheet'
import { TWIN_MISSIONS } from '../engine/missions'
import { DEVICES, SENSORS, SLOT_TH, type SlotId } from '../engine/robot'
import { TWIN_CAMERAS } from '../scene/layout'
import { useTwinSim } from '../sim'
import { useTwin, type TwinCamera, type TwinTab } from '../store'
import { TwinGuideCard, TwinGuideSync, useTwinGuideView } from './guide'
import { TwinCalibPanel, TwinDataPanel, TwinMissionPanel, TwinMonitorPanel, TwinSensorsPanel } from './panels'

const TwinScene = lazy(() => import('../scene/TwinScene'))

const TABS: Array<{ id: TwinTab; th: string; icon: string }> = [
  { id: 'mission', th: 'ภารกิจ', icon: '🎯' },
  { id: 'sensors', th: 'เซนเซอร์', icon: '📍' },
  { id: 'data', th: 'ข้อมูล', icon: '📶' },
  { id: 'calib', th: 'ปรับเทียบ', icon: '🔧' },
  { id: 'monitor', th: 'เฝ้าระวัง', icon: '🛡️' },
]

function useIsDesktop() {
  const q = '(min-width: 1024px)'
  const [d, setD] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setD(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return d
}

function TopBar() {
  const completed = useTwin((s) => s.progress.completed)
  const current = useTwin((s) => s.progress.current)
  const startedAt = useTwin((s) => s.progress.startedAt)
  const finishedAt = useTwin((s) => s.progress.finishedAt)
  const save = useTwin((s) => s.saveResult)
  const soundOn = useLab((s) => s.soundOn)
  const setSound = useLab((s) => s.setSound)
  const setRoute = useLab((s) => s.setRoute)
  const presenter = useLab((s) => s.presenter)
  const setPresenter = useLab((s) => s.setPresenter)
  const quality = useLab((s) => s.quality)
  const setQuality = useLab((s) => s.setQuality)
  const [now, setNow] = useState(Date.now())
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const pct = Math.round((completed.length / TWIN_MISSIONS.length) * 100)
  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-ink-950/95 px-2 sm:px-3">
      <button className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-left" onClick={() => setRoute('landing')} aria-label="กลับหน้าแรก">
        <span className="text-xl">🏠</span>
        <span className="hidden text-sm font-bold leading-tight text-teal-100 md:block">
          Digital Twin Lab
          <span className="block text-[11px] font-medium text-teal-300">ด่าน 1 · ภารกิจ {current}</span>
        </span>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-2.5 min-w-16 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้าภารกิจ">
          <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs text-slate-300">
          {completed.length}/{TWIN_MISSIONS.length}
        </span>
        <span className="font-mono text-sm tabular-nums text-teal-100">⏱ {fmtDuration(startedAt ? ((finishedAt ?? now) - startedAt) / 1000 : 0)}</span>
      </div>
      <Btn variant="ghost" onClick={() => setSound(!soundOn)} aria-label={soundOn ? 'ปิดเสียง' : 'เปิดเสียง'}>
        {soundOn ? '🔊' : '🔇'}
      </Btn>
      <Btn variant="ghost" onClick={() => setMenu(true)} aria-label="เมนูตั้งค่า">
        ⚙️
      </Btn>
      <Modal open={menu} onClose={() => setMenu(false)} title="ตั้งค่าและเมนู">
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 font-semibold">ธีมหน้าจอ (ฉาก 3D มืดเสมอ)</p>
            <ThemeToggle withLabel />
          </div>
          <div>
            <p className="mb-2 font-semibold">คุณภาพกราฟิก</p>
            <div className="flex flex-wrap gap-2">
              {(['auto', 'low', 'mid', 'high'] as const).map((q) => (
                <Btn key={q} variant={quality === q ? 'primary' : 'soft'} onClick={() => setQuality(q)}>
                  {{ auto: 'อัตโนมัติ', low: 'ต่ำ', mid: 'กลาง', high: 'สูง' }[q]}
                </Btn>
              ))}
            </div>
          </div>
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>โหมดนำเสนอ (ตัวอักษรใหญ่ + QR Code)</span>
            <input type="checkbox" className="h-6 w-6 accent-teal-400" checked={presenter} onChange={(e) => setPresenter(e.target.checked)} />
          </label>
          <p className="text-xs text-slate-400">เวลาในแล็บนี้ถูกเร่งให้เร็วขึ้น เพื่อให้เห็นการเปลี่ยนแปลงของอุณหภูมิและแบตเตอรี่ภายในไม่กี่วินาที</p>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={() => void save()}>
              💾 บันทึกผล
            </Btn>
            <Btn onClick={() => setRoute('landing')}>🏠 หน้าแรก</Btn>
          </div>
        </div>
      </Modal>
    </header>
  )
}

function SceneStage() {
  const [ready, setReady] = useState(false)
  return (
    <>
      <Suspense fallback={null}>
        <TwinScene onReady={() => setTimeout(() => setReady(true), 300)} />
      </Suspense>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-950">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
            <p className="text-sm text-teal-100">กำลังเปิดห้องแฝดดิจิทัล…</p>
          </div>
        </div>
      )}
    </>
  )
}

const SLOTS: SlotId[] = ['head', 'shoulderR', 'hip', 'kneeR', 'battery']

function InfoCard() {
  const sel = useTwin((s) => s.selection)
  const select = useTwin((s) => s.select)
  const mounts = useTwin((s) => s.mounts)
  const pick = useTwin((s) => s.pick)
  const setTab = useTwin((s) => s.setTab)
  if (!sel) return null
  if (sel.kind === 'sensor') {
    const sp = SENSORS[sel.id]
    return (
      <div className="glass anim-pop pointer-events-auto w-[min(92vw,360px)] rounded-2xl p-3">
        <p className="font-bold">{sp.nameTh}</p>
        <p className="mb-1 text-xs text-teal-300">{sp.nameEn}</p>
        <p className="text-sm text-slate-200">
          <b>วัด:</b> {sp.measures}
        </p>
        <p className="mt-1 text-sm text-amber-200">✋ ถืออยู่ แตะจุดสีเหลืองบนตัวหุ่นเพื่อติด</p>
        <Btn variant="ghost" className="mt-2" onClick={() => pick(null)}>
          วางคืนถาด
        </Btn>
      </div>
    )
  }
  const d = DEVICES[sel.id]
  const slot = SLOTS.includes(sel.id as SlotId) ? (sel.id as SlotId) : null
  const there = slot ? (Object.keys(mounts) as Array<keyof typeof mounts>).find((k) => mounts[k] === slot) : undefined
  return (
    <div className="glass anim-pop pointer-events-auto max-h-[60vh] w-[min(92vw,360px)] overflow-y-auto scroll-thin rounded-2xl p-3">
      <div className="float-right">
        <button className="h-9 w-9 rounded-lg text-slate-300 hover:bg-white/10" onClick={() => select(null)} aria-label="ปิดการ์ด">
          ✕
        </button>
      </div>
      <p className="text-base font-bold text-white">{d.nameTh}</p>
      <p className="mb-2 text-xs text-teal-300">{d.nameEn}</p>
      <p className="mb-1 text-sm text-slate-200">
        <b className="text-teal-200">หน้าที่:</b> {d.func}
      </p>
      <p className="mb-2 text-sm text-amber-200">
        <b>⚠️ ข้อควรระวัง:</b> {d.caution}
      </p>
      {slot && <p className="text-xs text-slate-300">จุดติดเซนเซอร์: {SLOT_TH[slot]} · {there ? `มี${SENSORS[there].nameTh}ติดอยู่` : 'ยังว่าง'}</p>}
      {sel.id === 'gateway' && <Btn className="mt-2" onClick={() => setTab('data')}>📶 ดูช่องสัญญาณ</Btn>}
      {sel.id === 'dashboard' && <Btn className="mt-2" onClick={() => setTab('monitor')}>🛡️ เปิดแผงเฝ้าระวัง</Btn>}
    </div>
  )
}

function Overlay() {
  const camera = useTwin((s) => s.camera.preset)
  const setCamera = useTwin((s) => s.setCamera)
  const picked = useTwin((s) => s.picked)
  const pick = useTwin((s) => s.pick)
  const hold = useTwin((s) => s.hold)
  const setHold = useTwin((s) => s.setHold)
  const stopped = useTwin((s) => s.live.stopped)
  const alerts = useTwin((s) => s.live.alerts)
  const resetRobot = useTwin((s) => s.resetRobot)
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2">
      <div className="flex flex-col items-start gap-2">
        <div className="pointer-events-auto flex gap-1 overflow-x-auto scroll-thin">
          {(Object.keys(TWIN_CAMERAS) as TwinCamera[]).map((k) => (
            <button
              key={k}
              onClick={() => setCamera(k)}
              className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold ${camera === k ? 'bg-teal-500 text-on-accent' : 'border border-white/10 bg-ink-900/80 text-teal-100'}`}
            >
              🎥 {TWIN_CAMERAS[k].th}
            </button>
          ))}
        </div>
        <InfoCard />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="hidden lg:block">
          <TwinGuideCard />
        </div>
        {alerts.length > 0 && (
          <div className="anim-pop rounded-2xl bg-rose-600/90 px-4 py-2 text-sm font-bold text-white">
            ⚠️ แฝดเตือน: {alerts.map((a) => ({ temp: 'มอเตอร์ร้อน', vib: 'ลูกปืนสั่น', soc: 'แบตใกล้หมด' })[a]).join(' · ')}
            {stopped && ' → หยุดหุ่นแล้ว'}
          </div>
        )}
        {picked && (
          <div className="glass pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-2 text-sm">
            <span>✋ {SENSORS[picked].nameTh} → แตะจุดสีเหลืองบนตัวหุ่น</span>
            <Btn variant="ghost" onClick={() => pick(null)}>
              ยกเลิก
            </Btn>
          </div>
        )}
        <div className="pointer-events-auto glass flex items-center gap-0.5 rounded-2xl p-0.5 sm:gap-1 sm:p-1">
          <Btn variant={hold ? 'success' : 'ghost'} onClick={() => setHold(!hold)} className="px-2 sm:px-3" aria-pressed={hold}>
            🧍<span className="hidden sm:inline"> {hold ? 'ยืนท่าเตรียม' : 'ท่าเตรียม'}</span>
          </Btn>
          <Btn variant="ghost" onClick={resetRobot} className="px-2 sm:px-3" aria-label="รีเซ็ตหุ่น">
            ↺<span className="hidden sm:inline"> รีเซ็ตหุ่น</span>
          </Btn>
        </div>
      </div>
    </div>
  )
}

function Panel({ desktop }: { desktop: boolean }) {
  const tab = useTwin((s) => s.panelTab)
  const setTab = useTwin((s) => s.setTab)
  const sheet = useTwin((s) => s.sheet)
  const setSheet = useTwin((s) => s.setSheet)
  const guided = useTwin((s) => s.guided)
  const g = useTwinGuideView((s) => s.g)
  const hiddenLabel = guided && g ? (g.current ? `🧭 ขั้น ${g.index + 1}/${g.total}` : '🧭 ครบทุกขั้นแล้ว') : undefined
  return (
    <LabSheet
      desktop={desktop}
      sheet={sheet}
      setSheet={setSheet}
      tabs={TABS}
      tab={tab}
      setTab={setTab}
      accent="teal"
      width="w-[440px]"
      hiddenLabel={hiddenLabel}
      guide={<TwinGuideCard docked />}
      guideCompact={<TwinGuideCard docked compact onExpand={() => setSheet('half')} />}
      body={
        <>
          {tab === 'mission' && <TwinMissionPanel />}
          {tab === 'sensors' && <TwinSensorsPanel />}
          {tab === 'data' && <TwinDataPanel />}
          {tab === 'calib' && <TwinCalibPanel />}
          {tab === 'monitor' && <TwinMonitorPanel />}
        </>
      }
    />
  )
}

function Intro() {
  const seen = useTwin((s) => s.progress.tutorial.seenIntro)
  const current = useTwin((s) => s.progress.current)
  const flag = useTwin((s) => s.tutorialFlag)
  const nickname = useLab((s) => s.profile.nickname)
  const [step, setStep] = useState(0)
  const open = !seen && current === 0
  // closing the intro passes mission 0; go straight on to mission 1
  const close = () => {
    flag('seenIntro')
    const p = useTwin.getState().progress
    if (p.current === 0 && p.completed.includes(0)) useTwin.getState().goMission(1)
  }
  const pages = [
    <div key="0" className="text-center">
      <div className="mb-2 flex justify-center">
        <ByteBot size={90} />
      </div>
      <p className="mb-2 text-lg font-bold text-white">สวัสดี{nickname ? ` ${nickname}` : ''}! มารู้จัก NOVA-1 กัน</p>
      <p className="text-sm text-slate-300">
        NOVA-1 คือหุ่นยนต์ผู้ช่วยที่เต้นและเล่นกับเด็ก ๆ ในห้องเด็กเล่นของโรงพยาบาล วันนี้น้องจะเป็น <b className="text-teal-200">วิศวกรดิจิทัลทวิน</b> (Digital Twin Engineer) สร้าง "ร่างแฝด" ของ NOVA-1 บนโต๊ะโฮโลแกรม ที่ขยับและเปลี่ยนสีตามข้อมูลจริง เพื่อดูแลไม่ให้หุ่นพังกลางโชว์
      </p>
    </div>,
    <div key="1" className="space-y-2">
      <p className="text-sm text-slate-300">สายดิจิทัลทวินมี 3 ด่าน วันนี้เริ่มที่ด่านที่ 1</p>
      {TWIN_STAGES.map((s) => (
        <div key={s.id} className={`rounded-xl border p-3 ${s.open ? 'border-teal-400 bg-teal-500/10' : 'border-white/10 opacity-70'}`}>
          <div className="flex items-center justify-between">
            <b>
              ด่านที่ {s.id}: {s.th}
            </b>
            {s.open ? <Pill className="bg-emerald-500/25">เปิด</Pill> : <Pill className="bg-slate-600/40">🔒 เร็ว ๆ นี้</Pill>}
          </div>
          <p className="text-xs text-teal-300">{s.en}</p>
          <p className="text-xs text-slate-300">{s.desc}</p>
        </div>
      ))}
    </div>,
    <div key="2" className="space-y-2 text-sm">
      <p className="font-bold text-white">วิธีใช้แล็บ</p>
      <p>🖱️ / 👆 ลากเพื่อหมุนกล้อง · ล้อเมาส์หรือสองนิ้วเพื่อซูม · ปุ่ม 🎥 เปลี่ยนมุม</p>
      <p>👆 แตะชิ้นส่วนของหุ่นหรืออุปกรณ์เพื่อดูการ์ดข้อมูล</p>
      <p>✋ แตะกล่องเซนเซอร์บนถาดเพื่อหยิบ แล้วแตะจุดสีเหลืองบนตัวหุ่นเพื่อติด</p>
      <p>🧍 "ท่าเตรียม" ให้หุ่นหยุดเต้นและยืนแขนลง · ↺ "รีเซ็ตหุ่น" เริ่มใหม่</p>
      <p className="rounded-xl bg-teal-500/15 p-2">🧭 <b>โหมดพาทำเปิดอยู่:</b> น้องไบต์จะบอกทีละขั้นพร้อมลูกศรสีเหลืองชี้จุดที่ต้องแตะ ถ้าอยากลองเองกด "💪 ทำเอง" ได้ทุกเมื่อ</p>
      <p className="text-xs text-slate-400">ทุกอย่างเป็นแบบจำลองอย่างง่ายเพื่อการเรียนรู้ และเร่งเวลาให้เร็วขึ้น ทำผิดได้ไม่มีอะไรพังจริง</p>
    </div>,
  ]
  return (
    <Modal open={open} onClose={close} title={['ยินดีต้อนรับสู่ Digital Twin Lab', 'แผนที่ด่าน', 'สอนใช้งาน'][step]}>
      {pages[step]}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {step + 1}/{pages.length}
        </span>
        <div className="flex gap-2">
          {step > 0 && <Btn onClick={() => setStep(step - 1)}>ย้อนกลับ</Btn>}
          {step < pages.length - 1 ? (
            <Btn variant="primary" onClick={() => setStep(step + 1)}>
              ถัดไป →
            </Btn>
          ) : (
            <Btn variant="primary" onClick={close}>
              เริ่มเลย! 🤖
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function TwinLabPage() {
  const desktop = useIsDesktop()
  useTwinSim(true)
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className={`relative flex min-h-0 flex-1 ${desktop ? 'flex-row' : 'flex-col'}`}>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <SceneStage />
          <Overlay />
        </div>
        <Panel desktop={desktop} />
      </div>
      <Intro />
      <TwinGuideSync />
    </div>
  )
}
