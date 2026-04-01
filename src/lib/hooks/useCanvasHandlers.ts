import { useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'

export type CanvasPoint = {
  clientX: number
  clientY: number
}

// Custom hook for canvas interaction handlers
export function useCanvasHandlers() {
  const isDrawingRef = useRef(false)
  const isSpacePressedRef = useRef(false)
  const pointerSequenceActiveRef = useRef(false)
  const zoomRef = useRef(useEditorStore.getState().zoom)
  const panRef = useRef({ x: useEditorStore.getState().panX, y: useEditorStore.getState().panY })
  const canvasRedrawFrameRef = useRef<number | null>(null)
  const minimapRedrawFrameRef = useRef<number | null>(null)
  const skipNextRedrawRef = useRef(false)

  return {
    isDrawingRef,
    isSpacePressedRef,
    pointerSequenceActiveRef,
    zoomRef,
    panRef,
    canvasRedrawFrameRef,
    minimapRedrawFrameRef,
    skipNextRedrawRef,
  }
}