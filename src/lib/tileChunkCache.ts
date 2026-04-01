export const CHUNK_SIZE = 32

type ChunkProject = {
  width: number
  height: number
  terrain: Uint8Array
  magnitude: Uint8Array
}

// LRU Cache with configurable max entries to prevent memory bloat on large maps
const MAX_CACHE_ENTRIES = 100

interface CacheEntry {
  key: string
  canvas: HTMLCanvasElement
  lastAccessed: number
}

class LRUCache {
  private entries = new Map<string, CacheEntry>()
  private accessOrder: string[] = [] // Track access order for LRU eviction

  get(key: string): HTMLCanvasElement | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined

    // Move to most recently used position
    this.touch(key)
    return entry.canvas
  }

  set(key: string, canvas: HTMLCanvasElement): void {
    if (this.entries.has(key)) {
      this.entries.set(key, { key, canvas, lastAccessed: Date.now() })
      this.touch(key)
    } else {
      // Evict oldest entries if at capacity
      while (this.entries.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = this.accessOrder.shift()
        if (oldestKey) {
          this.entries.delete(oldestKey)
        }
      }

      this.entries.set(key, { key, canvas, lastAccessed: Date.now() })
      this.accessOrder.push(key)
    }
  }

  delete(key: string): void {
    this.entries.delete(key)
    this.accessOrder = this.accessOrder.filter((k) => k !== key)
  }

  clear(): void {
    this.entries.clear()
    this.accessOrder = []
  }

  size(): number {
    return this.entries.size
  }

  private touch(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
      this.accessOrder.push(key)
    }
  }
}

const chunkCanvasCache = new LRUCache()

function getChunkKey(project: ChunkProject, chunkX: number, chunkY: number): string {
  return `${project.width}x${project.height}:${chunkX},${chunkY}`
}

function getChunkBounds(project: ChunkProject, chunkX: number, chunkY: number) {
  const startX = chunkX * CHUNK_SIZE
  const startY = chunkY * CHUNK_SIZE

  return {
    startX,
    startY,
    endX: Math.min(project.width, startX + CHUNK_SIZE),
    endY: Math.min(project.height, startY + CHUNK_SIZE),
  }
}

export function invalidateAllChunkCache(): void {
  chunkCanvasCache.clear()
}

export function invalidateChunkCacheForTile(project: ChunkProject, tileX: number, tileY: number): void {
  const chunkX = Math.floor(tileX / CHUNK_SIZE)
  const chunkY = Math.floor(tileY / CHUNK_SIZE)
  chunkCanvasCache.delete(getChunkKey(project, chunkX, chunkY))
}

export function invalidateChunkCacheForRect(
  project: ChunkProject,
  minTileX: number,
  minTileY: number,
  maxTileX: number,
  maxTileY: number,
): void {
  const startChunkX = Math.floor(minTileX / CHUNK_SIZE)
  const startChunkY = Math.floor(minTileY / CHUNK_SIZE)
  const endChunkX = Math.floor(maxTileX / CHUNK_SIZE)
  const endChunkY = Math.floor(maxTileY / CHUNK_SIZE)

  for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
    for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
      chunkCanvasCache.delete(getChunkKey(project, chunkX, chunkY))
    }
  }
}

export function getChunkCanvas(project: ChunkProject, chunkX: number, chunkY: number): HTMLCanvasElement {
  const key = getChunkKey(project, chunkX, chunkY)
  const cached = chunkCanvasCache.get(key)
  if (cached) return cached

  const bounds = getChunkBounds(project, chunkX, chunkY)
  const canvas = document.createElement('canvas')
  canvas.width = bounds.endX - bounds.startX
  canvas.height = bounds.endY - bounds.startY

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    chunkCanvasCache.set(key, canvas)
    return canvas
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let y = bounds.startY; y < bounds.endY; y += 1) {
    for (let x = bounds.startX; x < bounds.endX; x += 1) {
      const index = y * project.width + x
      const terrain = project.terrain[index] ?? 0
      const magnitude = project.magnitude[index] ?? 0

      if (terrain === 1) {
        ctx.fillStyle = `rgb(${magnitude}, ${Math.min(255, magnitude + 30)}, ${Math.min(255, magnitude + 10)})`
      } else {
        ctx.fillStyle = '#0b4f6c'
      }

      ctx.fillRect(x - bounds.startX, y - bounds.startY, 1, 1)
    }
  }

  chunkCanvasCache.set(key, canvas)
  return canvas
}

// Debug function to check cache stats
export function getChunkCacheStats() {
  return {
    entries: chunkCanvasCache.size(),
    maxEntries: MAX_CACHE_ENTRIES,
  }
}