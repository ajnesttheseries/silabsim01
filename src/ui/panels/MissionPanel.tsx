import { useState } from 'react'
import { FIND_LIST, FIND_TARGET, MISSIONS, objectivesStatus, type Mission } from '../../engine/missions'
import { CATALOG } from '../../engine/circuit/catalog'
import { FINAL_QUIZ, MINI_QUIZ, scoreQuiz, type QuizQuestion } from '../../engine/quiz'
import { SCENARIOS, type Challenge } from '../../engine/scenarios'
import { missionCtx, useLab } from '../../store/lab'
import { Btn, Modal, Pill, Section } from '../common'
import { GuidePanelSection } from '../guide'

function MissionMap() {
  const progress = useLab((s) => s.progress)
  const goMission = useLab((s) => s.goMission)
  return (
    <div className="flex gap-1 overflow-x-auto scroll-thin pb-1">
      {MISSIONS.map((m) => {
        const done = progress.completed.includes(m.id)
        const unlocked = m.id === 0 || progress.completed.includes(m.id - 1)
        const cur = progress.current === m.id
        return (
          <button
            key={m.id}
            onClick={() => goMission(m.id)}
            className={`min-h-11 shrink-0 rounded-xl border px-2 text-xs font-semibold ${cur ? 'border-cyan-300 bg-cyan-500/25 text-white' : done ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100' : unlocked ? 'border-white/15 text-slate-200' : 'border-white/5 text-slate-500'}`}
            aria-current={cur ? 'step' : undefined}
          >
            {done ? '✅' : unlocked ? '🔓' : '🔒'} {m.id === 6 ? 'สุดท้าย' : m.id}. {m.short}
          </button>
        )
      })}
    </div>
  )
}

