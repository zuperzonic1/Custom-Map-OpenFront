# OpenFront Map Editor Technical Spec

## 1. Goal

Build a browser-based OpenFront map editor with the least custom infrastructure possible. The product should let users create, edit, validate, preview, and export OpenFront-ready maps without hand-editing PNG and JSON files.

## 2. Product Scope

### In scope
- Blank map creation
- Terrain painting for land and water
- Elevation/intensity painting
- Nation spawn placement
- Map metadata editing
- Live preview and minimap rendering
- OpenFront-compatible export
- Import of existing `image.png` and `info.json`
- Undo/redo
- Zoom/pan
- Autosave
- Validation warnings

### Out of scope for MVP
- Collaboration
- Backend sync
- Custom rendering engine
- Custom ZIP compression implementation
- Multi-user editing
- Complex layer system
- Hard-coded pixel drawing workflows

## 3. Recommended Stack

### Core
- React
- Vite
- TypeScript

### Editor
- `react-konva`
- `konva`

### State
- `zustand`
- `immer`

### Forms and validation
- `react-hook-form`
- `zod`

### Worker and async bridge
- `comlink`

### Export
- `fflate`

### UI
- `shadcn/ui` with Tailwind CSS
- Alternative: Mantine if faster UI assembly is preferred

### Optional utilities
- `nanoid` for IDs
- Zustand persist middleware for autosave
- Native browser image APIs for import/export

## 4. Architecture Overview

The application should be split into four layers:

1. **UI layer**  
   React components for shell, panels, forms, toolbars, and export actions.

2. **Editor layer**  
   `react-konva` handles canvas interaction, overlays, drag/drop, hit detection, zoom, and selection.

3. **State layer**  
   `zustand` stores project data, tool state, selection state, viewport state, and undo/redo history.

4. **Processing layer**  
   A Web Worker handles map generation, cleanup, classification, packing, and export preparation.

## 5. Key Design Principle

Do not store the PNG as the source of truth.

The canonical model should be a project state containing terrain, magnitude, nations, and metadata. PNG, preview images, minimaps, and OpenFront binary outputs should all be derived from that project state.

## 6. Data Model

### Terrain
Use typed arrays rather than arrays of objects.

```ts
type TerrainType = 0 | 1; // 0 = water, 1 = land

type Nation = {
  id: string;
  name: string;
  flag: string;
  x: number;
  y: number;
};

type MapProject = {
  name: string;
  width: number;
  height: number;
  terrain: Uint8Array;
  magnitude: Uint8Array;
  nations: Nation[];
  metadata: {
    description?: string;
    author?: string;
    version?: string;
  };
};
```

### Why typed arrays
- Lower memory usage
- Faster painting
- Faster export packing
- Easier worker transfer
- Better fit for large maps

## 7. State Architecture

Use Zustand slices.

### Suggested slices
- `projectSlice`
  - project metadata
  - terrain data
  - magnitude data
  - nations
- `toolSlice`
  - active tool
  - brush settings
- `viewportSlice`
  - zoom
  - pan
- `selectionSlice`
  - selected nation
  - selected tile region
- `historySlice`
  - undo stack
  - redo stack

### State rules
- Keep project mutations immutable
- Use Immer for readable updates
- Persist project state locally
- Derive previews and exports from state, not from UI state

## 8. Rendering Strategy

### Preferred approach
Use a hybrid rendering model:

- **Raster terrain layer**
  - Render terrain into an offscreen canvas or `ImageData`
  - Display it as a single Konva image node

- **Vector overlay layer**
  - Nations
  - Selection boxes
  - Brush cursor
  - Grid
  - Hover indicators

### Why this approach
- Avoids thousands of tile nodes
- Keeps interaction responsive
- Reduces custom code
- Scales better for large maps

### Avoid
- Rendering every tile as an individual Konva shape
- Building a custom low-level canvas event system

## 9. Interaction Model

### Tools
- Brush: land/water painting
- Elevation brush
- Nation placement
- Select/move nation
- Fill bucket: optional after MVP
- Pan
- Zoom

