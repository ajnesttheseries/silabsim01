import { TWIN_LINKS } from '../../content'
import { scoreQuiz } from '../../engine/quiz'
import { useLab } from '../../store/lab'
import { Btn, Modal, Pill, Section } from '../../ui/common'
import { CurriculumCard } from '../../ui/CurriculumCard'
import { Quiz } from '../../ui/panels/MissionPanel'
import { adcOf, encoderErrorDeg, encoderOk, encoderRaw, LINK_KBPS, RATE_OPTIONS, rateChecks, SAFE_UTIL, sensorKbps, tempCalOk, tempMv, vibPeaks } from '../engine/daq'
import { TWIN_FIND_LIST, TWIN_FIND_TARGET, TWIN_FINAL_QUIZ, TWIN_MINI_QUIZ, TWIN_MISSIONS, twinObjectives } from '../engine/missions'
import { DEVICES, mountReport, PART_TH, SENSOR_IDS, SENSORS } from '../engine/robot'
import { BEARING_HZ, GEAR_HZ, vibAt, type Fault } from '../engine/signals'
import { ALERT_ACTION, ALERT_TH, type Checkpoint } from '../engine/twin'
import { SENSOR_HEX } from '../scene/layout'
import { twinCtx, useTwin } from '../store'
import { TwinGuidePanelSection } from './guide'

