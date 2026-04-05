/**
 * Single-texture map renderer backing store.
 *
 * The entire map is represented as one HTMLCanvasElement whose pixel data is
 * written directly from the terrain/magnitude Uint8Arrays.  Pixi creates a
 * single GPU texture from that canvas.  Pan/zoom is just a matrix transform
 * on one sprite — no chunks, no draw-call overhead, no LRU caches.
 *
 * Data flow:
 *   terrain + magnitude (Uint8Array)
 *     → writePixel() fills mapImageData.data in-place
 *     → ctx.putImageData() copies the dirty rect to mapCanvas
 *     → Pixi's texture.source.update() re-uploads to GPU on next render
 */

// ─── Color constants ──────────────────────────────────────────────────────────

const WATER_R = 0x0b
const WATER_G = 0x4f
const WATER_B = 0x6c

// Editor magnitude (0-255) → game magnitude (0-30)
function toGameMag(m: number): number {
  return Math.round((m / 255) * 30)
}

// ─── Shared buffer ────────────────────────────────────────────────────────────

type MapLike = {
  width: number
  height: number
  terrain: Uint8Array
  magnitude: Uint8Array
}

/** The live RGBA pixel buffer.  paintTilesDirect writes into .data directly. */
export let mapImageData: ImageData | null = null

/** The canvas backed by mapImageData.  Pixi's Texture is created from this. */
export let mapCanvas: HTMLCanvasElement | null = null

/** Incremented whenever a new canvas is allocated (i.e. project dimensions changed).
 *  The renderer watches this to know when to recreate its Pixi Texture. */
export let mapCanvasVersion = 0

let mapCtx: CanvasRenderingContext2D | null = null

// ─── Upload flag ──────────────────────────────────────────────────────────────

let _textureNeedsUpload = false

/**
 * Returns true if pixel data was changed since the last call.
 * Resets the flag — call exactly once per render frame.
 */
export function consumeTextureUpload(): boolean {
  const v = _textureNeedsUpload
  _textureNeedsUpload = false
  return v
}

// ─── Pixel writing ────────────────────────────────────────────────────────────

/**
 * Write one tile's colour into a flat Uint8ClampedArray RGBA buffer.
 *
 * Land colours mirror OpenFront's PastelTheme.ts (light theme):
 *   Plains    (gameMag  0– 9): rgb(190, 220-2*mag, 138)
 *   Highland  (gameMag 10–19): rgb(200+2*mag, 183+2*mag, 138+2*mag)
 *   Mountain  (gameMag 20–30): rgb(230+mag/2, 230+mag/2, 230+mag/2)
 */
function writePixel(data: Uint8ClampedArray, i: number, t: number, m: number): void {
  const px = i << 2 // i * 4
  if (t === 1) {
    const mag = toGameMag(m)
    let r: number, g: number, b: number
    if (mag < 10) {
      // Plains
      r = 190
      g = 220 - 2 * mag
      b = 138
    } else if (mag < 20) {
      // Highland
      r = Math.min(255, 200 + 2 * mag)
      g = Math.min(255, 183 + 2 * mag)
      b = Math.min(255, 138 + 2 * mag)
    } else {
      // Mountain
      const v = Math.min(255, Math.floor(230 + mag / 2))
      r = v; g = v; b = v
    }
    data[px]     = r
    data[px + 1] = g
    data[px + 2] = b
    data[px + 3] = 255
  } else {
    data[px]     = WATER_R
    data[px + 1] = WATER_G
    data[px + 2] = WATER_B
    data[px + 3] = 255
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full rebuild from project data.
 *
 * Creates a new canvas when the project dimensions differ from the current one.
 * Must be called:
 *  - when a new blank project is created
 *  - when a project is loaded from storage
 */
export function buildMapTexture(project: MapLike): void {
  const { width, height, terrain, magnitude } = project
  const n = width * height

  // (Re-)create canvas only when dimensions change
  if (!mapCanvas || mapCanvas.width !== width || mapCanvas.height !== height) {
    mapCanvas = document.createElement('canvas')
    mapCanvas.width = width
    mapCanvas.height = height
    mapCtx = mapCanvas.getContext('2d', { willReadFrequently: false }) ?? null
    mapImageData = mapCtx ? mapCtx.createImageData(width, height) : null
    mapCanvasVersion++
  }

  if (!mapCtx || !mapImageData) return

  const data = mapImageData.data
  for (let i = 0; i < n; i++) {
    writePixel(data, i, terrain[i], magnitude[i])
  }

  mapCtx.putImageData(mapImageData, 0, 0)
  _textureNeedsUpload = true
}

/**
 * Partial pixel update for a rectangle of tiles.
 *
 * Call AFTER mutating terrain/magnitude for the affected tiles.
 * Uses putImageData with a dirty-rect parameter so only the changed region is
 * copied from the CPU ImageData to the 2D canvas.
 */
export function updateMapPixels(
  project: MapLike,
  minTileX: number,
  minTileY: number,
  maxTileX: number,
  maxTileY: number,
): void {
  if (!mapImageData || !mapCtx) return

  const { terrain, magnitude, width, height } = project
  const data = mapImageData.data

  const x1 = Math.max(0, minTileX)
  const y1 = Math.max(0, minTileY)
  const x2 = Math.min(width - 1, maxTileX)
  const y2 = Math.min(height - 1, maxTileY)
  if (x2 < x1 || y2 < y1) return

  for (let y = y1; y <= y2; y++) {
    const rowBase = y * width
    for (let x = x1; x <= x2; x++) {
      const i = rowBase + x
      writePixel(data, i, terrain[i], magnitude[i])
    }
  }

  // Only copy the dirty rect to the canvas — avoids writing ~projectWidth*projectHeight
  // bytes every paint event.
  mapCtx.putImageData(mapImageData, 0, 0, x1, y1, x2 - x1 + 1, y2 - y1 + 1)
  _textureNeedsUpload = true
}