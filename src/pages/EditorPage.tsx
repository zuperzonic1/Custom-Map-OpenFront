import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import { buildExportBundle, downloadBlob } from '../lib/exportMap'
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

export function EditorPage(): React.ReactElement {
  const navigate = useNavigate()
  const onGoHome = () => navigate('/')

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

  const resetProject = (): void => {
    setNationName('Spawn 1')
    setNationCountryCode('US')
    setElevationValue(128)
    useEditorStore.getState().createBlankProject(projectWidth, projectHeight)
  }

  const [exportStatus, setExportStatus] = React.useState('Idle')
  const [exportFiles, setExportFiles] = React.useState<string[]>([])

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

  const tool = useEditorStore((state) => state.tool)

  return (
    <div className="app-shell">
      <ControlsPanel onGoHome={onGoHome} onResetMap={resetProject} />

      <section className="workspace">
        <main className="canvas-shell">
          <div className="canvas-frame">
            <PixiCanvas />
          </div>

          <div className="status-bar">
            <span>Drag to paint.</span>
            <span>Space + drag to pan.</span>
            {tool === 'nation' && <span>Click a land tile to place a nation.</span>}
          </div>
        </main>

        <InfoPanel
          exportStatus={exportStatus}
          exportFiles={exportFiles}
          onExportMap={() => void handleExportMap()}
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
                  {nationCountryCode ? (
                    <img
                      className="flag-preview"
                      src={flagUrl(nationCountryCode, 40)}
                      alt={nationCountryCode}
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                      onLoad={(e) => { e.currentTarget.style.visibility = 'visible' }}
                    />
                  ) : (
                    <div className="flag-preview flag-preview-empty" />
                  )}
                  <button
                    type="button"
                    className="secondary name-random-btn"
                    onClick={() =>
                      setNationCountryCode(
                        COUNTRY_CODES[Math.floor(Math.random() * COUNTRY_CODES.length)],
                      )
                    }
                    disabled={!nationCountryCode}
                    title="Random flag"
                  >
                    🎲
                  </button>
                  <select
                    value={nationCountryCode}
                    onChange={(event) => setNationCountryCode(event.target.value)}
                    title="ISO 3166-1 alpha-2 country code"
                  >
                    <option value="">— No flag —</option>
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