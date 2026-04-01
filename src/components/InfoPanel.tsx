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

function NationsSection({ nations }: { nations: Array<{ id: string; name: string; x: number; y: number }> }): React.ReactElement {
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
  )
}

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

  // Simple canvas drawing for minimap using requestAnimationFrame
  useEffect(() => {
    const canvas = minimapRef.current
    if (!canvas) return

    const frame = minimapFrameRef.current
    if (!frame) return

    const { width: mapWidth, height: mapHeight } = frame.getBoundingClientRect()
    
    // Set canvas size based on container with DPR scaling
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(mapWidth * dpr)
    canvas.height = Math.floor(mapHeight * dpr)
    canvas.style.width = `${mapWidth}px`
    canvas.style.height = `${mapHeight}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Scale for DPR
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

    // Clear and fill background
    ctx.clearRect(0, 0, mapWidth, mapHeight)
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, mapWidth, mapHeight)

    const scale = Math.min(mapWidth / width, mapHeight / height)
    const mapRenderWidth = width * scale
    const mapRenderHeight = height * scale
    const offsetX = (mapWidth - mapRenderWidth) / 2
    const offsetY = (mapHeight - mapRenderHeight) / 2

    // Get terrain data from store
    const { project } = useEditorStore.getState()
    
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        const terrain = project.terrain[index] ?? 0
        const magnitude = project.magnitude[index] ?? 0

        ctx.fillStyle = getTerrainColor(terrain, magnitude)
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, Math.max(1, scale), Math.max(1, scale))
      }
    }

    // Draw nations
    nations.forEach((nation) => {
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

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.strokeRect(offsetX, offsetY, mapRenderWidth, mapRenderHeight)
  }, [width, height, nations])

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

function getTerrainColor(terrain: number, magnitude: number): string {
  if (terrain === 1) {
    const r = magnitude
    const g = Math.min(255, magnitude + 30)
    const b = Math.min(255, magnitude + 10)
    return `rgb(${r}, ${g}, ${b})`
  }
  return '#0b4f6c'
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