export function Quiz({ qs, answers, onAnswer, oneAtATime }: { qs: QuizQuestion[]; answers: Array<number | null>; onAnswer: (i: number, c: number) => void; oneAtATime?: boolean }) {
  const firstOpen = answers.findIndex((a) => a === null)
  const [idx, setIdx] = useState(Math.max(0, firstOpen))
  const list = oneAtATime ? [idx] : qs.map((_, i) => i)
  return (
    <div className="space-y-3">
      {list.map((i) => {
        const q = qs[i]
        const a = answers[i]
        return (
          <div key={q.id} className="rounded-xl bg-ink-800/70 p-3">
            {oneAtATime && (
              <p className="mb-1 text-xs text-cyan-300">
                ข้อ {i + 1}/{qs.length} · {q.topic}
              </p>
            )}
            <p className="mb-2 text-sm font-semibold text-white">{q.q}</p>
            <div className="grid gap-1.5">
              {q.choices.map((c, k) => {
                const chosen = a === k
                const correct = q.answer === k
                const show = a !== null
                return (
                  <button
                    key={k}
                    disabled={oneAtATime ? a !== null : false}
                    onClick={() => onAnswer(i, k)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm ${
                      show && correct ? 'border-emerald-400 bg-emerald-500/20' : show && chosen ? 'border-rose-400 bg-rose-500/20' : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {['ก', 'ข', 'ค', 'ง'][k]}. {c} {show && correct ? '✅' : show && chosen ? '❌' : ''}
                  </button>
                )
              })}
            </div>
            {a !== null && (
              <p className={`mt-2 rounded-lg p-2 text-xs ${a === q.answer ? 'bg-emerald-900/50 text-emerald-100' : 'bg-amber-900/50 text-amber-100'}`}>
                {a === q.answer ? 'ถูกต้อง! ' : 'ยังไม่ถูก ลองดูเหตุผล: '}
                {q.explain}
              </p>
            )}
          </div>
        )
      })}
      {oneAtATime && (
        <div className="flex justify-between">
          <Btn disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            ← ก่อนหน้า
          </Btn>
          <Btn variant="primary" disabled={idx >= qs.length - 1 || answers[idx] === null} onClick={() => setIdx(idx + 1)}>
            ข้อต่อไป →
          </Btn>
        </div>
      )}
    </div>
  )
}

function Mission1Extras() {
  const found = useLab((s) => s.progress.found)
  const answers = useLab((s) => s.progress.miniAnswers)
  const answerMini = useLab((s) => s.answerMini)
  const setCamera = useLab((s) => s.setCamera)
  return (
    <>
      <Section title={`รายการอุปกรณ์ (${Math.min(found.length, FIND_LIST.length)}/${FIND_TARGET} ขึ้นไป)`} right={<Btn onClick={() => setCamera('shelf')}>🎥 ไปที่ชั้นวาง</Btn>}>
        <div className="flex flex-wrap gap-1">
          {FIND_LIST.map((i) => (
            <Pill key={i} className={found.includes(i) ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/5 text-slate-300'}>
              {found.includes(i) ? '✔' : '○'} {CATALOG[i].nameTh}
            </Pill>
          ))}
        </div>
      </Section>
      <Section title="Mini quiz: จับคู่อุปกรณ์กับหน้าที่">
        <Quiz qs={MINI_QUIZ} answers={answers} onAnswer={answerMini} />
      </Section>
    </>
  )
}

function OhmCalc() {
  const [vf, setVf] = useState(2.0)
  const [ma, setMa] = useState(10)
  const r = (3.3 - vf) / (ma / 1000)
  const std = [100, 150, 220, 330, 470, 1000].find((x) => x >= r) ?? 1000
  return (
    <Section title="เครื่องคิดเลขกฎของโอห์ม">
      <p className="mb-2 font-mono text-sm text-cyan-100">R = (V_supply − V_LED) / I</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>
          V_LED (สี LED)
          <select className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-ink-900 px-2" value={vf} onChange={(e) => setVf(Number(e.target.value))}>
            <option value={2.0}>แดง ~2.0V</option>
            <option value={3.0}>เขียว/น้ำเงิน ~3.0V</option>
          </select>
        </label>
        <label>
          กระแสที่ต้องการ (mA)
          <input type="number" min={1} max={20} className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-ink-900 px-2" value={ma} onChange={(e) => setMa(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
        </label>
      </div>
      <p className="mt-2 text-sm">
        R = (3.3 − {vf.toFixed(1)}) / {(ma / 1000).toFixed(3)} ≈ <b className="text-amber-300">{Math.round(r)} Ω</b> → เลือกค่ามาตรฐานที่สูงกว่าและปลอดภัย: <b className="text-emerald-300">{std} Ω</b>
      </p>
      {vf >= 3 && <p className="mt-1 text-xs text-slate-300">LED เขียว/น้ำเงินเหลือแรงดันให้ตัวต้านทานแค่ 0.3V จึงได้กระแสน้อยและสว่างน้อยกว่าเมื่อใช้ไฟ 3.3V</p>}
    </Section>
  )
}

function Mission2Extras() {
  const blink = useLab((s) => s.blink)
  const setBlink = useLab((s) => s.setBlink)
  const manual = useLab((s) => s.manual)
  const setManual = useLab((s) => s.setManual)
  const leds = useLab((s) => s.report.leds)
  const powered = useLab((s) => s.simView.powered)
  const okLeds = leds.filter((l) => l.drive?.kind === 'GPIO')
  const keys = [...new Set(okLeds.map((l) => (l.color === 'red' ? 'ledRed' : l.color === 'green' ? 'ledGreen' : 'ledBlue')))] as Array<'ledRed' | 'ledGreen' | 'ledBlue'>
  return (
    <>
      <Section title="ควบคุม LED">
        {!keys.length && <p className="text-sm text-slate-300">ยังไม่พบ LED ที่ต่อกับขา GPIO</p>}
        {keys.map((k) => (
          <div key={k} className="mb-2 flex flex-wrap items-center gap-2">
            <span className="w-24 text-sm">{{ ledRed: 'LED แดง', ledGreen: 'LED เขียว', ledBlue: 'LED น้ำเงิน' }[k]}</span>
            <Btn variant={manual[k] ? 'success' : 'soft'} onClick={() => setManual(k, !manual[k])}>
              {manual[k] ? 'สั่ง LOW (ดับ)' : 'สั่ง HIGH (ติด)'}
            </Btn>
            <Btn variant={blink[k] ? 'primary' : 'soft'} onClick={() => setBlink(k, !blink[k])}>
              {blink[k] ? 'หยุดกระพริบ' : '✨ สั่งกระพริบ'}
            </Btn>
          </div>
        ))}
        {!powered && keys.length > 0 && <p className="text-xs text-amber-300">อย่าลืมกด ⚡ Power ON ก่อน</p>}
      </Section>
      <OhmCalc />
    </>
  )
}

function Mission3Extras() {
  const r = useLab((s) => s.simView.readings)
  const obs = useLab((s) => s.progress.obs)
  const setTab = useLab((s) => s.setTab)
  return (
    <Section title="ค่าที่อ่านได้" right={<Btn onClick={() => setTab('env')}>🌡️ ปรับฮีตเตอร์/พัดลม</Btn>}>
      <p className="text-sm">
        อุณหภูมิ: <b className="font-mono text-amber-200">{r.temp == null ? 'NaN' : `${r.temp.toFixed(1)} °C`}</b> · ความชื้น:{' '}
        <b className="font-mono text-sky-200">{r.humidity == null ? 'NaN' : `${r.humidity.toFixed(1)} %`}</b>
      </p>
      {Number.isFinite(obs.tMin) && (
        <p className="mt-1 text-xs text-slate-300">
          ช่วงที่สังเกตได้: {obs.tMin.toFixed(1)} – {obs.tMax.toFixed(1)} °C (ต่างกัน {(obs.tMax - obs.tMin).toFixed(1)} °C ต้องการ ≥ 2 °C)
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400">สังเกต: ค่าเปลี่ยนทุก ~2 วินาที และไม่ได้กระโดดทันทีเมื่อเปิดฮีตเตอร์</p>
    </Section>
  )
}

function Mission4Extras() {
  const r = useLab((s) => s.simView.readings)
  const obs = useLab((s) => s.progress.obs)
  const answer = useLab((s) => s.progress.ldrAnswer)
  const correct = useLab((s) => s.progress.ldrAnswerCorrect)
  const answerLdr = useLab((s) => s.answerLdr)
  const ldr = useLab((s) => s.report.ldrs.find((d) => d.status === 'ok'))
  const setTab = useLab((s) => s.setTab)
  const volts = r.ldr?.volts
  return (
    <>
      <Section title="วงจรแบ่งแรงดัน" right={<Btn onClick={() => setTab('env')}>💡 ปรับแสง</Btn>}>
        <p className="font-mono text-sm text-cyan-100">V_out = V_in × R2 / (R1 + R2)</p>
        {ldr && r.ldr ? (
          <div className="mt-2 space-y-1 text-sm">
            <p>
              R_LDR ตอนนี้ ≈ <b className="font-mono">{r.ldr.rLdr >= 1000 ? `${(r.ldr.rLdr / 1000).toFixed(1)} kΩ` : `${Math.round(r.ldr.rLdr)} Ω`}</b> · R คงที่ = {ldr.rFixed! / 1000} kΩ
            </p>
            <p>
              {ldr.ldrOnTop ? 'R1 = LDR, R2 = 10kΩ' : 'R1 = 10kΩ, R2 = LDR'} → V_out ≈ <b className="font-mono text-amber-200">{volts?.toFixed(2)} V</b>
            </p>
            <p>
              ADC = V_out / 3.3 × 4095 ≈ <b className="font-mono text-amber-200">{r.light}</b>
            </p>
            {Number.isFinite(obs.lMin) && (
              <p className="text-xs text-slate-300">
                ช่วง ADC ที่สังเกตได้: {obs.lMin} – {obs.lMax} (ต่างกัน {obs.lMax - obs.lMin} ต้องการ ≥ 800)
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-300">ยังไม่พบวงจรแบ่งแรงดันที่ถูกต้อง หรือยังไม่ได้จ่ายไฟ</p>
        )}
      </Section>
      <Section title="คำถามชวนคิด: แสงมากขึ้น ค่า ADC เพิ่มหรือลด เพราะอะไร?">
        <div className="flex flex-wrap gap-2">
          <Btn variant={answer === 'up' ? 'primary' : 'soft'} onClick={() => answerLdr('up')} disabled={!ldr}>
            📈 เพิ่มขึ้น
          </Btn>
          <Btn variant={answer === 'down' ? 'primary' : 'soft'} onClick={() => answerLdr('down')} disabled={!ldr}>
            📉 ลดลง
          </Btn>
        </div>
        {!ldr && <p className="mt-2 text-xs text-slate-400">ต่อวงจรให้ถูกก่อน แล้วลองหรี่/เปิดไฟเพื่อสังเกตจริง</p>}
        {answer && ldr && (
          <p className={`mt-2 rounded-lg p-2 text-xs ${correct ? 'bg-emerald-900/50' : 'bg-amber-900/50'}`}>
            {correct ? 'ถูกต้อง! ' : 'ลองสังเกตค่าจริงอีกครั้ง: '}
            แสงมากขึ้น → ความต้านทาน LDR ลดลง →{' '}
            {ldr.ldrOnTop
              ? 'LDR อยู่ฝั่ง 3V3 (R1) จึงเหลือแรงดันตกคร่อม 10kΩ (R2) มากขึ้น ค่า ADC จึงเพิ่มขึ้น'
              : 'LDR อยู่ฝั่ง GND (R2) แรงดันตกคร่อมตัวมันน้อยลง ค่า ADC จึงลดลง'}
          </p>
        )}
      </Section>
    </>
  )
}

function Mission5Extras() {
  const challenge = useLab((s) => s.progress.challenge)
  const choose = useLab((s) => s.chooseChallenge)
  const run = useLab((s) => s.runAutoTest)
  const results = useLab((s) => s.autoResults)
  const autoTest = useLab((s) => s.progress.autoTest)
  const setTab = useLab((s) => s.setTab)
  const opts: Array<{ id: Challenge; icon: string; th: string; desc: string; parts: string[] }> = [
    {
      id: 'classroom',
      icon: '🏫',
      th: 'ห้องเรียนอัจฉริยะ',
      desc: 'ร้อนเกิน → พัดลมเปิด · มืด → ไฟเปิด',
      parts: ['เซนเซอร์อุณหภูมิ (ภารกิจ 3)', 'LDR + 10kΩ (ภารกิจ 4)', 'LED (ไฟห้อง)', 'โมดูลขับโหลด + พัดลม DC 5V'],
    },
    { id: 'plant', icon: '🪴', th: 'กระถางต้นไม้อัจฉริยะ', desc: 'ดินแห้ง → LED แดง + บัซเซอร์เตือน · ดินชื้นพอ → LED เขียว', parts: ['เซนเซอร์ความชื้นในดิน (AOUT → ขา ADC)', 'LED แดง + 220Ω', 'LED เขียว + 220Ω', 'บัซเซอร์'] },
  ]
  return (
    <>
      <Section title="เลือกโจทย์">
        <div className="grid gap-2">
          {opts.map((o) => (
            <button
              key={o.id}
              onClick={() => choose(o.id)}
              className={`min-h-11 rounded-xl border p-3 text-left ${challenge === o.id ? 'border-cyan-300 bg-cyan-500/20' : 'border-white/10 hover:bg-white/5'}`}
            >
              <p className="font-bold">
                {o.icon} {o.th}
              </p>
              <p className="text-xs text-slate-300">{o.desc}</p>
              {challenge === o.id && (
                <ul className="mt-1 list-inside list-disc text-xs text-cyan-100">
                  {o.parts.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </button>
          ))}
        </div>
      </Section>
      {challenge && (
        <Section title="ทดสอบอัตโนมัติ" right={<Btn onClick={() => setTab('rules')}>🧠 ไปตั้งกฎ</Btn>}>
          <p className="mb-2 text-xs text-slate-300">ระบบจะจำลองสภาพแวดล้อม {SCENARIOS[challenge].length} สถานการณ์ (ครั้งละ 30 วินาทีจำลอง) กับวงจรและกฎของเรา แล้วตรวจว่าอุปกรณ์ตอบสนองถูกไหม</p>
          <Btn variant="primary" onClick={run}>
            🧪 ทดสอบอัตโนมัติ
          </Btn>
          {autoTest && (
            <p className="mt-2 text-sm font-bold">
              ผลการทดสอบ: <span className={autoTest.score >= 3 ? 'text-emerald-300' : 'text-amber-300'}>{autoTest.score}/{autoTest.total} สถานการณ์</span>
            </p>
          )}
          {results && (
            <ul className="mt-2 space-y-1.5">
              {results.map((r) => (
                <li key={r.scenario.id} className={`rounded-lg p-2 text-xs ${r.pass ? 'bg-emerald-900/50' : 'bg-rose-900/40'}`}>
                  <p className="font-semibold">
                    {r.pass ? '✅' : '❌'} {r.scenario.th}
                  </p>
                  <p className="text-slate-300">
                    ค่าที่อ่านได้: {r.readings.temp != null && `อุณหภูมิ ${r.readings.temp.toFixed(1)}°C `}
                    {r.readings.light != null && `แสง ADC ${r.readings.light} `}
                    {r.readings.soil != null && `ดิน ${r.readings.soil}%`}
                    {r.readings.temp == null && r.readings.light == null && r.readings.soil == null && 'อ่านเซนเซอร์ไม่ได้'}
                  </p>
                  <p>
                    {r.checks.map((c) => (
                      <span key={c.key} className="mr-2">
                        {c.ok ? '✔' : '✘'} {c.th}
                        {!c.ok && ` (ได้: ${c.actual ? 'เปิด' : 'ปิด'})`}
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  )
}

function FinalQuiz() {
  const answers = useLab((s) => s.progress.finalAnswers)
  const answerFinal = useLab((s) => s.answerFinal)
  const finish = useLab((s) => s.finishLab)
  const done = answers.every((a) => a !== null)
  return (
    <Section title="แบบทดสอบ 5 ข้อ">
      <Quiz qs={FINAL_QUIZ} answers={answers} onAnswer={answerFinal} oneAtATime />
      {done && (
        <div className="mt-3 rounded-xl bg-emerald-900/40 p-3 text-center">
          <p className="mb-2 text-lg font-bold">
            คะแนน {scoreQuiz(FINAL_QUIZ, answers)}/{FINAL_QUIZ.length}
          </p>
          <Btn variant="primary" onClick={finish}>
            🎓 ดูผลสรุปและรับใบประกาศ
          </Btn>
        </div>
      )}
    </Section>
  )
}

function TheoryModal({ m }: { m: Mission }) {
  const open = useLab((s) => s.showTheory)
  const set = useLab((s) => s.setTheory)
  return (
    <Modal open={open} onClose={() => set(false)} title={`📘 ทฤษฎี: ${m.theory.title}`}>
      {m.theory.formula && <p className="mb-3 rounded-xl bg-ink-800 p-3 text-center font-mono text-lg text-cyan-100">{m.theory.formula}</p>}
      <ul className="space-y-2 text-sm text-slate-200">
        {m.theory.body.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>
    </Modal>
  )
}

function Hints({ m }: { m: Mission }) {
  const level = useLab((s) => s.progress.hintLevel[m.id] ?? 0)
  const takeHint = useLab((s) => s.useHint)
  const loadSolution = useLab((s) => s.loadSolution)
  const ask = useLab((s) => s.ask)
  const state = useLab()
  const solutionKey = typeof m.solution === 'function' ? m.solution(missionCtx(state)) : m.solution
  return (
    <div className="space-y-2">
      {level >= 1 && <p className="rounded-lg bg-sky-900/40 p-2 text-sm">💡 ใบ้เบา: {m.hints[0]}</p>}
      {level >= 2 && <p className="rounded-lg bg-sky-900/60 p-2 text-sm">🔦 ใบ้ชัด: {m.hints[1]}</p>}
      {level >= 3 && (
        <div className="rounded-lg bg-violet-900/50 p-2 text-sm">
          🧩 ตัวอย่างวงจรเฉลย:{' '}
          {solutionKey ? (
            <Btn variant="primary" onClick={() => ask('วางวงจรตัวอย่างแทนวงจรปัจจุบัน? (วงจรเดิมจะถูกแทนที่)', () => loadSolution(solutionKey))}>
              วางวงจรเฉลยให้ดู
            </Btn>
          ) : (
            <span className="text-slate-300">{m.id === 5 ? 'เลือกโจทย์ก่อน แล้วจะมีวงจรเฉลยให้' : 'ภารกิจนี้ไม่มีวงจรเฉลย ทำตามคำใบ้ด้านบนได้เลย'}</span>
          )}
        </div>
      )}
      {level < 3 && (
        <Btn variant="ghost" onClick={() => takeHint()}>
          🙋 ขอคำใบ้ ({['เบา', 'ชัด', 'เฉลย'][level]})
        </Btn>
      )}
    </div>
  )
}

export function MissionPanel() {
  const state = useLab()
  const p = state.progress
  const m = MISSIONS[p.current]
  const st = objectivesStatus(m, missionCtx(state))
  const done = p.completed.includes(m.id)
  const next = MISSIONS[m.id + 1]
  return (
    <div className="space-y-3">
      <MissionMap />
      <div>
        <p className="text-xs font-semibold text-cyan-300">
          {m.id === 6 ? 'ภารกิจสุดท้าย' : `ภารกิจที่ ${m.id}`} · ประมาณ {m.minutes} นาที
        </p>
        <h2 className="presenter-xl text-xl font-extrabold text-white">{m.title}</h2>
        <p className="mt-1 text-sm text-slate-300">{m.intro}</p>
      </div>
      <Section title="เป้าหมาย">
        <ul className="space-y-1.5">
          {m.objectives.map((o) => (
            <li key={o.id} className={`flex gap-2 text-sm ${st[o.id] ? 'text-emerald-200' : 'text-slate-200'}`}>
              <span aria-hidden>{st[o.id] ? '✅' : '⬜'}</span>
              <span>{o.th}</span>
            </li>
          ))}
        </ul>
        {done && next && (
          <Btn variant="primary" className="mt-3 w-full" onClick={() => state.goMission(next.id)}>
            ไปภารกิจถัดไป: {next.title} →
          </Btn>
        )}
      </Section>
      <GuidePanelSection />
      {m.id === 1 && <Mission1Extras />}
      {m.id === 2 && <Mission2Extras />}
      {m.id === 3 && <Mission3Extras />}
      {m.id === 4 && <Mission4Extras />}
      {m.id === 5 && <Mission5Extras />}
      {m.id === 6 && <FinalQuiz />}
      <Section title="ตัวช่วย">
        <div className="mb-2 flex flex-wrap gap-2">
          <Btn onClick={() => state.setTheory(true)}>📘 ทฤษฎี</Btn>
          <Btn onClick={() => state.ask('เริ่มภารกิจนี้ใหม่?', state.resetMission)}>↺ เริ่มภารกิจใหม่</Btn>
          <Btn onClick={() => void state.saveResult()}>💾 บันทึกผล</Btn>
        </div>
        <Hints m={m} />
      </Section>
      <TheoryModal m={m} />
    </div>
  )
}
