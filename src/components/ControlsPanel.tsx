import React from 'react'
import { useEditorStore } from '../store/editorStore'

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

  return (
    <aside className="panel controls">
      <h2>Tools</h2>

      <ToolButtons />

      <BrushSizeControl />
      <ElevationControl />
      <NationNameControl />
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
      <ToolButton label="Elevation" active={tool === 'elevation'} onClick={() => setTool('elevation')} />
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
        max="10"
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
  )
}

function NationNameControl(): React.ReactElement {
  const nationName = useEditorStore((state) => state.nationName)
  const setNationName = useEditorStore((state) => state.setNationName)

  return (
    <label className="field">
      <span>Nation name</span>
      <input
        value={nationName}
        onChange={(event) => setNationName(event.target.value)}
        placeholder="Spawn 1"
      />
    </label>
  )
}

function ZoomControl(): React.ReactElement {
  const zoom = useEditorStore((state) => state.zoom)
  const setZoom = useEditorStore((state) => state.setZoom)

  const handleZoomSliderChange = (value: number): void => {
    // Clamp the value between MIN_ZOOM and MAX_ZOOM
    const clamped = Math.max(0.05, Math.min(6, value))
    setZoom(clamped)
  }

  return (
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
  )
}

function MapSizePanel({
  width,
  height,
  onCreateBlankMap,
}: { 
  width: number; 
  height: number;
  onCreateBlankMap: (w: number, h: number) => void;
}): React.ReactElement {
  const widthInputRef = React.useRef<HTMLInputElement | null>(null)
  const heightInputRef = React.useRef<HTMLInputElement | null>(null)

  const handleCreateBlankMap = (): void => {
    const nextWidth = Math.max(1, Math.floor(Number(widthInputRef.current?.value ?? width)))
    const nextHeight = Math.max(1, Math.floor(Number(heightInputRef.current?.value ?? height)))

    onCreateBlankMap(nextWidth, nextHeight)
  }

  return (
    <div className="status-card">
      <h3>Map size</h3>
      <div className="size-grid">
        <label className="field">
          <span>Width</span>
          <input
            key={`width-${width}-${height}`}
            ref={widthInputRef}
            type="number"
            min="1"
            max="512"
            defaultValue={width}
          />
        </label>
        <label className="field">
          <span>Height</span>
          <input
            key={`height-${width}-${height}`}
            ref={heightInputRef}
            type="number"
            min="1"
            max="512"
            defaultValue={height}
          />
        </label>
      </div>
      <button type="button" className="secondary" onClick={handleCreateBlankMap}>
        New blank map
      </button>
    </div>
  )
}

function ProjectInfoPanel({ width, height }: { width: number; height: number }): React.ReactElement {
  const projectNations = useEditorStore((state) => state.project.nations)

  return (
    <div className="status-card">
      <h3>Project</h3>
      <dl>
        <div>
          <dt>Width</dt>
          <dd>{width}</dd>
        </div>
        <div>
          <dt>Height</dt>
          <dd>{height}</dd>
        </div>
        <div>
          <dt>Tiles</dt>
          <dd>{width * height}</dd>
        </div>
        <div>
          <dt>Nations</dt>
          <dd>{projectNations.length}</dd>
        </div>
      </dl>
    </div>
  )
}