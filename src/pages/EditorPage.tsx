import React from 'react'
import '../App.css'
import { buildExportBundle, buildExportPng, downloadBlob } from '../lib/exportMap'
import { useEditorStore } from '../store/editorStore'
import { PixiMapEditor as PixiCanvas } from '../lib/pixiMapRenderer'
import { ControlsPanel } from '../components/ControlsPanel'
import { InfoPanel } from '../components/InfoPanel'

// ─── Goofy name generator ─────────────────────────────────────────────────────

const GOOFY_ADJECTIVES = [
  'Mighty', 'Chunky', 'Wobbly', 'Spicy', 'Soggy', 'Turbo', 'Legendary', 'Fluffy',
  'Cosmic', 'Sneaky', 'Grumpy', 'Crispy', 'Fancy', 'Funky', 'Grand', 'Mystical',
  'Radical', 'Saucy', 'Supreme', 'Wacky', 'Rusty', 'Glamorous', 'Cursed', 'Ancient',
  'Electric', 'Feral', 'Hollow', 'Infinite', 'Jolly', 'Knightly',
]

const GOOFY_NOUNS = [
  'Penguins', 'Narwhals', 'Potatoes', 'Wombats', 'Ducks', 'Llamas', 'Muffins',
  'Pickles', 'Bananas', 'Noodles', 'Beavers', 'Donkeys', 'Rascals', 'Yetis',
  'Goblins', 'Badgers', 'Toads', 'Vikings', 'Wizards', 'Ninjas', 'Sloths',
  'Hedgehogs', 'Axolotls', 'Capybaras', 'Platypuses', 'Corgis', 'Ferrets',
  'Salamanders', 'Krakens', 'Parrots',
]

function generateGoofyName(): string {
  const adj = GOOFY_ADJECTIVES[Math.floor(Math.random() * GOOFY_ADJECTIVES.length)]
  const noun = GOOFY_NOUNS[Math.floor(Math.random() * GOOFY_NOUNS.length)]
  return `${adj} ${noun}`
}

// ─── Flag CDN helper ──────────────────────────────────────────────────────────

function flagUrl(code: string, width: 20 | 40 = 20): string {
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`
}

const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW',
  'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT',
  'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
  'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS',
  'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
  'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
  'WF', 'WS',
  'YE', 'YT',
  'ZA', 'ZM', 'ZW',
] as const

interface EditorPageProps {
  onGoHome: () => void
}

export function EditorPage({ onGoHome }: EditorPageProps): React.ReactElement {
  const projectName = useEditorStore((state) => state.project.name)
  const projectWidth = useEditorStore((state) => state.project.width)
  const projectHeight = useEditorStore((state) => state.project.height)
  const pendingNationPlacement = useEditorStore((state) => state.pendingNationPlacement)
  const nationName = useEditorStore((state) => state.nationName)
  const nationCountryCode = useEditorStore((state) => state.nationCountryCode)
  const setNationName = useEditorStore((state) => state.setNationName)
  const setNationCountryCode = useEditorStore((state) => state.setNationCountryCode)
  const confirmNationPlacement = useEditorStore((state) => state.confirmNationPlacement)
  const cancelNationPlacement = useEditorStore((state) => state.cancelNationPlacement)
  const setElevationValue = useEditorStore((state) => state.setElevationValue)

  // Auto-generate a goofy name each time the nation placement panel opens
  React.useEffect(() => {
    if (pendingNationPlacement) {
      setNationName(generateGoofyName())
    }
  }, [pendingNationPlacement]) // eslint-disable-line react-hooks/exhaustive-deps

  const [exportStatus, setExportStatus] = React.useState('Idle')
  const [exportFiles, setExportFiles] = React.useState<string[]>([])

  const resetProject = (): void => {
    setNationName('Spawn 1')
    setNationCountryCode('US')
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
        <button
          type="button"
          className="topbar-left topbar-home-btn"
          onClick={onGoHome}
          aria-label="Go to home"
        >
          <img
            src="/Openfront-Editor-Logo.png"
            alt="OpenFront Editor Logo"
            className="editor-logo"
          />
          <div>
            <p className="eyebrow">OpenFront map editor</p>
            <h1>Map Editor</h1>
          </div>
        </button>

        <div className="topbar-actions">
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
            <span>Nation tool opens a placement dialog.</span>
          </div>
        </main>

        <InfoPanel
          exportStatus={exportStatus}
          exportFiles={exportFiles}
          onExportMap={() => void handleExportMap()}
          onExportPng={() => void handleExportPng()}
        />
      </section>

  {pendingNationPlacement && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelNationPlacement()
          }}
        >
          <div
            className="nation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nation-modal-title"
          >
            <button
              type="button"
              className="nation-modal-close"
              onClick={cancelNationPlacement}
              aria-label="Close"
            >
              ×
            </button>

            <h2 id="nation-modal-title">Place nation</h2>
            <p>
              Confirm the nation name and flag code for the selected land tile.
            </p>

            <div className="nation-modal-grid">
              <label className="field">
                <span>Nation name</span>
                <div className="nation-name-row">
                  <input
                    value={nationName}
                    onChange={(event) => setNationName(event.target.value)}
                    placeholder="Spawn 1"
                  />
                  <button
                    type="button"
                    className="secondary name-random-btn"
                    onClick={() => setNationName(generateGoofyName())}
                    title="Generate random goofy name"
                  >
                    🎲
                  </button>
                </div>
              </label>

              <label className="field">
                <span>Flag</span>
                <div className="flag-select-row">
                  <img
                    className="flag-preview"
                    src={flagUrl(nationCountryCode, 40)}
                    alt={nationCountryCode}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                    onLoad={(e) => { e.currentTarget.style.visibility = 'visible' }}
                  />
                  <select
                    value={nationCountryCode}
                    onChange={(event) => setNationCountryCode(event.target.value)}
                    title="ISO 3166-1 alpha-2 country code"
                  >
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <div className="nation-modal-actions">
              <button type="button" className="secondary" onClick={cancelNationPlacement}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={confirmNationPlacement}>
                Place nation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}