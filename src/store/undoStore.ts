/**
 * Snapshot-based undo/redo store.
 *
 * Stores up to MAX_HISTORY snapshots of terrain + magnitude + nations.
 * Snapshots are cheap slices (Uint8Array copies), not full Immer clones.
 */

import { create } from 'zustand'
import type { Nation } from './editorStore'

const MAX_HISTORY = 15

export type MapSnapshot = {
  terrain: Uint8Array
  magnitude: Uint8Array
  nations: Nation[]
  landTileCount: number
}

function cloneSnapshot(
  terrain: Uint8Array,
  magnitude: Uint8Array,
  nations: Nation[],
  landTileCount: number,
): MapSnapshot {
  return {
    terrain: terrain.slice(),
    magnitude: magnitude.slice(),
    nations: nations.map((n) => ({ ...n })),
    landTileCount,
  }
}

type UndoStoreState = {
  undoStack: MapSnapshot[]
  redoStack: MapSnapshot[]
  /** Push to undo stack and CLEAR redo stack (new action path). */
  push: (
    terrain: Uint8Array,
    magnitude: Uint8Array,
    nations: Nation[],
    landTileCount: number,
  ) => void
  /** Push to undo stack WITHOUT touching the redo stack (used during redo). */
  pushToUndo: (
    terrain: Uint8Array,
    magnitude: Uint8Array,
    nations: Nation[],
    landTileCount: number,
  ) => void
  popUndo: () => MapSnapshot | null
  popRedo: () => MapSnapshot | null
  peekCurrentForRedo: (
    terrain: Uint8Array,
    magnitude: Uint8Array,
    nations: Nation[],
    landTileCount: number,
  ) => void
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

export const useUndoStore = create<UndoStoreState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  push(terrain, magnitude, nations, landTileCount) {
    set((state) => {
      const snapshot = cloneSnapshot(terrain, magnitude, nations, landTileCount)
      const next = [snapshot, ...state.undoStack].slice(0, MAX_HISTORY)
      return { undoStack: next, redoStack: [] }
    })
  },

  pushToUndo(terrain, magnitude, nations, landTileCount) {
    set((state) => {
      const snapshot = cloneSnapshot(terrain, magnitude, nations, landTileCount)
      const next = [snapshot, ...state.undoStack].slice(0, MAX_HISTORY)
      return { undoStack: next }
    })
  },

  popUndo() {
    const { undoStack } = get()
    if (undoStack.length === 0) return null
    const [top, ...rest] = undoStack
    set({ undoStack: rest })
    return top
  },

  popRedo() {
    const { redoStack } = get()
    if (redoStack.length === 0) return null
    const [top, ...rest] = redoStack
    set({ redoStack: rest })
    return top
  },

  /** Call this BEFORE applying undo so the current state can be redone. */
  peekCurrentForRedo(terrain, magnitude, nations, landTileCount) {
    set((state) => {
      const snapshot = cloneSnapshot(terrain, magnitude, nations, landTileCount)
      const next = [snapshot, ...state.redoStack].slice(0, MAX_HISTORY)
      return { redoStack: next }
    })
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  clear: () => set({ undoStack: [], redoStack: [] }),
}))