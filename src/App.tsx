import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react'
import { useLab } from './store/lab'
import { ConfirmDialog, Toasts } from './ui/common'
import { Landing } from './ui/Landing'
import { PresenterOverlay } from './ui/Presenter'

const LabPage = lazy(() => import('./ui/LabPage'))
const Summary = lazy(() => import('./ui/Summary'))
const Staff = lazy(() => import('./ui/Staff'))
const AvLabPage = lazy(() => import('./av/ui/AvLabPage'))
const AvSummary = lazy(() => import('./av/ui/AvSummary'))

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error(error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="glass max-w-md rounded-3xl p-6 text-center">
          <div className="mb-2 text-4xl">🛠️</div>
          <h1 className="mb-2 text-xl font-bold text-cyan-100">ขออภัย เกิดข้อผิดพลาดในแล็บ</h1>
          <p className="mb-4 text-sm text-slate-300">ข้อมูลความคืบหน้าถูกบันทึกไว้แล้ว ลองโหลดหน้าใหม่อีกครั้ง ถ้ายังไม่หาย ให้ลองเปลี่ยนเบราว์เซอร์เป็น Chrome, Edge หรือ Safari รุ่นล่าสุด</p>
          <pre className="mb-4 max-h-24 overflow-auto rounded-lg bg-black/40 p-2 text-left text-xs text-rose-300">{String(this.state.error.message)}</pre>
          <button className="min-h-11 rounded-xl bg-cyan-500 px-4 font-bold text-slate-950" onClick={() => location.reload()}>
            โหลดหน้าใหม่
          </button>
        </div>
      </div>
    )
  }
}

function PageLoading({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        <p className="text-sm text-cyan-100">{text}</p>
      </div>
    </div>
  )
}

export default function App() {
  const route = useLab((s) => s.route)
  const presenter = useLab((s) => s.presenter)
  const setRoute = useLab((s) => s.setRoute)

  useEffect(() => {
    document.documentElement.classList.toggle('presenter', presenter)
  }, [presenter])

  // #staff opens the staff page directly (e.g. bookmarked by the event team)
  useEffect(() => {
    const onHash = () => {
      if (location.hash === '#staff') setRoute('staff')
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [setRoute])

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoading text="กำลังโหลด..." />}>
        {route === 'landing' && <Landing />}
        {route === 'lab' && <LabPage />}
        {route === 'summary' && <Summary />}
        {route === 'staff' && <Staff />}
        {route === 'av' && <AvLabPage />}
        {route === 'avsummary' && <AvSummary />}
      </Suspense>
      <PresenterOverlay />
      <Toasts />
      <ConfirmDialog />
    </ErrorBoundary>
  )
}
