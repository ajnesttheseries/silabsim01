import { create } from 'zustand'
import type { V3 } from './layout'

/** Transient pointer state for the 3D scene (not persisted, changes at pointer rate). */
interface InteractState {
  ghostAnchor: string | null
  dragging: boolean
  /** armed = pointer is down on something draggable, waiting to see if it moves */
  armed: { kind: 'shelf' | 'comp'; id: string; x: number; y: number } | null
  pointer: V3 | null
  hoverLabel: { text: string; pos: V3 } | null
  /** camera-controls instance, disabled while dragging parts */
  controls: { enabled: boolean } | null
  set(p: Partial<Omit<InteractState, 'set'>>): void
}

export const useInteract = create<InteractState>((set) => ({
  controls: null,
  ghostAnchor: null,
  dragging: false,
  armed: null,
  pointer: null,
  hoverLabel: null,
  set: (p) => set(p),
}))

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
