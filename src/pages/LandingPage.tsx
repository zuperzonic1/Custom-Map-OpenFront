import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'
import { useProjectManagerStore, type ProjectSummary } from '../store/projectManagerStore'
import { importImageAsProject, importImageAsAnyMap, ImportError } from '../lib/importMap'

const FEATURES = [
  {
    icon: '🎨',
    title: 'Terrain Painting',
    description: 'Paint land and water tiles with adjustable brush sizes.',
  },
  {
    icon: '⛰️',
    title: 'Elevation Control',
    description: 'Set per-tile elevation values for rich terrain variation.',
  },
  {
    icon: '🏳️',
    title: 'Nation Spawns',
    description: 'Place and name nation spawn points anywhere on your map.',
  },
  {
    icon: '🗺️',
    title: 'Live Preview',
    description: 'WebGL-powered canvas renders your map in real time as you paint.',
  },
  {
    icon: '💾',
    title: 'Auto-save',
    description: 'Your work is automatically persisted in the browser between sessions.',
  },
] as const

export function LandingPage(): React.ReactElement {
  const navigate = useNavigate()
  const projects = useProjectManagerStore((state) => state.projects)
  const activeProjectId = useProjectManagerStore((state) => state.activeProjectId)
  const loadProject = useProjectManagerStore((state) => state.loadProject)
  const deleteProject = useProjectManagerStore((state) => state.deleteProject)
  const renameProject = useProjectManagerStore((state) => state.renameProject)
  const duplicateProject = useProjectManagerStore((state) => state.duplicateProject)
  const createProject = useProjectManagerStore((state) => state.createProject)

  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleOpenProject = (id: string) => {
    loadProject(id)
    navigate('/editor')
  }

  const handleCreateProject = (width: number, height: number, name?: string) => {
    createProject(width, height, name)
    setShowNewProjectModal(false)
    navigate('/editor')
  }

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
  }

  const handleFinishRename = () => {
    if (renamingId && renameValue.trim()) {
      renameProject(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      deleteProject(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      // Auto-cancel after 4 seconds
      setTimeout(() => setConfirmDeleteId(null), 4000)
    }
  }

  const importProject = useProjectManagerStore((state) => state.importProject)

  const handleImport = async (file: File, mode: 'blue' | 'any') => {
    try {
      const project = mode === 'blue'
        ? await importImageAsProject(file)
        : await importImageAsAnyMap(file)
      // Import the project (saves data, creates summary, loads into editor)
      importProject(project)
      setShowImportModal(false)
      navigate('/editor')
    } catch (err) {
      alert(err instanceof ImportError ? err.message : 'Import failed.')
    }
  }

  // Sort projects by last modified (most recent first)
  const sortedProjects = [...projects].sort((a, b) => b.lastModified - a.lastModified)

  return (
    <div className="landing">
      {/* ── hero ───────────────────────────────── */}
      <section className="landing-hero">
        <img 
          src="/Openfront-Editor-Logo.png" 
          alt="OpenFront Editor Logo" 
          className="landing-logo"
        />
        <p className="eyebrow">OpenFront Custom Map Editor</p>
        <h1>
          Build your own <span>OpenFront map</span>
        </h1>
        <p>
          A fully browser-based editor for creating custom OpenFront maps. Paint terrain, set
          elevations and place nation spawns — all in your browser with no installs required.
        </p>
      </section>

      {/* ── Project dashboard ──────────────────── */}
      <section className="landing-dashboard">
        <div className="dashboard-header">
          <h2>Your Projects</h2>
          <div className="dashboard-actions">
            <button
              type="button"
              className="cta-button cta-button-sm"
              onClick={() => setShowNewProjectModal(true)}
            >
              + New Project
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowImportModal(true)}
            >
              Import Image
            </button>
          </div>
        </div>

        {sortedProjects.length === 0 ? (
          <div className="dashboard-empty">
            <p>No projects yet. Create a new project or import an image to get started.</p>
          </div>
        ) : (
          <div className="project-grid">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                isRenaming={renamingId === project.id}
                renameValue={renameValue}
                isConfirmingDelete={confirmDeleteId === project.id}
                onOpen={() => handleOpenProject(project.id)}
                onStartRename={() => handleStartRename(project.id, project.name)}
                onRenameChange={setRenameValue}
                onFinishRename={handleFinishRename}
                onCancelRename={() => setRenamingId(null)}
                onDuplicate={() => duplicateProject(project.id)}
                onDelete={() => handleDelete(project.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── features grid ──────────────────────── */}
      <section className="landing-features">
        <h2>Everything you need</h2>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p>OpenFront Map Editor — open source, runs entirely in your browser.</p>
        <p>
          Current repository:{' '}
          <a href="https://github.com/zuperzonic1/Custom-Map-OpenFront" target="_blank" rel="noreferrer">
            zuperzonic1/Custom-Map-OpenFront
          </a>
        </p>
        <p>
          Map generator credits:{' '}
          <a
            href="https://github.com/openfrontio/OpenFrontIO/tree/main/map-generator"
            target="_blank"
            rel="noreferrer"
          >
            OpenFrontIO map-generator
          </a>
        </p>
      </footer>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreate={handleCreateProject}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
      )}
    </div>
  )
}

// ── Project Card ────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  isActive,
  isRenaming,
  renameValue,
  isConfirmingDelete,
  onOpen,
  onStartRename,
  onRenameChange,
  onFinishRename,
  onCancelRename,
  onDuplicate,
  onDelete,
}: {
  project: ProjectSummary
  isActive: boolean
  isRenaming: boolean
  renameValue: string
  isConfirmingDelete: boolean
  onOpen: () => void
  onStartRename: () => void
  onRenameChange: (v: string) => void
  onFinishRename: () => void
  onCancelRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onFinishRename()
    if (e.key === 'Escape') onCancelRename()
  }

  const formatDate = (ts: number): string => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  }

  return (
    <div
      className={`project-card${isActive ? ' project-card-active' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
    >
      <div className="project-card-preview">
        {project.thumbnailUrl ? (
          <img
            className="project-card-thumbnail"
            src={project.thumbnailUrl}
            alt={`Preview of ${project.name}`}
            loading="lazy"
          />
        ) : (
          <div className="project-card-preview-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </div>
        )}
      </div>

      <div className="project-card-body">
        {isRenaming ? (
          <input
            ref={inputRef}
            className="project-card-rename-input"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onFinishRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h3 className="project-card-name">{project.name}</h3>
        )}
        <div className="project-card-meta">
          <span>{project.width}×{project.height}</span>
          <span className="meta-dot">·</span>
          <span>{project.landTileCount.toLocaleString()} tiles</span>
        </div>
        <div className="project-card-meta">
          <span>Modified {formatDate(project.lastModified)}</span>
        </div>
      </div>

      <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="project-card-action-btn"
          title="Rename"
          onClick={onStartRename}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
        <button
          type="button"
          className="project-card-action-btn"
          title="Duplicate"
          onClick={onDuplicate}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          type="button"
          className={`project-card-action-btn project-card-action-btn-danger${isConfirmingDelete ? ' confirming' : ''}`}
          title={isConfirmingDelete ? 'Click again to confirm' : 'Delete'}
          onClick={onDelete}
        >
          {isConfirmingDelete ? (
            <span style={{ fontSize: 10, fontWeight: 700 }}>Sure?</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ── New Project Modal ───────────────────────────────────────────────────────

function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (width: number, height: number, name?: string) => void
}): React.ReactElement {
  const [name, setName] = useState('')
  const [width, setWidth] = useState(256)
  const [height, setHeight] = useState(192)

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="project-modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
        <button
          type="button"
          className="nation-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h2 id="new-project-title">New Project</h2>
        <p>Create a new blank map.</p>

        <div className="project-modal-fields">
          <label className="field">
            <span>Project Name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leave blank for a random name"
            />
          </label>

          <div className="size-inputs">
            <label className="field">
              <span>Width (tiles)</span>
              <input
                type="number"
                min={1}
                max={5000}
                value={width}
                onChange={(e) => setWidth(Math.max(1, Math.floor(Number(e.target.value))))}
              />
            </label>
            <label className="field">
              <span>Height (tiles)</span>
              <input
                type="number"
                min={1}
                max={5000}
                value={height}
                onChange={(e) => setHeight(Math.max(1, Math.floor(Number(e.target.value))))}
              />
            </label>
          </div>
        </div>

        <div className="project-modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => onCreate(width, height, name.trim() || undefined)}
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Import Modal ────────────────────────────────────────────────────────────

function ImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (file: File, mode: 'blue' | 'any') => void
}): React.ReactElement {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const blueInputRef = useRef<HTMLInputElement>(null)
  const anyInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File, mode: 'blue' | 'any') => {
    setBusy(true)
    setStatus('Importing…')
    try {
      await onImport(file, mode)
    } catch {
      setStatus('Import failed.')
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="project-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <button
          type="button"
          className="nation-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h2 id="import-title">Import Image</h2>
        <p>Choose how to interpret your image.</p>

        <div className="import-options">
          <div className="import-option-card">
            <h4>Blue channel map</h4>
            <p>Uses the blue channel for precise elevation encoding (OpenFront spec).</p>
            <input
              ref={blueInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file, 'blue')
              }}
            />
            <button
              type="button"
              className="cta-button cta-button-sm"
              disabled={busy}
              onClick={() => blueInputRef.current?.click()}
            >
              {busy ? 'Importing…' : 'Choose image →'}
            </button>
          </div>

          <div className="import-option-card">
            <h4>Any image</h4>
            <p>Converts any image into a map using pixel brightness for elevation.</p>
            <input
              ref={anyInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file, 'any')
              }}
            />
            <button
              type="button"
              className="cta-button cta-button-sm"
              disabled={busy}
              onClick={() => anyInputRef.current?.click()}
            >
              {busy ? 'Importing…' : 'Choose image →'}
            </button>
          </div>
        </div>

        {status && !status.startsWith('Imported') && (
          <p className="pixel-over-error" style={{ marginTop: 10 }}>{status}</p>
        )}

        <div className="project-modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}