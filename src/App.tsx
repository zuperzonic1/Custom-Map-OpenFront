import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import './App.css'
import { buildExportBundle, downloadBlob } from './lib/exportMap'
import {
  CHUNK_SIZE,
  getChunkCanvas,
  invalidateAllChunkCache,
  invalidateChunkCacheForRect,
} from './lib/tileChunkCache'
import { useEditorStore } from './store/editorStore'

const BASE_TILE_SIZE = 14
const MINIMAP_WIDTH = 240
const MINIMAP_HEIGHT = 160
const MIN_ZOOM = 0.05
const MAX_ZOOM = 6

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

type CanvasInteractionEvent =
  | React.PointerEvent<HTMLCanvasElement>
  | React.MouseEvent<HTMLCanvasElement>

type CanvasPoint = {
  clientX: number
  clientY: number
}

function colorFor(terrain: number, magnitude: number) {
  if (terrain === 1) {
    return `rgb(${magnitude}, ${Math.min(255, magnitude + 30)}, ${Math.min(255, magnitude + 10)})`
  }

  return '#0b4f6c'
}

function App(): React.ReactElement {
  const projectWidth = useEditorStore((state) => state.project.width)
  const projectHeight = useEditorStore((state) => state.project.height)
  const projectName = useEditorStore((state) => state.project.name)
  const projectNations = useEditorStore((state) => state.project.nations)
  const projectMetadataAuthor = useEditorStore((state) => state.project.metadata.author)
  const projectMetadataDescription = useEditorStore((state) => state.project.metadata.description)
  const renderRevision = useEditorStore((state) => state.renderRevision)
  const tool = useEditorStore((state) => state.tool)
  const brushSize = useEditorStore((state) => state.brushSize)
  const elevationValue = useEditorStore((state) => state.elevationValue)
  const nationName = useEditorStore((state) => state.nationName)
  const zoom = useEditorStore((state) => state.zoom)
  const panX = useEditorStore((state) => state.panX)
  const panY = useEditorStore((state) => state.panY)
  const createBlankProject = useEditorStore((state) => state.createBlankProject)
  const setTool = useEditorStore((state) => state.setTool)
  const setBrushSize = useEditorStore((state) => state.setBrushSize)
  const setElevationValue = useEditorStore((state) => state.setElevationValue)
  const setNationName = useEditorStore((state) => state.setNationName)
  const setZoom = useEditorStore((state) => state.setZoom)
  const setPan = useEditorStore((state) => state.setPan)
  const paintAt = useEditorStore((state) => state.paintAt)
  const addNationAt = useEditorStore((state) => state.addNationAt)
  const removeNation = useEditorStore((state) => state.removeNation)
  const setProjectName = useEditorStore((state) => state.setProjectName)
  const setProjectMetadata = useEditorStore((state) => state.setProjectMetadata)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const minimapRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const widthInputRef = useRef<HTMLInputElement | null>(null)
  const heightInputRef = useRef<HTMLInputElement | null>(null)

  const isDrawingRef = useRef(false)
  const isSpacePressedRef = useRef(false)
  const pointerSequenceActiveRef = useRef(false)
  const zoomRef = useRef(zoom)
  const panRef = useRef({ x: panX, y: panY })
  const canvasRedrawFrameRef = useRef<number | null>(null)
  const minimapRedrawFrameRef = useRef<number | null>(null)
  const skipNextRedrawRef = useRef(false)
  const fpsFrameRef = useRef<number | null>(null)
  const fpsSamplesRef = useRef(0)
  const fpsLastTickRef = useRef(0)

  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 640 })
  const [exportStatus, setExportStatus] = useState('Idle')
  const [exportFiles, setExportFiles] = useState<string[]>([])
  const [fps, setFps] = useState(0)

  useLayoutEffect(() => {
    zoomRef.current = zoom
    panRef.current = { x: panX, y: panY }
  }, [zoom, panX, panY])

  useEffect(() => {
    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
    setZoom(1)
    setPan(0, 0)
  }, [setPan, setZoom])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      const { width, height } = entry.contentRect
      setCanvasSize({
        width: Math.max(320, Math.floor(width)),
        height: Math.max(240, Math.floor(height)),
      })
    })

    observer.observe(frame)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const tick = (now: number) => {
      if (fpsLastTickRef.current === 0) {
        fpsLastTickRef.current = now
      }

      fpsSamplesRef.current += 1
      const elapsed = now - fpsLastTickRef.current

      if (elapsed >= 1000) {
        setFps(Math.round((fpsSamplesRef.current * 1000) / elapsed))
        fpsSamplesRef.current = 0
        fpsLastTickRef.current = now
      }

      fpsFrameRef.current = requestAnimationFrame(tick)
    }

    fpsFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (fpsFrameRef.current != null) {
        cancelAnimationFrame(fpsFrameRef.current)
        fpsFrameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isEditableTarget =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)

      if (event.code === 'Space' && !isEditableTarget) {
        event.preventDefault()
        isSpacePressedRef.current = true
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        isSpacePressedRef.current = false
      }
    }

    const stopInteraction = () => {
      isDrawingRef.current = false
      pointerSequenceActiveRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mouseup', stopInteraction)
    window.addEventListener('pointerup', stopInteraction)
    window.addEventListener('blur', stopInteraction)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mouseup', stopInteraction)
      window.removeEventListener('pointerup', stopInteraction)
      window.removeEventListener('blur', stopInteraction)
    }
  }, [])

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const pixelW = Math.floor(canvasSize.width * dpr)
    const pixelH = Math.floor(canvasSize.height * dpr)
    const canvasAny = canvas as HTMLCanvasElement & { __lastPixelSize?: { w: number; h: number } }
    const last = canvasAny.__lastPixelSize

    if (!last || last.w !== pixelW || last.h !== pixelH) {
      canvas.width = pixelW
      canvas.height = pixelH
      canvas.style.width = `${canvasSize.width}px`
      canvas.style.height = `${canvasSize.height}px`
      canvasAny.__lastPixelSize = { w: pixelW, h: pixelH }
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const state = useEditorStore.getState()
    const currentZoom = state.zoom
    const currentPan = { x: state.panX, y: state.panY }
    const tileSize = BASE_TILE_SIZE * currentZoom
    const visibleStartX = clamp(Math.floor(-currentPan.x / tileSize) - 1, 0, state.project.width)
    const visibleStartY = clamp(Math.floor(-currentPan.y / tileSize) - 1, 0, state.project.height)
    const visibleEndX = clamp(Math.ceil((canvasSize.width - currentPan.x) / tileSize) + 1, 0, state.project.width)
    const visibleEndY = clamp(Math.ceil((canvasSize.height - currentPan.y) / tileSize) + 1, 0, state.project.height)

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

    const visibleChunkStartX = Math.floor(visibleStartX / CHUNK_SIZE)
    const visibleChunkStartY = Math.floor(visibleStartY / CHUNK_SIZE)
    const visibleChunkEndX = Math.floor(Math.max(0, visibleEndX - 1) / CHUNK_SIZE)
    const visibleChunkEndY = Math.floor(Math.max(0, visibleEndY - 1) / CHUNK_SIZE)

    for (let chunkY = visibleChunkStartY; chunkY <= visibleChunkEndY; chunkY += 1) {
      for (let chunkX = visibleChunkStartX; chunkX <= visibleChunkEndX; chunkX += 1) {
        const chunkCanvas = getChunkCanvas(state.project, chunkX, chunkY)
        const startX = chunkX * CHUNK_SIZE
        const startY = chunkY * CHUNK_SIZE
        const drawX = currentPan.x + startX * tileSize
        const drawY = currentPan.y + startY * tileSize
        const drawWidth = chunkCanvas.width * tileSize
        const drawHeight = chunkCanvas.height * tileSize

        ctx.drawImage(chunkCanvas, 0, 0, chunkCanvas.width, chunkCanvas.height, drawX, drawY, drawWidth, drawHeight)
      }
    }

    const drawGrid = tileSize >= 6
    if (drawGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      for (let y = visibleStartY; y < visibleEndY; y += 1) {
        for (let x = visibleStartX; x < visibleEndX; x += 1) {
          const drawX = currentPan.x + x * tileSize
          const drawY = currentPan.y + y * tileSize
          ctx.strokeRect(drawX, drawY, tileSize, tileSize)
        }
      }
    }

    state.project.nations.forEach((nation) => {
      const drawX = currentPan.x + nation.x * tileSize + tileSize / 2
      const drawY = currentPan.y + nation.y * tileSize + tileSize / 2

      ctx.beginPath()
      ctx.fillStyle = '#f97316'
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 2
      ctx.arc(drawX, drawY, Math.max(5, tileSize * 0.18), 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      if (tileSize >= 6) {
        ctx.fillStyle = '#f8fafc'
        ctx.font = '12px Inter, system-ui, sans-serif'
        ctx.fillText(nation.name, drawX + 8, drawY - 8)
      }
    })

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.lineWidth = 2
    ctx.strokeRect(currentPan.x, currentPan.y, state.project.width * tileSize, state.project.height * tileSize)

    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
    ctx.fillRect(16, 16, 280, 96)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '600 14px Inter, system-ui, sans-serif'
    ctx.fillText(`${state.project.name}`, 28, 40)
    ctx.font = '12px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(`Map: ${state.project.width} × ${state.project.height}`, 28, 60)
    ctx.fillText(`Tiles: ${state.project.width * state.project.height}`, 28, 78)
    ctx.fillText(`Tool: ${state.tool} | Brush: ${state.brushSize} | Zoom: ${state.zoom.toFixed(2)}x`, 28, 96)
    ctx.fillText(`Nations: ${state.project.nations.length}`, 28, 114)
  }, [canvasSize.height, canvasSize.width])

  useEffect(() => {
    if (skipNextRedrawRef.current) {
      skipNextRedrawRef.current = false
      return
    }

    if (canvasRedrawFrameRef.current != null) {
      cancelAnimationFrame(canvasRedrawFrameRef.current)
      canvasRedrawFrameRef.current = null
    }

    canvasRedrawFrameRef.current = requestAnimationFrame(() => {
      canvasRedrawFrameRef.current = null
      redrawCanvas()
    })

    return () => {
      if (canvasRedrawFrameRef.current != null) {
        cancelAnimationFrame(canvasRedrawFrameRef.current)
        canvasRedrawFrameRef.current = null
      }
    }
  }, [
    brushSize,
    canvasSize.height,
    canvasSize.width,
    projectWidth,
    projectHeight,
    projectName,
    projectNations,
    renderRevision,
    tool,
    zoom,
    panX,
    panY,
    redrawCanvas,
  ])

  useEffect(() => {
    if (minimapRedrawFrameRef.current != null) {
      cancelAnimationFrame(minimapRedrawFrameRef.current)
      minimapRedrawFrameRef.current = null
    }

    minimapRedrawFrameRef.current = requestAnimationFrame(() => {
      minimapRedrawFrameRef.current = null

      const canvas = minimapRef.current
      if (!canvas) {
        return
      }

      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(MINIMAP_WIDTH * dpr)
      canvas.height = Math.floor(MINIMAP_HEIGHT * dpr)
      canvas.style.width = `${MINIMAP_WIDTH}px`
      canvas.style.height = `${MINIMAP_HEIGHT}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      const state = useEditorStore.getState()

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT)
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT)

      const scale = Math.min(
        (MINIMAP_WIDTH - 16) / state.project.width,
        (MINIMAP_HEIGHT - 16) / state.project.height,
      )
      const mapWidth = state.project.width * scale
      const mapHeight = state.project.height * scale
      const offsetX = (MINIMAP_WIDTH - mapWidth) / 2
      const offsetY = (MINIMAP_HEIGHT - mapHeight) / 2

      const fallbackScale = Math.max(1, scale)

      for (let y = 0; y < state.project.height; y += 1) {
        for (let x = 0; x < state.project.width; x += 1) {
          const index = y * state.project.width + x
          const terrain = state.project.terrain[index] ?? 0
          const magnitude = state.project.magnitude[index] ?? 0

          ctx.fillStyle = colorFor(terrain, magnitude)
          ctx.fillRect(
            offsetX + x * fallbackScale,
            offsetY + y * fallbackScale,
            Math.max(1, fallbackScale),
            Math.max(1, fallbackScale),
          )
        }
      }

      state.project.nations.forEach((nation) => {
        ctx.beginPath()
        ctx.fillStyle = '#f97316'
        ctx.arc(
          offsetX + (nation.x + 0.5) * scale,
          offsetY + (nation.y + 0.5) * scale,
          Math.max(2, scale * 0.15),
          0,
          Math.PI * 2,
        )
        ctx.fill()
      })

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.strokeRect(offsetX, offsetY, mapWidth, mapHeight)
    })

    return () => {
      if (minimapRedrawFrameRef.current != null) {
        cancelAnimationFrame(minimapRedrawFrameRef.current)
        minimapRedrawFrameRef.current = null
      }
    }
  }, [projectWidth, projectHeight, projectNations, renderRevision])

  const getTileFromCanvasPoint = (point: CanvasPoint) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return null
    }

    const state = useEditorStore.getState()
    const rect = canvas.getBoundingClientRect()
    const clientX = point.clientX - rect.left
    const clientY = point.clientY - rect.top
    const currentZoom = state.zoom
    const currentPan = { x: state.panX, y: state.panY }
    const size = BASE_TILE_SIZE * currentZoom
    const x = Math.floor((clientX - currentPan.x) / size)
    const y = Math.floor((clientY - currentPan.y) / size)

    if (x < 0 || y < 0 || x >= state.project.width || y >= state.project.height) {
      return null
    }

    return { x, y }
  }

  const drawTileImmediately = (tileX: number, tileY: number) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const state = useEditorStore.getState()
    const currentZoom = state.zoom
    const currentPan = { x: state.panX, y: state.panY }
    const tileSize = BASE_TILE_SIZE * currentZoom
    const drawGrid = tileSize >= 6
    const brushRadius = Math.max(0, state.brushSize - 1)
    const dpr = window.devicePixelRatio || 1

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    for (let y = tileY - brushRadius; y <= tileY + brushRadius; y += 1) {
      if (y < 0 || y >= state.project.height) {
        continue
      }

      for (let x = tileX - brushRadius; x <= tileX + brushRadius; x += 1) {
        if (x < 0 || x >= state.project.width) {
          continue
        }

        const drawX = currentPan.x + x * tileSize
        const drawY = currentPan.y + y * tileSize

        ctx.fillStyle = colorFor(
          state.project.terrain[y * state.project.width + x] ?? 0,
          state.project.magnitude[y * state.project.width + x] ?? 0,
        )
        ctx.fillRect(drawX, drawY, tileSize, tileSize)

        if (drawGrid) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
          ctx.strokeRect(drawX, drawY, tileSize, tileSize)
        }
      }
    }

    invalidateChunkCacheForRect(
      state.project,
      tileX - brushRadius,
      tileY - brushRadius,
      tileX + brushRadius,
      tileY + brushRadius,
    )
  }

  const updateViewFromAnchor = (nextZoom: number, anchorClientX: number, anchorClientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    const localX = anchorClientX - rect.left
    const localY = anchorClientY - rect.top
    const currentZoom = zoomRef.current
    const currentPan = panRef.current
    const worldX = (localX - currentPan.x) / (BASE_TILE_SIZE * currentZoom)
    const worldY = (localY - currentPan.y) / (BASE_TILE_SIZE * currentZoom)
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const nextPanX = localX - worldX * (BASE_TILE_SIZE * clampedZoom)
    const nextPanY = localY - worldY * (BASE_TILE_SIZE * clampedZoom)

    zoomRef.current = clampedZoom
    panRef.current = { x: nextPanX, y: nextPanY }
    setZoom(clampedZoom)
    setPan(nextPanX, nextPanY)
  }

  const beginPan = (startX: number, startY: number) => {
    const originPan = { ...panRef.current }

    const onMove = (moveEvent: PointerEvent | MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      const nextPan = {
        x: originPan.x + dx,
        y: originPan.y + dy,
      }

      panRef.current = nextPan
      setPan(nextPan.x, nextPan.y)
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
  }

  const handleCanvasWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()

    const currentZoom = zoomRef.current
    const factor = Math.exp(-event.deltaY * 0.001)
    const nextZoom = clamp(currentZoom * factor, MIN_ZOOM, MAX_ZOOM)
    updateViewFromAnchor(nextZoom, event.clientX, event.clientY)
  }

  const handleZoomSliderChange = (value: number) => {
    const clamped = clamp(value, MIN_ZOOM, MAX_ZOOM)
    zoomRef.current = clamped
    flushSync(() => {
      setZoom(clamped)
    })
  }

  const handleCanvasDown = (event: CanvasInteractionEvent) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    if (!('pointerId' in event) && pointerSequenceActiveRef.current) {
      return
    }

    event.preventDefault()

    if ('pointerId' in event) {
      pointerSequenceActiveRef.current = true
      canvas.setPointerCapture(event.pointerId)
    }

    if (event.button === 1 || isSpacePressedRef.current) {
      isDrawingRef.current = false
      beginPan(event.clientX, event.clientY)
      return
    }

    const tile = getTileFromCanvasPoint(event)
    if (!tile) {
      return
    }

    if (tool === 'nation') {
      skipNextRedrawRef.current = false
      addNationAt(tile.x, tile.y)
      window.requestAnimationFrame(() => redrawCanvas())
      return
    }

    isDrawingRef.current = true
    skipNextRedrawRef.current = true
    paintAt(tile.x, tile.y)
    drawTileImmediately(tile.x, tile.y)

    const onMove = (moveEvent: PointerEvent | MouseEvent) => {
      if (!isDrawingRef.current) {
        return
      }

      if (!('pointerId' in moveEvent) && pointerSequenceActiveRef.current) {
        return
      }

      const moveTile = getTileFromCanvasPoint(moveEvent)
      if (!moveTile) {
        return
      }

      skipNextRedrawRef.current = true
      paintAt(moveTile.x, moveTile.y)
      drawTileImmediately(moveTile.x, moveTile.y)
    }

    const onUp = () => {
      isDrawingRef.current = false
      pointerSequenceActiveRef.current = false
      skipNextRedrawRef.current = false

      window.removeEventListener('mousemove', onMove as EventListener)
      window.removeEventListener('pointermove', onMove as EventListener)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('blur', onUp)
    }

    window.addEventListener('mousemove', onMove as EventListener)
    window.addEventListener('pointermove', onMove as EventListener)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('blur', onUp)
  }

  const handleCanvasMove = (event: CanvasInteractionEvent) => {
    if (!isDrawingRef.current) {
      return
    }

    if (!('pointerId' in event) && pointerSequenceActiveRef.current) {
      return
    }

    if (tool === 'nation') {
      return
    }

    const tile = getTileFromCanvasPoint(event)
    if (!tile) {
      return
    }

    skipNextRedrawRef.current = true
    paintAt(tile.x, tile.y)
    drawTileImmediately(tile.x, tile.y)
  }

  const handleCanvasUp = () => {
    isDrawingRef.current = false
    pointerSequenceActiveRef.current = false
    skipNextRedrawRef.current = false
  }

  const resetProject = () => {
    skipNextRedrawRef.current = false
    setNationName('Spawn 1')
    setElevationValue(128)
    setExportStatus('Idle')
    setExportFiles([])
    invalidateAllChunkCache()
    createBlankProject(projectWidth, projectHeight)
    redrawCanvas()
  }

  const handleCreateBlankMap = () => {
    const nextWidth = Math.max(1, Math.floor(Number(widthInputRef.current?.value ?? projectWidth)))
    const nextHeight = Math.max(1, Math.floor(Number(heightInputRef.current?.value ?? projectHeight)))

    skipNextRedrawRef.current = false
    setExportStatus('Idle')
    setExportFiles([])
    invalidateAllChunkCache()
    createBlankProject(nextWidth, nextHeight)
    redrawCanvas()
  }

  const handleExportMap = async () => {
    setExportStatus('Preparing export...')

    try {
      const { project } = useEditorStore.getState()
      const bundle = await buildExportBundle(project, minimapRef.current)
      downloadBlob(bundle.zipBlob, `${project.name || 'openfront-map'}.zip`)
      setExportFiles(bundle.fileNames)
      setExportStatus('Export complete')
    } catch {
      setExportStatus('Export failed')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">OpenFront map editor</p>
          <h1>Sprint 1 foundation</h1>
          <p className="eyebrow">Sprint 2: editor depth</p>
        </div>

        <div className="topbar-actions">
          <label className="field field-inline">
            <span>Name</span>
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <button type="button" className="secondary" onClick={resetProject}>
            Reset map
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="panel controls">
          <h2>Tools</h2>

          <div className="button-group tool-grid">
            <button
              type="button"
              className={tool === 'land' ? 'active' : ''}
              onClick={() => setTool('land')}
            >
              Land
            </button>
            <button
              type="button"
              className={tool === 'water' ? 'active' : ''}
              onClick={() => setTool('water')}
            >
              Water
            </button>
            <button
              type="button"
              className={tool === 'elevation' ? 'active' : ''}
              onClick={() => setTool('elevation')}
            >
              Elevation
            </button>
            <button
              type="button"
              className={tool === 'nation' ? 'active' : ''}
              onClick={() => setTool('nation')}
            >
              Nation
            </button>
          </div>

          <label className="field">
            <span>Brush size</span>
            <input
              type="range"
              min="1"
              max="10"
              value={brushSize}
              onInput={(event) => setBrushSize(Number(event.currentTarget.value))}
              onChange={(event) => setBrushSize(Number(event.currentTarget.value))}
            />
            <strong>{brushSize}</strong>
          </label>

          <label className="field">
            <span>Elevation</span>
            <input
              type="range"
              min="0"
              max="255"
              value={elevationValue}
              onInput={(event) => setElevationValue(Number(event.currentTarget.value))}
              onChange={(event) => setElevationValue(Number(event.currentTarget.value))}
            />
            <strong>{elevationValue}</strong>
          </label>

          <label className="field">
            <span>Nation name</span>
            <input
              value={nationName}
              onChange={(event) => setNationName(event.target.value)}
              placeholder="Spawn 1"
            />
          </label>

          <label className="field">
            <span>Zoom</span>
            <input
              type="range"
              min="0.05"
              max="6"
              step="0.05"
              value={zoom}
              onInput={(event) => handleZoomSliderChange(Number(event.currentTarget.value))}
              onChange={(event) => handleZoomSliderChange(Number(event.currentTarget.value))}
            />
            <strong>{zoom.toFixed(2)}x</strong>
          </label>

          <div className="status-card">
            <h3>Map size</h3>
            <div className="size-grid">
              <label className="field">
                <span>Width</span>
                <input
                  key={`width-${projectWidth}-${projectHeight}`}
                  ref={widthInputRef}
                  type="number"
                  min="1"
                  max="512"
                  defaultValue={projectWidth}
                />
              </label>
              <label className="field">
                <span>Height</span>
                <input
                  key={`height-${projectWidth}-${projectHeight}`}
                  ref={heightInputRef}
                  type="number"
                  min="1"
                  max="512"
                  defaultValue={projectHeight}
                />
              </label>
            </div>
            <button type="button" className="secondary" onClick={handleCreateBlankMap}>
              New blank map
            </button>
          </div>

          <div className="status-card">
            <h3>Project</h3>
            <dl>
              <div>
                <dt>Width</dt>
                <dd>{projectWidth}</dd>
              </div>
              <div>
                <dt>Height</dt>
                <dd>{projectHeight}</dd>
              </div>
              <div>
                <dt>Tiles</dt>
                <dd>{projectWidth * projectHeight}</dd>
              </div>
              <div>
                <dt>Nations</dt>
                <dd>{projectNations.length}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <main className="canvas-shell">
          <div className="canvas-frame" ref={frameRef}>
            <canvas
              ref={canvasRef}
              onWheel={handleCanvasWheel}
              onPointerDown={handleCanvasDown}
              onPointerMove={handleCanvasMove}
              onPointerUp={handleCanvasUp}
              onPointerCancel={handleCanvasUp}
              onMouseDown={handleCanvasDown}
              onMouseMove={handleCanvasMove}
              onMouseUp={handleCanvasUp}
              onMouseLeave={handleCanvasUp}
            />
            <div className="fps-counter" aria-label="Frames per second">
              FPS {fps}
            </div>
          </div>

          <div className="footer-note">
            <span>Drag to paint.</span>
            <span>Hold Space and drag to pan.</span>
            <span>Nation tool places spawn points.</span>
          </div>
        </main>

        <aside className="panel info">
          <h2>Map metadata</h2>

          <div className="status-card">
            <h3>Metadata</h3>
            <label className="field">
              <span>Author</span>
              <input
                value={projectMetadataAuthor}
                onChange={(event) => setProjectMetadata('author', event.target.value)}
                placeholder="Author name"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={projectMetadataDescription}
                onChange={(event) => setProjectMetadata('description', event.target.value)}
                placeholder="Map description"
                rows={4}
              />
            </label>
          </div>

          <div className="status-card">
            <h3>Nations</h3>
            {projectNations.length === 0 ? (
              <p className="empty-state">No nations placed yet.</p>
            ) : (
              <ul className="nations-list">
                {projectNations.map((nation) => (
                  <li key={nation.id} className="nation-row">
                    <div>
                      <strong>{nation.name}</strong>
                      <span>
                        {nation.x}, {nation.y}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeNation(nation.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="status-card">
            <h3>Minimap</h3>
            <canvas ref={minimapRef} className="minimap-canvas" aria-label="Project minimap" />
          </div>

          <div className="status-card">
            <h3>Export</h3>
            <p>{exportStatus}</p>
            <button type="button" className="secondary" onClick={() => void handleExportMap()}>
              Export ZIP
            </button>
            {exportFiles.length > 0 ? (
              <ul className="nations-list export-list">
                {exportFiles.map((fileName) => (
                  <li key={fileName} className="nation-row">
                    <span>{fileName}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="status-card">
            <h3>Next sprint</h3>
            <p>Elevation brush, nation placement, metadata form, minimap, and validation.</p>
          </div>
        </aside>
      </section>
    </div>
  )
}

export default App