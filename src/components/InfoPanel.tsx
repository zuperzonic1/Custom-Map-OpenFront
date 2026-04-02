import React, { useEffect, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useViewportStore } from '../store/viewportStore'

export interface InfoPanelProps {
  onExportMap?: () => void
  onExportPng?: () => void
  exportStatus: string
  exportFiles: string[]
}

export function InfoPanel({
  onExportMap,
  onExportPng,
  exportStatus,
  exportFiles,
}: InfoPanelProps): React.ReactElement {
  const projectWidth = useEditorStore((state) => state.project.width)
  const projectHeight = useEditorStore((state) => state.project.height)
  const projectNations = useEditorStore((state) => state.project.nations)

  return (
    <aside className="panel info">
      <h2>Map metadata</h2>

      <MetadataSection />
      <NationsSection nations={projectNations} />

      <div className="status-card minimap-card">
        <Minimap width={projectWidth} height={projectHeight} />
      </div>

      <ExportSection
        onExportMap={onExportMap}
        onExportPng={onExportPng}
        exportStatus={exportStatus}
        exportFiles={exportFiles}
      />
    </aside>
  )
}

function MetadataSection(): React.ReactElement {
  const projectMetadataAuthor = useEditorStore((state) => state.project.metadata.author)
  const projectMetadataDescription = useEditorStore((state) => state.project.metadata.description)
  const setProjectMetadata = useEditorStore((state) => state.setProjectMetadata)

  return (
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
  )
}

