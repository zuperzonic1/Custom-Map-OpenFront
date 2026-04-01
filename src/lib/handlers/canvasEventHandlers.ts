import { useEditorStore } from '../../store/editorStore'

// Store state type - extracted from editorStore.ts
type EditorStoreState = {
  project: {
    name: string
    width: number
    height: number
    terrain: Uint8Array
    magnitude: Uint8Array
    nations: Array<{ id: string; name: string; x: number; y: number }>
    metadata: { author: string; description: string }
  }
  tool: 'land' | 'water' | 'elevation' | 'nation'
  brushSize: number
  elevationValue: number
  nationName: string
  zoom: number
  panX: number
  panY: number
  renderRevision: number
}

export type CanvasPoint = {
  clientX: number
  clientY: number
}

// Constants
const MIN_ZOOM = 0.05
const MAX_ZOOM = 6

// Clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export type CanvasHandlers = {
  canvasRef: React.RefObject<HTMLCanvasElement>
  isDrawingRef: React.MutableRefObject<boolean>
  pointerSequenceActiveRef: React.MutableRefObject<boolean>
  skipNextRedrawRef: React.MutableRefObject<boolean>
  zoomRef: React.MutableRefObject<number>
  panRef: React.MutableRefObject<{ x: number; y: number }>
  redrawCanvas: () => void
}

// Get the current map state from store
export function getMapState(store: EditorStoreState) {
  return store.project
}

// Get tile coordinates from canvas point
export function getTileFromCanvasPoint(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  point: CanvasPoint,
): { x: number; y: number } | null {
  const canvas = canvasRef.current
  if (!canvas) return null

  const store = useEditorStore.getState()
  const rect = canvas.getBoundingClientRect()
  const clientX = point.clientX - rect.left
  const clientY = point.clientY - rect.top
  const tileSize = 14 * store.zoom
  const x = Math.floor((clientX - store.panX) / tileSize)
  const y = Math.floor((clientY - store.panY) / tileSize)

  if (x < 0 || y < 0 || x >= store.project.width || y >= store.project.height) {
    return null
  }

  return { x, y }
}

// Get tile coordinates from canvas point (with zoom/pan)
export function getTileFromCanvasPointWithZoomPan(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  store: EditorStoreState,
  point: CanvasPoint,
): { x: number; y: number } | null {
  const canvas = canvasRef.current
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  const clientX = point.clientX - rect.left
  const clientY = point.clientY - rect.top
  const tileSize = 14 * store.zoom
  const x = Math.floor((clientX - store.panX) / tileSize)
  const y = Math.floor((clientY - store.panY) / tileSize)

  if (x < 0 || y < 0 || x >= store.project.width || y >= store.project.height) {
    return null
  }

  return { x, y }
}

// Draw a single tile immediately to canvas (for feedback during drawing)
export function drawTileImmediately(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  tileX: number,
  tileY: number,
): void {
  const canvas = canvasRef.current
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const store = useEditorStore.getState()
  const tileSize = 14 * store.zoom
  const drawGrid = tileSize >= 6
  const brushRadius = Math.max(0, store.brushSize - 1)
  const dpr = window.devicePixelRatio || 1

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  for (let y = tileY - brushRadius; y <= tileY + brushRadius; y += 1) {
    if (y < 0 || y >= store.project.height) continue

    for (let x = tileX - brushRadius; x <= tileX + brushRadius; x += 1) {
      if (x < 0 || x >= store.project.width) continue

      const drawX = store.panX + x * tileSize
      const drawY = store.panY + y * tileSize

      const terrainIndex = y * store.project.width + x
      ctx.fillStyle = getTileColor(store.project.terrain[terrainIndex], store.project.magnitude[terrainIndex])
      ctx.fillRect(drawX, drawY, tileSize, tileSize)

      if (drawGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.strokeRect(drawX, drawY, tileSize, tileSize)
      }
    }
  }

  // TODO: invalidate chunk cache - need access to chunk functions
}

function getTileColor(terrain: number, magnitude: number): string {
  if (terrain === 1) {
    const r = magnitude
    const g = Math.min(255, magnitude + 30)
    const b = Math.min(255, magnitude + 10)
    return `rgb(${r}, ${g}, ${b})`
  }
  return '#0b4f6c'
}

// Begin panning interaction
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
  const tileSize = 14 * currentZoom

  const worldX = (localX - currentPan.x) / tileSize
  const worldY = (localY - currentPan.y) / tileSize

  const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  const nextPanX = localX - worldX * (14 * clampedZoom)
  const nextPanY = localY - worldY * (14 * clampedZoom)

  zoomRef.current = clampedZoom
  panRef.current = { x: nextPanX, y: nextPanY }
  useEditorStore.getState().setZoom(clampedZoom)
  useEditorStore.getState().setPan(nextPanX, nextPanY)
}