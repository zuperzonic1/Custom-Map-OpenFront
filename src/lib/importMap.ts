import type { MapProject } from '../store/editorStore'

const VALID_CATEGORIES = [
  'new', 'featured', 'continental', 'world', 'europe', 'asia',
  'north_america', 'africa', 'south_america', 'oceania', 'antarctica',
  'countries', 'cosmic', 'tournament', 'fictional', 'arcade',
]

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
// Generic "any image" → terrain / magnitude mapping
// ---------------------------------------------------------------------------

/**
 * Converts any RGBA pixel to terrain + magnitude using luminance.
 *
 * Luminance (0-255) determines both land/water and elevation:
 *   - Pixels below `threshold` → water
 *   - Pixels at or above `threshold` → land
 *   - Land magnitude = luminance mapped to 0-255
 *
 * The threshold can be adjusted — 128 works well for typical images.
 */
function pixelToTerrainAny(
  r: number,
  g: number,
  b: number,
  a: number,
  threshold = 128,
): { terrain: 0 | 1; magnitude: number } {
  // Water: transparent pixel
  if (a < 20) return { terrain: 0, magnitude: 0 }

  // Perceived luminance (ITU-R BT.601)
  const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b)

  // Below threshold → water
  if (luminance < threshold) return { terrain: 0, magnitude: 0 }

  // Above threshold → land, magnitude = luminance
  return { terrain: 1, magnitude: luminance }
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
// Common image decoding helper
// ---------------------------------------------------------------------------

async function decodeImageFile(file: File): Promise<{
  width: number
  height: number
  data: Uint8ClampedArray
}> {
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

  return { width, height, data: ctx.getImageData(0, 0, width, height).data }
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
  const { width, height, data } = await decodeImageFile(file)

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
    metadata: { author: '', description: '', id: '', translation_key: '', categories: [], multiplayer_frequency: 4 },
  }
}

/**
 * Reads any image file and converts it to terrain + magnitude using pixel
 * luminance (brightness). Pixels below a brightness threshold become water;
 * brighter pixels become land with elevation proportional to brightness.
 *
 * This allows importing any photograph, illustration, or diagram as a map.
 */
export async function importImageAsAnyMap(file: File): Promise<MapProject> {
  const { width, height, data } = await decodeImageFile(file)

  const terrain = new Uint8Array(width * height)
  const magnitude = new Uint8Array(width * height)

  // Use Otsu's method to determine an adaptive threshold, or fall back to 128.
  // For simplicity, we default to 128 which works for most well-exposed images.
  const threshold = 128

  for (let i = 0; i < width * height; i++) {
    const base = i * 4
    const result = pixelToTerrainAny(data[base], data[base + 1], data[base + 2], data[base + 3], threshold)
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
    metadata: { author: '', description: '', id: '', translation_key: '', categories: [], multiplayer_frequency: 4 },
  }
}

/**
 * Parsed metadata from a JSON file (name, metadata, and nations only — no terrain data).
 */
export type ImportedMetadata = {
  name: string
  id: string
  translation_key: string
  categories: string[]
  multiplayer_frequency: number
  nations: Array<{ id: string; name: string; countryCode?: string; x: number; y: number }>
}

/**
 * Reads a JSON file containing map metadata (name + nations) and returns it.
 * This is intended for importing export-style info.json files that contain
 * just the project name and nation placements.
 *
 * Expected JSON format:
 * ```json
 * {
 *   "id": "MySampleMap",
 *   "name": "My Sample Map",
 *   "translation_key": "map.mysamplemap",
 *   "categories": ["europe"],
 *   "multiplayer_frequency": 4,
 *   "nations": [
 *     { "coordinates": [322, 269], "flag": "", "name": "Jolly Ninjas" },
 *     ...
 *   ]
 * }
 * ```
 *
 * Nation entries may use either the editor's `{ id, name, countryCode, x, y }`
 * format or the export's `{ coordinates, flag, name }` format.
 */
export async function importMetadataFromJson(file: File): Promise<ImportedMetadata> {
  let parsed: unknown
  try {
    const text = await file.text()
    parsed = JSON.parse(text)
  } catch {
    throw new ImportError('Could not parse file as JSON. Make sure it is a valid .json file.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ImportError('Invalid file: expected a JSON object with "name" and optional "nations".')
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj.name !== 'string') {
    throw new ImportError('Invalid file: missing or invalid "name" field.')
  }

  // Parse new metadata fields
  const id = typeof obj.id === 'string' ? obj.id : ''
  const translation_key = typeof obj.translation_key === 'string' ? obj.translation_key : ''
  const multiplayer_frequency = typeof obj.multiplayer_frequency === 'number' ? obj.multiplayer_frequency : 4

  // Parse categories — validate each against the allowed list
  let categories: string[] = []
  if (Array.isArray(obj.categories)) {
    categories = obj.categories.filter(
      (c): c is string => typeof c === 'string' && (VALID_CATEGORIES as readonly string[]).includes(c),
    )
  }

  const nations: Array<{ id: string; name: string; countryCode?: string; x: number; y: number }> = []

  if (obj.nations !== undefined) {
    if (!Array.isArray(obj.nations)) {
      throw new ImportError('Invalid file: "nations" must be an array.')
    }

    for (let i = 0; i < obj.nations.length; i++) {
      const n = obj.nations[i]
      if (!n || typeof n !== 'object') {
        throw new ImportError(`Invalid file: nations[${i}] is not an object.`)
      }

      const entry = n as Record<string, unknown>

      // Support both the editor format { id, name, countryCode, x, y }
      // and the export format { coordinates: [x, y], flag, name }
      let x: number | undefined
      let y: number | undefined
      let name: string | undefined
      let countryCode: string | undefined
      let id: string | undefined

      if (Array.isArray(entry.coordinates) && entry.coordinates.length >= 2) {
        x = entry.coordinates[0]
        y = entry.coordinates[1]
      } else if (typeof entry.x === 'number' && typeof entry.y === 'number') {
        x = entry.x
        y = entry.y
      }

      if (typeof entry.name === 'string') name = entry.name
      if (typeof entry.flag === 'string') countryCode = entry.flag.toUpperCase()
      if (typeof entry.countryCode === 'string') countryCode = entry.countryCode
      if (typeof entry.id === 'string') id = entry.id

      if (x === undefined || y === undefined) {
        throw new ImportError(
          `Invalid file: nations[${i}] is missing coordinates. Expected "coordinates" ([x, y]) or "x" and "y" fields.`,
        )
      }

      if (!name || !name.trim()) {
        throw new ImportError(`Invalid file: nations[${i}] is missing a valid "name".`)
      }

      nations.push({
        id: id ?? `nation-import-${Date.now()}-${i}`,
        name,
        countryCode: countryCode ?? '',
        x,
        y,
      })
    }
  }

  return { name: obj.name as string, id, translation_key, categories, multiplayer_frequency, nations }
}

/** Allowed values for the `categories` field in info.json */
export { VALID_CATEGORIES }