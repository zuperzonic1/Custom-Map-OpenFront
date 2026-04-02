/**
 * Lightweight viewport store — no Immer, no persist.
 *
 * All hot-path reads (every render frame) and writes (wheel/pointermove)
 * use plain Zustand setState, bypassing the structured-clone overhead of
 * Immer and the base64-serialization overhead of the persist middleware.
 */
import { create } from 'zustand'

export type ViewportState = {
  zoom: number
  panX: number
  panY: number
  viewportWidth: number
  viewportHeight: number
  /** Set true when a newly created/loaded project should be auto-fitted to view. */
  pendingFitToView: boolean
}

/**
 * No action methods — callers use `useViewportStore.setState({ ... })` directly.
 * Plain store with zero middleware = minimal overhead for 60+ FPS pan/zoom.
 */
export const useViewportStore = create<ViewportState>()(() => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 800,
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 600,
  pendingFitToView: true,
}))