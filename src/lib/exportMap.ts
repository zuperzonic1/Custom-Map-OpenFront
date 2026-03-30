import { zipSync, strToU8 } from 'fflate'
import type { MapProject } from '../store/editorStore'

export type ExportBundle = {
  fileNames: string[]
  zipBlob: Blob
}

function createManifest(project: MapProject) {
  return {
    name: project.name,
    width: project.width,
    height: project.height,
    terrainTiles: project.width * project.height,
    nations: project.nations.map((nation) => ({
      id: nation.id,
      name: nation.name,
      x: nation.x,
      y: nation.y,
    })),
    metadata: project.metadata,
    generatedAt: new Date().toISOString(),
  }
}

function createFolderName(project: MapProject) {
  const normalized = project.name.toLowerCase().replace(/\s+/g, '')
  return normalized || 'map'
}

function buildBinary(project: MapProject, divisor: number) {
  const outputWidth = Math.max(1, Math.ceil(project.width / divisor))
  const outputHeight = Math.max(1, Math.ceil(project.height / divisor))
  const output = new Uint8Array(outputWidth * outputHeight * 2)

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      let terrainTotal = 0
      let magnitudeTotal = 0
      let samples = 0

      for (let sy = y * divisor; sy < Math.min(project.height, (y + 1) * divisor); sy += 1) {
        for (let sx = x * divisor; sx < Math.min(project.width, (x + 1) * divisor); sx += 1) {
          const index = sy * project.width + sx
          terrainTotal += project.terrain[index] ?? 0
          magnitudeTotal += project.magnitude[index] ?? 0
          samples += 1
        }
      }

      const targetIndex = (y * outputWidth + x) * 2
      output[targetIndex] = terrainTotal > samples / 2 ? 1 : 0
      output[targetIndex + 1] = samples > 0 ? Math.round(magnitudeTotal / samples) : 0
    }
  }

  return output
}

function promiseCanvasBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to generate thumbnail'))
        return
      }

      resolve(blob)
    }, type)
  })
}

export async function buildExportBundle(
  project: MapProject,
  thumbnailCanvas: HTMLCanvasElement | null,
): Promise<ExportBundle> {
  const manifest = createManifest(project)
  const mapBin = buildBinary(project, 1)
  const map4xBin = buildBinary(project, 4)
  const map16xBin = buildBinary(project, 16)

  let thumbnail = new Blob([new Uint8Array()], { type: 'image/webp' })
  if (thumbnailCanvas) {
    thumbnail = await promiseCanvasBlob(thumbnailCanvas, 'image/webp')
  }

  const folderName = createFolderName(project)
  const fileEntries = {
    [`${folderName}/manifest.json`]: strToU8(JSON.stringify(manifest, null, 2)),
    [`${folderName}/map.bin`]: mapBin,
    [`${folderName}/map4x.bin`]: map4xBin,
    [`${folderName}/map16x.bin`]: map16xBin,
    [`${folderName}/thumbnail.webp`]: new Uint8Array(await thumbnail.arrayBuffer()),
  }

  const zipped = zipSync(fileEntries, { level: 6 })
  const zipBuffer = new ArrayBuffer(zipped.byteLength)
  new Uint8Array(zipBuffer).set(zipped)

  return {
    fileNames: Object.keys(fileEntries),
    zipBlob: new Blob([zipBuffer], { type: 'application/zip' }),
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}