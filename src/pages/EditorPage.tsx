import React from 'react'
import '../App.css'
import { buildExportBundle, buildExportPng, downloadBlob } from '../lib/exportMap'
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

  const [exportStatus, setExportStatus] = React.useState('Idle')
  const [exportFiles, setExportFiles] = React.useState<string[]>([])

  const resetProject = (): void => {
    setNationName('Spawn 1')
    setElevationValue(128)
    useEditorStore.getState().createBlankProject(projectWidth, projectHeight)
  }

  const handleCreateBlankMap = (w: number, h: number): void => {
    useEditorStore.getState().createBlankProject(w, h)
  }

  const handleExportMap = async (): Promise<void> => {
    setExportStatus('Exporting…')
    try {
      const { project } = useEditorStore.getState()
      const bundle = await buildExportBundle(project)
      downloadBlob(bundle.zipBlob, `${project.name || 'openfront-map'}.zip`)
      setExportFiles(bundle.fileNames)
      setExportStatus('Export complete')
    } catch {
      setExportStatus('Export failed')
    }
  }

  const handleExportPng = async (): Promise<void> => {
    setExportStatus('Exporting PNG…')
    setExportFiles([])
    try {
      const { project } = useEditorStore.getState()
      const blob = await buildExportPng(project)
      downloadBlob(blob, `${project.name || 'openfront-map'}.png`)
      setExportStatus('PNG export complete')
    } catch {
      setExportStatus('PNG export failed')
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
          <div className="canvas-frame">
            <PixiCanvas />
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
            onExportPng={() => void handleExportPng()}
          />
      </section>
    </div>
  )
}