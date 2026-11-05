# ส่งต่องาน (Handoff) — branch `wip/curriculum-fixes`

> ✅ **อัปเดต 5 พ.ย. 2026:** งานทั้งหมดในเอกสารนี้ทำเสร็จแล้ว ดูผลลัพธ์ที่ [`DELIVERY_REPORT.md`](DELIVERY_REPORT.md) เอกสารนี้เก็บไว้เป็นบันทึกเท่านั้น

**สำหรับคุณ:** ถ้าจะให้ Claude ทำต่อบน Cloud ให้เปิด claude.ai/code → เลือก repo `ajnesttheseries/silabsim01` → เลือก branch `wip/curriculum-fixes` แล้วพิมพ์ว่า:

> อ่าน `docs/HANDOFF.md` แล้วทำงานที่เหลือให้เสร็จ

**สถานะตอน handoff:** commit `cf49ea0` · type-check ผ่าน · unit test 78 ข้อผ่าน · ยังไม่ merge เข้า `main` (เว็บที่ deploy อยู่ไม่ถูกแตะ)

ทำเสร็จแล้วใน branch นี้:
- ข้อความ 5 สายอาชีพและด้านย่อยใช้ตามหลักสูตรจริง (`src/content.ts`) และแก้ชื่อด่าน 2–3 ของสาย AV เป็น "เซนเซอร์และปัญญาประดิษฐ์ (Sensing & AI)" และ "การจำลองและประเมินระบบ (Simulation & Evaluation)"
- การ์ด "🎓 ในหลักสูตร SI" ในทุกภารกิจของทั้งสองแล็บ (`src/ui/CurriculumCard.tsx`, `AIOT_LINKS` / `AV_LINKS`)
- โจทย์ "บ้านสัตว์เลี้ยงอัจฉริยะ" ฝั่ง engine: สถานการณ์ทดสอบ วงจรเฉลย และขั้นตอนโหมดพาทำ

---

## Brief for the Claude session that continues (English)

Work on branch `wip/curriculum-fixes`. Do **not** merge to `main`. Finish here, then open a PR to `main` for the user to review.

### 1. AIoT "smart pet home" challenge (`'pet'`): finish the UI and tests

Done already: `Challenge` type, `SCENARIOS.pet` (4 situations with `motion`), the reference circuit `SOLUTIONS.pet` (5V bus `BUS5V` on column 30, shared by the fan driver and the PIR), mission 5 checks and hints in `src/engine/missions.ts`, and the guided steps (`pirBlock`, `bus5v`) in `src/engine/guide.ts`.

To do:
- Add the option to the chooser in `Mission5Extras` (`src/ui/panels/MissionPanel.tsx`). Label it "🐱 บ้านสัตว์เลี้ยงอัจฉริยะ": too hot → fan on; pet walks by → welcome light on. List the parts: DHT, PIR (5V), LED, driver + fan.
- Add rule templates in `RulesPanel` for `challenge === 'pet'`: temp > 32 → fan, and motion detected → `ledGreen`.
- In the Staff table, map `'pet'` to `บ้านสัตว์เลี้ยง`.
- Show the motion reading in the scenario results, if that is easy.
- Tests:
  - `SOLUTIONS.pet()` validates with no error or danger issues.
  - `runScenarioTests('pet', SOLUTIONS.pet(), rules)` scores 4/4.
  - A guided walkthrough of mission 5 with challenge `'pet'` reaches 4/4. Use the `walk()` helper pattern in `src/engine/guide.test.ts`; `act()` must handle installing the `pir`.
  - Existing classroom tests still pass. Its reference circuit now gets 5V via `BUS5V`.

### 2. AV "interactive exhibit" challenge (alternative for mission 5)

Mission 5 offers a choice between `'concert'` (the existing cue list) and `'exhibit'`. Persist the choice in the AV store.

Framing: a music museum. The figure on stage is the exhibit. A motion sensor detects visitors. Two scenes, each with the same fields as a `Cue` (without time):
- **idle:** PAR ≤ 30% (> 0), mover off, wall `'logo'`, narration (the `mic` field) mute.
- **visitor:** mover spotlight on the exhibit (`SINGER_SPOT`), PAR amber or white ≥ 50%, wall in a new `'info'` mode (draw an exhibit info card in `LedWall`), narration live. Narration needs a working audio chain without feedback; reuse `micWorks` logic from `runShowTest`.

To do:
- `runExhibitTest(scenes, addresses, patch, mixer)` in `src/av/engine/show.ts`: 2 checkpoints through the real `rigOutput` DMX path; pass = 2/2.
- A presence toggle in the show tab that applies the scene in the sim, so students see it live.
- Mission 5 objectives per challenge, guided steps per challenge, hints, a hint level 3 solution, and `AV_LINKS[5]` text mentioning Sensing & AI.
- Tests in `src/av/engine/av.test.ts`: the solution scenes pass 2/2; factory DMX addresses fail the spotlight check.

### 3. Light theme (default) with a toggle

- Add `theme: 'light' | 'dark'` to `useLab`, persisted, default `'light'`. Toggle it in the settings menus of both labs and in the landing header.
- In `App.tsx`, set the class `light` on `<html>`.
- CSS: generate an `html.light { ... }` block that maps each Tailwind palette colour shade to its mirror (50↔950, 100↔900, 200↔800, 300↔700, 400↔600, 500 stays). Take the literal values from `node_modules/tailwindcss/theme.css` with a small script, to avoid `var()` cycles. Also remap `--color-white` (to a dark ink), `--color-black`, and the custom `--color-ink-*`. Override `.glass`, the `body` background and `.neon-text` for light.
- Keep both 3D canvases unchanged. The concert stage must stay dark so the lights read.
- Check contrast of the key screens: landing, both lab panels, quiz, summary and staff.

### 4. Verify

- `npm test` and `npm run build` must pass.
- If a browser is available, check both labs in light and dark mode at desktop and 375×812 widths.

### 5. Deliverables (the user will review these)

- Update `README.md`: the new challenges, the light theme, curriculum alignment, the feature status table and test counts.
- Write `docs/DELIVERY_REPORT.md` in Thai:
  - What was built, per lab.
  - Curriculum mapping per career and per mission.
  - Test results.
  - Not verified: iOS Safari and real phones, actual sound playback, Supabase against a real database, tapping AV ports in the 3D scene.
  - Next steps: labs for the other 3 careers under one shared theme (e.g. a smart theme park or museum that makes people and animals happier), Edge AI and Cloud stages, Sensing & AI and Simulation stages.
- Commit, push the branch, and open the PR.

### Notes

- Dev-only `window.__lab`, `__sim` and `__guide` hooks are in `src/main.tsx` and are stripped from production builds.
- The staff PIN defaults to `2468`.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- End PR descriptions with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
