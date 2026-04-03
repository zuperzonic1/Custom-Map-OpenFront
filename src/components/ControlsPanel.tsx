import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore, MAX_LAND_TILES } from '../store/editorStore'
import { useViewportStore } from '../store/viewportStore'

export interface ControlsPanelProps {
  onResetMap?: () => void
  onCreateBlankMap: (width: number, height: number) => void
}

export function ControlsPanel({
  onResetMap,
  onCreateBlankMap,
}: ControlsPanelProps): React.ReactElement {
  const projectWidth = useEditorStore((state) => state.project.width)
  const projectHeight = useEditorStore((state) => state.project.height)
  const tool = useEditorStore((state) => state.tool)

  return (
    <aside className="panel controls">
      <div className="tools-header">
        <h2>Tools</h2>
        <ShortcutsButton />
      </div>

      <ToolButtons />

      {tool !== 'nation' && <BrushSizeControl />}
      {tool !== 'nation' && <ElevationControl />}
      <NationPlacementHelp />
      <ZoomControl />

      <MapSizePanel
        width={projectWidth}
        height={projectHeight}
        onCreateBlankMap={onCreateBlankMap}
      />

      <ProjectInfoPanel
        width={projectWidth}
        height={projectHeight}
      />

      {onResetMap && (
        <div className="status-card">
          <button type="button" className="secondary" onClick={onResetMap}>
            Reset map
          </button>
        </div>
      )}
    </aside>
  )
}

function ToolButtons(): React.ReactElement {
  const tool = useEditorStore((state) => state.tool)
  const setTool = useEditorStore((state) => state.setTool)

  return (
    <div className="button-group tool-grid">
      <ToolButton label="Land" active={tool === 'land'} onClick={() => setTool('land')} />
      <ToolButton label="Water" active={tool === 'water'} onClick={() => setTool('water')} />
      <ToolButton label="Nation" active={tool === 'nation'} onClick={() => setTool('nation')} />
    </div>
  )
}

function ToolButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      className={active ? 'active' : ''}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function BrushSizeControl(): React.ReactElement {
  const brushSize = useEditorStore((state) => state.brushSize)
  const setBrushSize = useEditorStore((state) => state.setBrushSize)

  return (
    <label className="field">
      <span>Brush size</span>
      <input
        type="range"
        min="1"
        max="50"
        step="1"
        value={brushSize}
        onInput={(event) => setBrushSize(Number(event.currentTarget.value))}
        onChange={(event) => setBrushSize(Number(event.currentTarget.value))}
      />
      <strong>{brushSize}</strong>
    </label>
  )
}

function ElevationControl(): React.ReactElement {
  const elevationValue = useEditorStore((state) => state.elevationValue)
  const setElevationValue = useEditorStore((state) => state.setElevationValue)

  return (
    <label className="field">
      <span>Land elevation</span>
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
  )
}