/* ---------------- mission ---------------- */
export function TwinMissionPanel() {
  const s = useTwin()
  const p = s.progress
  const m = TWIN_MISSIONS[p.current]
  const st = twinObjectives(m, twinCtx(s))
  const done = p.completed.includes(m.id)
  const next = TWIN_MISSIONS[m.id + 1]
  const level = p.hintLevel[m.id] ?? 0
  const sol = ({ 2: 'mounts', 3: 'rates', 4: 'calib', 5: 'rules' } as const)[m.id as 2]
  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto scroll-thin pb-1">
        {TWIN_MISSIONS.map((x) => {
          const d = p.completed.includes(x.id)
          const unlocked = x.id === 0 || p.completed.includes(x.id - 1)
          return (
            <button
              key={x.id}
              onClick={() => s.goMission(x.id)}
              className={`min-h-11 shrink-0 rounded-xl border px-2 text-xs font-semibold ${p.current === x.id ? 'border-teal-300 bg-teal-500/25 text-white' : d ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100' : unlocked ? 'border-white/15 text-slate-200' : 'border-white/5 text-slate-500'}`}
            >
              {d ? '✅' : unlocked ? '🔓' : '🔒'} {x.id === 6 ? 'สุดท้าย' : x.id}. {x.short}
            </button>
          )
        })}
      </div>
      <div>
        <p className="text-xs font-semibold text-teal-300">
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
          <Btn variant="primary" className="mt-3 w-full" onClick={() => s.goMission(next.id)}>
            ไปภารกิจถัดไป: {next.title} →
          </Btn>
        )}
      </Section>
      <CurriculumCard career="twin" link={TWIN_LINKS[m.id]} done={done} />
      <TwinGuidePanelSection />
      {m.id === 1 && (
        <>
          <Section title={`ชิ้นส่วนที่ดูแล้ว (${p.found.length}/${TWIN_FIND_TARGET} ขึ้นไป)`}>
            <div className="flex flex-wrap gap-1">
              {TWIN_FIND_LIST.map((d) => (
                <Pill key={d} className={p.found.includes(d) ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/5 text-slate-300'}>
                  {p.found.includes(d) ? '✔' : '○'} {DEVICES[d].nameTh}
                </Pill>
              ))}
            </div>
          </Section>
          <Section title="Mini quiz">
            <Quiz qs={TWIN_MINI_QUIZ} answers={p.miniAnswers} onAnswer={s.answerMini} />
          </Section>
        </>
      )}
      {m.id === 5 && <TestResults />}
      {m.id === 6 && (
        <Section title="แบบทดสอบ 5 ข้อ">
          <Quiz qs={TWIN_FINAL_QUIZ} answers={p.finalAnswers} onAnswer={s.answerFinal} oneAtATime />
          {p.finalAnswers.every((a) => a !== null) && (
            <div className="mt-3 rounded-xl bg-emerald-900/40 p-3 text-center">
              <p className="mb-2 text-lg font-bold">
                คะแนน {scoreQuiz(TWIN_FINAL_QUIZ, p.finalAnswers)}/{TWIN_FINAL_QUIZ.length}
              </p>
              <Btn variant="primary" onClick={s.finishLab}>
                🎓 ดูผลสรุปและรับใบประกาศ
              </Btn>
            </div>
          )}
        </Section>
      )}
      <Section title="ตัวช่วย">
        <div className="mb-2 flex flex-wrap gap-2">
          <Btn onClick={() => s.setTheory(true)}>📘 ทฤษฎี</Btn>
          <Btn onClick={() => useLab.getState().ask('เริ่มภารกิจนี้ใหม่?', s.resetMission)}>↺ เริ่มภารกิจใหม่</Btn>
          <Btn onClick={() => void s.saveResult()}>💾 บันทึกผล</Btn>
        </div>
        <div className="space-y-2">
          {level >= 1 && <p className="rounded-lg bg-sky-900/40 p-2 text-sm">💡 ใบ้เบา: {m.hints[0]}</p>}
          {level >= 2 && <p className="rounded-lg bg-sky-900/60 p-2 text-sm">🔦 ใบ้ชัด: {m.hints[1]}</p>}
          {level >= 3 && (
            <div className="rounded-lg bg-violet-900/50 p-2 text-sm">
              🧩 เฉลย:{' '}
              {sol ? (
                <Btn variant="primary" onClick={() => useLab.getState().ask('วางตัวอย่างเฉลยแทนของเดิมในส่วนนี้?', () => s.loadSolution(sol))}>
                  วางเฉลยให้ดู
                </Btn>
              ) : (
                <span className="text-slate-300">ภารกิจนี้ไม่มีเฉลยแบบวางให้ ทำตามคำใบ้ด้านบนได้เลย</span>
              )}
            </div>
          )}
          {level < 3 && (
            <Btn variant="ghost" onClick={() => s.useHint()}>
              🙋 ขอคำใบ้ ({['เบา', 'ชัด', 'เฉลย'][level]})
            </Btn>
          )}
        </div>
      </Section>
      <Modal open={s.showTheory} onClose={() => s.setTheory(false)} title={`📘 ทฤษฎี: ${m.theory.title}`}>
        {m.theory.formula && <p className="mb-3 rounded-xl bg-ink-800 p-3 text-center font-mono text-base text-teal-100">{m.theory.formula}</p>}
        <ul className="space-y-2 text-sm text-slate-200">
          {m.theory.body.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}

/* ---------------- sensors ---------------- */
export function TwinSensorsPanel() {
  const s = useTwin()
  const rep = mountReport(s.mounts)
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        หยิบเซนเซอร์ (แตะกล่องบนถาด หรือกดปุ่ม "หยิบ") แล้วแตะจุดบนตัวหุ่นจริง ทุกเซนเซอร์ที่ติดถูกที่จะส่งข้อมูลให้แฝดประกอบร่างขึ้นทีละชิ้น
      </p>
      {s.picked && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/60 bg-amber-900/30 p-2 text-sm">
          <span>✋ ถือ {SENSORS[s.picked].nameTh} อยู่ → แตะจุดบนตัวหุ่น</span>
          <Btn variant="ghost" onClick={() => s.pick(null)}>
            วางคืน
          </Btn>
        </div>
      )}
      {SENSOR_IDS.map((id) => {
        const sp = SENSORS[id]
        const m = rep.sensors.find((x) => x.sensor === id)!
        const cls = m.state === 'ok' ? 'border-emerald-400/60 bg-emerald-950/30' : m.state === 'wrong' ? 'border-amber-400/70 bg-amber-950/30' : 'border-white/10 bg-ink-900/70'
        return (
          <section key={id} className={`rounded-2xl border p-3 ${cls}`}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">
                <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: SENSOR_HEX[id] }} />
                {sp.nameTh}
              </p>
              <div className="flex gap-1">
                {m.at ? (
                  <Btn variant="ghost" onClick={() => s.unmount(id)}>
                    ถอดออก
                  </Btn>
                ) : (
                  <Btn variant={s.picked === id ? 'primary' : 'soft'} onClick={() => s.pick(s.picked === id ? null : id)}>
                    ✋ {s.picked === id ? 'กำลังถือ' : 'หยิบไปติด'}
                  </Btn>
                )}
              </div>
            </div>
            <p className="text-xs text-teal-300">{sp.nameEn}</p>
            <p className="text-sm text-slate-200">
              <b>วัด:</b> {sp.measures}
            </p>
            <p className={`mt-1 text-sm ${m.state === 'ok' ? 'text-emerald-200' : m.state === 'wrong' ? 'text-amber-200' : 'text-slate-300'}`}>
              {m.state === 'ok' ? '✅' : m.state === 'wrong' ? '⚠️' : '○'} {m.message}
            </p>
          </section>
        )
      })}
      <Section title="ร่างแฝดที่ประกอบแล้ว">
        <div className="flex flex-wrap gap-1">
          {(['torso', 'arms', 'pelvis', 'legs', 'head'] as const).map((p) => (
            <Pill key={p} className={rep.parts.includes(p) ? 'bg-cyan-500/25 text-cyan-100' : 'bg-white/5 text-slate-400'}>
              {rep.parts.includes(p) ? '◆' : '◇'} {PART_TH[p]}
            </Pill>
          ))}
        </div>
        {rep.complete && <p className="mt-2 text-sm text-emerald-200">🎉 แฝดดิจิทัลประกอบร่างครบแล้ว! ทุกชิ้นขยับและเปลี่ยนสีตามข้อมูลจริง</p>}
      </Section>
    </div>
  )
}

