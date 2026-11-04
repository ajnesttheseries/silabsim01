/**
 * Draws the "AIoT trainee engineer" activity certificate on a canvas (A4 landscape, 150 dpi).
 * Thai text is rendered by the browser, so the PDF simply embeds the image (no Thai font needed in jsPDF).
 */
const W = 1754
const H = 1240
const FONT = '"Noto Sans Thai", "Leelawadee UI", "Thonburi", sans-serif'

export interface CertData {
  nickname: string
  school: string
  date: Date
  quiz: string
  missions: string
  duration: string
}

const thaiDate = (d: Date) => d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

export async function drawCertificate(d: CertData): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`800 80px ${FONT}`), document.fonts.load(`500 40px ${FONT}`)])
  } catch {
    /* fall back to system font */
  }
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#061233')
  bg.addColorStop(1, '#0b2a5c')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  // circuit traces
  g.strokeStyle = 'rgba(34,211,238,0.12)'
  g.lineWidth = 3
  for (let i = 0; i < 18; i++) {
    const y = 80 + i * 62
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(140 + (i % 4) * 30, y)
    g.lineTo(180 + (i % 4) * 30, y + 30)
    g.stroke()
    g.beginPath()
    g.moveTo(W, y)
    g.lineTo(W - 140 - (i % 3) * 40, y)
    g.lineTo(W - 180 - (i % 3) * 40, y - 30)
    g.stroke()
  }
  g.strokeStyle = '#22d3ee'
  g.lineWidth = 8
  g.strokeRect(50, 50, W - 100, H - 100)
  g.strokeStyle = 'rgba(34,211,238,0.4)'
  g.lineWidth = 2
  g.strokeRect(74, 74, W - 148, H - 148)

  g.textAlign = 'center'
  g.fillStyle = '#7dd3fc'
  g.font = `600 34px ${FONT}`
  g.fillText('Virtual AIoT Lab · ด่านที่ 1 ฮาร์ดแวร์และเซนเซอร์', W / 2, 190)
  g.shadowColor = '#22d3ee'
  g.shadowBlur = 30
  g.fillStyle = '#ffffff'
  g.font = `800 92px ${FONT}`
  g.fillText('ใบประกาศนักวิศวกร AIoT ฝึกหัด', W / 2, 330)
  g.shadowBlur = 0
  g.fillStyle = '#bae6fd'
  g.font = `500 36px ${FONT}`
  g.fillText('ขอมอบให้ไว้เพื่อแสดงว่า', W / 2, 430)
  g.fillStyle = '#fde68a'
  g.font = `800 96px ${FONT}`
  g.fillText(d.nickname || 'นักวิศวกรฝึกหัด', W / 2, 560)
  if (d.school) {
    g.fillStyle = '#e0f2fe'
    g.font = `500 40px ${FONT}`
    g.fillText(d.school, W / 2, 630)
  }
  g.fillStyle = '#e0f2fe'
  g.font = `500 38px ${FONT}`
  g.fillText('ได้ลงมือออกแบบวงจร ติดตั้งเซนเซอร์ อ่านค่าจากสภาพแวดล้อม', W / 2, 730)
  g.fillText('และตั้งเงื่อนไขให้ระบบอัจฉริยะทำงานเอง ในห้องปฏิบัติการเสมือนจริง', W / 2, 785)

  const stats = [
    ['ภารกิจที่ผ่าน', d.missions],
    ['คะแนนแบบทดสอบ', d.quiz],
    ['เวลาที่ใช้', d.duration],
  ]
  stats.forEach(([k, v], i) => {
    const x = W / 2 + (i - 1) * 420
    g.fillStyle = 'rgba(34,211,238,0.12)'
    g.fillRect(x - 180, 850, 360, 130)
    g.fillStyle = '#7dd3fc'
    g.font = `500 30px ${FONT}`
    g.fillText(k, x, 900)
    g.fillStyle = '#ffffff'
    g.font = `800 46px ${FONT}`
    g.fillText(v, x, 960)
  })

  g.fillStyle = '#94a3b8'
  g.font = `500 28px ${FONT}`
  g.fillText(`สาขาวิชาวิศวกรรมระบบอัจฉริยะและนวัตกรรมดิจิทัล · สาย AIoT & Embedded Control Systems Engineer`, W / 2, 1060)
  g.fillText(`วันที่ ${thaiDate(d.date)} · เกียรติบัตรกิจกรรมเรียนรู้ (ไม่ใช่เอกสารรับรองทางการศึกษา)`, W / 2, 1105)
  return c
}

export function downloadCanvasPng(c: HTMLCanvasElement, name: string) {
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function downloadCanvasPdf(c: HTMLCanvasElement, name: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210)
  pdf.save(name)
}