function NationsSection({
  nations,
}: {
  nations: Array<{ id: string; name: string; countryCode?: string; x: number; y: number }>
}): React.ReactElement {
  const removeNation = useEditorStore((state) => state.removeNation)

  return (
    <div className="status-card">
      <h3>Nations</h3>
      {nations.length === 0 ? (
        <p className="empty-state">No nations placed yet.</p>
      ) : (
        <ul className="nations-list">
          {nations.map((nation) => (
              <li key={nation.id} className="nation-row">
                <div>
                  <strong>
                    {nation.name} [{nation.countryCode || 'US'}]
                  </strong>
                  <span>
                    {nation.x}, {nation.y}
                  </span>
                </div>
                <button type="button" className="secondary" onClick={() => removeNation(nation.id)}>
                  Remove
                </button>
              </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Pre-computed water RGBA bytes
const WATER_R = 0x0b
const WATER_G = 0x4f
const WATER_B = 0x6c

/** Must stay in sync with BASE_TILE_SIZE in pixiMapRenderer.tsx */
const TILE_SIZE = 14

type MinimapMetrics = { offsetX: number; offsetY: number; renderW: number; renderH: number; scale: number }

function Minimap({
  width,
  height,
}: {
  width: number
  height: number
}): React.ReactElement {
  const minimapFrameRef = React.useRef<HTMLDivElement | null>(null)
  const minimapRef = useRef<HTMLCanvasElement | null>(null)

  // Stable metrics shared between the sizing code and the draw callback.
  const metricsRef = useRef<MinimapMetrics>({ offsetX: 0, offsetY: 0, renderW: 1, renderH: 1, scale: 1 })

  // Cached terrain ImageData — rebuilt only when renderRevision changes.
  const terrainImageDataRef = useRef<ImageData | null>(null)
  const terrainRevisionRef = useRef<number>(-1)

  // All drawing runs inside a Zustand subscription + rAF loop — no React
  // re-renders on pan / zoom / paint.
  useEffect(() => {
    const canvas = minimapRef.current
    const frame = minimapFrameRef.current
    if (!canvas || !frame) return

    let rafId: number | null = null

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx || canvas.width === 0) return

      const state = useEditorStore.getState()
      const { offsetX, offsetY, renderW, renderH, scale } = metricsRef.current

      // Rebuild terrain ImageData only when project content changed.
      if (state.renderRevision !== terrainRevisionRef.current) {
        const { project } = state
        const imageData = ctx.createImageData(renderW, renderH)
        const data = imageData.data
        for (let py = 0; py < renderH; py++) {
          const tileY = Math.floor((py / renderH) * height)
          const rowBase = tileY * width
          for (let px = 0; px < renderW; px++) {
            const tileX = Math.floor((px / renderW) * width)
            const srcIdx = rowBase + tileX
            const t = project.terrain[srcIdx] ?? 0
            const m = project.magnitude[srcIdx] ?? 0
            const dstIdx = (py * renderW + px) * 4
            if (t === 1) {
              data[dstIdx]     = m
              data[dstIdx + 1] = m + 30 > 255 ? 255 : m + 30
              data[dstIdx + 2] = m + 10 > 255 ? 255 : m + 10
              data[dstIdx + 3] = 255
            } else {
              data[dstIdx]     = WATER_R
              data[dstIdx + 1] = WATER_G
              data[dstIdx + 2] = WATER_B
              data[dstIdx + 3] = 255
            }
          }
        }
        terrainImageDataRef.current = imageData
        terrainRevisionRef.current = state.renderRevision
      }

      // Composite: background → terrain → border → nations → viewport rect.
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (terrainImageDataRef.current) {
        ctx.putImageData(terrainImageDataRef.current, offsetX, offsetY)
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(offsetX, offsetY, renderW, renderH)

      state.project.nations.forEach((nation) => {
        ctx.beginPath()
        ctx.fillStyle = '#f97316'
        ctx.arc(
          offsetX + ((nation.x + 0.5) / width) * renderW,
          offsetY + ((nation.y + 0.5) / height) * renderH,
          Math.max(2, scale * 0.25),
          0,
          Math.PI * 2,
        )
        ctx.fill()
      })

      // Viewport indicator — white rect tracking the visible area.
      // Fully zoomed out → rect equals minimap bounds → white border.
      const { zoom, panX, panY, viewportWidth, viewportHeight } = useViewportStore.getState()
      const tileLeft  = -panX / (TILE_SIZE * zoom)
      const tileTop   = -panY / (TILE_SIZE * zoom)
      const tilesWide = viewportWidth  / (TILE_SIZE * zoom)
      const tilesHigh = viewportHeight / (TILE_SIZE * zoom)

      const vx1 = offsetX + (tileLeft / width) * renderW
      const vy1 = offsetY + (tileTop  / height) * renderH
      const vx2 = offsetX + ((tileLeft + tilesWide) / width) * renderW
      const vy2 = offsetY + ((tileTop  + tilesHigh) / height) * renderH

      const cx1 = Math.max(offsetX, vx1)
      const cy1 = Math.max(offsetY, vy1)
      const cx2 = Math.min(offsetX + renderW, vx2)
      const cy2 = Math.min(offsetY + renderH, vy2)

      if (cx2 > cx1 && cy2 > cy1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 1.5
        ctx.strokeRect(cx1 + 0.5, cy1 + 0.5, cx2 - cx1 - 1, cy2 - cy1 - 1)
      }
    }

    /** Size the canvas to the frame, recompute metrics, then draw. */
    const sizeAndDraw = () => {
      const { width: fw, height: fh } = frame.getBoundingClientRect()
      if (fw === 0 || fh === 0) return

      const dpr = window.devicePixelRatio || 1
      const cw = Math.floor(fw * dpr)
      const ch = Math.floor(fh * dpr)

      // Always recompute metrics so that tile-dimension changes (new map size)
      // are reflected even when the container pixel size hasn't changed.
      const s = Math.min((fw * dpr) / width, (fh * dpr) / height)
      const rW = Math.max(1, Math.round(width * s))
      const rH = Math.max(1, Math.round(height * s))
      const ox = Math.floor(((fw * dpr) - rW) / 2)
      const oy = Math.floor(((fh * dpr) - rH) / 2)

      const prev = metricsRef.current
      const metricsChanged =
        canvas.width !== cw ||
        canvas.height !== ch ||
        prev.renderW !== rW ||
        prev.renderH !== rH ||
        prev.offsetX !== ox ||
        prev.offsetY !== oy

      if (metricsChanged) {
        canvas.width = cw
        canvas.height = ch
        canvas.style.width = `${fw}px`
        canvas.style.height = `${fh}px`
        metricsRef.current = { offsetX: ox, offsetY: oy, renderW: rW, renderH: rH, scale: s }
        // Metrics changed — force full terrain ImageData rebuild.
        terrainRevisionRef.current = -1
      }

      draw()
    }

    /** Schedule at most one draw per animation frame. */
    const schedule = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => { rafId = null; sizeAndDraw() })
    }

    // Subscribe to BOTH stores so minimap updates on terrain changes AND viewport changes.
    // The rAF guard ensures at most one canvas composite per frame.
    const unsub1 = useEditorStore.subscribe(schedule)
    const unsub2 = useViewportStore.subscribe(schedule)
    schedule() // draw immediately on mount / map-dimension change

    return () => {
      unsub1()
      unsub2()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }, [width, height]) // re-run only when the map tile dimensions change

  return (
    <div
      ref={minimapFrameRef}
      className="minimap-frame"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <canvas ref={minimapRef} className="minimap-canvas" aria-label="Project minimap" />
    </div>
  )
}

function ExportSection({
  onExportMap,
  onExportPng,
  exportStatus,
  exportFiles,
}: {
  onExportMap?: () => void
  onExportPng?: () => void
  exportStatus: string
  exportFiles: string[]
}): React.ReactElement {
  return (
    <div className="status-card">
      <h3>Export</h3>
      <p>{exportStatus}</p>
      <div className="button-group">
        {onExportMap && (
          <button type="button" className="secondary" onClick={onExportMap}>
            Map Files
          </button>
        )}
        {onExportPng && (
          <button type="button" className="secondary" onClick={onExportPng}>
            PNG
          </button>
        )}
      </div>
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
  )
}
