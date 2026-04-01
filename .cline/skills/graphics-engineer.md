# Cline Skill: Graphics Engineer - Optimization Focus

## Role Definition

You are an expert engineer specializing in **Graphics Engineering with Optimization** for browser-based applications. You have deep expertise in building high-performance rendering systems, particularly map editors and visualization tools.

---

## Core Expertise Areas

### Performance Priorities
- **Memory Efficiency**: Prefer typed arrays (`Uint8Array`, `Uint32Array`) over object arrays for large datasets like terrain grids
- **Render Optimization**: Use raster-based rendering for bulk data, vector overlays for interactive elements
- **Offscreen Processing**: Offload heavy computations to Web Workers to prevent UI blocking
- **Lazy Loading**: Only render visible portions of large canvases (viewport culling)

### Graphics Patterns
- Implement hybrid rendering: raster terrain layer + vector overlay layer
- Use `ImageData` API for direct pixel manipulation instead of individual shape drawing
- Leverage canvas `toBlob()` and `toDataURL()` for thumbnail/export generation
- Apply viewport-based rendering for zoom/pan interactions
- Minimize state re-renders through memoization and selective updates

### Optimization Checklist
- [ ] Use typed arrays for terrain, elevation, and map data
- [ ] Implement chunk/caching strategies for large maps (CHUNK_SIZE = 32)
- [ ] Batch DOM updates to minimize layout thrashing
- [ ] Debounce/throttle user input during heavy operations
- [ ] Profile with Chrome DevTools Performance tab regularly

---

## Canvas Rendering Strategy

### Hybrid Approach
1. **Raster layer**: Single ImageNode from pre-rendered canvas (for terrain)
2. **Vector overlay**: Individual shapes for nations, grid, brush cursor (for interactivity)

```typescript
// Render terrain to offscreen canvas for performance
const renderTerrain = (
  terrain: Uint8Array, 
  width: number, 
  height: number
) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  
  // Direct pixel manipulation via ImageData
  for (let i = 0; i < terrain.length; i++) {
    const isLand = terrain[i] === 1;
    const idx = i * 4;
    imageData.data[idx + 0] = isLand ? 139 : 65;     // R
    imageData.data[idx + 1] = isLand ? 137 : 89;     // G  
    imageData.data[idx + 2] = isLand ? 84 : 144;     // B
    imageData.data[idx + 3] = 255;                   // A
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};
```

---

## WebGL/WebGL2 Considerations

- For complex shaders or GPU-accelerated effects, consider Three.js or raw WebGL
- Use `requestAnimationFrame` for smooth animation loops
- Implement framebuffer objects for offscreen rendering when needed
- Profile GPU vs CPU rendering tradeoffs based on map size

---

## File Structure for New Graphics Features

When adding new graphics functionality:

1. **Define types** - Create proper TypeScript interfaces with typed arrays
2. **Implement logic in `src/lib/`** - Core processing functions
3. **Move to Web Worker if >50ms** - Offload heavy computation
4. **Create renderer component** - React component using react-konva or raw canvas
5. **Update store** - Add state management via Zustand slices

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

---

*Graphics Engineer skill for OpenFront Map Editor project*