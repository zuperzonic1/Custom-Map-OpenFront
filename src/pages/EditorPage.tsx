import React, { useEffect, useRef, useState } from 'react'
import '../App.css'
import { buildExportBundle, downloadBlob } from '../lib/exportMap'
import { useEditorStore } from '../store/editorStore'
import { PixiMapEditor as PixiCanvas } from '../lib/pixiMapRenderer'
import { ControlsPanel } from '../components/ControlsPanel'
import { InfoPanel } from '../components/InfoPanel'

interface EditorPageProps {
  onGoHome: () => void
}

export function EditorPage({ onGoHome }: EditorPageProps): React.ReactElement {
  const projectName = useEditorStore((state) => state.project.name)
  const projectWidth = useEditorStore((state) => state.project.width)
  const projectHeight = useEditorStore((state) => state.project.height)
  const setNationName = useEditorStore((state) => state.setNationName)
  const setElevationValue = useEditorStore((state) => state.setElevationValue)

  const frameRef = useRef<HTMLDivElement | null>(null)
  const isSpacePressedRef = useRef(false)

  const [fps, setFps] = useState(0)
  const [exportStatus, setExportStatus] = useState('Idle')
  const [exportFiles, setExportFiles] = useState<string[]>([])

  const fpsFrameRef = useRef<number | null>(null)
  const fpsSamplesRef = useRef(0)
  const fpsLastTickRef = useRef(0)

  useEffect(() => {
    useEditorStore.getState().setZoom(1)
    useEditorStore.getState().setPan(0, 0)
  }, [])

  // Canvas resize observer
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
    })

    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  // FPS counter
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

  // Space key for pan
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

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Stop drawing on pointer/mouse up
  useEffect(() => {
    const stopInteraction = () => {}

    window.addEventListener('mouseup', stopInteraction)
    window.addEventListener('pointerup', stopInteraction)

    return () => {
      window.removeEventListener('mouseup', stopInteraction)
      window.removeEventListener('pointerup', stopInteraction)
    }
  }, [])

  const resetProject = (): void => {
    setNationName('Spawn 1')
    setElevationValue(128)
    useEditorStore.getState().createBlankProject(projectWidth, projectHeight)
  }

  const handleCreateBlankMap = (w: number, h: number): void => {
    useEditorStore.getState().createBlankProject(w, h)
  }

  const handleExportMap = async (): Promise<void> => {
    setExportStatus('Idle')

    try {
      const { project } = useEditorStore.getState()
      const bundle = await buildExportBundle(project, null)
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
          <h1>Map Editor</h1>
        </div>

        <div className="topbar-actions">
          <button type="button" className="secondary" onClick={onGoHome}>
            ← Home
          </button>
          <label className="field field-inline">
            <span>Name</span>
            <input
              value={projectName}
              onChange={(event) => useEditorStore.getState().setProjectName(event.target.value)}
            />
          </label>
          <button type="button" className="secondary" onClick={resetProject}>
            Reset map
          </button>
        </div>
      </header>

      <section className="workspace">
        <ControlsPanel onCreateBlankMap={handleCreateBlankMap} />

        <main className="canvas-shell">
          <div className="canvas-frame" ref={frameRef}>
            <PixiCanvas />
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

        <InfoPanel
          exportStatus={exportStatus}
          exportFiles={exportFiles}
          onExportMap={() => void handleExportMap()}
        />
      </section>
    </div>
  )
}