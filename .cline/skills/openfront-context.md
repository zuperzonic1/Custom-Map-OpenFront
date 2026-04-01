# Cline Skill: OpenFront Map Editor Context

## Role Definition

You are a project specialist for the **OpenFront Map Editor** - a browser-based WebGL map editor. You have deep knowledge of this specific codebase, including its architecture, patterns, and conventions.

---

## Project Overview

**Project Name**: Custom-Map-OpenFront (OpenFront Map Editor)

**Primary Technology Stack**:
- `react-konva` / `konva`: Canvas rendering and interaction
- `zustand` + `immer`: State management with Immer for mutations
- `fflate`: In-browser ZIP file creation
- `comlink`: Worker communication abstraction
- `react-hook-form` + `zod`: Form handling and validation

---

## Current Architecture

```
src/
  components/        # UI layer (panels, toolbars, forms)
  lib/              # Processing logic (export, classification, minimap)
    exportMap.ts   # ZIP packaging and manifest generation
    tileChunkCache.ts # Caching strategy for large maps
  store/            # Zustand state management
    editorStore.ts
  worker/           # Web Worker for heavy computation (if needed)
tests/              # Cypress E2E tests
```

---

## Key Data Structures

```typescript
// Terrain types
type TerrainType = 0 | 1; // water | land

// Map project structure
type MapProject = {
  name: string;
  width: number;
  height: number;
  terrain: Uint8Array;      // 0 = water, 1 = land
  magnitude: Uint8Array;    // Elevation/intensity (0-255)
  nations: Nation[];
  metadata: {
    description?: string;
    author?: string;
    version?: string;
  };
};

// Nation definition
type Nation = {
  id: string;           // nanoid or similar
  name: string;
  flag: string;         // URL to flag asset
  x: number;            // grid coordinate
  y: number;
};
```

---

## Chunk System

```typescript
CHUNK_SIZE = 32  // Canvas chunk rendering size

// Get chunk key for caching
getChunkKey(project, chunkX, chunkY)  // Cache key format
```

---

## Rendering Strategy

1. **Raster layer**: Single Konva Image from offscreen canvas (for terrain)
2. **Vector layer**: Individual shapes for nations, grid, brush cursor (for interactivity)

---

## Export Pipeline Requirements

Generate OpenFront-compatible artifacts:

1. `manifest.json` - Map metadata and version info
2. `map.bin` - Primary binary map data
3. `map4x.bin`, `map16x.bin` - Scaled resolutions
4. `thumbnail.webp` - Compressed preview image
5. ZIP package containing all above

---

## Common Patterns Reference

### Brush Tool Implementation
```typescript
const paintBrush = (
  terrain: Uint8Array, 
  x: number, 
  y: number, 
  radius: number, 
  value: TerrainType
) => {
  const width = Math.sqrt(terrain.length);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        const idx = (y + dy) * width + (x + dx);
        if (idx >= 0 && idx < terrain.length) {
          terrain[idx] = value;
        }
      }
    }
  }
};
```

### State Update with Immer
```typescript
const setTerrain = (setter: (terrain: Uint8Array) => void) => {
  set((state) => {
    const newTerrain = new Uint8Array(state.terrain);
    setter(newTerrain);
    return { ...state, terrain: newTerrain };
  });
};
```

---

## File Structure for New Features

When adding new functionality:

1. Define types in appropriate type definitions or store slice
2. Implement core logic in `src/lib/` 
3. Move heavy computation to Web Worker if >50ms estimated
4. Create React component in `src/components/`
5. Update store slice for state management

---

*OpenFront Map Editor Context skill*