# Cline Rules - OpenFront Map Editor

## Overview

This document defines the optimal configuration for using Cline with the OpenFront Map Editor project. It integrates MCP servers (Knowledge Graph Memory and Context7) with the existing skill file structure.

---

## MCP Server Configuration

### 1. Knowledge Graph Memory (`github.com/modelcontextprotocol/servers/tree/main/src/memory`)

**Purpose**: Store project-specific context, patterns, and decisions across sessions.

**When to Use:**
- Learn project patterns (typed arrays, Zustand slices, react-konva conventions)
- Track architecture decisions
- Remember code style preferences for this project
- Store reusable utility functions or patterns

**Key Entities to Track:**

```typescript
// Project Entities:
- MapProject: { width, height, terrain, magnitude, nations, metadata }
- EditorTool: 'land' | 'water' | 'elevation' | 'nation'
- TerrainType: 0 (water) | 1 (land)
- ChunkSystem: CHUNK_SIZE = 32
```

**Commands to Use:**
```bash
# Create project entity
create_entities --entities '[{"name": "OpenFrontMapProject", "entityType": "project", "observations": ["Uses typed arrays for terrain and magnitude data", "State managed via Zustand with Immer", "Renders terrain as single Konva Image from offscreen canvas"]}]'

# Learn pattern
add_observations --observations '[{"entityName": "OpenFrontMapProject", "contents": ["Use Uint8Array for terrain/magnitude for memory efficiency", "Chunk canvas rendering at 32x32 tiles", "Persist state to localStorage via Zustand persist middleware"]}]'
```

---

### 2. Context7 (`github.com/upstash/context7-mcp`)

**Purpose**: Query library documentation for accurate code examples.

**When to Use:**
- Before implementing features using new libraries
- When needing specific API usage patterns
- When debugging library-related issues

**Library IDs for This Project:**
```
/mobxjs/immer        - Immer for immutable state updates
/pmndrs/zustand      - Zustand state management
/konvajs/konva       - Canvas rendering and interactions
/react-hook-form     - Form handling with Zod validation
/fflate              - In-browser ZIP creation
/comlink             - Worker communication abstraction
```

**Example Queries:**
```bash
# Query immer update patterns
query-docs --libraryId /mobxjs/immer --query "how to update nested array in immer state"

# Query zustand persist middleware
query-docs --libraryId /pmndrs/zustand --query "zustand persist partialize for typed arrays"
```

---

## Integration Guidelines

### Workflow Order

1. **Start with Context7** - Query documentation when using unfamiliar libraries
2. **Use Memory for patterns** - Learn and apply project-specific conventions
3. **Implement following skill guidelines**:
   - Use typed arrays for large datasets
   - Implement hybrid rendering (raster + vector)
   - Offload heavy work to Web Workers
   - Follow existing Zustand slice structure

### MCP Usage Checklist

- [ ] Query Context7 before implementing unfamiliar library features
- [ ] Add observations to Memory when discovering new patterns
- [ ] Search Memory for existing project entities before re-learning
- [ ] Update Memory when refactoring architecture decisions
- [ ] Use Memory entities to maintain context across sessions

---

## Project-Specific Patterns (Learned)

### State Management (Zustand + Immer)
```typescript
// ALWAYS use this pattern for state updates:
const setter = (value) => 
  set((state) => {
    // Mutate state directly with Immer - it handles immutability
    state.property = value
  })
```

### Terrain Data Structure
```typescript
type MapProject = {
  terrain: Uint8Array;      // 0 = water, 1 = land
  magnitude: Uint8Array;    // Elevation/intensity (0-255)
}
// Use typed arrays for memory efficiency with large maps
```

### Chunk System
```typescript
CHUNK_SIZE = 32  // Canvas chunk rendering size
getChunkKey(project, chunkX, chunkY)  // Cache key format
```

### Rendering Strategy
1. Raster layer: Single Konva Image from offscreen canvas
2. Vector layer: Individual shapes for nations, grid, brush cursor

---

## Response Guidelines

When assisting with this project:

1. **Prioritize performance** - typed arrays first, Web Workers for heavy work
2. **Respect existing patterns** - follow Zustand slice structure and react-konva conventions
3. **Query Context7 first** when using unfamiliar library APIs
4. **Add to Memory** when discovering project-specific patterns
5. **Use TypeScript strictly** with typed arrays and discriminated unions

---

## Quick Reference: MCP Commands

| Task | MCP Tool | Example |
|------|----------|---------|
| Query immer API | Context7 | `/mobxjs/immer` |
| Query zustand persist | Context7 | `/pmndrs/zustand` |
| Learn project pattern | Memory | `create_entities`, `add_observations` |
| Recall previous session | Memory | `read_graph`, `search_nodes` |

---

*Last updated: Cline Rules for OpenFront Map Editor v1.0*