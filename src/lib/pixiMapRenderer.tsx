/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasRenderer, Container, Sprite, Texture } from 'pixi.js'
import { useEditorStore } from '../store/editorStore'

export type PixiMapOptions = {
  width: number
  height: number
  tileSize: number
}

const BASE_TILE_SIZE = 14
const CHUNK_SIZE = 32

function getTerrainColor(terrain: number, magnitude: number): number {
  if (terrain === 1) {
    const r = magnitude
    const g = Math.min(255, magnitude + 30)
    const b = Math.min(255, magnitude + 10)
    return (r << 16) | (g << 8) | b
  }

  return 0x0b4f6c
}

function clearContainer(container: Container): void {
  const children = container.removeChildren()
  children.forEach((child) => {
    child.destroy({ children: true })
  })
}

function createTileSprite(x: number, y: number, size: number, tint: number): Sprite {
  const sprite = new Sprite(Texture.WHITE)
  sprite.x = x
  sprite.y = y
  sprite.width = size
  sprite.height = size
  sprite.tint = tint
  return sprite
}

function createChunkContainer(
  chunkX: number,
  chunkY: number,
  width: number,
  height: number,
  projectWidth: number,
  terrain: Uint8Array,
  magnitude: Uint8Array,
  tileSize: number,
): Container {
  const container = new Container()
  container.label = `chunk-${chunkX}-${chunkY}`

  const startX = chunkX * CHUNK_SIZE
  const startY = chunkY * CHUNK_SIZE

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const worldX = startX + x
      const worldY = startY + y
      const index = worldY * projectWidth + worldX

      if (index < 0 || index >= terrain.length) {
        continue
      }

      const terrainType = terrain[index] ?? 0
      const magnitudeVal = magnitude[index] ?? 0
      const tint = getTerrainColor(terrainType, magnitudeVal)

      container.addChild(createTileSprite(worldX * tileSize, worldY * tileSize, tileSize, tint))
    }
  }

  return container
}

function createNationContainer(x: number, y: number, tileSize: number): Container {
  const container = new Container()
  container.label = `nation-${x}-${y}`

  const centerX = x * tileSize + tileSize / 2
  const centerY = y * tileSize + tileSize / 2
  const markerSize = Math.max(8, tileSize * 0.45)

  const border = createTileSprite(centerX - markerSize / 2 - 2, centerY - markerSize / 2 - 2, markerSize + 4, 0x1e293b)
  const fill = createTileSprite(centerX - markerSize / 2, centerY - markerSize / 2, markerSize, 0xff9726)

  container.addChild(border)
  container.addChild(fill)

  return container
}

export function usePixiMapRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: PixiMapOptions,
) {
  const rendererRef = useRef<CanvasRenderer | null>(null)
  const worldContainerRef = useRef<Container | null>(null)
  const [isReady, setIsReady] = useState(false)

  const baseTileSize = options.tileSize || BASE_TILE_SIZE
  const renderRevision = useEditorStore((state) => state.renderRevision)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let destroyed = false

    const init = async () => {
      const renderer = new CanvasRenderer()
      const parent = canvas.parentElement
      await renderer.init({
        canvas,
        width: parent?.clientWidth ?? options.width,
        height: parent?.clientHeight ?? options.height,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        backgroundColor: 0x0f172a,
        antialias: false,
      })

      if (destroyed) {
        renderer.destroy()
        return
      }

      const worldContainer = new Container()
      worldContainer.label = 'world-container'

      rendererRef.current = renderer
      worldContainerRef.current = worldContainer
      setIsReady(true)
    }

    void init()

    return () => {
      destroyed = true
      setIsReady(false)

      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }

      worldContainerRef.current = null
    }
  }, [canvasRef])

  const renderScene = useCallback(() => {
    const renderer = rendererRef.current
    const worldContainer = worldContainerRef.current
    if (!renderer || !worldContainer) return

    const store = useEditorStore.getState()
    const { width: projectWidth, height: projectHeight } = store.project

    clearContainer(worldContainer)

    const numChunksX = Math.ceil(projectWidth / CHUNK_SIZE)
    const numChunksY = Math.ceil(projectHeight / CHUNK_SIZE)

    for (let cy = 0; cy < numChunksY; cy += 1) {
      for (let cx = 0; cx < numChunksX; cx += 1) {
        const chunkWidth = Math.min(CHUNK_SIZE, projectWidth - cx * CHUNK_SIZE)
        const chunkHeight = Math.min(CHUNK_SIZE, projectHeight - cy * CHUNK_SIZE)

        worldContainer.addChild(
          createChunkContainer(
            cx,
            cy,
            chunkWidth,
            chunkHeight,
            projectWidth,
            store.project.terrain,
            store.project.magnitude,
            baseTileSize,
          ),
        )
      }
    }

    store.project.nations.forEach((nation) => {
      worldContainer.addChild(createNationContainer(nation.x, nation.y, baseTileSize))
    })

    renderer.render(worldContainer)
  }, [baseTileSize])

  useEffect(() => {
    if (!isReady) return
    renderScene()
  }, [isReady, renderScene, renderRevision])

  const updateTransform = useCallback((zoom: number, panX: number, panY: number) => {
    if (!rendererRef.current || !worldContainerRef.current) return

    worldContainerRef.current.scale.set(zoom)
    worldContainerRef.current.position.set(panX, panY)

    rendererRef.current.render(worldContainerRef.current)
  }, [])

  return {
    updateTransform,
  }
}

