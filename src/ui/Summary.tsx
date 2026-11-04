import { useEffect, useState } from 'react'
import { CAREERS, PROGRAM, STAGES } from '../content'
import { MISSIONS } from '../engine/missions'
import { FINAL_QUIZ, scoreQuiz } from '../engine/quiz'
import { downloadCanvasPdf, downloadCanvasPng, drawCertificate } from '../services/certificate'
import { useLab } from '../store/lab'
import { Btn, ByteBot, fmtDuration, Pill } from './common'

export default function Summary() {
  const profile = useLab((s) => s.profile)
  const p = useLab((s) => s.progress)
  const setRoute = useLab((s) => s.setRoute)
  const startLab = useLab((s) => s.startLab)
  const saveResult = useLab((s) => s.saveResult)
  const restartAll = useLab((s) => s.restartAll)
  const ask = useLab((s) => s.ask)
  const toast = useLab((s) => s.toast)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const end = p.finishedAt ?? Date.now()
  const duration = p.startedAt ? (end - p.startedAt) / 1000 : 0
  const quizDone = p.finalAnswers.every((a) => a !== null)
  const score = scoreQuiz(FINAL_QUIZ, p.finalAnswers)
  const data = {
    nickname: profile.nickname,
    school: profile.school,
    date: new Date(end),
    quiz: quizDone ? `${score}/${FINAL_QUIZ.length}` : '–',
    missions: `${p.completed.length}/${MISSIONS.length}`,
    duration: `${fmtDuration(duration)} นาที`,
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
      const name = `ใบประกาศ-AIoT-${profile.nickname || 'trainee'}.${kind}`
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
            <h1 className="neon-text text-2xl font-extrabold text-white sm:text-3xl">สรุปผลการทดลอง</h1>
            <p className="text-sm text-slate-300">เก่งมาก{profile.nickname ? ` ${profile.nickname}` : ''}! นี่คือสิ่งที่วิศวกร AIoT ทำจริงในทุกวัน</p>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="glass rounded-2xl p-4 text-center">
            <p className="text-xs text-cyan-300">เวลาที่ใช้</p>
            <p className="font-mono text-3xl font-bold">{fmtDuration(duration)}</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <p className="text-xs text-cyan-300">คะแนนแบบทดสอบ</p>
            <p className="font-mono text-3xl font-bold">{quizDone ? `${score}/${FINAL_QUIZ.length}` : 'ยังไม่ทำ'}</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <p className="text-xs text-cyan-300">ภารกิจที่ผ่าน</p>
            <p className="font-mono text-3xl font-bold">
              {p.completed.length}/{MISSIONS.length}
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-white/10 bg-ink-900/60 p-4">
          <h2 className="mb-2 font-bold text-cyan-100">ภารกิจ</h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {MISSIONS.map((m) => (
              <li key={m.id}>
                {p.completed.includes(m.id) ? '✅' : '⬜'} {m.id === 6 ? 'สุดท้าย' : m.id}. {m.title}
              </li>
            ))}
          </ul>
          {p.autoTest && (
            <p className="mt-2 text-sm text-slate-300">
              ภารกิจท้าทาย ({p.challenge === 'plant' ? 'กระถางต้นไม้อัจฉริยะ' : 'ห้องเรียนอัจฉริยะ'}): ผ่าน {p.autoTest.score}/{p.autoTest.total} สถานการณ์ · ใช้คำใบ้ {p.hintsUsed} ครั้ง
            </p>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-cyan-400/40 bg-ink-900/60 p-4">
          <h2 className="mb-3 font-bold text-cyan-100">🎓 ใบประกาศนักวิศวกร AIoT ฝึกหัด</h2>
          {preview ? <img src={preview} alt="ตัวอย่างใบประกาศ" className="mb-3 w-full rounded-xl border border-white/10" /> : <p className="mb-3 text-sm">กำลังสร้างใบประกาศ…</p>}
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" disabled={busy} onClick={() => void dl('png')}>
              ⬇ ดาวน์โหลดรูป (PNG)
            </Btn>
            <Btn variant="primary" disabled={busy} onClick={() => void dl('pdf')}>
              ⬇ ดาวน์โหลด PDF
            </Btn>
            <Btn onClick={() => void saveResult()}>💾 บันทึกผล</Btn>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-cyan-100">ทักษะที่น้องเพิ่งลอง คือส่วนหนึ่งของสาย AIoT ในหลักสูตร {PROGRAM.short}</h2>
          <p className="mb-3 text-sm text-slate-300">
            การเลือกอุปกรณ์ อ่านขาต่อ คำนวณตัวต้านทานด้วยกฎของโอห์ม อ่านค่า Analog/Digital และตั้งเงื่อนไขควบคุม คือพื้นฐานของ <b>วิศวกรระบบ AIoT และสมองกลฝังตัว</b> ใน{PROGRAM.nameTh} {PROGRAM.faculty} ซึ่งยังมีอีก 4 สายอาชีพให้เลือก:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAREERS.filter((c) => !c.thisLab).map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-ink-900/60 p-3">
                <p className="font-semibold">
                  {c.icon} {c.th}
                </p>
                <p className="text-xs text-cyan-300">{c.en}</p>
                <p className="text-xs text-slate-300">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 grid gap-2 sm:grid-cols-2">
          {STAGES.filter((s) => !s.open).map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 bg-ink-900/60 p-3 opacity-90">
              <div className="flex items-center justify-between">
                <b>
                  ด่านที่ {s.id}: {s.th}
                </b>
                <Pill className="bg-slate-600/40">🔒 เร็ว ๆ นี้</Pill>
              </div>
              <p className="text-xs text-cyan-300">{s.en}</p>
              <p className="text-xs text-slate-300">{s.desc}</p>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-2">
          <Btn onClick={startLab}>↩ กลับไปที่แล็บ</Btn>
          <Btn onClick={() => setRoute('landing')}>🏠 หน้าแรก</Btn>
          <Btn variant="ghost" onClick={() => ask('เริ่มใหม่ทั้งหมดสำหรับผู้เล่นคนถัดไป?', restartAll)}>
            👋 ผู้เล่นคนถัดไป (เริ่มใหม่)
          </Btn>
        </div>
      </div>
    </div>
  )
}
