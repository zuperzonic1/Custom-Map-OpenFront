import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createJSONStorage, persist } from 'zustand/middleware'

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

export type EditorTool = 'land' | 'water' | 'elevation' | 'nation'

type SerializedProject = Omit<MapProject, 'terrain' | 'magnitude'> & {
  terrain: number[]
  magnitude: number[]
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
  startPan: (clientX: number, clientY: number) => void
  movePan: (clientX: number, clientY: number) => void
  endPan: () => void
  paintAt: (tileX: number, tileY: number) => void
  addNationAt: (tileX: number, tileY: number) => void
  removeNation: (nationId: string) => void
  setProjectName: (name: string) => void
  setProjectMetadata: (key: keyof MapMetadata, value: string) => void
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
    terrain: Array.from(project.terrain),
    magnitude: Array.from(project.magnitude),
    nations: project.nations,
    metadata: project.metadata,
  }
}

function deserializeProject(project: SerializedProject | MapProject): MapProject {
  return {
    name: project.name,
    width: project.width,
    height: project.height,
    terrain: project.terrain instanceof Uint8Array ? project.terrain : Uint8Array.from(project.terrain),
    magnitude:
      project.magnitude instanceof Uint8Array
        ? project.magnitude
        : Uint8Array.from(project.magnitude),
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
      renderRevision: 0,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      projectStartPanX: 0,
      projectStartPanY: 0,
      createBlankProject: (width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) =>
        set((state) => {
          state.project = createBlankProject(width, height)
          state.panX = 0
          state.panY = 0
          state.zoom = 1
          state.tool = 'land'
          state.renderRevision = (state.renderRevision ?? 0) + 1
        }),
      setTool: (tool) =>
        set((state) => {
          state.tool = tool
        }),
      setBrushSize: (brushSize) =>
        set((state) => {
          state.brushSize = Math.max(1, Math.min(10, Math.round(brushSize)))
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
          // Allow much smaller zoom so very large maps can be fully visible.
          state.zoom = Math.max(0.05, Math.min(6, zoom))
        }),
      setPan: (panX, panY) =>
        set((state) => {
          state.panX = panX
          state.panY = panY
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
      paintAt: (tileX, tileY) =>
        set((state) => {
          const { project, brushSize, tool, elevationValue } = state
          const radius = Math.max(0, brushSize - 1)
          const terrain = project.terrain
          const magnitude = project.magnitude

          for (let y = tileY - radius; y <= tileY + radius; y += 1) {
            if (y < 0 || y >= project.height) {
              continue
            }

            for (let x = tileX - radius; x <= tileX + radius; x += 1) {
              if (x < 0 || x >= project.width) {
                continue
              }

              const index = y * project.width + x

              if (tool === 'water') {
                terrain[index] = 0
                magnitude[index] = 0
                continue
              }

              terrain[index] = 1
              magnitude[index] = tool === 'elevation' ? elevationValue : 180
            }
          }
        }),
      addNationAt: (tileX, tileY) =>
        set((state) => {
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
          state.renderRevision = (state.renderRevision ?? 0) + 1
        }),
      setProjectMetadata: (key, value) =>
        set((state) => {
          state.project.metadata[key] = value
          state.renderRevision = (state.renderRevision ?? 0) + 1
        }),
    })),
    {
      name: 'openfront-editor-state',
      storage: createJSONStorage(() => localStorage),
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