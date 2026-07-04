import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectManagerStore } from '../store/projectManagerStore'

/** Inline eyedropper/pipette SVG icon. */
function EyedropperIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22a1 1 0 0 1-1-1v-1H7a1 1 0 0 1-.707-1.707l9.9-9.9a1 1 0 0 1 1.414 0l2 2a1 1 0 0 1 0 1.414l-9.9 9.9A1 1 0 0 1 10 22H9v1a1 1 0 0 1-1 1" />
      <path d="m18.5 2.5 3 3" />
      <path d="M15 5 3 17l4 4L19 9" />
    </svg>
  )
}

export interface ControlsPanelProps {
  onGoHome: () => void
  onResetMap?: () => void
}

export function ControlsPanel({
  onGoHome,
  onResetMap,
}: ControlsPanelProps): React.ReactElement {
  const tool = useEditorStore((state) => state.tool)
  const setTool = useEditorStore((state) => state.setTool)
  const brushSize = useEditorStore((state) => state.brushSize)
  const setBrushSize = useEditorStore((state) => state.setBrushSize)
  const brushShape = useEditorStore((state) => state.brushShape)
  const setBrushShape = useEditorStore((state) => state.setBrushShape)
  const elevationValue = useEditorStore((state) => state.elevationValue)
  const setElevationValue = useEditorStore((state) => state.setElevationValue)
  const isSampling = useEditorStore((state) => state.isSampling)
  const setIsSampling = useEditorStore((state) => state.setIsSampling)
  const autoAddNations = useEditorStore((state) => state.autoAddNations)
  const [confirmReset, setConfirmReset] = useState(false)
  const [nationCountStr, setNationCountStr] = React.useState('8')
  const [nationUseFlags, setNationUseFlags] = React.useState(true)

  // Auto-cancel reset confirmation after 4 seconds
  useEffect(() => {
    if (!confirmReset) return
    const timer = setTimeout(() => setConfirmReset(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmReset])

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    setConfirmReset(false)
    onResetMap?.()
  }

  // Cancel confirmation on Escape key
  useEffect(() => {
    if (!confirmReset) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmReset(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirmReset])

  // Cancel confirmation if user clicks outside the button area
  useEffect(() => {
    if (!confirmReset) return
    const handler = (e: PointerEvent) => {
      const btn = document.querySelector('.toolbar-reset')
      if (btn && !btn.contains(e.target as Node)) {
        setConfirmReset(false)
      }
    }
    // Delay so the click that triggered confirm doesn't also cancel it
    setTimeout(() => window.addEventListener('pointerdown', handler), 0)
    return () => window.removeEventListener('pointerdown', handler)
  }, [confirmReset])

  const projectName = useEditorStore((state) => state.project.name)
  const projects = useProjectManagerStore((state) => state.projects)
  const activeProjectId = useProjectManagerStore((state) => state.activeProjectId)
  const loadProject = useProjectManagerStore((state) => state.loadProject)
  const saveCurrentProject = useProjectManagerStore((state) => state.saveCurrentProject)
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(false)
  const projectSwitcherRef = useRef<HTMLDivElement>(null)

  // Close project switcher on outside click
  useEffect(() => {
    if (!showProjectSwitcher) return
    const handler = (e: PointerEvent) => {
      if (projectSwitcherRef.current && !projectSwitcherRef.current.contains(e.target as Node)) {
        setShowProjectSwitcher(false)
      }
    }
    setTimeout(() => window.addEventListener('pointerdown', handler), 0)
    return () => window.removeEventListener('pointerdown', handler)
  }, [showProjectSwitcher])

  const handleSwitchProject = (id: string) => {
    if (id !== activeProjectId) {
      saveCurrentProject()
      loadProject(id)
    }
    setShowProjectSwitcher(false)
  }

  return (
    <header className="toolbar">
      {/* Brand */}
      <button type="button" className="toolbar-brand" onClick={onGoHome} aria-label="Go to home">
        <img src="/Openfront-Editor-Logo.png" alt="OpenFront" className="toolbar-logo" />
        <h1 className="toolbar-title">Map Editor</h1>
      </button>

      {/* Project name & switcher */}
      <div className="toolbar-project" ref={projectSwitcherRef}>
        <button
          type="button"
          className="toolbar-project-btn"
          onClick={() => setShowProjectSwitcher(!showProjectSwitcher)}
          title="Switch project"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <span className="toolbar-project-name">{projectName || 'Untitled'}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showProjectSwitcher && (
          <div className="toolbar-project-dropdown">
            <div className="toolbar-project-dropdown-header">
              <span>Switch project</span>
            </div>
            {projects.length === 0 ? (
              <div className="toolbar-project-dropdown-empty">No other projects</div>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`toolbar-project-dropdown-item${p.id === activeProjectId ? ' active' : ''}`}
                  onClick={() => handleSwitchProject(p.id)}
                >
                  <span className="toolbar-project-dropdown-item-name">{p.name}</span>
                  <span className="toolbar-project-dropdown-item-meta">{p.width}×{p.height}</span>
                </button>
              ))
            )}
            <div className="toolbar-project-dropdown-footer">
              <button
                type="button"
                className="toolbar-project-dropdown-all"
                onClick={() => { setShowProjectSwitcher(false); onGoHome() }}
              >
                All Projects
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Tools */}
      <div className="toolbar-section">
        <div className="toolbar-tools">
          <button type="button" className={tool === 'land' ? 'active' : ''} onClick={() => setTool('land')}>Land</button>
          <button type="button" className={tool === 'water' ? 'active' : ''} onClick={() => setTool('water')}>Water</button>
          <button type="button" className={tool === 'nation' ? 'active' : ''} onClick={() => setTool('nation')}>Nation</button>
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Brush size & shape */}
      {tool !== 'nation' && (
        <>
          <div className="toolbar-slider">
            <span className="toolbar-section-label">Brush</span>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={brushSize}
              onInput={(e) => setBrushSize(Number(e.currentTarget.value))}
              onChange={(e) => setBrushSize(Number(e.currentTarget.value))}
            />
            <strong>{brushSize}</strong>
          </div>
          <div className="toolbar-shapes">
            <button
              type="button"
              className={`shape-btn${brushShape === 'square' ? ' active' : ''}`}
              onClick={() => setBrushShape('square')}
              title="Square"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="10" height="10" /></svg>
            </button>
            <button
              type="button"
              className={`shape-btn${brushShape === 'circle' ? ' active' : ''}`}
              onClick={() => setBrushShape('circle')}
              title="Circle"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="5" /></svg>
            </button>
            <button
              type="button"
              className={`shape-btn${brushShape === 'triangle' ? ' active' : ''}`}
              onClick={() => setBrushShape('triangle')}
              title="Triangle"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="6,1 11,10 1,10" /></svg>
            </button>
            <button
              type="button"
              className={`shape-btn${brushShape === 'diamond' ? ' active' : ''}`}
              onClick={() => setBrushShape('diamond')}
              title="Diamond"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="6,1 11,6 6,11 1,6" /></svg>
            </button>
          </div>
        </>
      )}

      {/* Elevation */}
      {tool !== 'nation' && (
        <div className="toolbar-slider">
          <span className="toolbar-section-label">Elev</span>
          <input
            type="range"
            min="0"
            max="255"
            value={elevationValue}
            onInput={(e) => setElevationValue(Number(e.currentTarget.value))}
            onChange={(e) => setElevationValue(Number(e.currentTarget.value))}
          />
          <strong>{elevationValue}</strong>
          <button
            type="button"
            className={`elevation-sampler-btn${isSampling ? ' active' : ''}`}
            title="Sample elevation from map (or Alt+click on canvas)"
            aria-label="Sample elevation"
            onClick={() => setIsSampling(!isSampling)}
          >
            <EyedropperIcon />
          </button>
        </div>
      )}

      {/* Nation tool controls */}
      {tool === 'nation' && (
        <>
          <div className="toolbar-slider toolbar-nation-count">
            <span className="toolbar-section-label">Nations</span>
            <input
              type="number"
              min={0}
              max={500}
              value={nationCountStr}
              onChange={(e) => setNationCountStr(e.target.value)}
              className="toolbar-nation-input"
            />
          </div>
          <label className="toolbar-checkbox" title="Generate flags for nations">
            <input
              type="checkbox"
              checked={nationUseFlags}
              onChange={(e) => setNationUseFlags(e.target.checked)}
            />
            <span>Flags</span>
          </label>
          <button
            type="button"
            className="primary toolbar-nation-btn"
            disabled={nationCountStr.trim() === '' || Number(nationCountStr) <= 0}
            onClick={() => {
              const n = Math.min(500, Math.max(1, Math.floor(Number(nationCountStr))))
              autoAddNations(n, nationUseFlags)
            }}
          >
            Generate
          </button>
          <div className="toolbar-divider" />
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1, minWidth: 0 }} />

      {/* Reset */}
      {onResetMap && (
        <button
          type="button"
          className="toolbar-reset"
          style={confirmReset ? { background: 'rgba(239, 68, 68, 0.35)', color: '#fca5a5' } : undefined}
          onClick={handleReset}
        >
          {confirmReset ? 'Confirm?' : 'Reset'}
        </button>
      )}

      {/* Shortcuts */}
      <ShortcutsButton />
    </header>
  )
}

const SHORTCUTS = [
  { keys: '1 / 2 / 3', action: 'Land / Water / Nation tool' },
  { keys: 'F', action: 'Fit map to view' },
  { keys: '[ / ]', action: 'Decrease / Increase brush size' },
  { keys: 'Shift + [ / Shift + ]', action: 'Decrease / Increase elevation by 50' },
  { keys: 'Shift + S', action: 'Cycle brush shapes' },
  { keys: 'Space + Drag', action: 'Pan the map' },
  { keys: 'Scroll Wheel', action: 'Zoom in / out' },
  { keys: 'Ctrl + Z', action: 'Undo' },
  { keys: 'Ctrl + Y  /  Ctrl + Shift + Z', action: 'Redo' },
  { keys: 'Alt + Click', action: 'Sample elevation (Land/Water)' },
]

function ShortcutsButton(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  const handleToggle = () => {
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        e.target instanceof Node
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
        type="button"
        className="toolbar-btn"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts"
        onClick={handleToggle}
        style={{ fontSize: 16 }}
      >
        ⌨
      </button>
      {open && (
        <div
          ref={popupRef}
          className="shortcuts-popup"
          role="dialog"
          aria-label="Keyboard shortcuts"
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
