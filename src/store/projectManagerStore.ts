/**
 * Project Manager Store
 *
 * Manages a registry of all projects (ProjectSummary) and handles saving/loading
 * full project data to/from localStorage. Each project gets its own localStorage
 * key: `openfront-project-{id}`.
 *
 * The editorStore no longer uses Zustand persist — the project manager owns all
 * persistence.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { MapProject, EditorTool, BrushShape } from './editorStore'
import { buildMapTexture } from '../lib/mapTexture'
import {
  createNewBlankProject,
  useEditorStore,
  typedArrayToBase64,
  base64ToTypedArray,
  countLandTiles,
} from './editorStore'
import { useUndoStore } from './undoStore'
import { useViewportStore } from './viewportStore'

// ── Types ──────────────────────────────────────────────────────────────────

export type ProjectSummary = {
  id: string
  name: string
  width: number
  height: number
  createdAt: number
  lastModified: number
  landTileCount: number
  thumbnailUrl?: string  // base64 data URL of a small preview
}

type EditorSettings = {
  tool: EditorTool
  brushSize: number
  brushShape: BrushShape
  elevationValue: number
  nationName: string
  nationCountryCode: string
}

type SerializedProjectData = {
  project: {
    name: string
    width: number
    height: number
    terrain: string  // base64
    magnitude: string // base64
    nations: Array<{ id: string; name: string; countryCode: string; x: number; y: number }>
    metadata: {
      author: string
      description: string
      id: string
      translation_key: string
      categories: string[]
      multiplayer_frequency: number
    }
  }
  editor: EditorSettings
}

const STORAGE_KEY_INDEX = 'openfront-project-manager'

function createProjectId(): string {
  return `proj-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createGoofyName(): string {
  const adjectives = 'Mighty,Chunky,Wobbly,Spicy,Soggy,Turbo,Legendary,Fluffy,Cosmic,Sneaky,Grumpy,Crispy,Fancy,Funky,Grand,Mystical,Radical,Saucy,Supreme,Wacky,Rusty,Glamorous,Cursed,Ancient,Electric,Feral,Hollow,Infinite,Jolly,Knightly'.split(',')
  const nouns = 'Penguins,Narwhals,Potatoes,Wombats,Ducks,Llamas,Muffins,Pickles,Bananas,Noodles,Beavers,Donkeys,Rascals,Yetis,Goblins,Badgers,Toads,Vikings,Wizards,Ninjas,Sloths,Hedgehogs,Axolotls,Capybaras,Platypuses,Corgis,Ferrets,Salamanders,Krakens,Parrots'.split(',')
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`
}

function deserializeProjectData(raw: SerializedProjectData): {
  project: MapProject
  editor: EditorSettings
} {
  const p = raw.project
  return {
    project: {
      name: p.name,
      width: p.width,
      height: p.height,
      terrain: base64ToTypedArray(p.terrain),
      magnitude: base64ToTypedArray(p.magnitude),
      nations: (p.nations ?? []).map((n) => ({
        ...n,
        countryCode: n.countryCode ?? '',
      })),
      metadata: {
        author: p.metadata?.author ?? '',
        description: p.metadata?.description ?? '',
        id: p.metadata?.id ?? '',
        translation_key: p.metadata?.translation_key ?? '',
        categories: p.metadata?.categories ?? [],
        multiplayer_frequency: p.metadata?.multiplayer_frequency ?? 4,
      },
    },
    editor: raw.editor,
  }
}

function serializeProjectData(
  project: MapProject,
  editor: EditorSettings,
): SerializedProjectData {
  return {
    project: {
      name: project.name,
      width: project.width,
      height: project.height,
      terrain: typedArrayToBase64(project.terrain),
      magnitude: typedArrayToBase64(project.magnitude),
      nations: project.nations.map((n) => ({
        id: n.id,
        name: n.name,
        countryCode: n.countryCode,
        x: n.x,
        y: n.y,
      })),
      metadata: { ...project.metadata },
    },
    editor,
  }
}

// ── Thumbnail generation ────────────────────────────────────────────────────

const THUMBNAIL_SIZE = 200  // max dimension in pixels

/**
 * Generate a small base64 data-URL thumbnail from a project's terrain/magnitude data.
 * This is stored in the ProjectSummary so the dashboard can show map previews
 * without loading the full project data.
 */
