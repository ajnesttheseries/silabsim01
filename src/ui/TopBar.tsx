import { useEffect, useState } from 'react'
import { MISSIONS } from '../engine/missions'
import { useLab, type Quality } from '../store/lab'
import { Btn, fmtDuration, Modal } from './common'

function Timer() {
  const startedAt = useLab((s) => s.progress.startedAt)
  const finishedAt = useLab((s) => s.progress.finishedAt)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const s = startedAt ? ((finishedAt ?? now) - startedAt) / 1000 : 0
  return (
    <span className="font-mono text-sm tabular-nums text-cyan-100" aria-label="เวลาที่ใช้">
      ⏱ {fmtDuration(s)}
    </span>
  )
}

export function TopBar() {
  const completed = useLab((s) => s.progress.completed)
  const current = useLab((s) => s.progress.current)
  const soundOn = useLab((s) => s.soundOn)
  const setSound = useLab((s) => s.setSound)
  const presenter = useLab((s) => s.presenter)
  const setPresenter = useLab((s) => s.setPresenter)
  const saveResult = useLab((s) => s.saveResult)
  const setRoute = useLab((s) => s.setRoute)
  const quality = useLab((s) => s.quality)
  const autoQuality = useLab((s) => s.autoQuality)
  const setQuality = useLab((s) => s.setQuality)
  const dataFlow = useLab((s) => s.dataFlow)
  const setDataFlow = useLab((s) => s.setDataFlow)
  const [menu, setMenu] = useState(false)
  const pct = Math.round((completed.length / MISSIONS.length) * 100)

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-ink-950/95 px-2 sm:px-3">
      <button className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-left" onClick={() => setRoute('landing')} aria-label="กลับหน้าแรก">
        <span className="text-xl">🏠</span>
        <span className="hidden text-sm font-bold leading-tight text-cyan-100 md:block">
          Virtual AIoT Lab
          <span className="block text-[11px] font-medium text-cyan-300">ด่าน 1 · ภารกิจ {current}</span>
        </span>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-2.5 min-w-16 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้าภารกิจ">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs text-slate-300">
          {completed.length}/{MISSIONS.length}
        </span>
        <Timer />
      </div>
      <Btn variant="ghost" onClick={() => setSound(!soundOn)} aria-label={soundOn ? 'ปิดเสียง' : 'เปิดเสียง'} aria-pressed={soundOn}>
        {soundOn ? '🔊' : '🔇'}
      </Btn>
      <Btn variant="ghost" onClick={() => setMenu(true)} aria-label="เมนูตั้งค่า">
        ⚙️
      </Btn>
      <Modal open={menu} onClose={() => setMenu(false)} title="ตั้งค่าและเมนู">
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 font-semibold text-cyan-100">คุณภาพกราฟิก</p>
            <div className="flex flex-wrap gap-2">
              {(['auto', 'low', 'mid', 'high'] as Quality[]).map((q) => (
                <Btn key={q} variant={quality === q ? 'primary' : 'soft'} onClick={() => setQuality(q)}>
                  {{ auto: `อัตโนมัติ (${{ low: 'ต่ำ', mid: 'กลาง', high: 'สูง' }[autoQuality]})`, low: 'ต่ำ', mid: 'กลาง', high: 'สูง' }[q]}
                </Btn>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">ต่ำ = ไม่มีเงาและแสงเรือง เหมาะกับมือถือรุ่นเก่า · อัตโนมัติจะลดคุณภาพเองเมื่อเฟรมเรตตก</p>
          </div>
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>แสดงเส้นทางของข้อมูล (แอนิเมชัน)</span>
            <input type="checkbox" className="h-6 w-6 accent-cyan-400" checked={dataFlow} onChange={(e) => setDataFlow(e.target.checked)} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>โหมดนำเสนอ (ตัวอักษรใหญ่ + QR Code)</span>
            <input type="checkbox" className="h-6 w-6 accent-cyan-400" checked={presenter} onChange={(e) => setPresenter(e.target.checked)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={() => void saveResult()}>
              💾 บันทึกผล
            </Btn>
            <Btn variant="soft" onClick={() => { setMenu(false); setRoute('landing') }}>
              🏠 หน้าแรก
            </Btn>
            <Btn variant="soft" onClick={() => { setMenu(false); setRoute('staff') }}>
              👩‍🏫 หน้าผู้สอน
            </Btn>
          </div>
          <p className="text-xs text-slate-400">ความคืบหน้าบันทึกอัตโนมัติในเบราว์เซอร์นี้ รีเฟรชหน้าแล้วเล่นต่อได้</p>
        </div>
      </Modal>
    </header>
  )
}
