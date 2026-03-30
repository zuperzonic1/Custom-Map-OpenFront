export const CHUNK_SIZE = 32

type ChunkProject = {
  width: number
  height: number
  terrain: Uint8Array
  magnitude: Uint8Array
}

const chunkCanvasCache = new Map<string, HTMLCanvasElement>()

function getChunkKey(project: ChunkProject, chunkX: number, chunkY: number) {
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

export function invalidateAllChunkCache() {
  chunkCanvasCache.clear()
}

export function invalidateChunkCacheForTile(project: ChunkProject, tileX: number, tileY: number) {
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
) {
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

export function getChunkCanvas(project: ChunkProject, chunkX: number, chunkY: number) {
  const key = getChunkKey(project, chunkX, chunkY)
  const cached = chunkCanvasCache.get(key)
  if (cached) {
    return cached
  }

  const bounds = getChunkBounds(project, chunkX, chunkY)
  const canvas = document.createElement('canvas')
  canvas.width = bounds.endX - bounds.startX
  canvas.height = bounds.endY - bounds.startY

  const ctx = canvas.getContext('2d')
  if (!ctx) {
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