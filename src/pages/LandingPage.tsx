import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'
import { useEditorStore } from '../store/editorStore'
import { importImageAsProject, ImportError } from '../lib/importMap'

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
    icon: '📦',
    title: 'OpenFront Export',
    description: 'Export a ready-to-use .zip with binary map data and manifest.',
  },
  {
    icon: '💾',
    title: 'Auto-save',
    description: 'Your work is automatically persisted in the browser between sessions.',
  },
] as const

export function LandingPage(): React.ReactElement {
  const navigate = useNavigate()
  const onEnterEditor = () => navigate('/editor')

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
          elevations, place nation spawns and export a game-ready zip — no installs required.
        </p>
      </section>

      {/* ── configurator (moved above features) ── */}
      <section className="landing-configurator">
        <div className="configurator-card">
          <h2>Get started</h2>
          <div className="configurator-split">
            <NewMapPanel onEnterEditor={onEnterEditor} />
            <div className="configurator-divider">
              <span>or</span>
            </div>
            <ImportMapPanel onEnterEditor={onEnterEditor} />
          </div>
        </div>
      </section>

      <section className="landing-guide">
        <h2>How to Use Your Map In-Game</h2>
        <p>
          Follow these steps to create, export, and enable your custom map in OpenFront. See the{' '}
          <a
            href="https://openfrontio-openfrontio.mintlify.app/map-generator/usage"
            target="_blank"
            rel="noreferrer"
          >
            original usage docs
          </a>{' '}
          for the full guide.
        </p>
        <ol>
          <li>
            <strong>Create or Import Your Map</strong>
            <span>
              Start with a blank canvas (choose a size and click <em>Open Editor</em>) or import an
              existing image to use as a base. Paint terrain, set elevations, place nation spawn
              points, then click <strong>Export → Map Files</strong> to download your map as a{' '}
              <code>.zip</code>.
            </span>
          </li>
          <li>
            <strong>Add Map Files to the Game</strong>
            <span>
              In your OpenFrontIO repository, create a new folder at{' '}
              <code>resources/maps/&lt;YourMapName&gt;/</code>. Unzip the downloaded{' '}
              <code>.zip</code> and move all the files into that folder.
            </span>
          </li>
          <li>
            <strong>Update Game Types</strong>
            <span>Add to <code>GameMapType</code> and <code>mapCategories</code> in <code>src/core/game/Game.ts</code></span>
          </li>
          <li>
            <strong>Update Map Playlist</strong>
            <span>Add to <code>src/server/MapPlaylist.ts</code></span>
          </li>
          <li>
            <strong>Add Translation</strong>
            <span>Add to the map object in <code>resources/lang/en.json</code></span>
          </li>
          <li>
            <strong>Update Credits</strong>
            <span>Add license and attribution to <code>CREDITS.md</code></span>
          </li>
        </ol>
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
    </div>
  )
}

// ── New blank map panel ──────────────────────────────────────────────────────

function NewMapPanel({ onEnterEditor }: { onEnterEditor: () => void }): React.ReactElement {
  const [width, setWidth] = useState(1000)
  const [height, setHeight] = useState(1000)

  const handleLaunch = (): void => {
    useEditorStore.getState().createBlankProject(width, height)
    onEnterEditor()
  }

  return (
    <div className="configurator-panel">
      <h3>Create your map</h3>
      <p className="configurator-panel-desc">Choose a size, then open the editor.</p>

      <div className="size-inputs">
        <label className="field">
          <span>Width (tiles)</span>
          <input
            type="number"
            min={1}
            max={5000}
            value={width}
            onChange={(e) => setWidth(Math.max(1, Math.floor(Number(e.target.value))))}
            data-testid="landing-width"
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
            data-testid="landing-height"
          />
        </label>
      </div>

      <button
        type="button"
        className="cta-button"
        onClick={handleLaunch}
        data-testid="open-editor-btn"
      >
        Open Editor →
      </button>
    </div>
  )
}

// ── Import image panel ───────────────────────────────────────────────────────

function ImportMapPanel({ onEnterEditor }: { onEnterEditor: () => void }): React.ReactElement {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFile = async (file: File): Promise<void> => {
    setBusy(true)
    setStatus('Importing…')
    try {
      const project = await importImageAsProject(file)
      useEditorStore.getState().loadProject(project)
      setStatus(`Imported "${project.name}" (${project.width}×${project.height})`)
      onEnterEditor()
    } catch (err) {
      setStatus(err instanceof ImportError ? err.message : 'Import failed.')
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="configurator-panel">
      <h3>Import image</h3>
      <p className="configurator-panel-desc">
        Load a PNG, JPEG, or WebP — the blue channel encodes terrain elevation.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />

      <button
        type="button"
        className="cta-button"
        disabled={busy}
        style={busy ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Importing…' : 'Choose image →'}
      </button>

      {status && !status.startsWith('Imported') && (
        <p className="pixel-over-error" style={{ marginTop: '10px' }}>
          {status}
        </p>
      )}
    </div>
  )
}