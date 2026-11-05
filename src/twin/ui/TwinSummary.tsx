import { useEffect, useState } from 'react'
import { CAREERS, PROGRAM, TWIN_STAGES } from '../../content'
import { scoreQuiz } from '../../engine/quiz'
import { downloadCanvasPdf, downloadCanvasPng, drawCertificate, type CertData } from '../../services/certificate'
import { useLab } from '../../store/lab'
import { Btn, ByteBot, fmtDuration, Pill } from '../../ui/common'
import { TWIN_FINAL_QUIZ, TWIN_MISSIONS } from '../engine/missions'
import { useTwin } from '../store'

export default function TwinSummary() {
  const profile = useLab((s) => s.profile)
  const setRoute = useLab((s) => s.setRoute)
  const toast = useLab((s) => s.toast)
  const ask = useLab((s) => s.ask)
  const p = useTwin((s) => s.progress)
  const save = useTwin((s) => s.saveResult)
  const restart = useTwin((s) => s.restartAll)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const end = p.finishedAt ?? Date.now()
  const duration = p.startedAt ? (end - p.startedAt) / 1000 : 0
  const quizDone = p.finalAnswers.every((a) => a !== null)
  const score = scoreQuiz(TWIN_FINAL_QUIZ, p.finalAnswers)
  const data: CertData = {
    nickname: profile.nickname,
    school: profile.school,
    date: new Date(end),
    quiz: quizDone ? `${score}/${TWIN_FINAL_QUIZ.length}` : '–',
    missions: `${p.completed.length}/${TWIN_MISSIONS.length}`,
    duration: `${fmtDuration(duration)} นาที`,
    topLine: 'Virtual Digital Twin Lab · ด่านที่ 1 จำลองข้อมูลจริง (Data Acquisition)',
    title: 'ใบประกาศนักวิศวกรดิจิทัลทวินฝึกหัด',
    lines: ['ได้ลงมือติดเซนเซอร์ ตั้งอัตราการวัดและช่องสัญญาณ ปรับเทียบข้อมูล', 'และสร้างแฝดดิจิทัลที่เฝ้าระวังหุ่นยนต์ผู้ช่วยแบบเรียลไทม์'],
    careerLine: 'สาย Digital Twin Engineer',
    accent: '#2dd4bf',
  }
  useEffect(() => {
    let alive = true
    void drawCertificate(data).then((c) => alive && setPreview(c.toDataURL('image/png')))
    return () => {
      alive = false
    }
  }, [profile.nickname, profile.school, p.completed.length, score, quizDone])

  const dl = async (kind: 'png' | 'pdf') => {
    setBusy(true)
    try {
      const c = await drawCertificate(data)
      const name = `ใบประกาศ-Digital-Twin-${profile.nickname || 'trainee'}.${kind}`
      if (kind === 'png') downloadCanvasPng(c, name)
      else await downloadCanvasPdf(c, name)
    } catch (e) {
      toast('error', `ดาวน์โหลดไม่สำเร็จ: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
        <div className="mb-6 flex items-center gap-3">
          <ByteBot size={64} />
          <div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">สรุปผล: แฝดดิจิทัล NOVA-1</h1>
            <p className="text-sm text-slate-300">เยี่ยมมาก{profile.nickname ? ` ${profile.nickname}` : ''}! น้องเพิ่งทำงานแบบเดียวกับที่วิศวกรดิจิทัลทวินทำกับเครื่องจักร โรงงาน และอาคารจริง</p>
          </div>
        </div>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            ['เวลาที่ใช้', fmtDuration(duration)],
            ['คะแนนแบบทดสอบ', quizDone ? `${score}/${TWIN_FINAL_QUIZ.length}` : 'ยังไม่ทำ'],
            ['ภารกิจที่ผ่าน', `${p.completed.length}/${TWIN_MISSIONS.length}`],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-2xl p-4 text-center">
              <p className="text-xs text-teal-300">{k}</p>
              <p className="font-mono text-3xl font-bold">{v}</p>
            </div>
          ))}
        </div>
        <section className="mb-6 rounded-2xl border border-white/10 bg-ink-900/60 p-4">
          <h2 className="mb-2 font-bold text-teal-100">ภารกิจ</h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {TWIN_MISSIONS.map((m) => (
              <li key={m.id}>
                {p.completed.includes(m.id) ? '✅' : '⬜'} {m.id === 6 ? 'สุดท้าย' : m.id}. {m.title}
              </li>
            ))}
          </ul>
          {p.testScore && (
            <p className="mt-2 text-sm text-slate-300">
              แฝดเฝ้าระวังผ่าน {p.testScore.score}/{p.testScore.total} สถานการณ์ · ใช้คำใบ้ {p.hintsUsed} ครั้ง
            </p>
          )}
        </section>
        <section className="mb-6 rounded-2xl border border-teal-400/40 bg-ink-900/60 p-4">
          <h2 className="mb-3 font-bold text-teal-100">🎓 ใบประกาศนักวิศวกรดิจิทัลทวินฝึกหัด</h2>
          {preview ? <img src={preview} alt="ตัวอย่างใบประกาศ" className="mb-3 w-full rounded-xl border border-white/10" /> : <p className="mb-3 text-sm">กำลังสร้างใบประกาศ…</p>}
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" disabled={busy} onClick={() => void dl('png')}>
              ⬇ ดาวน์โหลดรูป (PNG)
            </Btn>
            <Btn variant="primary" disabled={busy} onClick={() => void dl('pdf')}>
              ⬇ ดาวน์โหลด PDF
            </Btn>
            <Btn onClick={() => void save()}>💾 บันทึกผล</Btn>
          </div>
        </section>
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-teal-100">ทักษะนี้คือส่วนหนึ่งของสายดิจิทัลทวินในหลักสูตร {PROGRAM.short}</h2>
          <p className="mb-3 text-sm text-slate-300">
            การเลือกและติดตั้งเซนเซอร์, Sampling และ Nyquist, งบช่องสัญญาณ, การปรับเทียบ และการบำรุงรักษาเชิงพยากรณ์ คือพื้นฐานของ <b>วิศวกรดิจิทัลทวิน</b> ใน{PROGRAM.nameTh} {PROGRAM.faculty} ซึ่งยังมีสายอาชีพอื่นให้ลองอีก:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAREERS.filter((c) => c.id !== 'twin').map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-ink-900/60 p-3">
                <p className="font-semibold">
                  {c.icon} {c.th} {c.lab && <Pill className="ml-1 bg-cyan-500/20 text-cyan-100">มีแล็บให้ลอง</Pill>}
                </p>
                <p className="text-xs text-cyan-300">{c.en}</p>
                <p className="text-xs text-slate-300">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mb-6 grid gap-2 sm:grid-cols-2">
          {TWIN_STAGES.filter((s) => !s.open).map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 bg-ink-900/60 p-3">
              <div className="flex items-center justify-between">
                <b>
                  ด่านที่ {s.id}: {s.th}
                </b>
                <Pill className="bg-slate-600/40">🔒 เร็ว ๆ นี้</Pill>
              </div>
              <p className="text-xs text-teal-300">{s.en}</p>
              <p className="text-xs text-slate-300">{s.desc}</p>
            </div>
          ))}
        </section>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => setRoute('twin')}>↩ กลับไปที่ห้องแล็บ</Btn>
          <Btn onClick={() => setRoute('landing')}>🏠 หน้าแรก</Btn>
          <Btn
            variant="ghost"
            onClick={() =>
              ask('เริ่มแล็บดิจิทัลทวินใหม่ทั้งหมดสำหรับผู้เล่นคนถัดไป?', () => {
                restart()
                setRoute('landing')
              })
            }
          >
            👋 ผู้เล่นคนถัดไป
          </Btn>
        </div>
      </div>
    </div>
  )
}
