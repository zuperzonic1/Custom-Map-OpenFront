import React, { useEffect, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useViewportStore } from '../store/viewportStore'
import { importMetadataFromJson, ImportError, VALID_CATEGORIES } from '../lib/importMap'

function flagUrl(code: string, width: 20 | 40 = 20): string {
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`
}

export interface InfoPanelProps {
  onExportMap?: () => void
  exportStatus: string
  exportFiles: string[]
}

type PanelTab = 'meta' | 'export' | 'newmap'

export function InfoPanel({
  onExportMap,
  exportStatus,
  exportFiles,
}: InfoPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<PanelTab>('meta')
  const projectWidth = useEditorStore((state) => state.project.width)
  const projectHeight = useEditorStore((state) => state.project.height)

  return (
    <aside className="panel">
      {/* Tab bar */}
      <div className="panel-tabs">
        <button
          type="button"
          className={`panel-tab${activeTab === 'meta' ? ' active' : ''}`}
          onClick={() => setActiveTab('meta')}
          title="Metadata"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Meta</span>
        </button>
        <button
          type="button"
          className={`panel-tab${activeTab === 'export' ? ' active' : ''}`}
          onClick={() => setActiveTab('export')}
          title="Export"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Export</span>
        </button>
        <button
          type="button"
          className={`panel-tab${activeTab === 'newmap' ? ' active' : ''}`}
          onClick={() => setActiveTab('newmap')}
          title="New map"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>New</span>
        </button>
      </div>

      {/* Tab content (scrollable) */}
      <div className="panel-content">
        {activeTab === 'meta' && <MetaTabContent />}
        {activeTab === 'export' && (
          <ExportSection
            onExportMap={onExportMap}
            exportStatus={exportStatus}
            exportFiles={exportFiles}
          />
        )}
        {activeTab === 'newmap' && (
          <MapSizePanel
            width={projectWidth}
            height={projectHeight}
          />
        )}
      </div>

      {/* Minimap — always at the bottom */}
      <div className="panel-minimap-area">
        <h3 className="panel-minimap-label">Minimap</h3>
        <Minimap width={projectWidth} height={projectHeight} />
      </div>
    </aside>
  )
}

function MetaTabContent(): React.ReactElement {
  const projectWidth = useEditorStore((state) => state.project.width)
  const projectHeight = useEditorStore((state) => state.project.height)
  const projectNations = useEditorStore((state) => state.project.nations)
  const tool = useEditorStore((state) => state.tool)

  return (
    <>
      <MetadataSection />
      <ProjectInfoPanel width={projectWidth} height={projectHeight} />
      <NationsSection nations={projectNations} />
      {tool === 'nation' && <NationHelp />}
    </>
  )
}

function autoFillFromName(name: string, metadata: { id: string; translation_key: string }): void {
  const trimmed = name.trim()
  if (!trimmed) return

  const setProjectMetadata = useEditorStore.getState().setProjectMetadata

  if (!metadata.id) {
    setProjectMetadata('id', trimmed.replace(/\s+/g, ''))
  }
  if (!metadata.translation_key) {
    setProjectMetadata('translation_key', `map.${trimmed.replace(/\s+/g, '').toLowerCase()}`)
  }
}

function MetadataSection(): React.ReactElement {
  const projectName = useEditorStore((state) => state.project.name)
  const metadataId = useEditorStore((state) => state.project.metadata.id)
  const metadataTranslationKey = useEditorStore((state) => state.project.metadata.translation_key)
  const metadataCategories = useEditorStore((state) => state.project.metadata.categories)
  const metadataMultiplayerFrequency = useEditorStore((state) => state.project.metadata.multiplayer_frequency)
  const setProjectName = useEditorStore((state) => state.setProjectName)
  const setProjectMetadata = useEditorStore((state) => state.setProjectMetadata)
  const setProjectCategories = useEditorStore((state) => state.setProjectCategories)
  const setProjectMultiplayerFrequency = useEditorStore((state) => state.setProjectMultiplayerFrequency)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importing, setImporting] = React.useState(false)

  const handleImportClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const metadata = await importMetadataFromJson(file)
      // Replace nations in a single atomic update.
      // Clone the current project and replace only the name + nations,
      // then use loadProject() which handles texture rebuild + undo.
      // Read the current project state, cloning frozen Immer arrays into
      // fresh Uint8Arrays so loadProject can take ownership.
      const current = useEditorStore.getState().project
      const project = {
        name: metadata.name,
        width: current.width,
        height: current.height,
        terrain: new Uint8Array(current.terrain),
        magnitude: new Uint8Array(current.magnitude),
        metadata: {
          ...current.metadata,
          id: metadata.id,
          translation_key: metadata.translation_key,
          categories: metadata.categories,
          multiplayer_frequency: metadata.multiplayer_frequency,
        },
        nations: metadata.nations.map((n) => ({
          id: n.id,
          name: n.name,
          countryCode: n.countryCode ?? '',
          x: n.x,
          y: n.y,
        })),
      }
      useEditorStore.getState().loadProject(project)
    } catch (err) {
      if (err instanceof ImportError) {
        window.alert(`Import failed:\n${err.message}`)
      } else {
        window.alert(`Import failed:\n${(err as Error).message ?? 'Unknown error'}`)
      }
    } finally {
      setImporting(false)
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="panel-section">
      <div className="section-header-row">
        <h3>Metadata</h3>
        <button
          type="button"
          className="icon-btn import-btn"
          onClick={handleImportClick}
          disabled={importing}
          title="Import JSON project file"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      </div>
      <label className="field">
        <span>Map Name</span>
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          onBlur={() => autoFillFromName(projectName, { id: metadataId, translation_key: metadataTranslationKey })}
          placeholder="Map name"
        />
      </label>
      <label className="field" style={{ marginTop: 6 }}>
        <span>ID</span>
        <input
          value={metadataId}
          onChange={(event) => setProjectMetadata('id', event.target.value)}
          placeholder="map-id (no spaces)"
        />
      </label>
      <label className="field" style={{ marginTop: 6 }}>
        <span>Translation Key</span>
        <input
          value={metadataTranslationKey}
          onChange={(event) => setProjectMetadata('translation_key', event.target.value)}
          placeholder="map.mapname"
        />
      </label>
      <label className="field" style={{ marginTop: 6 }}>
        <span>Multiplayer Frequency</span>
        <input
          type="number"
          min={1}
          max={10}
          value={metadataMultiplayerFrequency}
          onChange={(event) => setProjectMultiplayerFrequency(Math.max(1, Math.min(10, Math.floor(Number(event.target.value)) || 4)))}
        />
      </label>
      <label className="field" style={{ marginTop: 6 }}>
        <span>Categories</span>
        <div className="categories-tags">
          {VALID_CATEGORIES.map((cat) => (
            <label key={cat} className="category-chip">
              <input
                type="checkbox"
                checked={metadataCategories.includes(cat)}
                onChange={() => {
                  if (metadataCategories.includes(cat)) {
                    setProjectCategories(metadataCategories.filter((c) => c !== cat))
                  } else {
                    setProjectCategories([...metadataCategories, cat])
                  }
                }}
              />
              <span>{cat.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </label>
    </div>
  )
}

function ProjectInfoPanel({ width, height }: { width: number; height: number }): React.ReactElement {
  const projectNations = useEditorStore((state) => state.project.nations)
  const landTileCount = useEditorStore((state) => state.landTileCount)

  return (
    <div className="panel-section project-info">
      <h3>Project</h3>
      <dl>
        <div>
          <dt>Total tiles</dt>
          <dd>{(width * height).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Land tiles</dt>
          <dd>{landTileCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Nations</dt>
          <dd>{projectNations.length}</dd>
        </div>
      </dl>
    </div>
  )
}

// ─── Country codes list (reused from EditorPage) ──────────────────────────────
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

function NationsSection({
  nations,
}: {
  nations: Array<{ id: string; name: string; countryCode?: string; x: number; y: number }>
}): React.ReactElement {
  const removeNation = useEditorStore((state) => state.removeNation)
  const updateNation = useEditorStore((state) => state.updateNation)
  const removeAllNations = useEditorStore((state) => state.removeAllNations)

  const [showEditor, setShowEditor] = React.useState(false)
  return (
    <div className="panel-section">
      <div className="nations-section-header">
        <h3>Nations</h3>
        {nations.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="nation-edit-all-btn"
              onClick={() => setShowEditor(true)}
              title="Open nation editor"
            >
              Edit
            </button>
            <button
              type="button"
              className="nation-remove-all-btn"
              onClick={removeAllNations}
              title="Remove all nations"
            >
              Remove all
            </button>
          </div>
        )}
      </div>

      {nations.length === 0 ? (
        <p className="empty-state">No nations placed yet.</p>
      ) : (
        <ul className="nations-list">
          {nations.map((nation) => (
            <li key={nation.id} className="nation-row">
              <div className="nation-row-info">
                {nation.countryCode ? (
                  <img
                    className="nation-flag"
                    src={flagUrl(nation.countryCode || 'us')}
                    alt={nation.countryCode || 'US'}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                    onLoad={(e) => { e.currentTarget.style.visibility = 'visible' }}
                  />
                ) : (
                  <div className="nation-flag nation-flag-placeholder" />
                )}
                <div>
                  <strong>{nation.name}</strong>
                  <span>{nation.x}, {nation.y}</span>
                </div>
              </div>
              <button
                type="button"
                className="nation-remove-btn"
                onClick={() => removeNation(nation.id)}
                aria-label="Remove nation"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEditor && (
        <NationEditorModal
          nations={nations}
          onUpdate={updateNation}
          onRemove={removeNation}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}

/**
 * Expanded nation editor modal with search, inline editing, and all controls.
 */
function NationEditorModal({
  nations,
  onUpdate,
  onRemove,
  onClose,
}: {
  nations: Array<{ id: string; name: string; countryCode?: string; x: number; y: number }>
  onUpdate: (id: string, updates: Partial<{ name: string; countryCode: string; x: number; y: number }>) => void
  onRemove: (id: string) => void
  onClose: () => void
}): React.ReactElement {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editCountryCode, setEditCountryCode] = React.useState('')

  const filtered = searchQuery.trim()
    ? nations.filter((n) => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : nations

  const startEdit = (nation: typeof nations[number]) => {
    setEditingId(nation.id)
    setEditName(nation.name)
    setEditCountryCode(nation.countryCode ?? '')
  }

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onUpdate(editingId, { name: editName.trim(), countryCode: editCountryCode })
    }
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="nation-modal" role="dialog" aria-modal="true" aria-labelledby="nation-editor-title">
        <button
          type="button"
          className="nation-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h2 id="nation-editor-title">Nation Editor</h2>
        <p>Search, edit, or remove nations.</p>

        {/* Search bar */}
        <input
          className="nation-editor-search"
          type="text"
          placeholder="Search nations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid var(--line)',
            borderRadius: 10,
            color: 'var(--text-strong)',
            background: 'rgba(2, 6, 23, 0.45)',
            fontSize: 13,
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        {/* Nation list */}
        <div className="nations-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p className="empty-state" style={{ textAlign: 'center', padding: 12 }}>
              {searchQuery ? 'No nations match your search.' : 'No nations placed yet.'}
            </p>
          ) : (
            filtered.map((nation) => {
              const isEditing = editingId === nation.id
              return (
                <div key={nation.id} className="nation-row" style={{ marginBottom: 6 }}>
                  {isEditing ? (
                    // Editing mode
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="nation-name-row" style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nation name"
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            border: '1px solid var(--line)',
                            borderRadius: 8,
                            color: 'var(--text-strong)',
                            background: 'rgba(2, 6, 23, 0.45)',
                            fontSize: 12,
                            minWidth: 0,
                          }}
                        />
                        <button
                          type="button"
                          className="secondary name-random-btn"
                          onClick={() => setEditName(generateGoofyName())}
                          title="Random name"
                          style={{ fontSize: 14, padding: '4px 8px' }}
                        >
                          🎲
                        </button>
                      </div>
                      <div className="flag-select-row" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {editCountryCode ? (
                          <img
                            className="flag-preview"
                            src={flagUrl(editCountryCode, 40)}
                            alt={editCountryCode}
                            onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                            onLoad={(e) => { e.currentTarget.style.visibility = 'visible' }}
                            style={{ width: 30, height: 20, borderRadius: 2 }}
                          />
                        ) : (
                          <div className="flag-preview-empty" style={{ width: 30, height: 20 }} />
                        )}
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            setEditCountryCode(COUNTRY_CODES[Math.floor(Math.random() * COUNTRY_CODES.length)])
                          }
                          title="Random flag"
                          style={{ fontSize: 14, padding: '4px 8px' }}
                        >
                          🎲
                        </button>
                        <select
                          value={editCountryCode}
                          onChange={(e) => setEditCountryCode(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            border: '1px solid var(--line)',
                            borderRadius: 8,
                            color: 'var(--text-strong)',
                            background: 'rgba(2, 6, 23, 0.45)',
                            fontSize: 12,
                          }}
                        >
                          <option value="">— No flag —</option>
                          {COUNTRY_CODES.map((code) => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button type="button" className="secondary" onClick={cancelEdit} style={{ fontSize: 11, padding: '3px 8px' }}>
                          Cancel
                        </button>
                        <button type="button" className="primary" onClick={saveEdit} style={{ fontSize: 11, padding: '3px 8px' }}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <>
                      <div className="nation-row-info">
                        {nation.countryCode ? (
                          <img
                            className="nation-flag"
                            src={flagUrl(nation.countryCode)}
                            alt={nation.countryCode}
                            onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                            onLoad={(e) => { e.currentTarget.style.visibility = 'visible' }}
                          />
                        ) : (
                          <div className="nation-flag nation-flag-placeholder" />
                        )}
                        <div>
                          <strong>{nation.name}</strong>
                          <span>{nation.x}, {nation.y}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => startEdit(nation)}
                          style={{ fontSize: 11, padding: '3px 7px' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="nation-remove-btn"
                          onClick={() => onRemove(nation.id)}
                          style={{ fontSize: 14, padding: '3px 7px' }}
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="nation-modal-actions" style={{ marginTop: 12 }}>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Nation placement help — shown only when the Nation tool is active.
 */
function NationHelp(): React.ReactElement {
  const pendingNationPlacement = useEditorStore((state) => state.pendingNationPlacement)

  return (
    <div className="panel-section">
      <h3>Nation tool</h3>
      <p className="empty-state" style={{ marginTop: 8, fontSize: 12 }}>
        {pendingNationPlacement
          ? 'Nation dialog is open — confirm or cancel it.'
          : 'Click a land tile to open the placement dialog.'}
      </p>
    </div>
  )
}

// Pre-computed water RGBA bytes
const WATER_R = 0x0b
const WATER_G = 0x4f
const WATER_B = 0x6c

// Editor magnitude (0-255) → game magnitude (0-30)
function toGameMag(m: number): number {
  return Math.round((m / 255) * 30)
}

/** Must stay in sync with BASE_TILE_SIZE in pixiMapRenderer.tsx */
const TILE_SIZE = 14

type MinimapMetrics = { offsetX: number; offsetY: number; renderW: number; renderH: number; scale: number }

function Minimap({
  width,
  height,
}: {
  width: number
  height: number
}): React.ReactElement {
  const minimapFrameRef = React.useRef<HTMLDivElement | null>(null)
  const minimapRef = useRef<HTMLCanvasElement | null>(null)

  // Stable metrics shared between the sizing code and the draw callback.
  const metricsRef = useRef<MinimapMetrics>({ offsetX: 0, offsetY: 0, renderW: 1, renderH: 1, scale: 1 })

  // Cached terrain ImageData — rebuilt only when renderRevision changes.
  const terrainImageDataRef = useRef<ImageData | null>(null)
  const terrainRevisionRef = useRef<number>(-1)

  // All drawing runs inside a Zustand subscription + rAF loop — no React
  // re-renders on pan / zoom / paint.
  useEffect(() => {
    const canvas = minimapRef.current
    const frame = minimapFrameRef.current
    if (!canvas || !frame) return

    let rafId: number | null = null

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx || canvas.width === 0) return

      const state = useEditorStore.getState()
      const { offsetX, offsetY, renderW, renderH, scale } = metricsRef.current

      // Rebuild terrain ImageData only when project content changed.
      if (state.renderRevision !== terrainRevisionRef.current) {
        const { project } = state
        const imageData = ctx.createImageData(renderW, renderH)
        const data = imageData.data
        for (let py = 0; py < renderH; py++) {
          const tileY = Math.floor((py / renderH) * height)
          const rowBase = tileY * width
          for (let px = 0; px < renderW; px++) {
            const tileX = Math.floor((px / renderW) * width)
            const srcIdx = rowBase + tileX
            const t = project.terrain[srcIdx] ?? 0
            const m = project.magnitude[srcIdx] ?? 0
            const dstIdx = (py * renderW + px) * 4
            if (t === 1) {
              const mag = toGameMag(m)
              let r: number, g: number, b: number
              if (mag < 10) {
                r = 190; g = 220 - 2 * mag; b = 138
              } else if (mag < 20) {
                r = Math.min(255, 200 + 2 * mag)
                g = Math.min(255, 183 + 2 * mag)
                b = Math.min(255, 138 + 2 * mag)
              } else {
                const v = Math.min(255, Math.floor(230 + mag / 2))
                r = v; g = v; b = v
              }
              data[dstIdx]     = r
              data[dstIdx + 1] = g
              data[dstIdx + 2] = b
              data[dstIdx + 3] = 255
            } else {
              data[dstIdx]     = WATER_R
              data[dstIdx + 1] = WATER_G
              data[dstIdx + 2] = WATER_B
              data[dstIdx + 3] = 255
            }
          }
        }
        terrainImageDataRef.current = imageData
        terrainRevisionRef.current = state.renderRevision
      }

      // Composite: background → terrain → border → nations → viewport rect.
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (terrainImageDataRef.current) {
        ctx.putImageData(terrainImageDataRef.current, offsetX, offsetY)
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(offsetX, offsetY, renderW, renderH)

      state.project.nations.forEach((nation) => {
        ctx.beginPath()
        ctx.fillStyle = '#f97316'
        ctx.arc(
          offsetX + ((nation.x + 0.5) / width) * renderW,
          offsetY + ((nation.y + 0.5) / height) * renderH,
          Math.max(2, scale * 0.25),
          0,
          Math.PI * 2,
        )
        ctx.fill()
      })

      // Viewport indicator — white rect tracking the visible area.
      // Fully zoomed out → rect equals minimap bounds → white border.
      const { zoom, panX, panY, viewportWidth, viewportHeight } = useViewportStore.getState()
      const tileLeft  = -panX / (TILE_SIZE * zoom)
      const tileTop   = -panY / (TILE_SIZE * zoom)
      const tilesWide = viewportWidth  / (TILE_SIZE * zoom)
      const tilesHigh = viewportHeight / (TILE_SIZE * zoom)

      const vx1 = offsetX + (tileLeft / width) * renderW
      const vy1 = offsetY + (tileTop  / height) * renderH
      const vx2 = offsetX + ((tileLeft + tilesWide) / width) * renderW
      const vy2 = offsetY + ((tileTop  + tilesHigh) / height) * renderH

      const cx1 = Math.max(offsetX, vx1)
      const cy1 = Math.max(offsetY, vy1)
      const cx2 = Math.min(offsetX + renderW, vx2)
      const cy2 = Math.min(offsetY + renderH, vy2)

      if (cx2 > cx1 && cy2 > cy1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        const lw = 1.5
        ctx.lineWidth = lw
        const dpr = window.devicePixelRatio || 1
        // Inset enough so the full stroke is visible even at canvas edges
        const inset = Math.ceil(lw * dpr) / dpr
        const rx = cx1 + inset
        const ry = cy1 + inset
        const rw = cx2 - cx1 - inset * 2
        const rh = cy2 - cy1 - inset * 2
        if (rw > 0 && rh > 0) {
          // Match the 10px CSS border-radius of .minimap-frame
          const r = Math.min(10 * dpr, rw / 2, rh / 2)
          ctx.beginPath()
          ctx.roundRect(rx, ry, rw, rh, r)
          ctx.stroke()
        }
      }
    }

    /** Size the canvas to the frame, recompute metrics, then draw. */
    const sizeAndDraw = () => {
      const { width: fw, height: fh } = frame.getBoundingClientRect()
      if (fw === 0 || fh === 0) return

      const dpr = window.devicePixelRatio || 1
      const cw = Math.floor(fw * dpr)
      const ch = Math.floor(fh * dpr)

      // Always recompute metrics so that tile-dimension changes (new map size)
      // are reflected even when the container pixel size hasn't changed.
      const s = Math.min((fw * dpr) / width, (fh * dpr) / height)
      const rW = Math.max(1, Math.round(width * s))
      const rH = Math.max(1, Math.round(height * s))
      const ox = Math.floor(((fw * dpr) - rW) / 2)
      const oy = Math.floor(((fh * dpr) - rH) / 2)

      const prev = metricsRef.current
      const metricsChanged =
        canvas.width !== cw ||
        canvas.height !== ch ||
        prev.renderW !== rW ||
        prev.renderH !== rH ||
        prev.offsetX !== ox ||
        prev.offsetY !== oy

      if (metricsChanged) {
        canvas.width = cw
        canvas.height = ch
        canvas.style.width = `${fw}px`
        canvas.style.height = `${fh}px`
        metricsRef.current = { offsetX: ox, offsetY: oy, renderW: rW, renderH: rH, scale: s }
        // Metrics changed — force full terrain ImageData rebuild.
        terrainRevisionRef.current = -1
      }

      draw()
    }

    /** Schedule at most one draw per animation frame. */
    const schedule = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => { rafId = null; sizeAndDraw() })
    }

    // Subscribe to BOTH stores so minimap updates on terrain changes AND viewport changes.
    // The rAF guard ensures at most one canvas composite per frame.
    const unsub1 = useEditorStore.subscribe(schedule)
    const unsub2 = useViewportStore.subscribe(schedule)
    schedule() // draw immediately on mount / map-dimension change

    return () => {
      unsub1()
      unsub2()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }, [width, height]) // re-run only when the map tile dimensions change

  return (
    <div
      ref={minimapFrameRef}
      className="minimap-frame"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <canvas ref={minimapRef} className="minimap-canvas" aria-label="Project minimap" />
    </div>
  )
}

function MapSizePanel({
  width,
  height,
}: {
  width: number
  height: number
}): React.ReactElement {
  const [nextWidth, setNextWidth] = React.useState(width)
  const [nextHeight, setNextHeight] = React.useState(height)

  // Keep local state in sync when the project changes externally
  React.useEffect(() => {
    setNextWidth(width)
    setNextHeight(height)
  }, [width, height])

  return (
    <div className="panel-section">
      <h3>New Map</h3>
      <p className="empty-state" style={{ marginBottom: 10, fontSize: 12 }}>
        Create a new blank map with custom dimensions.
      </p>
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
        className="primary"
        onClick={() => useEditorStore.getState().createBlankProject(nextWidth, nextHeight)}
        style={{ width: '100%' }}
      >
        Create blank map
      </button>
    </div>
  )
}

function ExportSection({
  onExportMap,
  exportStatus,
  exportFiles,
}: {
  onExportMap?: () => void
  exportStatus: string
  exportFiles: string[]
}): React.ReactElement {
  return (
    <div className="panel-section">
      <h3>Export</h3>
      {exportStatus !== 'Idle' && <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 8px' }}>{exportStatus}</p>}
      {onExportMap && (
        <button type="button" className="primary" onClick={onExportMap} style={{ width: '100%' }}>
          Export Map Files
        </button>
      )}
      {exportFiles.length > 0 ? (
        <ul className="nations-list export-list">
          {exportFiles.map((fileName) => (
            <li key={fileName} className="nation-row">
              <span>{fileName}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
