/**
 * exportMap.ts
 *
 * Simplified export: produces a .zip containing:
 *   map.png      – the full-resolution map image (1 px per tile)
 *   info.json    – project name and nation data
 */

import { zipSync, strToU8 } from 'fflate'
import { mapCanvas } from './mapTexture'
import type { MapProject } from '../store/editorStore'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ExportBundle = {
  fileNames: string[]
  zipBlob: Blob
}

// ─── Blob helpers ─────────────────────────────────────────────────────────────

function promiseCanvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Unable to generate image blob')); return }
      resolve(blob)
    }, type, quality)
  })
}

// ─── Main export entry point ──────────────────────────────────────────────────

export async function buildExportBundle(project: MapProject): Promise<ExportBundle> {
  // ── Map image (PNG) ──
  // Capture the current mapCanvas (1 px per tile rendering) as a PNG blob.
  if (!mapCanvas) {
    throw new Error('Map canvas not available — render the map before exporting.')
  }

  const mapBlob = await promiseCanvasBlob(mapCanvas, 'image/png')
  const mapBuffer = new Uint8Array(await mapBlob.arrayBuffer())

  // ── info.json ──
  const info = {
    name: project.name,
    nations: project.nations.map((n) => ({
      coordinates: [n.x, n.y] as [number, number],
      flag: n.countryCode ? n.countryCode.toLowerCase() : '',
      name: n.name,
    })),
  }

  const fileEntries: Record<string, Uint8Array> = {
    'map.png': mapBuffer,
    'info.json': strToU8(JSON.stringify(info, null, 2)),
  }

  const zipped = zipSync(fileEntries, { level: 6 })
  const zipBuffer = new ArrayBuffer(zipped.byteLength)
  new Uint8Array(zipBuffer).set(zipped)

  return {
    fileNames: Object.keys(fileEntries),
    zipBlob: new Blob([zipBuffer], { type: 'application/zip' }),
  }
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000)
}