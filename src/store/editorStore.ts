import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { buildMapTexture, updateMapPixels } from '../lib/mapTexture'
import { useViewportStore } from './viewportStore'
import { useUndoStore } from './undoStore'

export const MAX_LAND_TILES = 3_000_000

/**
 * Module-level running land-tile count — updated inline by paintTilesDirect
 * (hot path) and synced to the Zustand store on commitPaint / project load.
 */
let _landTileCount = 0

/**
 * True while a paint stroke is in-flight (between beginPaint and commitPaint).
 * Guards against double-commits and allows undo/redo to safely auto-commit
 * an active stroke before executing.
 */
let _isPainting = false

function countLandTiles(terrain: Uint8Array): number {
  let n = 0
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === 1) n++
  }
  return n
}

/**
 * Hot-path paint: mutates terrain/magnitude TypedArrays in-place WITHOUT
 * going through Immer.  After mutating, writes the changed pixels directly
 * into the shared ImageData buffer (no chunk cache, no LRU, no copy).
 *
 * Enforces the MAX_LAND_TILES limit: land tiles that would push the count
 * over the limit are silently skipped.
 *
 * Call commitPaint() on pointerup to bump renderRevision and trigger the
 * persist middleware so the stroke is saved to localStorage.
 */
export function paintTilesDirect(tileX: number, tileY: number): void {
  const { project, tool, brushSize, elevationValue } = useEditorStore.getState()
  const radius = Math.max(0, brushSize - 1)
  const { terrain, magnitude, width, height } = project

  let landDelta = 0

  for (let y = tileY - radius; y <= tileY + radius; y++) {
    if (y < 0 || y >= height) continue
    for (let x = tileX - radius; x <= tileX + radius; x++) {
      if (x < 0 || x >= width) continue
      const index = y * width + x
      if (tool === 'water') {
        if (terrain[index] === 1) landDelta--
        terrain[index] = 0
        magnitude[index] = 0
      } else {
        if (terrain[index] === 0) {
          // Would add a new land tile — enforce limit
          if (_landTileCount + landDelta >= MAX_LAND_TILES) continue
          landDelta++
        }
        terrain[index] = 1
        magnitude[index] = elevationValue
      }
    }
  }

  _landTileCount += landDelta

  // Write the painted rect directly into the shared ImageData buffer.
  updateMapPixels(project, tileX - radius, tileY - radius, tileX + radius, tileY + radius)
}

