import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useLab } from '../store/lab'
import { Btn } from './common'

export function appUrl() {
  return location.href.split('#')[0]
}

export function useQr(text: string, size = 360) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, { width: size, margin: 1, color: { dark: '#050b1f', light: '#ffffff' } })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [text, size])
  return src
}

/** Presenter mode: large text + QR code of the app URL for students to scan. */
export function PresenterOverlay() {
  const presenter = useLab((s) => s.presenter)
  const setPresenter = useLab((s) => s.setPresenter)
  const [collapsed, setCollapsed] = useState(false)
  const url = appUrl()
  const qr = useQr(url)
  if (!presenter) return null
  const local = /localhost|127\.0\.0\.1/.test(url)
  return (
    <div className="fixed bottom-4 left-4 z-[55] max-w-[min(92vw,380px)]">
      {collapsed ? (
        <Btn variant="primary" onClick={() => setCollapsed(false)}>
          📱 แสดง QR
        </Btn>
      ) : (
        <div className="glass anim-pop rounded-3xl p-4 text-center">
          <p className="mb-2 text-lg font-bold text-cyan-100">สแกนเพื่อเข้าแล็บบนมือถือ</p>
          {qr ? <img src={qr} alt={`QR code ของ ${url}`} className="mx-auto w-56 rounded-xl bg-white p-2" /> : <p className="text-sm">กำลังสร้าง QR…</p>}
          <p className="mt-2 break-all font-mono text-xs text-cyan-200">{url}</p>
          {local && <p className="mt-1 text-xs text-amber-300">⚠️ URL นี้เป็น localhost มือถือจะเปิดไม่ได้ ให้ deploy ขึ้นเว็บหรือเปิดด้วย IP ของเครื่องในวง WiFi เดียวกัน</p>}
          <div className="mt-3 flex justify-center gap-2">
            <Btn variant="ghost" onClick={() => setCollapsed(true)}>
              ย่อ
            </Btn>
            <Btn variant="soft" onClick={() => setPresenter(false)}>
              ออกจากโหมดนำเสนอ
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