### MVP brush rules
- Square brush only
- Single active terrain mode
- Simple intensity control
- No hardness system initially

### UI expectations
- Canvas interactions should feel immediate
- Tool settings should be editable in standard DOM forms
- Metadata editing should remain outside the canvas

## 10. Processing Pipeline

All heavy generation work should happen in a Web Worker.

### Worker responsibilities
- Terrain classification
- Cleanup rules
- Shoreline detection
- Distance calculations
- Minimap generation
- Thumbnail generation
- OpenFront export packing

### Why a worker
- Prevents UI freezing
- Makes generation testable
- Separates presentation from algorithmic logic

### Use Comlink
Wrap the worker API with Comlink to keep async calls simple.

## 11. Export Requirements

The export system should generate OpenFront-compatible outputs.

### Expected outputs
- `manifest.json`
- `map.bin`
- `map4x.bin`
- `map16x.bin`
- `thumbnail.webp`
- ZIP package

### Export flow
1. Validate project
2. Build derived raster images
3. Pack map binaries
4. Generate thumbnail blob
5. Bundle files into ZIP
6. Trigger browser download

### ZIP handling
Use `fflate` for in-browser ZIP creation.

## 12. Image Generation

### Preview and thumbnail
Use native browser canvas APIs.

### Requirements
- Render preview from project state
- Generate thumbnail from canvas content
- Use `canvas.toBlob()` for blob creation
- Prefer WebP when supported by browser

### Why native APIs
- Already built into the browser
- Minimal dependency footprint
- Good performance for image output

## 13. Import Requirements

Support importing the current OpenFront workflow inputs:

- `image.png`
- `info.json`

### Import behavior
- Parse the image into project terrain state
- Parse metadata from JSON
- Reconstruct map state where possible
- Show warnings when import data is incomplete or invalid

## 14. Validation Rules

Validation should run continuously and before export.

### Examples
- Missing map name
- Invalid map dimensions
- Nations outside bounds
- Duplicate nation names
- Empty terrain data
- Mismatched import files

### Validation UX
- Display warnings in a dedicated panel
- Block export only for critical errors
- Allow export with non-fatal warnings

## 15. Undo/Redo

### Approach
- Store project mutations as immutable snapshots or patch-like history
- Limit history size to avoid memory growth
- Group brush strokes into single undoable actions

### Required actions
- Terrain paint
- Magnitude paint
- Nation add/remove/move
- Metadata changes

## 16. Autosave and Persistence

### Persistence goals
- Preserve current work after reload
- Restore recent session automatically
- Avoid forcing backend storage

### Implementation
- Zustand persist middleware
- LocalStorage for small state
- IndexedDB if project files become larger later

## 17. Suggested Folder Structure

```txt
src/
  app/
    App.tsx
  components/
    Toolbar.tsx
    MapCanvas.tsx
    RightPanel.tsx
    NationsPanel.tsx
    ExportPanel.tsx
    PreviewPanel.tsx
    ValidationPanel.tsx
  store/
    editorStore.ts
    slices/
      projectSlice.ts
      toolSlice.ts
      viewportSlice.ts
      selectionSlice.ts
      historySlice.ts
  worker/
    generator.worker.ts
    generatorClient.ts
  lib/
    openfront/
      classify.ts
      cleanup.ts
      shoreline.ts
      distance.ts
      minimap.ts
      pack.ts
      thumbnail.ts
      manifest.ts
  types/
    map.ts
```

## 18. MVP Delivery Plan

### Sprint 1: editor foundation

#### Status
Completed

#### Achievements
- App shell and workspace layout created
- Canonical project model established in Zustand
- Raster terrain rendering implemented with typed arrays
- Basic land/water brush painting implemented
- Zoom and pan controls implemented
- Local persistence enabled

#### Deliverables completed
- React/Vite app bootstrapped in TypeScript
- Zustand store with project, tool, viewport, and history slices
- Blank map creation flow
- Raster terrain renderer backed by typed arrays
- Basic square brush for land and water
- Canvas zoom and pan controls
- Local persistence for the current project