/* ---------------- data: sampling, aliasing, link ---------------- */
function VibScope({ fs, bearingAmp }: { fs: number; bearingAmp: number }) {
  const W = 320
  const H = 110
  const span = 0.04 // 40 ms window
  const y = (v: number) => H / 2 - (v / 1.6) * (H / 2 - 6)
  const truePts = Array.from({ length: 321 }, (_, i) => {
    const t = (i / 320) * span
    return `${(t / span) * W},${y(vibAt(t, bearingAmp))}`
  }).join(' ')
  const n = Math.floor(span * fs)
  const samples = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / fs
    return [(t / span) * W, y(vibAt(t, bearingAmp))] as const
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-[#071826]" role="img" aria-label="กราฟความสั่น: เส้นเทาคือของจริง จุดม่วงคือค่าที่วัดได้">
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#1e3a4a" />
      <polyline points={truePts} fill="none" stroke="#64748b" strokeWidth={1} />
      {samples.length > 1 && <polyline points={samples.map(([a, b]) => `${a},${b}`).join(' ')} fill="none" stroke="#c084fc" strokeWidth={2} />}
      {samples.map(([a, b], i) => (
        <circle key={i} cx={a} cy={b} r={samples.length > 30 ? 1.6 : 3} fill="#e879f9" />
      ))}
    </svg>
  )
}

