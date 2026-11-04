import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLab } from '../../store/lab'
import { Btn, ByteBot, fmtDuration, Modal, Pill } from '../../ui/common'
import { AV_STAGES } from '../../content'
import { AV_MISSIONS } from '../engine/missions'
import { DEVICES, PORTS } from '../engine/patch'
import { AV_CAMERAS, type AvCameraPreset } from '../scene/layout'
import { useAvSim } from '../sim'
import { avSound } from '../sound'
import { useAv, type AvTab } from '../store'
import { AvGuideCard, AvGuideSync } from './guide'
import { AvLightPanel, AvMissionPanel, AvPatchPanel, AvShowPanel, AvSoundPanel } from './panels'

const AvScene = lazy(() => import('../scene/AvScene'))

const TABS: Array<{ id: AvTab; th: string; icon: string }> = [
  { id: 'mission', th: 'ภารกิจ', icon: '🎯' },
  { id: 'patch', th: 'สายสัญญาณ', icon: '🔌' },
  { id: 'light', th: 'แสง', icon: '💡' },
  { id: 'sound', th: 'เสียง', icon: '🎚️' },
  { id: 'show', th: 'โชว์', icon: '🎬' },
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
  const completed = useAv((s) => s.progress.completed)
  const current = useAv((s) => s.progress.current)
  const startedAt = useAv((s) => s.progress.startedAt)
  const finishedAt = useAv((s) => s.progress.finishedAt)
  const soundOn = useLab((s) => s.soundOn)
  const setSound = useLab((s) => s.setSound)
  const setRoute = useLab((s) => s.setRoute)
  const presenter = useLab((s) => s.presenter)
  const setPresenter = useLab((s) => s.setPresenter)
  const quality = useLab((s) => s.quality)
  const setQuality = useLab((s) => s.setQuality)
  const save = useAv((s) => s.saveResult)
  const [now, setNow] = useState(Date.now())
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const pct = Math.round((completed.length / AV_MISSIONS.length) * 100)
  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-ink-950/95 px-2 sm:px-3">
      <button className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-left" onClick={() => setRoute('landing')} aria-label="กลับหน้าแรก">
        <span className="text-xl">🏠</span>
        <span className="hidden text-sm font-bold leading-tight text-fuchsia-100 md:block">
          AV &amp; Lighting Lab
          <span className="block text-[11px] font-medium text-fuchsia-300">ด่าน 1 · ภารกิจ {current}</span>
        </span>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-2.5 min-w-16 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้าภารกิจ">
          <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs text-slate-300">
          {completed.length}/{AV_MISSIONS.length}
        </span>
        <span className="font-mono text-sm tabular-nums text-fuchsia-100">⏱ {fmtDuration(startedAt ? ((finishedAt ?? now) - startedAt) / 1000 : 0)}</span>
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
            <input type="checkbox" className="h-6 w-6 accent-fuchsia-400" checked={presenter} onChange={(e) => setPresenter(e.target.checked)} />
          </label>
          <p className="text-xs text-slate-400">เสียงในแล็บนี้สร้างจำลองขึ้น ระดับเสียงถูกจำกัดไว้ให้ปลอดภัย กด 🔊 เพื่อปิดได้ทุกเมื่อ</p>
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
        <AvScene onReady={() => setTimeout(() => setReady(true), 300)} />
      </Suspense>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink-950">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-fuchsia-400 border-t-transparent" />
            <p className="text-sm text-fuchsia-100">กำลังเตรียมเวทีคอนเสิร์ต…</p>
          </div>
        </div>
      )}
    </>
  )
}

