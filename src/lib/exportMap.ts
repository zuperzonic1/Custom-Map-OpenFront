/**
 * exportMap.ts
 *
 * Produces binary output files matching the OpenFrontIO map-generator exactly:
 *   map.bin       – full resolution, 1 byte/tile packed
 *   map4x.bin     – half dimensions (water-priority 2× downscale)
 *   map16x.bin    – quarter dimensions (water-priority 2× downscale of 4x)
 *   thumbnail.webp – rendered from 4x minimap at 0.5 quality
 *   manifest.json  – map/map4x/map16x dims + num_land_tiles
 *
 * Packed byte (1 byte per tile, row-major y*width+x):
 *   Bit 7 (0x80) – isLand
 *   Bit 6 (0x40) – isShoreline (adjacent to opposite terrain type)
 *   Bit 5 (0x20) – isOcean (largest connected water body)
 *   Bits 0-4     – magnitude (0-31)
 *     Land  → min(ceil(elevation), 31)   elevation = round(editorMag/255*30)
 *     Water → min(ceil(distance/2), 31)  distance = BFS tiles from nearest land
 */

import { zipSync, strToU8 } from 'fflate'
import type { MapProject } from '../store/editorStore'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ExportBundle = {
  fileNames: string[]
  zipBlob: Blob
}

// ─── Packed-byte bit constants ────────────────────────────────────────────────

const BIT_LAND = 0x80
const BIT_SHORELINE = 0x40
const BIT_OCEAN = 0x20

// Internal processing flags (not the packed-byte bits)
const F_SHORELINE = 1
const F_OCEAN = 2

// ─── Flat grid ────────────────────────────────────────────────────────────────

interface FlatGrid {
  /** 1 = land, 0 = water */
  terrain: Uint8Array
  /** Land: elevation 0-30; Water: BFS distance to nearest land */
  mag: Float32Array
  /** F_SHORELINE | F_OCEAN */
  flags: Uint8Array
  width: number
  height: number
}

// ─── Build initial grid from project arrays ───────────────────────────────────

function buildGrid(
  srcTerrain: Uint8Array,
  srcMag: Uint8Array,
  width: number,
  height: number,
): FlatGrid {
  const size = width * height
  const terrain = new Uint8Array(size)
  const mag = new Float32Array(size)
  const flags = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    terrain[i] = srcTerrain[i] === 1 ? 1 : 0
    // Map editor 0-255 → official elevation 0-30
    mag[i] = terrain[i] === 1 ? Math.round((srcMag[i] / 255) * 30) : 0
  }
  return { terrain, mag, flags, width, height }
}

// ─── Water processing (ocean, shoreline, BFS distances) ──────────────────────

function processWater(g: FlatGrid): void {
  const { terrain, mag, flags, width, height } = g
  const size = width * height

  // ── 1. Find all connected water bodies via BFS flood-fill ──
  const visited = new Uint8Array(size)
  const waterBodies: number[][] = []

  for (let startIdx = 0; startIdx < size; startIdx++) {
    if (terrain[startIdx] !== 0 || visited[startIdx]) continue
    const body: number[] = []
    const queue: number[] = [startIdx]
    visited[startIdx] = 1
    let head = 0
    while (head < queue.length) {
      const idx = queue[head++]
      body.push(idx)
      const x = idx % width
      const y = (idx / width) | 0
      if (x > 0 && !visited[idx - 1] && terrain[idx - 1] === 0) { visited[idx - 1] = 1; queue.push(idx - 1) }
      if (x < width - 1 && !visited[idx + 1] && terrain[idx + 1] === 0) { visited[idx + 1] = 1; queue.push(idx + 1) }
      if (y > 0 && !visited[idx - width] && terrain[idx - width] === 0) { visited[idx - width] = 1; queue.push(idx - width) }
      if (y < height - 1 && !visited[idx + width] && terrain[idx + width] === 0) { visited[idx + width] = 1; queue.push(idx + width) }
    }
    waterBodies.push(body)
  }

  if (waterBodies.length === 0) return

  // ── 2. Largest water body = ocean ──
  waterBodies.sort((a, b) => b.length - a.length)
  for (const idx of waterBodies[0]) {
    flags[idx] |= F_OCEAN
  }

  // ── 3. Shoreline identification ──
  const shoreWater: number[] = []
  for (let idx = 0; idx < size; idx++) {
    const t = terrain[idx]
    const x = idx % width
    const y = (idx / width) | 0
    let adj = false
    if (x > 0 && terrain[idx - 1] !== t) adj = true
    else if (x < width - 1 && terrain[idx + 1] !== t) adj = true
    else if (y > 0 && terrain[idx - width] !== t) adj = true
    else if (y < height - 1 && terrain[idx + width] !== t) adj = true
    if (adj) {
      flags[idx] |= F_SHORELINE
      if (t === 0) shoreWater.push(idx)
    }
  }

  // ── 4. BFS from shore-water tiles to compute distance-to-land ──
  const distVisited = new Uint8Array(size)
  const bfsQueue: number[] = []
  for (const idx of shoreWater) {
    distVisited[idx] = 1
    mag[idx] = 0
    bfsQueue.push(idx)
  }
  let bfsHead = 0
  while (bfsHead < bfsQueue.length) {
    const idx = bfsQueue[bfsHead++]
    const dist = mag[idx]
    const x = idx % width
    const y = (idx / width) | 0
    if (x > 0 && !distVisited[idx - 1] && terrain[idx - 1] === 0) {
      distVisited[idx - 1] = 1; mag[idx - 1] = dist + 1; bfsQueue.push(idx - 1)
    }
    if (x < width - 1 && !distVisited[idx + 1] && terrain[idx + 1] === 0) {
      distVisited[idx + 1] = 1; mag[idx + 1] = dist + 1; bfsQueue.push(idx + 1)
    }
    if (y > 0 && !distVisited[idx - width] && terrain[idx - width] === 0) {
      distVisited[idx - width] = 1; mag[idx - width] = dist + 1; bfsQueue.push(idx - width)
    }
    if (y < height - 1 && !distVisited[idx + width] && terrain[idx + width] === 0) {
      distVisited[idx + width] = 1; mag[idx + width] = dist + 1; bfsQueue.push(idx + width)
    }
  }
}