export function TwinDataPanel() {
  const s = useTwin()
  const checks = rateChecks(s.rates)
  const util = s.link.util
  const peaks = vibPeaks(s.rates.vib, Math.max(0.6, s.live.truth.bearingAmp))
  const need: Record<string, string> = {
    temp: `อุณหภูมิเปลี่ยนช้ามาก ${SENSORS.temp.minRate} ครั้ง/วินาทีก็พอ`,
    vib: `ต้องถี่กว่า 2 × ${BEARING_HZ} Hz = ${BEARING_HZ * 2} ครั้ง/วินาที (Nyquist)`,
    angle: `อย่างน้อย ${SENSORS.angle.minRate} ครั้ง/วินาที แขนแฝดจึงขยับลื่น`,
    power: `กระแสเปลี่ยนช้า ${SENSORS.power.minRate}–10 ครั้ง/วินาทีก็พอ`,
  }
  const ok = (id: keyof typeof checks) => checks[id]
  return (
    <div className="space-y-3">
      <Section title={`ช่องสัญญาณไร้สาย (ความจุ ${LINK_KBPS} kbps)`}>
        <div className="mb-1 h-4 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(util * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="การใช้ช่องสัญญาณ">
          <div className={`h-full rounded-full ${util > 1 ? 'bg-rose-500' : util > SAFE_UTIL ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, util * 100)}%` }} />
        </div>
        <p className="text-sm">
          ใช้ {s.link.kbps.toFixed(1)} kbps ({Math.round(util * 100)}%) · ดีเลย์ <b className={s.link.latency > 0.2 ? 'text-rose-300' : 'text-emerald-300'}>{s.link.latency.toFixed(2)} วินาที</b>
          {s.link.level === 'overload' && <span className="text-rose-300"> · ข้อมูลล้น! ต่อคิวและหายไป {Math.round(s.link.drop * 100)}%</span>}
        </p>
        <p className="mt-1 text-xs text-slate-400">ข้อมูลต่อวินาที = อัตราการวัด × จำนวนไบต์ × 8 บิต · ควรใช้ไม่เกิน {Math.round(SAFE_UTIL * 100)}% เผื่อไว้</p>
      </Section>
      {SENSOR_IDS.map((id) => (
        <section key={id} className={`rounded-2xl border p-3 ${s.mounts[id] ? (ok(id) ? 'border-emerald-400/40 bg-ink-900/70' : 'border-amber-400/60 bg-amber-950/20') : 'border-white/10 bg-ink-900/40 opacity-70'}`}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
            <p className="text-sm font-bold">
              <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: SENSOR_HEX[id] }} />
              {SENSORS[id].nameTh}
            </p>
            <span className="font-mono text-xs text-slate-300">
              {s.rates[id]} ครั้ง/วิ × {SENSORS[id].bytes} B = {s.mounts[id] ? sensorKbps(id, s.rates[id]).toFixed(2) : '0'} kbps
            </span>
          </div>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`อัตราการวัดของ${SENSORS[id].nameTh}`}>
            {RATE_OPTIONS.map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={s.rates[id] === r}
                onClick={() => s.setRate(id, r)}
                className={`min-h-9 min-w-11 rounded-lg px-2 text-xs font-semibold ${s.rates[id] === r ? 'bg-teal-500 text-on-accent' : 'bg-white/10 text-slate-200 hover:bg-white/15'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className={`mt-1 text-xs ${ok(id) ? 'text-emerald-200' : 'text-amber-200'}`}>
            {ok(id) ? '✅' : '⚠️'} {need[id]}
            {!s.mounts[id] && ' (ยังไม่ได้ติดเซนเซอร์ จึงยังไม่ส่งข้อมูล)'}
          </p>
        </section>
      ))}
      <Section title="ดูความสั่นที่แฝดได้รับ (40 มิลลิวินาที)">
        <VibScope fs={s.rates.vib} bearingAmp={Math.max(0.6, s.live.truth.bearingAmp)} />
        <p className="mt-1 text-xs text-slate-400">เส้นเทา = ความสั่นจริงของเฟือง · เส้นม่วง = สิ่งที่แฝดเห็นจากการวัด {s.rates.vib} ครั้ง/วินาที (แสดงเหมือนลูกปืนเริ่มสึก เพื่อให้เห็นชัด)</p>
        <ul className="mt-2 space-y-1 text-sm">
          {peaks.map((p) => (
            <li key={p.trueHz} className={p.aliased ? 'text-rose-200' : 'text-emerald-200'}>
              {p.aliased ? '❌' : '✅'} {p.name} สั่นจริง {p.trueHz} Hz → แฝดเห็น {p.seenHz.toFixed(0)} Hz{p.aliased ? ' (ความถี่หลอก! Aliasing)' : ''}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-slate-400">
          เฟือง {GEAR_HZ} Hz · ลูกปืน {BEARING_HZ} Hz · แฝดวัดระดับสั่นย่านลูกปืนได้ก็ต่อเมื่อวัดถี่กว่า {BEARING_HZ * 2} ครั้ง/วินาที
        </p>
      </Section>
    </div>
  )
}

/* ---------------- calibration ---------------- */
export function TwinCalibPanel() {
  const s = useTwin()
  const r = s.live.reading
  const tr = s.live.truth
  const angleMounted = s.mounts.angle === 'shoulderR'
  const tempMounted = s.mounts.temp === 'kneeR'
  const mv = tempMv(tr.temp)
  return (
    <div className="space-y-3">
      <Section title="1) ตั้งศูนย์ Encoder ที่ข้อไหล่">
        {!angleMounted && <p className="mb-2 text-sm text-amber-200">⚠️ ติดเซนเซอร์มุมที่ข้อไหล่ขวาก่อน (ภารกิจที่ 2)</p>}
        <div className="mb-2 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-ink-800 p-2">
            <p className="text-xs text-slate-400">แขนจริง</p>
            <p className="font-mono text-xl font-bold">{tr.angle.toFixed(0)}°</p>
          </div>
          <div className="rounded-xl bg-ink-800 p-2">
            <p className="text-xs text-slate-400">ค่าดิบ Encoder</p>
            <p className="font-mono text-xl font-bold">{encoderRaw(tr.angle)}</p>
          </div>
          <div className={`rounded-xl p-2 ${encoderOk(s.encoderOffset) ? 'bg-emerald-900/40' : 'bg-rose-900/40'}`}>
            <p className="text-xs text-slate-400">แขนแฝด</p>
            <p className="font-mono text-xl font-bold">{r.angle === null ? '—' : `${r.angle.toFixed(0)}°`}</p>
          </div>
        </div>
        <p className="mb-2 text-xs text-slate-300">
          ค่าศูนย์ที่จำไว้: <b className="font-mono">{s.encoderOffset}</b> · แฝดคลาดจากของจริง {encoderErrorDeg(s.encoderOffset).toFixed(1)}° · สูตร: มุม = (ค่าดิบ − ค่าศูนย์) × 360 / 4096
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn variant={s.hold ? 'success' : 'soft'} aria-pressed={s.hold} onClick={() => s.setHold(!s.hold)}>
            {s.hold ? '🧍 ยืนท่าเตรียมอยู่ (กดให้เต้นต่อ)' : '🧍 ให้หุ่นยืนท่าเตรียม'}
          </Btn>
          <Btn variant="primary" onClick={s.zeroEncoder} disabled={!angleMounted}>
            🎯 ตั้งศูนย์ Encoder
          </Btn>
        </div>
      </Section>
      <Section title="2) แปลงแรงดันเป็นอุณหภูมิ">
        {!tempMounted && <p className="mb-2 text-sm text-amber-200">⚠️ ติดเซนเซอร์อุณหภูมิที่มอเตอร์เข่าขวาก่อน</p>}
        <div className="mb-2 rounded-xl border border-white/10 bg-ink-800/70 p-2 text-xs text-slate-300">
          📄 <b>Datasheet:</b> เซนเซอร์ให้แรงดัน <b>500 mV ที่ 0 °C</b> และเพิ่ม <b>10 mV ทุก 1 °C</b> · บอร์ดอ่าน ADC 12 บิต (0–4095 = 0–3300 mV)
        </div>
        <div className="mb-2 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-ink-800 p-2">
            <p className="text-xs text-slate-400">ค่า ADC / แรงดัน</p>
            <p className="font-mono text-base font-bold">
              {adcOf(mv)} / {mv.toFixed(0)} mV
            </p>
          </div>
          <div className="rounded-xl bg-ink-800 p-2">
            <p className="text-xs text-slate-400">🌡️ เทอร์โมมิเตอร์อ้างอิง</p>
            <p className="font-mono text-xl font-bold">{tr.temp.toFixed(1)} °C</p>
          </div>
          <div className={`rounded-xl p-2 ${tempCalOk(s.tempCal) ? 'bg-emerald-900/40' : 'bg-rose-900/40'}`}>
            <p className="text-xs text-slate-400">แฝดแสดง</p>
            <p className="font-mono text-xl font-bold">{r.temp === null ? '—' : `${r.temp.toFixed(1)} °C`}</p>
          </div>
        </div>
        <label className="block text-sm">
          แรงดันที่ 0 °C: <b className="font-mono">{s.tempCal.offsetMv} mV</b>
          <input type="range" min={0} max={1000} step={10} value={s.tempCal.offsetMv} onChange={(e) => s.setTempCal({ offsetMv: Number(e.target.value) })} className="h-8 w-full accent-teal-400" />
        </label>
        <label className="block text-sm">
          ความไว: <b className="font-mono">{s.tempCal.mvPerC} mV/°C</b>
          <input type="range" min={1} max={20} step={0.5} value={s.tempCal.mvPerC} onChange={(e) => s.setTempCal({ mvPerC: Number(e.target.value) })} className="h-8 w-full accent-teal-400" />
        </label>
        <p className="mt-1 font-mono text-xs text-slate-300">
          อุณหภูมิ = (mV − {s.tempCal.offsetMv}) / {s.tempCal.mvPerC}
        </p>
      </Section>
      <Section title="3) แฝดตามทันของจริงไหม">
        <p className={`text-sm ${s.link.latency < 0.2 ? 'text-emerald-200' : 'text-rose-200'}`}>
          {s.link.latency < 0.2 ? '✅' : '❌'} ดีเลย์ {s.link.latency.toFixed(2)} วินาที {s.link.latency < 0.2 ? 'แฝดตามทัน' : 'ช้าเกินไป กลับไปลดอัตราการวัดในแท็บข้อมูล'}
        </p>
      </Section>
    </div>
  )
}

/* ---------------- monitoring & challenge ---------------- */
function TestResults() {
  const results = useTwin((s) => s.testResults)
  const score = useTwin((s) => s.progress.testScore)
  const live = useTwin((s) => s.testLive)
  const run = useTwin((s) => s.runTest)
  const list: Checkpoint[] = results ?? live.checkpoints
  return (
    <Section title="ทดสอบแฝด 4 สถานการณ์ (จำลอง 60 วินาทีต่อสถานการณ์)" right={<Btn variant="primary" onClick={run}>🧪 ทดสอบแฝดอัตโนมัติ</Btn>}>
      {score && (
        <p className="mb-2 text-sm font-bold">
          ผลทดสอบล่าสุด: <span className={score.score >= score.total ? 'text-emerald-300' : 'text-amber-300'}>{score.score}/{score.total}</span>
        </p>
      )}
      <ul className="space-y-1.5">
        {list.map((cp) => (
          <li key={cp.id} className={`rounded-lg p-2 text-xs ${cp.pass ? 'bg-emerald-900/40' : 'bg-ink-800'}`}>
            <p className="font-semibold">
              {cp.pass ? '✅' : '⬜'} {cp.th}
            </p>
            {cp.checks.map((c) => (
              <p key={c.th} className={c.ok ? 'text-emerald-200' : 'text-slate-300'}>
                {c.ok ? '✔' : '✘'} {c.th}
              </p>
            ))}
            <p className="mt-0.5 text-slate-400">↳ {cp.note}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

const FAULTS: Array<{ id: Fault; th: string }> = [
  { id: 'overheat', th: '🔥 มอเตอร์เข่าฝืด' },
  { id: 'bearing', th: '⚙️ ลูกปืนสึก' },
  { id: 'lowbatt', th: '🔋 แบตเสื่อม' },
]

export function TwinMonitorPanel() {
  const s = useTwin()
  const r = s.live.reading
  return (
    <div className="space-y-3">
      <Section title="ตั้งเกณฑ์เตือนบนแฝด">
        <label className="block text-sm">
          🌡️ เตือนเมื่อมอเตอร์เข่าร้อนเกิน <b className="font-mono">{s.rules.tempMax} °C</b>
          <input type="range" min={30} max={100} step={1} value={s.rules.tempMax} onChange={(e) => s.setRule('tempMax', Number(e.target.value))} className="h-8 w-full accent-orange-400" />
          <span className="text-xs text-slate-400">ปกติขณะเต้น ≤ 42 °C · เสียหายที่ 85 °C</span>
        </label>
        <label className="mt-2 block text-sm">
          ⚙️ เตือนเมื่อลูกปืนสั่นเกิน <b className="font-mono">{s.rules.vibMax.toFixed(2)} g</b>
          <input type="range" min={0.05} max={1.5} step={0.05} value={s.rules.vibMax} onChange={(e) => s.setRule('vibMax', Number(e.target.value))} className="h-8 w-full accent-purple-400" />
          <span className="text-xs text-slate-400">ลูกปืนดี ~0.07 g · สึกหนักถึง ~0.85 g แล้วแตก</span>
        </label>
        <label className="mt-2 block text-sm">
          🔋 กลับแท่นชาร์จเมื่อแบตต่ำกว่า <b className="font-mono">{s.rules.socMin}%</b>
          <input type="range" min={0} max={60} step={1} value={s.rules.socMin} onChange={(e) => s.setRule('socMin', Number(e.target.value))} className="h-8 w-full accent-yellow-400" />
          <span className="text-xs text-slate-400">ต้องเหลือ ≥ 10% เพื่อเดินกลับเอง · วันปกติแบตไม่ต่ำกว่า 65%</span>
        </label>
      </Section>
      <Section title="ลองเหตุการณ์สด ๆ">
        <p className="mb-2 text-xs text-slate-300">สร้างปัญหาให้หุ่นจริง แล้วดูว่าแฝดเปลี่ยนสีและเตือนทันไหม (เวลาเร่งให้เร็วขึ้น)</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {FAULTS.map((f) => (
            <Btn key={f.id} variant={s.liveFault === f.id ? 'danger' : 'soft'} onClick={() => s.injectFault(f.id)}>
              {f.th}
            </Btn>
          ))}
          <Btn variant="ghost" onClick={s.resetRobot}>
            ↺ รีเซ็ตหุ่น
          </Btn>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-ink-800 p-2">
            🌡️ {r.temp === null ? '—' : `${r.temp.toFixed(1)} °C`}
          </div>
          <div className="rounded-xl bg-ink-800 p-2">
            ⚙️ {r.vib === null ? (s.mounts.vib ? 'วัดไม่ได้' : '—') : `${r.vib.toFixed(2)} g`}
          </div>
          <div className="rounded-xl bg-ink-800 p-2">
            🔋 {r.soc === null ? '—' : `${r.soc.toFixed(0)}%`}
          </div>
        </div>
        {s.live.alerts.length > 0 ? (
          <p className="mt-2 rounded-lg bg-rose-900/60 p-2 text-sm font-semibold text-rose-100">
            ⚠️ {s.live.alerts.map((a) => `${ALERT_TH[a]} → ${ALERT_ACTION[a]}`).join(' · ')}
          </p>
        ) : (
          <p className="mt-2 text-sm text-emerald-200">✅ แฝดยังไม่พบความผิดปกติ</p>
        )}
        {s.progress.current < 5 && <p className="mt-1 text-xs text-slate-400">หุ่นจะหยุดเองเมื่อเตือนตั้งแต่ภารกิจที่ 5</p>}
      </Section>
      <TestResults />
    </div>
  )
}