function DeviceCard() {
  const sel = useAv((s) => s.selection)
  const select = useAv((s) => s.select)
  const mixer = useAv((s) => s.mixer)
  const setMixer = useAv((s) => s.setMixer)
  const cables = useAv((s) => s.cables)
  const removeCable = useAv((s) => s.removeCable)
  const setTab = useAv((s) => s.setTab)
  const selectFixture = useAv((s) => s.selectFixture)
  const addresses = useAv((s) => s.addresses)
  if (!sel) return null
  if (sel.kind === 'cable') {
    const c = cables.find((x) => x.id === sel.id)
    if (!c) return null
    return (
      <div className="glass anim-pop pointer-events-auto w-[min(92vw,360px)] rounded-2xl p-3">
        <p className="mb-1 font-bold">สายสัญญาณ</p>
        <p className="mb-2 text-sm text-slate-200">
          {DEVICES[PORTS[c.from].device].nameTh} {PORTS[c.from].label} → {DEVICES[PORTS[c.to].device].nameTh} {PORTS[c.to].label}
        </p>
        <div className="flex gap-2">
          <Btn variant="danger" onClick={() => removeCable(c.id)}>
            🗑 ถอดสาย
          </Btn>
          <Btn variant="ghost" onClick={() => select(null)}>
            ปิด
          </Btn>
        </div>
      </div>
    )
  }
  const d = DEVICES[sel.id]
  const isFixture = sel.id.startsWith('par') || sel.id.startsWith('mover')
  return (
    <div className="glass anim-pop pointer-events-auto max-h-[60vh] w-[min(92vw,360px)] overflow-y-auto scroll-thin rounded-2xl p-3">
      <div className="float-right">
        <button className="h-9 w-9 rounded-lg text-slate-300 hover:bg-white/10" onClick={() => select(null)} aria-label="ปิดการ์ด">
          ✕
        </button>
      </div>
      <p className="text-base font-bold text-white">{d.nameTh}</p>
      <p className="mb-2 text-xs text-fuchsia-300">{d.nameEn}</p>
      <p className="mb-1 text-sm text-slate-200">
        <b className="text-fuchsia-200">หน้าที่:</b> {d.func}
      </p>
      <p className="mb-1 text-sm text-slate-200">
        <b className="text-fuchsia-200">ช่องต่อ:</b> {d.ports.map((p) => p.label).join(' · ')}
      </p>
      <p className="mb-3 text-sm text-amber-200">
        <b>⚠️ ข้อควรระวัง:</b> {d.caution}
      </p>
      <div className="flex flex-wrap gap-2">
        {isFixture && (
          <Btn
            variant="primary"
            onClick={() => {
              selectFixture(sel.id)
              setTab('light')
            }}
          >
            🎚️ ควบคุมไฟดวงนี้ (address {addresses[sel.id]})
          </Btn>
        )}
        {(sel.id === 'micDyn' || sel.id === 'micCond') && mixer.micOnStand !== sel.id && (
          <Btn variant="primary" onClick={() => setMixer({ micOnStand: sel.id as 'micDyn' })}>
            🎤 ให้นักร้องใช้ไมค์นี้
          </Btn>
        )}
        {(sel.id === 'spkL' || sel.id === 'spkR') && (
          <Btn variant="primary" onClick={() => setMixer({ paPos: mixer.paPos === 'front' ? 'back' : 'front' })}>
            ↪ ย้ายลำโพงหลักไป{mixer.paPos === 'front' ? 'หลังนักร้อง' : 'หน้าเวที'}
          </Btn>
        )}
        {sel.id === 'wedge' && (
          <Btn variant="primary" onClick={() => setMixer({ wedgePos: mixer.wedgePos === 'front' ? 'behind' : 'front' })}>
            ↪ ย้ายมอนิเตอร์ไป{mixer.wedgePos === 'front' ? 'หลังนักร้อง' : 'หน้านักร้อง'}
          </Btn>
        )}
        {(sel.id === 'mixer' || sel.id === 'amp') && <Btn onClick={() => setTab('sound')}>🎚️ เปิดแผงเสียง</Btn>}
        {sel.id === 'console' && <Btn onClick={() => setTab('light')}>💡 เปิดคอนโซลแสง</Btn>}
      </div>
    </div>
  )
}

