import type { MapProject } from '../store/editorStore'

// ---------------------------------------------------------------------------
// Blue-channel → terrain / magnitude mapping
// (follows the OpenFront terrain generator spec)
// ---------------------------------------------------------------------------

/**
 * Returns `{ terrain, magnitude }` for a single RGBA pixel.
 * Water tiles get magnitude = 0 here; `computeWaterMagnitude` fills the real
 * BFS distance afterwards.
 */
function pixelToTerrain(
  _r: number,
  _g: number,
  b: number,
  a: number,
): { terrain: 0 | 1; magnitude: number } {
  // Water: transparent pixel
  if (a < 20) return { terrain: 0, magnitude: 0 }
  // Water: specific key colour (blue = 106)
  if (b === 106) return { terrain: 0, magnitude: 0 }

  // Land — decode blue channel → game magnitude (0-30) → editor magnitude (0-255)
  let gameMag: number
  if (b < 140) {
    gameMag = 0
  } else if (b <= 158) {
    // Plains — game magnitude 0-9
    gameMag = Math.round(((b - 140) / 18) * 9)
  } else if (b <= 178) {
    // Highland — game magnitude 10-19
    gameMag = 10 + Math.round(((b - 159) / 19) * 9)
  } else if (b <= 200) {
    // Mountain — game magnitude 20-30
    gameMag = 20 + Math.round(((b - 179) / 21) * 10)
  } else {
    gameMag = 30
  }
  // Convert game magnitude (0-30) → editor magnitude (0-255)
  return { terrain: 1, magnitude: Math.round((gameMag / 30) * 255) }
}

// ---------------------------------------------------------------------------
// BFS water magnitude — distance to nearest land tile (clamped to 255)
// ---------------------------------------------------------------------------

function computeWaterMagnitude(
  terrain: Uint8Array,
  magnitude: Uint8Array,
  width: number,
  height: number,
): void {
  // -1 = unvisited
  const dist = new Int32Array(width * height).fill(-1)
  // Use a typed queue (flat index) with a head pointer to avoid Array#shift cost.
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  // Seed the BFS from every land tile.
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === 1) {
      dist[i] = 0
      queue[tail++] = i
    }
  }

  const dx = [1, -1, 0, 0]
  const dy = [0, 0, 1, -1]

  while (head < tail) {
    const idx = queue[head++]
    const x = idx % width
    const y = (idx / width) | 0
    const d = dist[idx] + 1

    for (let dir = 0; dir < 4; dir++) {
      const nx = x + dx[dir]
      const ny = y + dy[dir]
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const nidx = ny * width + nx
      if (dist[nidx] !== -1) continue
      dist[nidx] = d
      queue[tail++] = nidx
    }
  }

  // Write clamped distance into magnitude for every water tile.
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === 0) {
      const d = dist[i]
      magnitude[i] = d === -1 ? 255 : d > 255 ? 255 : d
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class ImportError extends Error {}

/**
 * Reads an image file, converts each pixel to terrain + magnitude using the
 * OpenFront blue-channel spec, then fills water-tile magnitude with BFS
 * distance to the nearest land tile.
 */
export async function importImageAsProject(file: File): Promise<MapProject> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImportError('Could not decode image. Make sure it is a valid PNG, JPEG, or WebP file.')
  }

  const { width, height } = bitmap

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new ImportError('Could not acquire 2D canvas context.')
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const { data } = ctx.getImageData(0, 0, width, height) // RGBA, 4 bytes/px

  const terrain = new Uint8Array(width * height)
  const magnitude = new Uint8Array(width * height)

  for (let i = 0; i < width * height; i++) {
    const base = i * 4
    const result = pixelToTerrain(data[base], data[base + 1], data[base + 2], data[base + 3])
    terrain[i] = result.terrain
    magnitude[i] = result.magnitude
  }

  computeWaterMagnitude(terrain, magnitude, width, height)

  const name = file.name.replace(/\.[^.]+$/, '') || 'Imported map'

  return {
    name,
    width,
    height,
    terrain,
    magnitude,
    nations: [],
    metadata: { author: '', description: '' },
  }
}