// ─── 2× downscale (water-priority) ───────────────────────────────────────────

/**
 * Downscale by 2 in each dimension.
 * Any water source tile in a 2×2 block makes the output tile water (water wins).
 * Shoreline/ocean flags are cleared — processWater will recompute them.
 */
function createMiniGrid(g: FlatGrid): FlatGrid {
  const { terrain, mag, width, height } = g
  const mw = (width / 2) | 0
  const mh = (height / 2) | 0
  const mSize = mw * mh
  const mTerrain = new Uint8Array(mSize).fill(1) // all land initially
  const mMag = new Float32Array(mSize)
  const mFlags = new Uint8Array(mSize)

  for (let y = 0; y < height; y++) {
    const my = (y / 2) | 0
    if (my >= mh) continue
    for (let x = 0; x < width; x++) {
      const mx = (x / 2) | 0
      if (mx >= mw) continue
      const mIdx = my * mw + mx
      if (mTerrain[mIdx] === 1) {
        // Overwrite only while the output tile is still land
        const srcIdx = y * width + x
        mTerrain[mIdx] = terrain[srcIdx]
        // Land mag carried over; water mag reset (processWater recomputes)
        mMag[mIdx] = terrain[srcIdx] === 1 ? mag[srcIdx] : 0
      }
    }
  }

  return { terrain: mTerrain, mag: mMag, flags: mFlags, width: mw, height: mh }
}

// ─── Pack grid to official 1-byte-per-tile binary ─────────────────────────────

function packGrid(g: FlatGrid): { data: Uint8Array; numLandTiles: number } {
  const { terrain, mag, flags, width, height } = g
  const size = width * height
  const data = new Uint8Array(size)
  let numLandTiles = 0

  for (let idx = 0; idx < size; idx++) {
    const isLand = terrain[idx] === 1
    let b = 0
    if (isLand) { b |= BIT_LAND; numLandTiles++ }
    if (flags[idx] & F_SHORELINE) b |= BIT_SHORELINE
    if (flags[idx] & F_OCEAN) b |= BIT_OCEAN
    b |= isLand
      ? Math.min(31, Math.ceil(mag[idx]))
      : Math.min(31, Math.ceil(mag[idx] / 2))
    data[idx] = b
  }

  // Go iterates x-outer, y-inner with index y*width+x — same row-major layout
  // so no reordering needed.
  return { data, numLandTiles }
}

// ─── Thumbnail rendering (official colour scheme) ─────────────────────────────

/**
 * Render a thumbnail using the same colour logic as getThumbnailColor() in the
 * official Go generator.  Water tiles are transparent (alpha=0).
 *
 * quality=0.5 → output is srcWidth/2 × srcHeight/2 of the 4x minimap
 *             = width/4 × height/4 of the original map.
 */
function renderThumbnail(g: FlatGrid, quality = 0.5): HTMLCanvasElement {
  const { terrain, mag, flags, width: sw, height: sh } = g
  const tw = Math.max(1, Math.floor(sw * quality))
  const th = Math.max(1, Math.floor(sh * quality))

  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(tw, th)
  const d = imageData.data

  for (let x = 0; x < tw; x++) {
    for (let y = 0; y < th; y++) {
      const sx = Math.min(sw - 1, Math.floor(x / quality))
      const sy = Math.min(sh - 1, Math.floor(y / quality))
      const si = sy * sw + sx
      const di = (y * tw + x) * 4
      const isLand = terrain[si] === 1
      const shoreline = (flags[si] & F_SHORELINE) !== 0
      const m = mag[si]

      if (!isLand) {
        // All water tiles are transparent in thumbnail
        d[di] = 70; d[di + 1] = 132; d[di + 2] = 180; d[di + 3] = 0
      } else if (shoreline) {
        d[di] = 204; d[di + 1] = 203; d[di + 2] = 158; d[di + 3] = 255
      } else if (m < 10) {
        // Plains
        const g2 = Math.round(220 - 2 * m)
        d[di] = 190; d[di + 1] = g2; d[di + 2] = 138; d[di + 3] = 255
      } else if (m < 20) {
        // Highlands
        const adj = Math.round(2 * m)
        d[di] = Math.min(255, 200 + adj)
        d[di + 1] = Math.min(255, 183 + adj)
        d[di + 2] = Math.min(255, 138 + adj)
        d[di + 3] = 255
      } else {
        // Mountains
        const adj = Math.min(255, Math.floor(230 + m / 2))
        d[di] = adj; d[di + 1] = adj; d[di + 2] = adj; d[di + 3] = 255
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

// ─── Blob helpers ─────────────────────────────────────────────────────────────

function promiseCanvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Unable to generate image blob')); return }
      resolve(blob)
    }, type)
  })
}