function generateThumbnail(project: MapProject): string | undefined {
  const { width, height, terrain, magnitude } = project
  if (width === 0 || height === 0) return undefined

  // Compute scale to fit within THUMBNAIL_SIZE
  const scale = Math.min(THUMBNAIL_SIZE / width, THUMBNAIL_SIZE / height, 1)
  const thumbW = Math.max(1, Math.round(width * scale))
  const thumbH = Math.max(1, Math.round(height * scale))

  try {
    const canvas = document.createElement('canvas')
    canvas.width = thumbW
    canvas.height = thumbH
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const imageData = ctx.createImageData(thumbW, thumbH)
    const data = imageData.data

    // Sample the map at thumbnail resolution
    for (let py = 0; py < thumbH; py++) {
      const tileY = Math.floor((py / thumbH) * height)
      const rowBase = tileY * width
      for (let px = 0; px < thumbW; px++) {
        const tileX = Math.floor((px / thumbW) * width)
        const srcIdx = rowBase + tileX
        const t = terrain[srcIdx] ?? 0
        const m = magnitude[srcIdx] ?? 0
        const dstIdx = (py * thumbW + px) * 4

        if (t === 1) {
          const mag = Math.round((m / 255) * 30)
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
          data[dstIdx]     = 0x0b
          data[dstIdx + 1] = 0x4f
          data[dstIdx + 2] = 0x6c
          data[dstIdx + 3] = 255
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/webp', 0.6)
  } catch {
    return undefined
  }
}

// ── Helpers used externally — re-export for consistency
export { countLandTiles }

// ── Store ───────────────────────────────────────────────────────────────────

type ProjectManagerState = {
  projects: ProjectSummary[]
  activeProjectId: string | null
  isLoadingProject: boolean

  /** Create a new blank project, switch to it, and navigate to editor */
  createProject: (width: number, height: number, name?: string) => string
  /** Import an already-built project (e.g. from image import) */
  importProject: (project: MapProject) => string
  /** Delete a project from the registry + localStorage */
  deleteProject: (id: string) => void
  /** Rename a project */
  renameProject: (id: string, name: string) => void
  /** Duplicate a project */
  duplicateProject: (id: string) => void
  /** Save current editor state to the active project's localStorage key */
  saveCurrentProject: () => void
  /** Load a project into the editor by id */
  loadProject: (id: string) => void
  /** Load the most-recently-edited project (or first one) */
  loadMostRecent: () => string | null
  /** Get the summary for a project */
  getProject: (id: string) => ProjectSummary | undefined
}

export const useProjectManagerStore = create<ProjectManagerState>()(
  immer((set, get) => ({
    projects: [],
    activeProjectId: null,
    isLoadingProject: false,

    importProject: (project: MapProject) => {
      const id = createProjectId()
      const now = Date.now()
      const landCount = countLandTiles(project.terrain)
      const thumbnailUrl = generateThumbnail(project)

      const summary: ProjectSummary = {
        id,
        name: project.name || 'Imported Map',
        width: project.width,
        height: project.height,
        createdAt: now,
        lastModified: now,
        landTileCount: landCount,
        thumbnailUrl,
      }

      // Save project data
      const data: SerializedProjectData = serializeProjectData(project, {
        tool: 'land',
        brushSize: 1,
        brushShape: 'square',
        elevationValue: 128,
        nationName: 'Spawn 1',
        nationCountryCode: 'US',
      })
      try {
        localStorage.setItem(`openfront-project-${id}`, JSON.stringify(data))
      } catch {
        // QuotaExceededError
      }

      set((state) => {
        state.projects.push(summary)
        state.activeProjectId = id
      })
      saveIndexToStorage(get().projects)

      // Load into editor
      buildMapTexture(project)
      const store = useEditorStore.getState()
      store.loadProject(project)
      useUndoStore.getState().clear()
      store.setTool('land')
      store.setBrushSize(1)
      store.setBrushShape('square')
      store.setElevationValue(128)
      store.setNationName('Spawn 1')
      store.setNationCountryCode('US')
      useViewportStore.setState({ pendingFitToView: true })

      return id
    },

    createProject: (width: number, height: number, name?: string) => {
      const id = createProjectId()
      const projectName = name || createGoofyName()
      const now = Date.now()

      // Build the blank project in memory
      const project = createNewBlankProject(width, height)
      project.name = projectName

      const landCount = countLandTiles(project.terrain)

      // Generate thumbnail for the blank project
      const thumbnailUrl = generateThumbnail(project)

      const summary: ProjectSummary = {
        id,
        name: projectName,
        width,
        height,
        createdAt: now,
        lastModified: now,
        landTileCount: landCount,
        thumbnailUrl,
      }

      // Save project data immediately
      const data: SerializedProjectData = serializeProjectData(project, {
        tool: 'land',
        brushSize: 1,
        brushShape: 'square',
        elevationValue: 128,
        nationName: 'Spawn 1',
        nationCountryCode: 'US',
      })
      try {
        localStorage.setItem(`openfront-project-${id}`, JSON.stringify(data))
      } catch {
        // QuotaExceededError
      }

      set((state) => {
        state.projects.push(summary)
        state.activeProjectId = id
      })

      saveIndexToStorage(get().projects)

      // Load into editor
      buildMapTexture(project)
      const store = useEditorStore.getState()
      store.loadProject(project)
      useUndoStore.getState().clear()
      // Set editor settings to defaults
      store.setTool('land')
      store.setBrushSize(1)
      store.setBrushShape('square')
      store.setElevationValue(128)
      store.setNationName('Spawn 1')
      store.setNationCountryCode('US')
      useViewportStore.setState({ pendingFitToView: true })

      return id
    },

    deleteProject: (id: string) => {
      set((state) => {
        state.projects = state.projects.filter((p) => p.id !== id)
        if (state.activeProjectId === id) {
          state.activeProjectId = null
        }
      })
      // Remove from localStorage
      try {
        localStorage.removeItem(`openfront-project-${id}`)
      } catch {
        // ignore
      }
      saveIndexToStorage(get().projects)
    },

    renameProject: (id: string, name: string) => {
      set((state) => {
        const proj = state.projects.find((p) => p.id === id)
        if (proj) proj.name = name
      })
      saveIndexToStorage(get().projects)

      // Also update the editorStore's project name if it's the active project
      const { activeProjectId } = get()
      if (activeProjectId === id) {
        useEditorStore.getState().setProjectName(name)
      }
    },

    duplicateProject: (id: string) => {
      const { projects } = get()
      const original = projects.find((p) => p.id === id)
      if (!original) return

      const newId = createProjectId()
      const now = Date.now()

      // Load the original project data
      let raw: string | null = null
      try {
        raw = localStorage.getItem(`openfront-project-${id}`)
      } catch {
        // ignore
      }
      if (!raw) return

      let data: SerializedProjectData
      try {
        data = JSON.parse(raw) as SerializedProjectData
      } catch {
        return
      }

      // Give it a new name
      data.project.name = `${original.name} (copy)`

      const newSummary: ProjectSummary = {
        id: newId,
        name: data.project.name,
        width: data.project.width,
        height: data.project.height,
        createdAt: now,
        lastModified: now,
        landTileCount: original.landTileCount,
      }

      // Save duplicated data
      try {
        localStorage.setItem(`openfront-project-${newId}`, JSON.stringify(data))
      } catch {
        // ignore
      }

      set((state) => {
        state.projects.push(newSummary)
      })
      saveIndexToStorage(get().projects)
    },

    saveCurrentProject: () => {
      const { activeProjectId } = get()
      if (!activeProjectId) return

      const editorState = useEditorStore.getState()
      const { project, tool, brushSize, brushShape, elevationValue, nationName, nationCountryCode } = editorState

      const data = serializeProjectData(project, {
        tool,
        brushSize,
        brushShape,
        elevationValue,
        nationName,
        nationCountryCode,
      })

      try {
        localStorage.setItem(`openfront-project-${activeProjectId}`, JSON.stringify(data))
      } catch {
        // QuotaExceededError
      }

      // Update summary lastModified + landTileCount + thumbnail
      const landCount = countLandTiles(project.terrain)
      const thumbnailUrl = generateThumbnail(project)
      set((state) => {
        const proj = state.projects.find((p) => p.id === activeProjectId)
        if (proj) {
          proj.lastModified = Date.now()
          proj.landTileCount = landCount
          if (thumbnailUrl) proj.thumbnailUrl = thumbnailUrl
        }
      })
      saveIndexToStorage(get().projects)
    },

    loadProject: (id: string) => {
      const { projects } = get()
      const summary = projects.find((p) => p.id === id)
      if (!summary) return

      // Save current project first
      const { activeProjectId } = get()
      if (activeProjectId && activeProjectId !== id) {
        get().saveCurrentProject()
      }

      // Load project data from localStorage
      let raw: string | null = null
      try {
        raw = localStorage.getItem(`openfront-project-${id}`)
      } catch {
        return
      }

      if (!raw) {
        // Project data missing — create a blank one
        get().createProject(summary.width, summary.height, summary.name)
        return
      }

      let parsed: SerializedProjectData
      try {
        parsed = JSON.parse(raw) as SerializedProjectData
      } catch {
        return
      }

      const { project, editor } = deserializeProjectData(parsed)

      buildMapTexture(project)
      const store = useEditorStore.getState()
      store.loadProject(project)
      useUndoStore.getState().clear()

      // Restore editor settings
      store.setTool(editor.tool)
      store.setBrushSize(editor.brushSize)
      store.setBrushShape(editor.brushShape)
      store.setElevationValue(editor.elevationValue)
      store.setNationName(editor.nationName)
      store.setNationCountryCode(editor.nationCountryCode)

      useViewportStore.setState({ pendingFitToView: true })

      set((state) => {
        state.activeProjectId = id
        // Update summary
        const proj = state.projects.find((p) => p.id === id)
        if (proj) {
          proj.name = project.name
          proj.width = project.width
          proj.height = project.height
        }
      })
      saveIndexToStorage(get().projects)
    },

    loadMostRecent: () => {
      const { projects, activeProjectId } = get()
      if (projects.length === 0) return null

      // If there's an active project, return it
      if (activeProjectId) return activeProjectId

      // Otherwise load the most recently modified
      const sorted = [...projects].sort((a, b) => b.lastModified - a.lastModified)
      return sorted[0].id
    },

    getProject: (id: string) => {
      return get().projects.find((p) => p.id === id)
    },
  })),
)

// ── Index persistence helpers ───────────────────────────────────────────────

function saveIndexToStorage(projects: ProjectSummary[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(projects))
  } catch {
    // ignore
  }
}

function loadIndexFromStorage(): ProjectSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INDEX)
    if (!raw) return []
    return JSON.parse(raw) as ProjectSummary[]
  } catch {
    return []
  }
}