function Overlay() {
  const camera = useAv((s) => s.camera.preset)
  const setCamera = useAv((s) => s.setCamera)
  const mode = useAv((s) => s.mode)
  const setMode = useAv((s) => s.setMode)
  const cableStart = useAv((s) => s.cableStart)
  const rehearsing = useAv((s) => s.live.rehearsing)
  const setRehearsing = useAv((s) => s.setRehearsing)
  const showPlaying = useAv((s) => s.live.showPlaying)
  const playShow = useAv((s) => s.playShow)
  const feedback = useAv((s) => s.live.levels.feedback)
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2">
      <div className="flex flex-col items-start gap-2">
        <div className="pointer-events-auto flex gap-1 overflow-x-auto scroll-thin">
          {(Object.keys(AV_CAMERAS) as AvCameraPreset[]).map((k) => (
            <button
              key={k}
              onClick={() => setCamera(k)}
              className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold ${camera === k ? 'bg-fuchsia-500 text-slate-950' : 'border border-white/10 bg-ink-900/80 text-fuchsia-100'}`}
            >
              🎥 {AV_CAMERAS[k].th}
            </button>
          ))}
        </div>
        <DeviceCard />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="hidden lg:block">
          <AvGuideCard />
        </div>
        {feedback && <div className="anim-pop rounded-2xl bg-rose-600/90 px-4 py-2 text-sm font-bold text-white">🔊 เสียงหอน! ลด Master/MON send หรือย้ายลำโพง</div>}
        {mode === 'cable' && (
          <div className="glass pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-2 text-sm">
            <span>{cableStart ? `ต้นสาย: ${DEVICES[PORTS[cableStart].device].nameTh} ${PORTS[cableStart].label} → แตะช่องปลายทาง` : 'แตะช่อง OUT หรือ IN ที่ต้องการ (จุดสีบนอุปกรณ์)'}</span>
            <Btn variant="ghost" onClick={() => setMode('select')}>
              เสร็จ
            </Btn>
          </div>
        )}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1">
          <div className="glass flex items-center gap-0.5 rounded-2xl p-0.5 sm:gap-1 sm:p-1">
            <Btn variant={mode === 'select' ? 'primary' : 'ghost'} onClick={() => setMode('select')} aria-label="โหมดเลือก" className="px-2 sm:px-3">
              👆<span className="hidden sm:inline"> เลือก</span>
            </Btn>
            <Btn variant={mode === 'cable' ? 'primary' : 'ghost'} onClick={() => setMode(mode === 'cable' ? 'select' : 'cable')} aria-label="โหมดเสียบสาย" className="px-2 sm:px-3">
              🔌<span className="hidden sm:inline"> เสียบสาย</span>
            </Btn>
          </div>
          <div className="glass flex items-center gap-0.5 rounded-2xl p-0.5 sm:gap-1 sm:p-1">
            <Btn
              variant={rehearsing ? 'danger' : 'ghost'}
              onClick={() => {
                avSound.unlock()
                setRehearsing(!rehearsing)
              }}
              className="px-2 sm:px-3"
            >
              🎤<span className="hidden sm:inline"> {rehearsing ? 'หยุดซ้อม' : 'ซ้อมร้อง'}</span>
            </Btn>
            <Btn
              variant={showPlaying ? 'danger' : 'ghost'}
              onClick={() => {
                avSound.unlock()
                playShow(!showPlaying)
              }}
              className="px-2 sm:px-3"
            >
              🎬<span className="hidden sm:inline"> {showPlaying ? 'หยุดโชว์' : 'เล่นโชว์'}</span>
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function Panel({ desktop }: { desktop: boolean }) {
  const tab = useAv((s) => s.panelTab)
  const setTab = useAv((s) => s.setTab)
  const sheet = useAv((s) => s.sheet)
  const setSheet = useAv((s) => s.setSheet)
  const startY = useRef<number | null>(null)
  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin p-3">
      {tab === 'mission' && <AvMissionPanel />}
      {tab === 'patch' && <AvPatchPanel />}
      {tab === 'light' && <AvLightPanel />}
      {tab === 'sound' && <AvSoundPanel />}
      {tab === 'show' && <AvShowPanel />}
    </div>
  )
  const tabs = (
    <nav className="flex shrink-0 gap-1 overflow-x-auto scroll-thin border-b border-white/10 px-2 py-1" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => {
            setTab(t.id)
            if (!desktop && sheet === 'peek') setSheet('half')
          }}
          className={`flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-semibold ${tab === t.id ? 'bg-fuchsia-500/20 text-fuchsia-100' : 'text-slate-300 hover:bg-white/5'}`}
        >
          <span aria-hidden>{t.icon}</span>
          {t.th}
        </button>
      ))}
    </nav>
  )
  if (desktop)
    return (
      <aside className="flex w-[440px] shrink-0 flex-col border-l border-white/10 bg-ink-950/95">
        {tabs}
        {body}
      </aside>
    )
  const h = sheet === 'peek' ? 'max-h-[45%]' : sheet === 'half' ? 'h-[50%]' : 'h-[82%]'
  return (
    <section className={`flex shrink-0 flex-col overflow-hidden rounded-t-3xl border-t border-fuchsia-400/30 bg-ink-950/98 transition-[height] duration-300 ${h}`}>
      <button
        aria-label="ปรับความสูงแผงควบคุม"
        className="flex h-7 shrink-0 items-center justify-center"
        onClick={() => setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'peek')}
        onPointerDown={(e) => (startY.current = e.clientY)}
        onPointerUp={(e) => {
          if (startY.current == null) return
          const dy = e.clientY - startY.current
          startY.current = null
          if (Math.abs(dy) < 25) return
          if (dy < 0) setSheet(sheet === 'peek' ? 'half' : 'full')
          else setSheet(sheet === 'full' ? 'half' : 'peek')
        }}
      >
        <span className="h-1.5 w-12 rounded-full bg-white/30" />
      </button>
      <div className="shrink-0">
        <AvGuideCard docked />
      </div>
      {tabs}
      {sheet !== 'peek' && body}
    </section>
  )
}

function Intro() {
  const seen = useAv((s) => s.progress.tutorial.seenIntro)
  const current = useAv((s) => s.progress.current)
  const flag = useAv((s) => s.tutorialFlag)
  const nickname = useLab((s) => s.profile.nickname)
  const [step, setStep] = useState(0)
  const open = !seen && current === 0
  const pages = [
    <div key="0" className="text-center">
      <div className="mb-2 flex justify-center">
        <ByteBot size={90} />
      </div>
      <p className="mb-2 text-lg font-bold text-white">สวัสดี{nickname ? ` ${nickname}` : ''}! ยินดีต้อนรับสู่เวทีคอนเสิร์ต</p>
      <p className="text-sm text-slate-300">
        วันนี้เราจะลองเป็น <b className="text-fuchsia-200">วิศวกรระบบภาพ เสียง และแสงอัจฉริยะ</b> (Intelligent AV &amp; Lighting Systems Engineer) ผู้ออกแบบให้แสง เสียง และจอภาพของคอนเสิร์ต สตูดิโอ และอาคารอัจฉริยะทำงานร่วมกันอัตโนมัติ
      </p>
    </div>,
    <div key="1" className="space-y-2">
      <p className="text-sm text-slate-300">สาย AV &amp; Lighting มี 3 ด่าน วันนี้เริ่มที่ด่านที่ 1</p>
      {AV_STAGES.map((s) => (
        <div key={s.id} className={`rounded-xl border p-3 ${s.open ? 'border-fuchsia-400 bg-fuchsia-500/10' : 'border-white/10 opacity-70'}`}>
          <div className="flex items-center justify-between">
            <b>
              ด่านที่ {s.id}: {s.th}
            </b>
            {s.open ? <Pill className="bg-emerald-500/25">เปิด</Pill> : <Pill className="bg-slate-600/40">🔒 เร็ว ๆ นี้</Pill>}
          </div>
          <p className="text-xs text-fuchsia-300">{s.en}</p>
          <p className="text-xs text-slate-300">{s.desc}</p>
        </div>
      ))}
    </div>,
    <div key="2" className="space-y-2 text-sm">
      <p className="font-bold text-white">วิธีใช้แล็บ</p>
      <p>🖱️ / 👆 ลากเพื่อหมุนกล้อง · ล้อเมาส์หรือสองนิ้วเพื่อซูม · ปุ่ม 🎥 เปลี่ยนมุม</p>
      <p>👆 แตะอุปกรณ์เพื่อดูการ์ดข้อมูล</p>
      <p>🔌 กด "เสียบสาย" แล้วแตะจุดสีบนอุปกรณ์: ช่อง OUT หนึ่งจุด และช่อง IN อีกจุด</p>
      <p>🎤 "ซ้อมร้อง" ให้นักร้องร้องเพลง · 🎬 "เล่นโชว์" เล่น Cue list ที่สร้างไว้</p>
      <p className="rounded-xl bg-fuchsia-500/15 p-2">🧭 <b>โหมดพาทำเปิดอยู่:</b> น้องไบต์จะบอกทีละขั้นพร้อมลูกศรชี้จุดที่ต้องแตะ ถ้าอยากลองเองกด "💪 ทำเอง" ได้ทุกเมื่อ</p>
      <p className="text-xs text-slate-400">🔊 แล็บนี้มีเสียงจำลอง (ดนตรี เสียงร้อง เสียงแตก และเสียงหอน) ระดับเสียงถูกจำกัดไว้ ปิดได้ที่ปุ่ม 🔊 ด้านบน</p>
    </div>,
  ]
  return (
    <Modal open={open} onClose={() => flag('seenIntro')} title={['ยินดีต้อนรับสู่ AV & Lighting Lab', 'แผนที่ด่าน', 'สอนใช้งาน'][step]}>
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
            <Btn variant="primary" onClick={() => flag('seenIntro')}>
              เริ่มเลย! 🎸
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function AvLabPage() {
  const desktop = useIsDesktop()
  useAvSim(true)
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
      <AvGuideSync />
    </div>
  )
}