// Helper to serialize Uint8Array to base64 for efficient localStorage storage
function typedArrayToBase64(arr: Uint8Array): string {
  // Use Blob + FileReader-free path: btoa on chunked binary string
  // Chunk to avoid call-stack overflow on large arrays
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode(...arr.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// Helper to deserialize base64 to Uint8Array
function base64ToTypedArray(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const len = binaryString.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    arr[i] = binaryString.charCodeAt(i)
  }
  return arr
}

export type TerrainType = 0 | 1

export type Nation = {
  id: string
  name: string
  countryCode: string
  x: number
  y: number
}

export type MapMetadata = {
  author: string
  description: string
}

export type MapProject = {
  name: string
  width: number
  height: number
  terrain: Uint8Array
  magnitude: Uint8Array
  nations: Nation[]
  metadata: MapMetadata
}

export type EditorTool = 'land' | 'water' | 'nation'

type PendingNationPlacement = {
  x: number
  y: number
} | null

// Type for localStorage storage - uses base64 strings instead of arrays
type SerializedProject = Omit<MapProject, 'terrain' | 'magnitude'> & {
  terrain: string
  magnitude: string
}

type EditorStoreState = {
  project: MapProject
  tool: EditorTool
  brushSize: number
  elevationValue: number
  nationName: string
  nationCountryCode: string
  pendingNationPlacement: PendingNationPlacement
  landTileCount: number
  renderRevision: number
  createBlankProject: (width?: number, height?: number) => void
  setTool: (tool: EditorTool) => void
  setBrushSize: (brushSize: number) => void
  setElevationValue: (value: number) => void
  setNationName: (name: string) => void
  setNationCountryCode: (countryCode: string) => void
  paintAt: (tileX: number, tileY: number) => void
  beginPaint: () => void
  commitPaint: () => void
  addNationAt: (tileX: number, tileY: number) => void
  confirmNationPlacement: () => void
  cancelNationPlacement: () => void
  removeNation: (nationId: string) => void
  removeAllNations: () => void
  autoAddNations: (count: number) => void
  undo: () => void
  redo: () => void
  setProjectName: (name: string) => void
  setProjectMetadata: (key: keyof MapMetadata, value: string) => void
  loadProject: (project: MapProject) => void
}

const DEFAULT_WIDTH = 64
const DEFAULT_HEIGHT = 48

function createBlankTerrain(width: number, height: number) {
  return new Uint8Array(width * height)
}

function createBlankProject(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): MapProject {
  return {
    name: 'Untitled map',
    width,
    height,
    terrain: createBlankTerrain(width, height),
    magnitude: new Uint8Array(width * height),
    nations: [],
    metadata: {
      author: '',
      description: '',
    },
  }
}

function serializeProject(project: MapProject): SerializedProject {
  return {
    name: project.name,
    width: project.width,
    height: project.height,
    terrain: typedArrayToBase64(project.terrain),
    magnitude: typedArrayToBase64(project.magnitude),
    nations: project.nations,
    metadata: project.metadata,
  }
}

function deserializeProject(project: SerializedProject | MapProject): MapProject {
  return {
    name: project.name,
    width: project.width,
    height: project.height,
    terrain:
      project.terrain instanceof Uint8Array
        ? project.terrain
        : base64ToTypedArray(project.terrain as string),
    magnitude:
      project.magnitude instanceof Uint8Array
        ? project.magnitude
        : base64ToTypedArray(project.magnitude as string),
    nations: (project.nations ?? []).map((nation) => ({
      ...nation,
      countryCode: nation.countryCode || 'US',
    })),
    metadata: project.metadata ?? {
      author: '',
      description: '',
    },
  }
}

function createNationId() {
  return `nation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

// Partialize returns raw MapProject (not serialized).
type PartializedEditorState = {
  project: MapProject
  tool: EditorTool
  brushSize: number
  elevationValue: number
  nationName: string
  nationCountryCode: string
}

/**
 * Deferred-serialization persist storage.
 *
 * The key optimization: partialize() returns the raw MapProject (no base64
 * encoding), and setItem() defers the expensive serializeProject() +
 * JSON.stringify() work into a debounced setTimeout. This means every
 * setState call on the editor store is O(1), not O(map-size).
 *
 * Without this, Zustand's persist middleware called partialize() +
 * JSON.stringify(serializeProject(...)) synchronously on EVERY setState,
 * causing ~100ms+ of main-thread blocking on each zoom/pan/paint event
 * for large maps.
 */
let persistDeferTimer: ReturnType<typeof setTimeout> | null = null
const PERSIST_DEBOUNCE_MS = 1000

const deferredStorage = {
  getItem(name: string): { state: PartializedEditorState; version?: number } | null {
    try {
      const raw = localStorage.getItem(name)
      if (!raw) return null
      const parsed = JSON.parse(raw) as {
        state: { project: SerializedProject | MapProject } & Omit<PartializedEditorState, 'project'>
        version?: number
      }
      return {
        state: {
          ...parsed.state,
          project: deserializeProject(parsed.state.project),
        },
        version: parsed.version,
      }
    } catch {
      return null
    }
  },
  setItem(name: string, value: { state: PartializedEditorState; version?: number }): void {
    if (persistDeferTimer !== null) clearTimeout(persistDeferTimer)
    persistDeferTimer = setTimeout(() => {
      persistDeferTimer = null
      try {
        const serializable = {
          ...value,
          state: {
            ...value.state,
            project: serializeProject(value.state.project),
          },
        }
        localStorage.setItem(name, JSON.stringify(serializable))
      } catch {
        // QuotaExceededError — map too large; ignore silently
      }
    }, PERSIST_DEBOUNCE_MS)
  },
  removeItem(name: string): void {
    try {
      localStorage.removeItem(name)
    } catch {
      // Ignore
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

// ── Auto-add nation helpers ───────────────────────────────────────────────────

const _ADJ = 'Mighty,Chunky,Wobbly,Spicy,Soggy,Turbo,Legendary,Fluffy,Cosmic,Sneaky,Grumpy,Crispy,Fancy,Funky,Grand,Mystical,Radical,Saucy,Supreme,Wacky,Rusty,Glamorous,Cursed,Ancient,Electric,Feral,Hollow,Infinite,Jolly,Knightly'.split(',')
const _NNS = 'Penguins,Narwhals,Potatoes,Wombats,Ducks,Llamas,Muffins,Pickles,Bananas,Noodles,Beavers,Donkeys,Rascals,Yetis,Goblins,Badgers,Toads,Vikings,Wizards,Ninjas,Sloths,Hedgehogs,Axolotls,Capybaras,Platypuses,Corgis,Ferrets,Salamanders,Krakens,Parrots'.split(',')
const _FLG = 'AD,AE,AF,AG,AL,AM,AR,AT,AU,AZ,BA,BD,BE,BG,BO,BR,BY,CA,CH,CL,CN,CO,CZ,DE,DK,EG,ES,ET,FI,FR,GA,GB,GH,GR,GT,HN,HR,HU,ID,IE,IL,IN,IQ,IR,IT,JP,KE,KR,KZ,LA,LB,LY,MA,MX,MY,NG,NL,NO,NZ,PE,PH,PK,PL,PT,RO,RS,RU,SA,SE,SG,SK,SN,SO,SR,SY,TH,TN,TR,TZ,UA,UG,US,UY,UZ,VE,VN,YE,ZA,ZM,ZW'.split(',')

function _rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randomGoofyName(): string { return `${_rnd(_ADJ)} ${_rnd(_NNS)}` }
function randomFlag(): string { return _rnd(_FLG) }

export const useEditorStore = create<EditorStoreState>()(
  persist(
    immer((set) => ({
      project: createBlankProject(),
      tool: 'land',
      brushSize: 1,
      elevationValue: 128,
      nationName: 'Spawn 1',
      nationCountryCode: 'US',
      pendingNationPlacement: null,
      landTileCount: 0,
      renderRevision: 0,
      createBlankProject: (width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) => {
        const newProject = createBlankProject(width, height)
        buildMapTexture(newProject)
        _landTileCount = 0
        set((state) => {
          state.project = newProject
          state.tool = 'land'
          state.nationName = 'Spawn 1'
          state.nationCountryCode = 'US'
          state.pendingNationPlacement = null
          state.landTileCount = 0
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
        useViewportStore.setState({ pendingFitToView: true })
      },
      setTool: (tool) =>
        set((state) => {
          state.tool = tool
          if (tool !== 'nation') {
            state.pendingNationPlacement = null
          }
        }),
      setBrushSize: (brushSize) =>
        set((state) => {
          state.brushSize = Math.max(1, Math.min(50, Math.round(brushSize)))
        }),
      setElevationValue: (value) =>
        set((state) => {
          state.elevationValue = Math.max(0, Math.min(255, Math.round(value)))
        }),
      setNationName: (name) =>
        set((state) => {
          state.nationName = name
        }),
      setNationCountryCode: (countryCode) =>
        set((state) => {
          state.nationCountryCode = countryCode
        }),
      paintAt: (tileX, tileY) => {
        paintTilesDirect(tileX, tileY)
      },
      beginPaint: () => {
        // Snapshot the PRE-stroke state so undo can restore it.
        // Called from handlePointerDown BEFORE any paintTilesDirect calls.
        // Use _landTileCount (module-level, always current) not the store's
        // landTileCount which may be stale if a prior commit was missed.
        _isPainting = true
        const { project } = useEditorStore.getState()
        useUndoStore.getState().push(project.terrain, project.magnitude, project.nations, _landTileCount)
      },
      commitPaint: () => {
        // Guard: no-op if no stroke is in-flight (prevents double-commits from
        // handleMouseLeave + handlePointerUp firing in quick succession).
        if (!_isPainting) return
        _isPainting = false
        set((state) => {
          state.landTileCount = _landTileCount
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
      addNationAt: (tileX, tileY) =>
        set((state) => {
          const { terrain, width, height } = state.project
          if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) return
          if (terrain[tileY * width + tileX] !== 1) return

          if (!state.nationName.trim()) {
            state.nationName = `Spawn ${state.project.nations.length + 1}`
          }

          state.pendingNationPlacement = {
            x: tileX,
            y: tileY,
          }
        }),
      confirmNationPlacement: () => {
        // Capture snapshot data OUTSIDE the Immer producer to avoid passing
        // draft proxies to cloneSnapshot, and to keep side-effects out of set().
        const currentState = useEditorStore.getState()
        const pending = currentState.pendingNationPlacement
        if (!pending) return
        const { project } = currentState
        const { terrain, width, height } = project

        if (
          pending.x < 0 || pending.x >= width ||
          pending.y < 0 || pending.y >= height ||
          terrain[pending.y * width + pending.x] !== 1
        ) {
          set((state) => { state.pendingNationPlacement = null })
          return
        }

        // Push snapshot before mutation, using real _landTileCount.
        useUndoStore.getState().push(project.terrain, project.magnitude, project.nations, _landTileCount)

        set((state) => {
          const label = state.nationName.trim() || `Spawn ${state.project.nations.length + 1}`
          state.project.nations.push({
            id: createNationId(),
            name: label,
            countryCode: state.nationCountryCode || 'US',
            x: pending.x,
            y: pending.y,
          })
          state.pendingNationPlacement = null
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
      cancelNationPlacement: () =>
        set((state) => {
          state.pendingNationPlacement = null
        }),
      removeNation: (nationId) => {
        const { project } = useEditorStore.getState()
        useUndoStore.getState().push(project.terrain, project.magnitude, project.nations, _landTileCount)
        set((state) => {
          state.project.nations = state.project.nations.filter((nation) => nation.id !== nationId)
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
      removeAllNations: () => {
        const { project } = useEditorStore.getState()
        useUndoStore.getState().push(project.terrain, project.magnitude, project.nations, _landTileCount)
        set((state) => {
          state.project.nations = []
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
      autoAddNations: (count) => {
        const { project } = useEditorStore.getState()
        useUndoStore.getState().push(project.terrain, project.magnitude, project.nations, _landTileCount)
        set((state) => {
          const { terrain, width } = state.project
          // Collect land tile flat indices
          const land: number[] = []
          for (let i = 0; i < terrain.length; i++) {
            if (terrain[i] === 1) land.push(i)
          }
          if (land.length === 0 || count <= 0) return
          const actual = Math.min(count, land.length)
          const minDist = Math.max(1, Math.sqrt(land.length / actual) * 0.6)
          const placed: Array<{ x: number; y: number }> = []
          let tries = 0
          const maxTries = actual * 30
          while (placed.length < actual && tries < maxTries) {
            tries++
            const idx = land[Math.floor(Math.random() * land.length)]
            const cx = idx % width
            const cy = Math.floor(idx / width)
            let ok = true
            for (const p of placed) {
              const dx = p.x - cx; const dy = p.y - cy
              if (dx * dx + dy * dy < minDist * minDist) { ok = false; break }
            }
            if (ok) placed.push({ x: cx, y: cy })
          }
          // Fill remainder without distance constraint if needed
          if (placed.length < actual) {
            for (let i = land.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [land[i], land[j]] = [land[j], land[i]]
            }
            for (const idx of land) {
              if (placed.length >= actual) break
              const cx = idx % width; const cy = Math.floor(idx / width)
              if (!placed.some((p) => p.x === cx && p.y === cy)) placed.push({ x: cx, y: cy })
            }
          }
          for (const pos of placed) {
            state.project.nations.push({
              id: createNationId(),
              name: randomGoofyName(),
              countryCode: randomFlag(),
              x: pos.x,
              y: pos.y,
            })
          }
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
      undo: () => {
        // commitPaint() is called by the keyboard/button handler before invoking
        // undo(), so _isPainting is always false here. _landTileCount is the
        // authoritative land count (store's landTileCount may lag one tick).
        const { project } = useEditorStore.getState()
        const undoStore = useUndoStore.getState()
        if (!undoStore.canUndo()) return
        // Save current state to redo stack BEFORE popping undo.
        undoStore.peekCurrentForRedo(project.terrain, project.magnitude, project.nations, _landTileCount)
        const snapshot = undoStore.popUndo()
        if (!snapshot) return
        // Copy snapshot data into the live arrays (TypedArrays are not Immer-proxied).
        project.terrain.set(snapshot.terrain)
        project.magnitude.set(snapshot.magnitude)
        buildMapTexture(project)
        _landTileCount = snapshot.landTileCount
        set((state) => {
          state.project.nations = snapshot.nations.map((n) => ({ ...n }))
          state.landTileCount = snapshot.landTileCount
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
      redo: () => {
        const { project } = useEditorStore.getState()
        const undoStore = useUndoStore.getState()
        if (!undoStore.canRedo()) return
        // Pop redo snapshot BEFORE saving current state, so the redo stack
        // reference is stable when we call pushToUndo.
        const snapshot = undoStore.popRedo()
        if (!snapshot) return
        // Save current state to undo stack (without clearing remaining redo entries).
        undoStore.pushToUndo(project.terrain, project.magnitude, project.nations, _landTileCount)
        project.terrain.set(snapshot.terrain)
        project.magnitude.set(snapshot.magnitude)
        buildMapTexture(project)
        _landTileCount = snapshot.landTileCount
        set((state) => {
          state.project.nations = snapshot.nations.map((n) => ({ ...n }))
          state.landTileCount = snapshot.landTileCount
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
      setProjectName: (name) =>
        set((state) => {
          state.project.name = name
        }),
      setProjectMetadata: (key, value) =>
        set((state) => {
          state.project.metadata[key] = value
        }),
      loadProject: (project) => {
        buildMapTexture(project)
        _landTileCount = countLandTiles(project.terrain)
        useUndoStore.getState().clear()
        set((state) => {
          state.project = project
          state.landTileCount = _landTileCount
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
        useViewportStore.setState({ pendingFitToView: true })
      },
    })),
    {
      name: 'openfront-editor-state',
      storage: deferredStorage,
      partialize: (state) => ({
        project: state.project,
        tool: state.tool,
        brushSize: state.brushSize,
        elevationValue: state.elevationValue,
        nationName: state.nationName,
        nationCountryCode: state.nationCountryCode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.project) {
          buildMapTexture(state.project)
          _landTileCount = countLandTiles(state.project.terrain)
          state.landTileCount = _landTileCount
        }
      },
      merge: (persistedState, currentState) => {
        const saved = persistedState as Partial<EditorStoreState> & {
          project?: SerializedProject | MapProject
        }

        return {
          ...currentState,
          ...saved,
          project: saved.project ? deserializeProject(saved.project) : currentState.project,
        }
      },
    },
  ),
)

export const createNewBlankProject = createBlankProject