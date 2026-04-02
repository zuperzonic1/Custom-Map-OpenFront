import React, { useState } from 'react'
import './LandingPage.css'
import { useEditorStore } from '../store/editorStore'

const MAX_PIXELS = 3_000_000

const FEATURES = [
  {
    icon: '🎨',
    title: 'Terrain Painting',
    description: 'Paint land and water tiles with adjustable brush sizes.',
  },
  {
    icon: '⛰️',
    title: 'Elevation Control',
    description: 'Set per-tile elevation/intensity values for rich terrain variation.',
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
    description: 'Export a ready-to-use .zip with image.png and info.json.',
  },
  {
    icon: '💾',
    title: 'Auto-save',
    description: 'Your work is automatically persisted in the browser between sessions.',
  },
] as const

interface LandingPageProps {
  onEnterEditor: (width: number, height: number) => void
}

export function LandingPage({ onEnterEditor }: LandingPageProps): React.ReactElement {
  const [width, setWidth] = useState(1000)
  const [height, setHeight] = useState(1000)

  const totalPixels = width * height
  const overLimit = totalPixels > MAX_PIXELS
  const fillPct = Math.min((totalPixels / MAX_PIXELS) * 100, 100)
  const fillClass = overLimit ? 'over' : fillPct >= 75 ? 'warn' : 'ok'

  const handleLaunch = (): void => {
    if (overLimit) return
    useEditorStore.getState().createBlankProject(width, height)
    onEnterEditor(width, height)
  }

  return (
    <div className="landing">
      {/* ── hero ───────────────────────────────── */}
      <section className="landing-hero">
        <p className="eyebrow">OpenFront Custom Map Editor</p>
        <h1>
          Build your own <span>OpenFront map</span>
        </h1>
        <p>
          A fully browser-based editor for creating custom OpenFront maps. Paint terrain, set
          elevations, place nation spawns and export a game-ready zip — no installs required.
        </p>
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

      {/* ── configurator ───────────────────────── */}
      <section className="landing-configurator">
        <div className="configurator-card">
          <h2>
            Create your map
            <span>Choose a size, then open the editor.</span>
          </h2>

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

          <div className="pixel-budget">
            <div className="pixel-budget-label">
              <span>Pixel budget</span>
              <strong className={overLimit ? 'over-limit' : ''}>
                {totalPixels.toLocaleString()} / {MAX_PIXELS.toLocaleString()}
              </strong>
            </div>
            <div className="pixel-budget-bar">
              <div
                className={`pixel-budget-fill ${fillClass}`}
                style={{ width: `${fillPct}%` }}
                data-testid="pixel-budget-fill"
              />
            </div>
            {overLimit && (
              <p className="pixel-over-error">
                Map exceeds the 3,000,000-pixel limit. Reduce width or height.
              </p>
            )}
          </div>

          <button
            type="button"
            className="cta-button"
            onClick={handleLaunch}
            disabled={overLimit}
            data-testid="open-editor-btn"
          >
            Open Editor →
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        OpenFront Map Editor — open source, runs entirely in your browser.
      </footer>
    </div>
  )
}