import * as THREE from 'three'
import { BOARD_PINS } from '../engine/circuit/board'

export const FONT = '"Noto Sans Thai", "Leelawadee UI", "Thonburi", system-ui, sans-serif'
export const MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace'

const cache = new Map<string, THREE.CanvasTexture>()

export function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  cache.set(key, t)
  // re-draw once web fonts are ready so Thai labels use the intended font
  if (typeof document !== 'undefined' && document.fonts && document.fonts.status !== 'loaded') {
    void document.fonts.ready.then(() => {
      g.clearRect(0, 0, w, h)
      draw(g, w, h)
      t.needsUpdate = true
    })
  }
  return t
}

export function labelTexture(text: string, opts: { bg?: string; fg?: string; sub?: string; w?: number; h?: number } = {}) {
  const w = opts.w ?? 512
  const h = opts.h ?? 160
  return canvasTexture(`label:${text}:${opts.sub}:${opts.bg}:${w}x${h}`, w, h, (g) => {
    g.fillStyle = opts.bg ?? '#0e2247'
    roundRect(g, 4, 4, w - 8, h - 8, 22)
    g.fill()
    g.strokeStyle = 'rgba(34,211,238,0.8)'
    g.lineWidth = 6
    g.stroke()
    g.fillStyle = opts.fg ?? '#e6f6ff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const big = opts.sub ? h * 0.36 : h * 0.44
    g.font = `700 ${big}px ${FONT}`
    fitText(g, text, w - 40, big, 700)
    g.fillText(text, w / 2, opts.sub ? h * 0.4 : h / 2)
    if (opts.sub) {
      g.font = `500 ${h * 0.2}px ${FONT}`
      g.fillStyle = 'rgba(200,235,255,0.85)'
      fitText(g, opts.sub, w - 40, h * 0.2, 500)
      g.fillText(opts.sub, w / 2, h * 0.75)
    }
  })
}

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight: number) {
  let s = size
  g.font = `${weight} ${s}px ${FONT}`
  while (g.measureText(text).width > maxW && s > 10) {
    s -= 2
    g.font = `${weight} ${s}px ${FONT}`
  }
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Neon room sign. */
export function signTexture() {
  return canvasTexture('sign', 2048, 360, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `800 150px ${FONT}`
    g.shadowColor = '#22d3ee'
    g.shadowBlur = 40
    g.fillStyle = '#b9f5ff'
    g.fillText('AIoT & Embedded Systems Lab', w / 2, h * 0.42)
    g.shadowBlur = 18
    g.font = `600 64px ${FONT}`
    g.fillStyle = '#7dd3fc'
    g.fillText('ห้องปฏิบัติการวิศวกรรม AIoT และสมองกลฝังตัว', w / 2, h * 0.84)
  })
}

/** Silkscreen for the microcontroller board, matching layout.boardPinPos(). */
export function boardTexture(w: number, l: number) {
  const px = 128
  return canvasTexture('board-silk', Math.round(w * px), Math.round(l * px), (g, cw, ch) => {
    g.fillStyle = '#0d3b2e'
    g.fillRect(0, 0, cw, ch)
    g.strokeStyle = 'rgba(180,255,220,0.25)'
    g.lineWidth = 2
    for (let i = 0; i < 9; i++) {
      g.beginPath()
      g.moveTo(cw * 0.3, ch * (0.25 + i * 0.06))
      g.lineTo(cw * 0.7, ch * (0.28 + i * 0.06))
      g.stroke()
    }
    g.fillStyle = '#f4fff9'
    g.textBaseline = 'middle'
    g.font = `700 ${px * 0.13}px ${MONO}`
    for (const p of BOARD_PINS) {
      const z = (0.35 + p.index * 0.2) * px
      const label = p.power ? (p.power === 'GND' ? 'GND' : p.power) : `G${p.gpio}`
      if (p.side === 'L') {
        g.textAlign = 'left'
        g.fillStyle = p.power === 'GND' ? '#cbd5e1' : p.power ? '#fca5a5' : p.adc === 'ADC1' ? '#fde68a' : '#f4fff9'
        g.fillText(label, 0.2 * px, z)
      } else {
        g.textAlign = 'right'
        g.fillStyle = p.power === 'GND' ? '#cbd5e1' : p.power ? '#fca5a5' : '#f4fff9'
        g.fillText(label, cw - 0.2 * px, z)
      }
    }
    g.textAlign = 'center'
    g.fillStyle = '#9ff0d0'
    g.font = `700 ${px * 0.12}px ${FONT}`
    g.fillText('AIoT DevBoard', cw / 2, ch * 0.93)
    g.font = `500 ${px * 0.08}px ${FONT}`
    g.fillText('3.3V · WiFi · ADC 12-bit', cw / 2, ch * 0.97)
  })
}

/** Grille pattern for the DHT housing. */
export function grilleTexture() {
  return canvasTexture('grille', 128, 160, (g, w, h) => {
    g.fillStyle = '#f2f5f8'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#9aa7b4'
    for (let y = 18; y < h - 30; y += 18) for (let x = 14; x < w - 8; x += 22) g.fillRect(x, y, 12, 9)
    g.fillStyle = '#334155'
    g.font = `700 16px ${MONO}`
    g.textAlign = 'center'
    g.fillText('T/RH', w / 2, h - 12)
  })
}

export function ldrTexture() {
  return canvasTexture('ldr', 128, 128, (g, w, h) => {
    g.fillStyle = '#e8d6a0'
    g.beginPath()
    g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#c2410c'
    g.lineWidth = 7
    g.beginPath()
    for (let i = 0; i < 7; i++) {
      const y = 24 + i * 12
      g.moveTo(26, y)
      g.lineTo(102, y)
    }
    g.stroke()
  })
}

export function pirTexture() {
  return canvasTexture('pir', 128, 128, (g, w, h) => {
    g.fillStyle = '#f8fafc'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#cbd5e1'
    g.lineWidth = 3
    for (let i = 0; i < w; i += 14) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, h)
      g.stroke()
      g.beginPath()
      g.moveTo(0, i)
      g.lineTo(w, i)
      g.stroke()
    }
  })
}

/** Text panel for module pin labels. */
export function pinLabelTexture(labels: string[], bg = '#1e3a8a') {
  return canvasTexture(`pins:${labels.join('|')}:${bg}`, 256, 64, (g, w, h) => {
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `700 22px ${MONO}`
    labels.forEach((l, i) => g.fillText(l, ((i + 0.5) / labels.length) * w, h / 2))
  })
}
