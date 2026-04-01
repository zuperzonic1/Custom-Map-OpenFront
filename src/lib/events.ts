import { useEditorStore } from '../store/editorStore'

// Constants
const MIN_ZOOM = 0.05
const MAX_ZOOM = 6
const BASE_TILE_SIZE = 14

// Clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export type CanvasPoint = {
  clientX: number
  clientY: number
}

// Get tile coordinates from canvas point (using store state directly)
export function getTileFromCanvasPoint(
  store: ReturnType<typeof useEditorStore.getState>,
  point: CanvasPoint,
): { x: number; y: number } | null {
  const tileSize = BASE_TILE_SIZE * store.zoom
  const x = Math.floor((point.clientX - store.panX) / tileSize)
  const y = Math.floor((point.clientY - store.panY) / tileSize)

  if (x < 0 || y < 0 || x >= store.project.width || y >= store.project.height) {
    return null
  }

  return { x, y }
}

// Get tile coordinates from canvas point (with zoom/pan)
export function getTileFromCanvasPointWithZoomPan(
  canvasRect: DOMRect,
  store: ReturnType<typeof useEditorStore.getState>,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const tileSize = BASE_TILE_SIZE * store.zoom
  const localX = clientX - canvasRect.left
  const localY = clientY - canvasRect.top
  const x = Math.floor((localX - store.panX) / tileSize)
  const y = Math.floor((localY - store.panY) / tileSize)

  if (x < 0 || y < 0 || x >= store.project.width || y >= store.project.height) {
    return null
  }

  return { x, y }
}

// Update view from anchor point (for zooming with mouse wheel)
export function updateViewFromAnchor(
  nextZoom: number,
  anchorClientX: number,
  anchorClientY: number,
  canvasRect: DOMRect,
  store: ReturnType<typeof useEditorStore.getState>,
): void {
  const localX = anchorClientX - canvasRect.left
  const localY = anchorClientY - canvasRect.top
  const currentZoom = store.zoom
  const currentPan = { x: store.panX, y: store.panY }
  const tileSize = BASE_TILE_SIZE * currentZoom

  const worldX = (localX - currentPan.x) / tileSize
  const worldY = (localY - currentPan.y) / tileSize

  const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  const nextPanX = localX - worldX * (BASE_TILE_SIZE * clampedZoom)
  const nextPanY = localY - worldY * (BASE_TILE_SIZE * clampedZoom)

  useEditorStore.getState().setZoom(clampedZoom)
  useEditorStore.getState().setPan(nextPanX, nextPanY)
}

// Begin panning interaction
export function beginPan(
  startX: number,
  startY: number,
  store: ReturnType<typeof useEditorStore.getState>,
): { onMove: (e: PointerEvent | MouseEvent) => void; onUp: () => void } {
  const originPan = { x: store.panX, y: store.panY }

  const onMove = (moveEvent: PointerEvent | MouseEvent) => {
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY
    useEditorStore.getState().setPan(originPan.x + dx, originPan.y + dy)
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

// Handle canvas wheel event (zoom)
export function handleCanvasWheel(
  event: React.WheelEvent<HTMLCanvasElement>,
  store: ReturnType<typeof useEditorStore.getState>,
): void {
  event.preventDefault()

  const currentZoom = store.zoom
  const factor = Math.exp(-event.deltaY * 0.001)
  const nextZoom = clamp(currentZoom * factor, MIN_ZOOM, MAX_ZOOM)

  // Get canvas rect for coordinate calculation
  const canvas = (event.target as HTMLCanvasElement) || event.currentTarget
  const canvasRect = canvas.getBoundingClientRect()

  updateViewFromAnchor(nextZoom, event.clientX, event.clientY, canvasRect, store)
}

// Handle canvas pointer down event
export function handleCanvasDown(
  event: React.PointerEvent<HTMLCanvasElement>,
  isDrawingRef: React.MutableRefObject<boolean>,
  isSpacePressedRef: React.MutableRefObject<boolean>,
  pointerSequenceActiveRef: React.MutableRefObject<boolean>,
  skipNextRedrawRef: React.MutableRefObject<boolean>,
  store: ReturnType<typeof useEditorStore.getState>,
): void {
  if (!('pointerId' in event) && pointerSequenceActiveRef.current) {
    return
  }

  event.preventDefault()

  if ('pointerId' in event) {
    pointerSequenceActiveRef.current = true
    ;(event.target as HTMLCanvasElement).setPointerCapture(event.pointerId)
  }

  // Middle click or space+drag = pan
  if (event.button === 1 || isSpacePressedRef.current) {
    isDrawingRef.current = false
    beginPan(event.clientX, event.clientY, store)
    return
  }

  const tile = getTileFromCanvasPoint(store, { clientX: event.clientX, clientY: event.clientY })
  if (!tile) {
    return
  }

  // Nation tool - just place a nation
  if (store.tool === 'nation') {
    skipNextRedrawRef.current = false
    useEditorStore.getState().addNationAt(tile.x, tile.y)
    // Pixi.js will re-render when store changes
    return
  }

  isDrawingRef.current = true
  skipNextRedrawRef.current = true
  useEditorStore.getState().paintAt(tile.x, tile.y)
  // Pixi.js will re-render automatically when store changes via terrain/magnitude updates
}

// Handle canvas pointer move event (during drawing)
export function handleCanvasMove(
  event: React.PointerEvent<HTMLCanvasElement>,
  isDrawingRef: React.MutableRefObject<boolean>,
  pointerSequenceActiveRef: React.MutableRefObject<boolean>,
  skipNextRedrawRef: React.MutableRefObject<boolean>,
  store: ReturnType<typeof useEditorStore.getState>,
): void {
  if (!isDrawingRef.current) {
    return
  }

  if (!('pointerId' in event) && pointerSequenceActiveRef.current) {
    return
  }

  // Don't draw while panning with nation tool
  if (store.tool === 'nation') {
    return
  }

  const tile = getTileFromCanvasPoint(store, { clientX: event.clientX, clientY: event.clientY })
  if (!tile) {
    return
  }

  skipNextRedrawRef.current = true
  useEditorStore.getState().paintAt(tile.x, tile.y)
}

// Handle canvas pointer up event (end drawing)
export function handleCanvasUp(
  event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>,
  isDrawingRef: React.MutableRefObject<boolean>,
  pointerSequenceActiveRef: React.MutableRefObject<boolean>,
  skipNextRedrawRef: React.MutableRefObject<boolean>,
): void {
  if (event.type === 'pointerup' || event.type === 'mouseup') {
    // Clear the reference to release the capture
    ;(event.target as HTMLCanvasElement)?.releasePointerCapture(
      'pointerId' in event ? (event as React.PointerEvent).pointerId : 0,
    )
  }

  isDrawingRef.current = false
  pointerSequenceActiveRef.current = false
  skipNextRedrawRef.current = false
}

// Handle canvas mouse leave (end drawing if mouse leaves canvas)
export function handleCanvasMouseLeave(
  _event: React.MouseEvent<HTMLCanvasElement>,
  isDrawingRef: React.MutableRefObject<boolean>,
  pointerSequenceActiveRef: React.MutableRefObject<boolean>,
): void {
  isDrawingRef.current = false
  pointerSequenceActiveRef.current = false
}