/**
 * Initialize the project manager from localStorage.
 * Must be called once at app startup.
 */
export function initializeProjectManager(): void {
  const stored = loadIndexFromStorage()
  if (stored.length > 0) {
    useProjectManagerStore.setState({ projects: stored })
    // Migrate old single-project data if present
    migrateOldSingleProject(stored)
  }
}

/**
 * Migrate from the old single-project persist key to the new multi-project system.
 * Only runs if no projects exist yet but old data is present.
 */
function migrateOldSingleProject(existingProjects: ProjectSummary[]): void {
  if (existingProjects.length > 0) return
  try {
    const oldRaw = localStorage.getItem('openfront-editor-state')
    if (!oldRaw) return

    const oldParsed = JSON.parse(oldRaw)
    const savedState = oldParsed.state || oldParsed
    const project = savedState.project
    if (!project) return

    const id = createProjectId()
    const now = Date.now()

    // Build serialized data
    const terrain = project.terrain instanceof Uint8Array
      ? typedArrayToBase64(project.terrain)
      : (project.terrain || '')
    const magnitude = project.magnitude instanceof Uint8Array
      ? typedArrayToBase64(project.magnitude)
      : (project.magnitude || '')

    const data: SerializedProjectData = {
      project: {
        name: project.name || 'Migrated Map',
        width: project.width || 64,
        height: project.height || 48,
        terrain,
        magnitude,
        nations: (project.nations ?? []).map((n: { id: string; name: string; countryCode?: string; x: number; y: number }) => ({
          id: n.id,
          name: n.name,
          countryCode: n.countryCode ?? '',
          x: n.x,
          y: n.y,
        })),
        metadata: project.metadata || {
          author: '',
          description: '',
          id: '',
          translation_key: '',
          categories: [],
          multiplayer_frequency: 4,
        },
      },
      editor: {
        tool: savedState.tool || 'land',
        brushSize: savedState.brushSize || 1,
        brushShape: savedState.brushShape || 'square',
        elevationValue: savedState.elevationValue || 128,
        nationName: savedState.nationName || 'Spawn 1',
        nationCountryCode: savedState.nationCountryCode || 'US',
      },
    }

    const landCount = countLandTiles(
      project.terrain instanceof Uint8Array ? project.terrain : base64ToTypedArray(terrain),
    )

    const summary: ProjectSummary = {
      id,
      name: project.name || 'Migrated Map',
      width: project.width || 64,
      height: project.height || 48,
      createdAt: now,
      lastModified: now,
      landTileCount: landCount,
    }

    localStorage.setItem(`openfront-project-${id}`, JSON.stringify(data))
    localStorage.removeItem('openfront-editor-state')

    useProjectManagerStore.setState((state) => ({
      projects: [summary, ...state.projects],
      activeProjectId: id,
    }))
    saveIndexToStorage([summary, ...useProjectManagerStore.getState().projects])
  } catch {
    // Migration failed silently — user can create new projects
  }
}