#### Verified implementation order
1. App shell and layout
2. Project model and Zustand store
3. Blank project initialization
4. Raster terrain rendering
5. Brush painting interactions
6. Zoom and pan
7. Local persistence
8. Smoke test the editor flow

#### Acceptance criteria
- A user can create a blank map
- Terrain updates visually after painting
- Zoom and pan work smoothly
- The editor state survives refresh in local storage
- No export logic is required yet

### Sprint 2: editor depth and map metadata

#### Goals
- Add elevation/intensity editing
- Add nation spawn placement
- Add map metadata editing
- Add nation management UI
- Add minimap/preview support

#### Deliverables
- Elevation/intensity brush
- Nation placement tool
- Metadata form panel
- Nations list panel
- Minimap preview panel
- Updated editor state to persist nations and metadata

#### Implementation order
1. Extend project state for metadata and nations
2. Add metadata form UI
3. Add nation creation and editing UI
4. Implement nation placement on the canvas
5. Add elevation/intensity brush behavior
6. Add minimap preview rendering
7. Add validation for nations and metadata
8. Smoke test the updated editor flow

#### Acceptance criteria
- A user can add and move nation spawns
- A user can edit map metadata
- Elevation/intensity can be painted separately from land/water
- The minimap updates from project state
- The new state persists correctly in local storage

### Sprint 3: map generation and export pipeline

#### Goals
- Replicate the OpenFront map-generator flow in the browser
- Generate OpenFront-compatible map artifacts entirely from the frontend
- Keep heavy processing off the UI thread with a Web Worker
- Support preview, packaging, and download of generated maps

#### Deliverables
- Map generation worker
- Export pipeline for `manifest.json`, `map.bin`, `map4x.bin`, `map16x.bin`, and `thumbnail.webp`
- Front-end generation controls and export actions
- Progress and error feedback during generation
- ZIP download of all export artifacts

#### Implementation order
1. Define the generator data contract between UI and worker
2. Implement map classification and cleanup logic in the worker
3. Implement shoreline and distance calculations
4. Implement scaled binary packing for map output
5. Implement thumbnail generation from the canvas state
6. Package export artifacts into a ZIP file
7. Wire export controls into the UI
8. Add Cypress coverage for generation and export flows

#### Acceptance criteria
- A user can export an OpenFront-ready map package from the browser
- Exported artifacts match the expected OpenFront file set
- Generation runs without blocking the editor UI
- Export can be repeated after edits to terrain, nations, or metadata
- The export flow exposes useful progress and validation feedback
### Sprint 3
- Worker-based export engine
- Manifest generation
- Binary output generation
- Thumbnail generation
- ZIP download

### Sprint 4
- Import `image.png`
- Import `info.json`
- Validation warnings
- Undo/redo
- Autosave polish

## 19. Simplification Rules

For the first release:
- Use square brush only
- Skip brush hardness
- Skip custom project sync
- Skip collaboration
- Skip backend
- Skip advanced selection tools
- Skip extra rendering layers

## 20. Recommended Initial Package List

```txt
react
react-dom
vite
typescript
zustand
immer
react-konva
konva
react-hook-form
zod
comlink
fflate
```

### UI package choice
Use either:
- `shadcn/ui` + Tailwind CSS
- or Mantine for faster component assembly

## 21. Technical Rationale

This stack minimizes custom code in the most expensive areas:
- state management
- canvas interaction
- archive generation
- validation forms
- image export

Custom code should be limited to:
- OpenFront tile model
- painting rules
- nation placement
- binary packing
- thumbnail/minimap generation
- import/export adapters

## 22. Success Criteria

The editor is successful when a user can:
- create or import a map
- edit terrain and nations
- preview the result
- export OpenFront-ready files
- reopen later with preserved state

## 23. Next Implementation Order

1. Project model and Zustand store
2. Terrain raster renderer
3. Brush tools
4. Nation placement
5. Map generation worker and export pipeline
6. ZIP download
7. Import support
8. Undo/redo and polish