function NationPlacementHelp(): React.ReactElement {
  const tool = useEditorStore((state) => state.tool)
  const pendingNationPlacement = useEditorStore((state) => state.pendingNationPlacement)
  const autoAddNations = useEditorStore((state) => state.autoAddNations)
  const [tab, setTab] = useState<'place' | 'auto'>('place')
  const [countStr, setCountStr] = useState('8')

  if (tool !== 'nation') return <></>

  const countInvalid = countStr.trim() === '' || Number(countStr) <= 0

  return (
    <div className="status-card">
      <div className="nation-tool-tabs">
        <button
          type="button"
          className={tab === 'place' ? 'active' : ''}
          onClick={() => setTab('place')}
        >
          Place
        </button>
        <button
          type="button"
          className={tab === 'auto' ? 'active' : ''}
          onClick={() => setTab('auto')}
        >
          Auto
        </button>
      </div>

      {tab === 'place' && (
        <p className="empty-state" style={{ marginTop: 10 }}>
          {pendingNationPlacement
            ? 'Nation dialog is open — confirm or cancel it.'
            : 'Click a land tile to open the placement dialog.'}
        </p>
      )}

      {tab === 'auto' && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="field">
            <span>Number of nations</span>
            <input
              type="number"
              min={0}
              max={500}
              value={countStr}
              onChange={(e) => setCountStr(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={countInvalid}
            onClick={() => {
              const n = Math.min(500, Math.max(1, Math.floor(Number(countStr))))
              autoAddNations(n)
            }}
          >
            Place nations
          </button>
        </div>
      )}
    </div>
  )
}

function ZoomControl(): React.ReactElement {
  const zoom = useViewportStore((state) => state.zoom)

  const handleZoomSliderChange = (value: number): void => {
    const clamped = Math.max(0.001, Math.min(6, value))
    useViewportStore.setState({ zoom: clamped })
  }

  return (
    <label className="field">
      <span>Zoom</span>
      <input
        type="range"
        min="0.001"
        max="6"
        step="0.001"
        value={zoom}
        onInput={(event) => handleZoomSliderChange(Number(event.currentTarget.value))}
        onChange={(event) => handleZoomSliderChange(Number(event.currentTarget.value))}
      />
      <strong>{zoom.toFixed(2)}x</strong>
    </label>
  )
}

function MapSizePanel({
  width,
  height,
  onCreateBlankMap,
}: {
  width: number
  height: number
  onCreateBlankMap: (w: number, h: number) => void
}): React.ReactElement {
  const [nextWidth, setNextWidth] = React.useState(width)
  const [nextHeight, setNextHeight] = React.useState(height)

  // Keep local state in sync when the project changes externally
  React.useEffect(() => {
    setNextWidth(width)
    setNextHeight(height)
  }, [width, height])

  return (
    <div className="status-card">
      <h3>Map size</h3>
      <div className="size-grid">
        <label className="field">
          <span>Width</span>
          <input
            type="number"
            min="1"
            max="5000"
            value={nextWidth}
            onChange={(e) => setNextWidth(Math.max(1, Math.floor(Number(e.target.value))))}
          />
        </label>
        <label className="field">
          <span>Height</span>
          <input
            type="number"
            min="1"
            max="5000"
            value={nextHeight}
            onChange={(e) => setNextHeight(Math.max(1, Math.floor(Number(e.target.value))))}
          />
        </label>
      </div>
      <button
        type="button"
        className="secondary"
        onClick={() => onCreateBlankMap(nextWidth, nextHeight)}
      >
        New blank map
      </button>
    </div>
  )
}

const SHORTCUTS = [
  { keys: 'Space + Drag', action: 'Pan the map' },
  { keys: 'Scroll Wheel', action: 'Zoom in / out' },
  { keys: 'Ctrl + Z', action: 'Undo' },
  { keys: 'Ctrl + Y  /  Ctrl + Shift + Z', action: 'Redo' },
]

function ShortcutsButton(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPopupPos({ top: rect.bottom + 8, left: rect.left })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  return (
    <div className="shortcuts-wrapper">
      <button
        ref={btnRef}
        type="button"
        className="shortcuts-btn"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts"
        onClick={handleToggle}
      >
        ⌨
      </button>
      {open && popupPos && (
        <div
          ref={popupRef}
          className="shortcuts-popup"
          role="dialog"
          aria-label="Keyboard shortcuts"
          style={{ top: popupPos.top, left: popupPos.left }}
        >
          <p className="shortcuts-heading">Keyboard Shortcuts</p>
          <table className="shortcuts-table">
            <tbody>
              {SHORTCUTS.map(({ keys, action }) => (
                <tr key={keys}>
                  <td><kbd>{keys}</kbd></td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProjectInfoPanel({ width, height }: { width: number; height: number }): React.ReactElement {
  const projectNations = useEditorStore((state) => state.project.nations)
  const landTileCount = useEditorStore((state) => state.landTileCount)
  const atLimit = landTileCount >= MAX_LAND_TILES
  const pct = Math.min(100, (landTileCount / MAX_LAND_TILES) * 100)

  return (
    <div className="status-card">
      <h3>Project</h3>
      <dl>
        <div>
          <dt>Total tiles</dt>
          <dd>{(width * height).toLocaleString()}</dd>
        </div>
        <div className="land-tiles-row">
          <dt>Land tiles</dt>
          <div className="land-tiles-bar-track" aria-hidden="true">
            <div
              className="land-tiles-bar-fill"
              style={{
                width: `${pct}%`,
                background: atLimit
                  ? 'linear-gradient(90deg,#ef4444,#f87171)'
                  : 'linear-gradient(90deg,var(--accent),var(--accent-2))',
              }}
            />
          </div>
          <dd className="land-tiles-count" style={{ color: atLimit ? '#f87171' : undefined }}>
            {landTileCount.toLocaleString()} / {MAX_LAND_TILES.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt>Nations</dt>
          <dd>{projectNations.length}</dd>
        </div>
      </dl>
    </div>
  )
}
