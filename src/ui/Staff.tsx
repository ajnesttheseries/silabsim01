import { useEffect, useState } from 'react'
import { downloadText, toCsv } from '../engine/csv'
import { AV_MISSIONS } from '../av/engine/missions'
import { MISSIONS } from '../engine/missions'
import { fetchRemoteResults, LAB_TH, loadLocalResults, STAFF_PIN, supabaseEnabled, type LabId, type ResultRecord } from '../services/results'
import { useLab } from '../store/lab'
import { Btn, fmtDuration } from './common'

const labOf = (r: ResultRecord): LabId => r.lab ?? 'aiot'

function Stats({ rows, lab }: { rows: ResultRecord[]; lab: LabId | 'all' }) {
  const missions = lab === 'av' ? AV_MISSIONS : MISSIONS
  const n = rows.length
  const quiz = rows.filter((r) => r.quizScore != null)
  const avgQuiz = quiz.length ? quiz.reduce((s, r) => s + r.quizScore!, 0) / quiz.length : null
  const avgTime = n ? rows.reduce((s, r) => s + r.durationS, 0) / n : 0
  const schools = new Set(rows.map((r) => r.school).filter(Boolean)).size
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        {[
          ['ผู้เล่น', String(n)],
          ['โรงเรียน', String(schools)],
          ['คะแนนเฉลี่ย', avgQuiz == null ? '–' : `${avgQuiz.toFixed(2)}/5`],
          ['เวลาเฉลี่ย', fmtDuration(avgTime)],
        ].map(([k, v]) => (
          <div key={k} className="glass rounded-2xl p-3 text-center">
            <p className="text-xs text-cyan-300">{k}</p>
            <p className="font-mono text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      {lab === 'all' ? (
        <p className="text-xs text-slate-400">เลือกแล็บด้านบนเพื่อดูจำนวนผู้ผ่านแต่ละภารกิจ</p>
      ) : (
      <div className="glass rounded-2xl p-3">
        <p className="mb-2 text-sm font-bold text-cyan-100">จำนวนผู้ผ่านแต่ละภารกิจ ({LAB_TH[lab]})</p>
        <div className="space-y-1">
          {missions.map((m) => {
            const c = rows.filter((r) => r.missionsPassed.includes(m.id)).length
            const pct = n ? (c / n) * 100 : 0
            return (
              <div key={m.id} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 truncate">
                  {m.id === 6 ? 'สุดท้าย' : m.id}. {m.short}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-white/10">
                  <div className="h-full bg-cyan-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right font-mono">
                  {c} ({pct.toFixed(0)}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>
      )}
    </div>
  )
}

export default function Staff() {
  const setRoute = useLab((s) => s.setRoute)
  const [pin, setPin] = useState('')
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')
  const [rows, setRows] = useState<ResultRecord[]>([])
  const [source, setSource] = useState<'remote' | 'local'>(supabaseEnabled ? 'remote' : 'local')
  const [loading, setLoading] = useState(false)
  const [lab, setLab] = useState<LabId | 'all'>('all')
  const shown = lab === 'all' ? rows : rows.filter((r) => labOf(r) === lab)

  useEffect(() => {
    if (!ok) return
    if (source === 'local') {
      setRows(loadLocalResults().sort((a, b) => b.finishedAt - a.finishedAt))
      return
    }
    setLoading(true)
    void fetchRemoteResults().then((r) => {
      setLoading(false)
      if ('error' in r) {
        setErr(`โหลดจาก Supabase ไม่สำเร็จ: ${r.error}`)
        setRows([])
      } else {
        setErr('')
        setRows(r)
      }
    })
  }, [ok, source])

  const exportCsv = () =>
    downloadText(
      `si-lab-results-${lab}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['แล็บ', 'ชื่อเล่น', 'โรงเรียน', 'เริ่ม', 'จบ', 'เวลา (วินาที)', 'คะแนนแบบทดสอบ', 'เต็ม', 'ภารกิจที่ผ่าน', 'โจทย์ท้าทาย', 'คะแนนทดสอบอัตโนมัติ', 'ใช้คำใบ้', 'ใช้โหมดพาทำ'],
        shown.map((r) => [
          LAB_TH[labOf(r)],
          r.nickname,
          r.school,
          new Date(r.startedAt).toLocaleString('th-TH'),
          new Date(r.finishedAt).toLocaleString('th-TH'),
          r.durationS,
          r.quizScore,
          r.quizTotal,
          r.missionsPassed.join(' '),
          r.challenge,
          r.autoScore,
          r.hintsUsed,
          r.guided ? 'ใช่' : 'ไม่',
        ]),
      ),
    )

  if (!ok)
    return (
      <div className="flex h-full items-center justify-center p-4">
        <form
          className="glass w-full max-w-sm rounded-3xl p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (pin === STAFF_PIN) {
              setOk(true)
              setErr('')
            } else setErr('PIN ไม่ถูกต้อง')
          }}
        >
          <h1 className="mb-1 text-xl font-bold text-cyan-100">👩‍🏫 หน้าผู้สอน/สตาฟ</h1>
          <p className="mb-3 text-sm text-slate-300">ใส่ PIN เพื่อดูสถิติผู้เล่น (ตั้งค่า PIN ได้ด้วยตัวแปร VITE_STAFF_PIN)</p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mb-2 min-h-11 w-full rounded-xl border border-white/15 bg-ink-950 px-3 text-lg tracking-widest"
            aria-label="PIN"
          />
          {err && <p className="mb-2 text-sm text-rose-300">{err}</p>}
          <div className="flex gap-2">
            <Btn variant="primary" type="submit">
              เข้าสู่ระบบ
            </Btn>
            <Btn
              onClick={() => {
                history.replaceState(null, '', location.pathname)
                setRoute('landing')
              }}
            >
              กลับ
            </Btn>
          </div>
        </form>
      </div>
    )

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-5xl space-y-4 px-4 pb-16 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-cyan-100">👩‍🏫 สถิติผู้เล่น</h1>
          <div className="flex flex-wrap gap-2">
            {supabaseEnabled && (
              <>
                <Btn variant={source === 'remote' ? 'primary' : 'soft'} onClick={() => setSource('remote')}>
                  ☁️ ฐานข้อมูล (ทุกเครื่อง)
                </Btn>
                <Btn variant={source === 'local' ? 'primary' : 'soft'} onClick={() => setSource('local')}>
                  💻 เครื่องนี้
                </Btn>
              </>
            )}
            <select value={lab} onChange={(e) => setLab(e.target.value as LabId | 'all')} className="h-11 rounded-xl border border-white/15 bg-ink-900 px-2 text-sm" aria-label="เลือกแล็บ">
              <option value="all">ทุกแล็บ</option>
              <option value="aiot">{LAB_TH.aiot}</option>
              <option value="av">{LAB_TH.av}</option>
            </select>
            <Btn variant="primary" onClick={exportCsv} disabled={!shown.length}>
              ⬇ ส่งออก CSV
            </Btn>
            <Btn
              onClick={() => {
                history.replaceState(null, '', location.pathname)
                setRoute('landing')
              }}
            >
              🏠 หน้าแรก
            </Btn>
          </div>
        </div>
        {source === 'local' && (
          <p className="rounded-xl bg-amber-950/60 p-3 text-sm text-amber-200">
            ⚠️ ข้อมูลนี้เป็นข้อมูลเฉพาะเครื่อง (localStorage ของเบราว์เซอร์นี้) เท่านั้น
            {!supabaseEnabled && ' — ยังไม่ได้เชื่อม Supabase จึงรวมผลจากหลายเครื่องไม่ได้ ดูวิธีตั้งค่าใน README'}
          </p>
        )}
        {err && <p className="rounded-xl bg-rose-950/60 p-3 text-sm text-rose-200">{err}</p>}
        {loading ? <p>กำลังโหลด…</p> : <Stats rows={shown} lab={lab} />}
        <div className="glass overflow-x-auto scroll-thin rounded-2xl p-3">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-cyan-200">
              <tr>
                {['แล็บ', 'ชื่อเล่น', 'โรงเรียน', 'วันที่', 'เวลา', 'คะแนน', 'ภารกิจ', 'โจทย์ท้าทาย', 'โหมด'].map((h) => (
                  <th key={h} className="px-2 py-1">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-2 py-1 text-xs">{labOf(r) === 'av' ? '🎛️ AV' : '🤖 AIoT'}</td>
                  <td className="px-2 py-1">{r.nickname}</td>
                  <td className="px-2 py-1">{r.school || '–'}</td>
                  <td className="px-2 py-1 text-xs">{new Date(r.finishedAt).toLocaleString('th-TH')}</td>
                  <td className="px-2 py-1 font-mono">{fmtDuration(r.durationS)}</td>
                  <td className="px-2 py-1 font-mono">{r.quizScore == null ? '–' : `${r.quizScore}/${r.quizTotal}`}</td>
                  <td className="px-2 py-1 font-mono">{r.missionsPassed.length}/7</td>
                  <td className="px-2 py-1 text-xs">
                    {r.challenge === 'plant' ? 'กระถาง' : r.challenge === 'classroom' ? 'ห้องเรียน' : r.challenge === 'concert-show' ? 'โชว์คอนเสิร์ต' : '–'} {r.autoScore != null && `(${r.autoScore}/4)`}
                  </td>
                  <td className="px-2 py-1 text-xs">{r.guided ? '🧭 พาทำ' : '💪 ทำเอง'}</td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-center text-slate-400">
                    ยังไม่มีผลที่บันทึกไว้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">PIN นี้ตรวจในเบราว์เซอร์ ป้องกันได้ในระดับเบาสำหรับงานกิจกรรมเท่านั้น ระบบเก็บเพียงชื่อเล่นและชื่อโรงเรียน</p>
      </div>
    </div>
  )
}
