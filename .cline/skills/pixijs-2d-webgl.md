# Cline Skill: Pixi.js 2D WebGL Rendering Expert

## Role Definition

You are an expert in **Pixi.js** - the high-performance 2D WebGL rendering library. You specialize in optimizing large-scale 2D scenes, particularly for applications like map editors that need to render millions of elements efficiently.

---

## Why Pixi.js for Large-Scale Rendering?

### Performance Advantages
- **WebGL acceleration** under the hood - uses GPU for all rendering
- **Batch rendering** - merges draw calls for same textures/materials
- **Texture atlases** - reduces texture switches, improves cache locality
- **View frustum culling** - only renders visible objects
- Handles 10k+ sprites at 60 FPS with proper optimization

### Comparison: Canvas 2D vs Pixi.js
| Aspect | Canvas 2D | Pixi.js (WebGL) |
|--------|-----------|-----------------|
| Max Objects | ~100k before lag | Millions with batching |
| Draw Calls | One per shape/texture | Batched automatically |
| Memory | Per-object overhead | Shared buffers |
| Zoom/Pan | CPU-transforms | GPU-transforms |

---

## Core Optimization Techniques

### 1. Texture Atlases for Block Rendering
```typescript
// Create a single texture atlas containing all block types
const blocks = ['grass', 'dirt', 'water', 'stone'];
const textures = blocks.map(block => 
  PIXI.Texture.from(`${block}.png`)
);

// Use texture regions to reference different blocks from one image
const atlasTexture = PIXI.Texture.from('terrain-atlas.png');
```

### 2. Sprite Batching and Container Pooling
```typescript
// Reuse containers instead of creating new ones
class BlockContainer extends PIXI.Container {
  constructor() {
    super();
    this.sprite = new PIXI.Sprite();
    this.addChild(this.sprite);
  }
  
  reset(blockType: string, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.sprite.texture = textures[blockType];
  }
}

// Pool for efficient recycling
const containerPool: BlockContainer[] = [];
```

### 3. Viewport Culling (Only Render Visible Blocks)
```typescript
// Calculate visible range based on camera position and zoom
function getCullRange(camera, viewportWidth, viewportHeight) {
  const worldX = camera.x / camera.zoom;
  const worldY = camera.y / camera.zoom;
  
  return {
    xMin: Math.floor(worldX),
    xMax: Math.floor(worldX + viewportWidth / camera.zoom),
    yMin: Math.floor(worldY),
    yMax: Math.floor(worldY + viewportHeight / camera.zoom)
  };
}
```

### 4. Level-of-Detail (LOD) Based on Zoom
```typescript
// Render at lower detail when zoomed out significantly
function getLodLevel(zoom: number): 'low' | 'medium' | 'high' {
  if (zoom < 0.25) return 'low';   // 1 block = 4x4 pixels
  if (zoom < 0.5) return 'medium'; // 1 block = 2x2 pixels
  return 'high';                   // 1 block = 1 pixel
}
```

---

## Pixi.js Architecture for Map Editor

### Layer Organization
```typescript
const app = new PIXI.Application({ 
  width: window.innerWidth,
  height: window.innerHeight,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1
});

// Background layer (terrain)
const terrainLayer = new PIXI.Container();

// Vector overlay layer (nations, grid, selection)
const overlayLayer = new PIXI.Container();

app.stage.addChild(terrainLayer);
app.stage.addChild(overlayLayer);
```

### Rendering Millions of Blocks
```typescript
// Use Graphics for procedural block rendering (no textures needed)
function createBlockGraphics(blockType: string) {
  const graphics = new PIXI.Graphics();
  
  switch(blockType) {
    case 'grass':
      graphics.beginFill(0x5D9B47);
      graphics.drawRect(0, 0, BLOCK_SIZE, BLOCK_SIZE);
      break;
    case 'water':
      graphics.beginFill(0x4A90E2);
      graphics.drawRect(0, 0, BLOCK_SIZE, BLOCK_SIZE);
      break;
    // ... other types
  }
  
  graphics.endFill();
  return graphics;
}

// Batch rendering with Graphics
const batchContainer = new PIXI.Container();
for (let i = 0; i < blocks.length; i++) {
  const block = blocks[i];
  const graphic = createBlockGraphics(block.type);
  graphic.position.set(block.x * BLOCK_SIZE, block.y * BLOCK_SIZE);
  batchContainer.addChild(graphic);
}
```

### Efficient Updates with Graphics
```typescript
// For terrain changes, rebuild only affected chunks
function updateChunk(chunkX: number, chunkY: number) {
  const chunkKey = `${chunkX},${chunkY}`;
  
  // Remove old graphics for this chunk
  if (chunkGraphics[chunkKey]) {
    chunkGraphics[chunkKey].destroy();
  }
  
  // Create new graphics with updated terrain
  const graphics = createChunkGraphics(chunkX, chunkY);
  chunkGraphics[chunkKey] = graphics;
  terrainLayer.addChild(graphics);
}
```

---

## Performance Checklist for 3M Blocks

- [x] Use texture atlases to reduce draw calls
- [x] Implement viewport culling (only render visible area)
- [x] Use Graphics batching for similar objects
- [ ] Consider chunk-based rendering (divide map into 32x32 chunks)
- [ ] Use Level-of-Detail based on zoom level
- [ ] Profile with Pixi.js devtools to identify bottlenecks

---

## Integration with Zustand Store
```typescript
// In store: update terrain, then trigger Pixi re-render
const setTerrain = (setter: (terrain: Uint8Array) => void) => {
  set((state) => {
    const newTerrain = new Uint8Array(state.terrain);
    setter(newTerrain);
    
    // Trigger viewport update to refresh render
    viewportStore.getState().requestRender();
    
    return { ...state, terrain: newTerrain };
  });
};
```

---

## Pixi.js vs react-konva Comparison

| Feature | Pixi.js | react-konva |
|---------|---------|-------------|
| Learning Curve | Moderate | Steeper (React + Konva) |
| Performance (2D) | Excellent | Good |
| Ecosystem | Larger, mature | Smaller |
| Customization | Full control | React patterns |

**For 3M blocks**: Pixi.js is recommended for maximum performance.

---

*Pixi.js skill for OpenFront Map Editor - Large-scale 2D WebGL rendering*