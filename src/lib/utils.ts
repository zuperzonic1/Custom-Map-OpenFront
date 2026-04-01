import { useEditorStore } from '../store/editorStore'

export const BASE_TILE_SIZE = 14
export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 6

// Clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Get tile color based on terrain type (for rendering)
export function getTileColor(terrain: number, magnitude: number): string {
  if (terrain === 1) {
    // Land - grass-like colors based on elevation/magnitude
    const r = magnitude
    const g = Math.min(255, magnitude + 30)
    const b = Math.min(255, magnitude + 10)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Water - deep blue color (#0b4f6c)
    return '#0b4f6c'
  }
}

// Create a blank terrain array
export function createBlankTerrain(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height)
}

// Get tile coordinates from canvas point (using store state)
export function getTileFromCanvasPoint(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  point: { clientX: number; clientY: number },
): { x: number; y: number } | null {
  const canvas = canvasRef.current
  if (!canvas) return null

  const store = useEditorStore.getState()
  const rect = canvas.getBoundingClientRect()
  const clientX = point.clientX - rect.left
  const clientY = point.clientY - rect.top
  const tileSize = BASE_TILE_SIZE * store.zoom
  const x = Math.floor((clientX - store.panX) / tileSize)
  const y = Math.floor((clientY - store.panY) / tileSize)

  if (x < 0 || y < 0 || x >= store.project.width || y >= store.project.height) {
    return null
  }

  return { x, y }
}

// Begin panning interaction with mouse events
export function beginPan(
  startX: number,
  startY: number,
  panRef: React.MutableRefObject<{ x: number; y: number }>,
): { onMove: (e: PointerEvent | MouseEvent) => void; onUp: () => void } {
  const originPan = { ...panRef.current }

  const onMove = (moveEvent: PointerEvent | MouseEvent) => {
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY
    panRef.current = {
      x: originPan.x + dx,
      y: originPan.y + dy,
    }
    useEditorStore.getState().setPan(panRef.current.x, panRef.current.y)
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove as EventListener)
    window.removeEventListener('mousemove', onMove as EventListener)
    window.removeEventListener('pointerup', onUp as EventListener)
    window.removeEventListener('mouseup', onUp as EventListener)
  }

  window.addEventListener('pointermove', onMove as EventListener)
  window.addEventListener('mousemove', onMove as EventListener)
  window.addEventListener('pointerup', onUp as EventListener)
  window.addEventListener('mouseup', onUp as EventListener)

  return { onMove, onUp }
}

// Update view from anchor point (for zooming with mouse wheel)
export function updateViewFromAnchor(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  nextZoom: number,
  anchorClientX: number,
  anchorClientY: number,
  zoomRef: React.MutableRefObject<number>,
  panRef: React.MutableRefObject<{ x: number; y: number }>,
): void {
  const canvas = canvasRef.current
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const localX = anchorClientX - rect.left
  const localY = anchorClientY - rect.top
  const currentZoom = zoomRef.current
  const currentPan = panRef.current
  const tileSize = BASE_TILE_SIZE * currentZoom

  const worldX = (localX - currentPan.x) / tileSize
  const worldY = (localY - currentPan.y) / tileSize

  const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  const nextPanX = localX - worldX * (BASE_TILE_SIZE * clampedZoom)
  const nextPanY = localY - worldY * (BASE_TILE_SIZE * clampedZoom)

  zoomRef.current = clampedZoom
  panRef.current = { x: nextPanX, y: nextPanY }
  useEditorStore.getState().setZoom(clampedZoom)
  useEditorStore.getState().setPan(nextPanX, nextPanY)
}