import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildMapTexture, updateMapPixels } from '../lib/mapTexture'

export const MAX_LAND_TILES = 3_000_000

/**
 * Module-level running land-tile count — updated inline by paintTilesDirect
 * (hot path) and synced to the Zustand store on commitPaint / project load.
 */
let _landTileCount = 0

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
  zoom: number
  panX: number
  panY: number
  /** Current number of land tiles — updated on commitPaint / project load. */
  landTileCount: number
  /** CSS-pixel dimensions of the map canvas — updated by the renderer. */
  viewportWidth: number
  viewportHeight: number
  /** Set true when a new blank project is created so renderer fits it to view. */
  pendingFitToView: boolean
  renderRevision: number
  isPanning: boolean
  panStartX: number
  panStartY: number
  projectStartPanX: number
  projectStartPanY: number
  createBlankProject: (width?: number, height?: number) => void
  setTool: (tool: EditorTool) => void
  setBrushSize: (brushSize: number) => void
  setElevationValue: (value: number) => void
  setNationName: (name: string) => void
  setZoom: (zoom: number) => void
  setPan: (panX: number, panY: number) => void
  /** Set zoom and pan in a single Immer/Zustand call to avoid double React re-renders. */
  setZoomAndPan: (zoom: number, panX: number, panY: number) => void
  setViewport: (width: number, height: number) => void
  clearFitToView: () => void
  startPan: (clientX: number, clientY: number) => void
  movePan: (clientX: number, clientY: number) => void
  endPan: () => void
  paintAt: (tileX: number, tileY: number) => void
  commitPaint: () => void
  addNationAt: (tileX: number, tileY: number) => void
  removeNation: (nationId: string) => void
  setProjectName: (name: string) => void
  setProjectMetadata: (key: keyof MapMetadata, value: string) => void
  /** Replace the current project with a fully-formed MapProject (e.g. from image import). */
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
    nations: project.nations ?? [],
    metadata: project.metadata ?? {
      author: '',
      description: '',
    },
  }
}

function createNationId() {
  return `nation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

/**
 * A localStorage wrapper that:
 * 1. Silently swallows QuotaExceededError
 * 2. Debounces writes so rapid state updates (e.g. brush strokes) don't hammer
 *    the serialization pipeline on every pointer-move event.
 */
let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null
const PERSIST_DEBOUNCE_MS = 500 // write at most once per 500 ms

const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    // Debounce: cancel previous pending write and schedule a new one
    if (persistDebounceTimer !== null) {
      clearTimeout(persistDebounceTimer)
    }
    persistDebounceTimer = setTimeout(() => {
      persistDebounceTimer = null
      try {
        localStorage.setItem(name, value)
      } catch {
        // QuotaExceededError — map is too large to persist; ignore silently.
      }
    }, PERSIST_DEBOUNCE_MS)
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name)
    } catch {
      // Ignore.
    }
  },
}

export const useEditorStore = create<EditorStoreState>()(
  persist(
    immer((set, get) => ({
      project: createBlankProject(),
      tool: 'land',
      brushSize: 1,
      elevationValue: 128,
      nationName: 'Spawn 1',
      zoom: 1,
      panX: 0,
      panY: 0,
      landTileCount: 0,
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 800,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 600,
      pendingFitToView: true,
      renderRevision: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      projectStartPanX: 0,
      projectStartPanY: 0,
      createBlankProject: (width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) => {
        // Build the map texture BEFORE updating the store so the pixel buffer
        // is ready by the time the next render frame fires.
        const newProject = createBlankProject(width, height)
        buildMapTexture(newProject)
        _landTileCount = 0
        set((state) => {
          state.project = newProject
          state.tool = 'land'
          state.landTileCount = 0
          state.pendingFitToView = true
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
      setTool: (tool) =>
        set((state) => {
          state.tool = tool
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
      setZoom: (zoom) =>
        set((state) => {
          state.zoom = Math.max(0.05, Math.min(6, zoom))
        }),
      setPan: (panX, panY) =>
        set((state) => {
          state.panX = panX
          state.panY = panY
        }),
      setZoomAndPan: (zoom, panX, panY) =>
        set((state) => {
          state.zoom = Math.max(0.05, Math.min(6, zoom))
          state.panX = panX
          state.panY = panY
        }),
      setViewport: (width, height) =>
        set((state) => {
          state.viewportWidth = width
          state.viewportHeight = height
        }),
      clearFitToView: () =>
        set((state) => {
          state.pendingFitToView = false
        }),
      startPan: (clientX, clientY) => {
        const { panX, panY } = get()
        set((state) => {
          state.isPanning = true
          state.panStartX = clientX
          state.panStartY = clientY
          state.projectStartPanX = panX
          state.projectStartPanY = panY
        })
      },
      movePan: (clientX, clientY) => {
        const { isPanning, panStartX, panStartY, projectStartPanX, projectStartPanY } = get()
        if (!isPanning) {
          return
        }

        const dx = clientX - panStartX
        const dy = clientY - panStartY

        set((state) => {
          state.panX = projectStartPanX + dx
          state.panY = projectStartPanY + dy
        })
      },
      endPan: () =>
        set((state) => {
          state.isPanning = false
        }),
      paintAt: (tileX, tileY) => {
        // Kept for test compatibility.  Hot-path painting uses paintTilesDirect.
        paintTilesDirect(tileX, tileY)
      },
      commitPaint: () =>
        set((state) => {
          // Signal persist middleware after a paint stroke ends.
          // terrain/magnitude were already mutated in-place by paintTilesDirect;
          // Immer finalises them with the same references.
          state.landTileCount = _landTileCount
          state.renderRevision = (state.renderRevision ?? 0) + 1
        }),
      addNationAt: (tileX, tileY) =>
        set((state) => {
          const { terrain, width, height } = state.project
          // Only place nations on land tiles
          if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) return
          if (terrain[tileY * width + tileX] !== 1) return

          const label = state.nationName.trim() || `Spawn ${state.project.nations.length + 1}`

          state.project.nations.push({
            id: createNationId(),
            name: label,
            x: tileX,
            y: tileY,
          })
          state.renderRevision = (state.renderRevision ?? 0) + 1
        }),
      removeNation: (nationId) =>
        set((state) => {
          state.project.nations = state.project.nations.filter((nation) => nation.id !== nationId)
          state.renderRevision = (state.renderRevision ?? 0) + 1
        }),
      setProjectName: (name) =>
        set((state) => {
          state.project.name = name
          // Name change doesn't affect visual rendering — no renderRevision bump needed
        }),
      setProjectMetadata: (key, value) =>
        set((state) => {
          state.project.metadata[key] = value
          // Metadata changes don't affect visual rendering — no renderRevision bump needed
        }),
      loadProject: (project) => {
        buildMapTexture(project)
        _landTileCount = countLandTiles(project.terrain)
        set((state) => {
          state.project = project
          state.landTileCount = _landTileCount
          state.pendingFitToView = true
          state.renderRevision = (state.renderRevision ?? 0) + 1
        })
      },
    })),
    {
      name: 'openfront-editor-state',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        project: serializeProject(state.project),
        tool: state.tool,
        brushSize: state.brushSize,
        elevationValue: state.elevationValue,
        nationName: state.nationName,
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
      }),
      onRehydrateStorage: () => (state) => {
        // After localStorage data is parsed and merged, ensure the map texture
        // pixel buffer is built for the loaded (or initial) project.
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
          // Rehydrated projects restore saved zoom/pan — no need to re-fit.
          pendingFitToView: false,
        }
      },
    },
  ),
)

export const createNewBlankProject = createBlankProject