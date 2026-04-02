import React, { useEffect, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'

export interface InfoPanelProps {
  onExportMap?: () => void
  exportStatus: string
  exportFiles: string[]
}

export function InfoPanel({
  onExportMap,
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
        <Minimap width={projectWidth} height={projectHeight} nations={projectNations} />
      </div>

      <ExportSection
        onExportMap={onExportMap}
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
  nations: Array<{ id: string; name: string; x: number; y: number }>
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
                <strong>{nation.name}</strong>
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

function Minimap({
  width,
  height,
  nations,
}: {
  width: number
  height: number
  nations: Array<{ id: string; name: string; x: number; y: number }>
}): React.ReactElement {
  const minimapFrameRef = React.useRef<HTMLDivElement | null>(null)
  const minimapRef = useRef<HTMLCanvasElement | null>(null)

  // Cached terrain pixel data — rebuilt only when project content changes.
  const terrainImageDataRef = useRef<ImageData | null>(null)
  const terrainCacheRevisionRef = useRef<number>(-1)

  const renderRevision = useEditorStore((state) => state.renderRevision)
  const zoom = useEditorStore((state) => state.zoom)
  const panX = useEditorStore((state) => state.panX)
  const panY = useEditorStore((state) => state.panY)
  const viewportWidth = useEditorStore((state) => state.viewportWidth)
  const viewportHeight = useEditorStore((state) => state.viewportHeight)

  useEffect(() => {
    const canvas = minimapRef.current
    if (!canvas) return

    const frame = minimapFrameRef.current
    if (!frame) return

    const { width: mapWidth, height: mapHeight } = frame.getBoundingClientRect()
    if (mapWidth === 0 || mapHeight === 0) return

    // Set canvas size based on container with DPR scaling
    const dpr = window.devicePixelRatio || 1
    const canvasW = Math.floor(mapWidth * dpr)
    const canvasH = Math.floor(mapHeight * dpr)

    // Only resize the backing store if dimensions actually changed
    if (canvas.width !== canvasW || canvas.height !== canvasH) {
      canvas.width = canvasW
      canvas.height = canvasH
      canvas.style.width = `${mapWidth}px`
      canvas.style.height = `${mapHeight}px`
      // Force terrain ImageData rebuild on resize (dimensions changed)
      terrainCacheRevisionRef.current = -1
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Scale coordinates → account for DPR
    const scale = Math.min((mapWidth * dpr) / width, (mapHeight * dpr) / height)
    const mapRenderWidth = width * scale
    const mapRenderHeight = height * scale
    const offsetX = Math.floor(((mapWidth * dpr) - mapRenderWidth) / 2)
    const offsetY = Math.floor(((mapHeight * dpr) - mapRenderHeight) / 2)

    const renderW = Math.max(1, Math.round(mapRenderWidth))
    const renderH = Math.max(1, Math.round(mapRenderHeight))

    // Rebuild terrain ImageData only when project content changed or canvas resized.
    if (renderRevision !== terrainCacheRevisionRef.current) {
      const { project } = useEditorStore.getState()
      const imageData = ctx.createImageData(renderW, renderH)
      const data = imageData.data

      for (let py = 0; py < renderH; py += 1) {
        const tileY = Math.floor((py / renderH) * height)
        const rowBase = tileY * width
        for (let px = 0; px < renderW; px += 1) {
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
      terrainCacheRevisionRef.current = renderRevision
    }

    // Composite: clear → terrain → border → nations → viewport indicator.
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (terrainImageDataRef.current) {
      ctx.putImageData(terrainImageDataRef.current, offsetX, offsetY)
    }

    // Map border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(offsetX, offsetY, renderW, renderH)

    // Nation markers
    nations.forEach((nation) => {
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

    // Viewport indicator — white rect showing the currently visible area.
    // When fully zoomed out the rect equals the minimap bounds → white border.
    const tileLeft = -panX / (TILE_SIZE * zoom)
    const tileTop  = -panY / (TILE_SIZE * zoom)
    const tilesWide = viewportWidth  / (TILE_SIZE * zoom)
    const tilesHigh = viewportHeight / (TILE_SIZE * zoom)

    const vx1 = offsetX + (tileLeft / width) * renderW
    const vy1 = offsetY + (tileTop  / height) * renderH
    const vx2 = offsetX + ((tileLeft + tilesWide) / width) * renderW
    const vy2 = offsetY + ((tileTop  + tilesHigh) / height) * renderH

    // Clamp to minimap bounds
    const cx1 = Math.max(offsetX, vx1)
    const cy1 = Math.max(offsetY, vy1)
    const cx2 = Math.min(offsetX + renderW, vx2)
    const cy2 = Math.min(offsetY + renderH, vy2)

    if (cx2 > cx1 && cy2 > cy1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(cx1 + 0.5, cy1 + 0.5, cx2 - cx1 - 1, cy2 - cy1 - 1)
    }
  }, [width, height, nations, renderRevision, zoom, panX, panY, viewportWidth, viewportHeight])

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
  exportStatus,
  exportFiles,
}: {
  onExportMap?: () => void
  exportStatus: string
  exportFiles: string[]
}): React.ReactElement {
  return (
    <div className="status-card">
      <h3>Export</h3>
      <p>{exportStatus}</p>
      {onExportMap && (
        <button type="button" className="secondary" onClick={onExportMap}>
          Export ZIP
        </button>
      )}
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