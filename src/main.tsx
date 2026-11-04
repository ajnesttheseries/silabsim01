import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { sim, useLab } from './store/lab'

// dev-only handle for scripted end-to-end checks; stripped from production builds
if (import.meta.env.DEV) {
  Object.assign(window, { __lab: useLab, __sim: sim })
  void import('./ui/guide').then((m) => Object.assign(window, { __guide: m.useGuideView }))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