function createFolderName(project: MapProject): string {
  return project.name.toLowerCase().replace(/\s+/g, '') || 'map'
}

// ─── Main export entry point ──────────────────────────────────────────────────

export async function buildExportBundle(project: MapProject): Promise<ExportBundle> {
  const rawW = project.width
  const rawH = project.height
  // Trim to multiples of 4 (required for 2-level minimap downscaling)
  const width = rawW - (rawW % 4)
  const height = rawH - (rawH % 4)

  if (width < 4 || height < 4) {
    throw new Error(`Map dimensions (${rawW}×${rawH}) are too small to export — minimum 4×4.`)
  }

  // ── Full resolution grid ──
  const grid = buildGrid(project.terrain, project.magnitude, width, height)
  processWater(grid)

  // ── 4x minimap (half dimensions) ──
  const grid4x = createMiniGrid(grid)
  processWater(grid4x)

  // ── 16x minimap (quarter dimensions) ──
  const grid16x = createMiniGrid(grid4x)
  processWater(grid16x)

  // ── Pack binary data ──
  const { data: mapData, numLandTiles } = packGrid(grid)
  const { data: map4xData, numLandTiles: numLandTiles4x } = packGrid(grid4x)
  const { data: map16xData, numLandTiles: numLandTiles16x } = packGrid(grid16x)

  // ── Thumbnail (from 4x minimap, rendered at 0.5) ──
  const thumbCanvas = renderThumbnail(grid4x, 0.5)
  // Try WebP (Chrome/Edge support); PNG fallback handled implicitly
  const thumbBlob = await promiseCanvasBlob(thumbCanvas, 'image/webp')
  const thumbBuffer = new Uint8Array(await thumbBlob.arrayBuffer())

  // ── Manifest ──
  const manifest = {
    name: project.name,
    nations: project.nations.map((n) => ({ id: n.id, name: n.name, x: n.x, y: n.y })),
    metadata: project.metadata,
    generatedAt: new Date().toISOString(),
    map: { width, height, num_land_tiles: numLandTiles },
    map4x: { width: grid4x.width, height: grid4x.height, num_land_tiles: numLandTiles4x },
    map16x: { width: grid16x.width, height: grid16x.height, num_land_tiles: numLandTiles16x },
  }

  const folderName = createFolderName(project)
  const fileEntries: Record<string, Uint8Array> = {
    [`${folderName}/manifest.json`]: strToU8(JSON.stringify(manifest, null, 2)),
    [`${folderName}/map.bin`]: mapData,
    [`${folderName}/map4x.bin`]: map4xData,
    [`${folderName}/map16x.bin`]: map16xData,
    [`${folderName}/thumbnail.webp`]: thumbBuffer,
  }

  const zipped = zipSync(fileEntries, { level: 6 })
  const zipBuffer = new ArrayBuffer(zipped.byteLength)
  new Uint8Array(zipBuffer).set(zipped)

  return {
    fileNames: Object.keys(fileEntries),
    zipBlob: new Blob([zipBuffer], { type: 'application/zip' }),
  }
}

// ─── PNG export (visual preview) ─────────────────────────────────────────────

/**
 * Export a PNG using the same thumbnail colour scheme as the official generator.
 * 1 pixel per tile — nations drawn as orange dots.
 */
export async function buildExportPng(project: MapProject): Promise<Blob> {
  const { width, height, terrain, magnitude, nations } = project

  // Reuse the same processWater logic so colours reflect computed shorelines
  const grid = buildGrid(terrain, magnitude, width, height)
  processWater(grid)

  // Render at 1:1 (quality=1 relative to grid size)
  const canvas = renderThumbnail(grid, 1)
  // Make water opaque for a standalone PNG
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.getImageData(0, 0, width, height)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) {
      // Transparent water → opaque water blue
      d[i] = 0x0b; d[i + 1] = 0x4f; d[i + 2] = 0x6c; d[i + 3] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)

  // Draw nations as orange dots
  const dotRadius = Math.max(2, Math.min(6, width / 200))
  ctx.fillStyle = '#f97316'
  for (const nation of nations) {
    ctx.beginPath()
    ctx.arc(nation.x + 0.5, nation.y + 0.5, dotRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  return promiseCanvasBlob(canvas, 'image/png')
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}