export function PixiMapEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const zoom = useEditorStore((state) => state.zoom)
  const panX = useEditorStore((state) => state.panX)
  const panY = useEditorStore((state) => state.panY)

  const isDrawingRef = useRef(false)
  const isSpacePressedRef = useRef(false)
  const pointerSequenceActiveRef = useRef(false)

  const { updateTransform } = usePixiMapRenderer(canvasRef, {
    width: 0,
    height: 0,
    tileSize: BASE_TILE_SIZE,
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isEditableTarget =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)

      if (event.code === 'Space' && !isEditableTarget) {
        event.preventDefault()
        isSpacePressedRef.current = true
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        isSpacePressedRef.current = false
      }
    }

    const stopInteraction = () => {
      isDrawingRef.current = false
      pointerSequenceActiveRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mouseup', stopInteraction)
    window.addEventListener('pointerup', stopInteraction)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mouseup', stopInteraction)
      window.removeEventListener('pointerup', stopInteraction)
    }
  }, [])

  useEffect(() => {
    updateTransform(zoom, panX, panY)
  }, [zoom, panX, panY, updateTransform])

  // Native wheel listener registered with { passive: false } so that
  // event.preventDefault() actually suppresses page scrolling.
  // React's synthetic onWheel is passive in React 17+ and cannot be made
  // non-passive via JSX props, so we attach the listener imperatively.
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault()

      const store = useEditorStore.getState()
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * 0.001)
      const nextZoom = Math.min(6, Math.max(0.05, store.zoom * factor))

      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      const currentTileSize = BASE_TILE_SIZE * store.zoom
      const worldX = (localX - store.panX) / currentTileSize
      const worldY = (localY - store.panY) / currentTileSize
      const nextPanX = localX - worldX * (BASE_TILE_SIZE * nextZoom)
      const nextPanY = localY - worldY * (BASE_TILE_SIZE * nextZoom)

      useEditorStore.getState().setZoom(nextZoom)
      useEditorStore.getState().setPan(nextPanX, nextPanY)
    },
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  const getTileFromPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const store = useEditorStore.getState()
    const tileSize = BASE_TILE_SIZE * store.zoom
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const x = Math.floor((localX - store.panX) / tileSize)
    const y = Math.floor((localY - store.panY) / tileSize)

    if (x < 0 || y < 0 || x >= store.project.width || y >= store.project.height) {
      return null
    }

    return { x, y }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()

    const store = useEditorStore.getState()
    const canvas = canvasRef.current
    if (!canvas) return

    pointerSequenceActiveRef.current = true
    canvas.setPointerCapture(event.pointerId)

    if (event.button === 1 || isSpacePressedRef.current) {
      isDrawingRef.current = false
      const originPan = { x: store.panX, y: store.panY }
      const startX = event.clientX
      const startY = event.clientY

      const onMove = (moveEvent: PointerEvent | MouseEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        useEditorStore.getState().setPan(originPan.x + dx, originPan.y + dy)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove as EventListener)
        window.removeEventListener('mousemove', onMove as EventListener)
        window.removeEventListener('pointerup', onUp as EventListener)
        window.removeEventListener('mouseup', onUp as EventListener)
      }

      window.addEventListener('pointermove', onMove as EventListener)
      window.addEventListener('mousemove', onMove as EventListener)
      window.addEventListener('pointerup', onUp as EventListener)
      window.addEventListener('mouseup', onUp as EventListener)
      return
    }

    const tile = getTileFromPoint(event.clientX, event.clientY)
    if (!tile) return

    if (store.tool === 'nation') {
      useEditorStore.getState().addNationAt(tile.x, tile.y)
      return
    }

    isDrawingRef.current = true
    useEditorStore.getState().paintAt(tile.x, tile.y)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    if (useEditorStore.getState().tool === 'nation') return

    const tile = getTileFromPoint(event.clientX, event.clientY)
    if (!tile) return

    useEditorStore.getState().paintAt(tile.x, tile.y)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (canvas) {
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore if capture was already released.
      }
    }

    isDrawingRef.current = false
    pointerSequenceActiveRef.current = false
  }

  const handleMouseLeave = () => {
    isDrawingRef.current = false
    pointerSequenceActiveRef.current = false
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          cursor: 'crosshair',
          width: '100%',
          height: '100%',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
}