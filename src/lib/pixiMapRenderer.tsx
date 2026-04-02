/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasRenderer, Container, Sprite, Texture } from 'pixi.js'
import { useEditorStore } from '../store/editorStore'
import { getChunkCanvas, CHUNK_SIZE } from './tileChunkCache'

export type PixiMapOptions = {
  width: number
  height: number
  tileSize: number
}

const BASE_TILE_SIZE = 14
// Extra chunks rendered beyond the visible edge to avoid popping during fast pans
const CULL_MARGIN = 1

// ─── Nation marker helpers ────────────────────────────────────────────────────

function createNationSprite(x: number, y: number, color: number, size: number): Sprite {
  const sprite = new Sprite(Texture.WHITE)
  sprite.x = x
  sprite.y = y
  sprite.width = size
  sprite.height = size
  sprite.tint = color
  return sprite
}

function createNationContainer(x: number, y: number, tileSize: number): Container {
  const container = new Container()
  container.label = `nation-${x}-${y}`

  const centerX = x * tileSize + tileSize / 2
  const centerY = y * tileSize + tileSize / 2
  const markerSize = Math.max(8, tileSize * 0.45)

  container.addChild(
    createNationSprite(
      centerX - markerSize / 2 - 2,
      centerY - markerSize / 2 - 2,
      0x1e293b,
      markerSize + 4,
    ),
  )
  container.addChild(
    createNationSprite(
      centerX - markerSize / 2,
      centerY - markerSize / 2,
      0xff9726,
      markerSize,
    ),
  )

  return container
}

// ─── Texture cache (WeakMap keyed by HTMLCanvasElement reference) ─────────────
//
// tileChunkCache returns a STABLE canvas reference until a chunk is
// invalidated, at which point a FRESH canvas is returned.  We therefore key
// the texture cache by the canvas object itself: same canvas ⟹ same texture,
// new canvas ⟹ new texture (old entry is GC'd via WeakMap).

const chunkTextureMap = new WeakMap<HTMLCanvasElement, Texture>()

function getChunkTexture(canvas: HTMLCanvasElement): Texture {
  let texture = chunkTextureMap.get(canvas)
  if (!texture) {
    texture = Texture.from(canvas)
    // Nearest-neighbour: sharp pixel art upscaling, no bilinear blur.
    texture.source.scaleMode = 'nearest'
    chunkTextureMap.set(canvas, texture)
  }
  return texture
}

// ─── Per-chunk sprite pool entry ─────────────────────────────────────────────

interface ChunkSpriteEntry {
  sprite: Sprite
  /** The canvas reference used to build the current texture. */
  canvas: HTMLCanvasElement
}

// ─── Main renderer hook ───────────────────────────────────────────────────────

export function usePixiMapRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: PixiMapOptions,
) {
  const rendererRef = useRef<CanvasRenderer | null>(null)
  const worldContainerRef = useRef<Container | null>(null)
  const nationContainerRef = useRef<Container | null>(null)

  /**
   * Persistent pool of chunk sprites.  Keyed "cx,cy".
   * Sprites are created when a chunk enters the viewport and destroyed only
   * when it leaves — never on every pan/zoom frame.
   */
  const chunkSpriteMapRef = useRef(new Map<string, ChunkSpriteEntry>())

  /** rAF handle; null means no frame is currently scheduled. */
  const rafIdRef = useRef<number | null>(null)

  /**
   * The renderRevision value from the last time we rebuilt nation markers.
   * Nations are only rebuilt when this differs from the store's current value.
   */
  const lastRenderRevisionRef = useRef<number>(-1)

  const [isReady, setIsReady] = useState(false)

  const baseTileSize = options.tileSize || BASE_TILE_SIZE

  // ── Renderer init / teardown ────────────────────────────────────────────────
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

      // Nation markers live in a dedicated child container so they always
      // render on top of chunk sprites regardless of draw order.
      const nationContainer = new Container()
      nationContainer.label = 'nation-container'
      worldContainer.addChild(nationContainer)

      rendererRef.current = renderer
      worldContainerRef.current = worldContainer
      nationContainerRef.current = nationContainer
      setIsReady(true)
    }

    void init()

    return () => {
      destroyed = true
      setIsReady(false)

      // Cancel any pending frame before teardown.
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      // Destroy all pooled chunk sprites.
      chunkSpriteMapRef.current.forEach(({ sprite }) => sprite.destroy())
      chunkSpriteMapRef.current.clear()

      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }

      worldContainerRef.current = null
      nationContainerRef.current = null
      lastRenderRevisionRef.current = -1
    }
  }, [canvasRef])

  // ── Core render function ────────────────────────────────────────────────────
  /**
   * Performs one render pass.  Reads zoom/pan/renderRevision directly from the
   * store so it always uses the latest values regardless of how many state
   * updates were batched before this frame fired.
   *
   * Work done per frame:
   *   1. Update worldContainer transform  (O(1) — just sets two numbers)
   *   2. Compute visible chunk range      (O(1))
   *   3. Remove off-screen sprites        (O(chunks leaving viewport) ≈ 0 for pan)
   *   4. Add/update on-screen sprites     (O(chunks entering viewport) ≈ 0 for pan)
   *   5. Rebuild nation markers           (only when renderRevision changes)
   *   6. renderer.render()                (draw call)
   */
  const renderFrame = useCallback(() => {
    const renderer = rendererRef.current
    const worldContainer = worldContainerRef.current
    const nationContainer = nationContainerRef.current
    const canvas = canvasRef.current
    if (!renderer || !worldContainer || !nationContainer || !canvas) return

    const store = useEditorStore.getState()
    const { zoom, panX, panY, renderRevision } = store
    const { width: projectWidth, height: projectHeight } = store.project

    // 1. Transform — always cheap.
    worldContainer.scale.set(zoom)
    worldContainer.position.set(panX, panY)

    // 2. Visible chunk range.
    const viewW = canvas.clientWidth || renderer.width / (renderer.resolution || 1)
    const viewH = canvas.clientHeight || renderer.height / (renderer.resolution || 1)
    const scaledTile = baseTileSize * zoom

    const startTileX = Math.max(0, Math.floor(-panX / scaledTile))
    const startTileY = Math.max(0, Math.floor(-panY / scaledTile))
    const endTileX = Math.min(projectWidth, Math.ceil((viewW - panX) / scaledTile))
    const endTileY = Math.min(projectHeight, Math.ceil((viewH - panY) / scaledTile))

    const startCX = Math.max(0, Math.floor(startTileX / CHUNK_SIZE) - CULL_MARGIN)
    const startCY = Math.max(0, Math.floor(startTileY / CHUNK_SIZE) - CULL_MARGIN)
    const endCX = Math.min(
      Math.ceil(projectWidth / CHUNK_SIZE),
      Math.ceil(endTileX / CHUNK_SIZE) + CULL_MARGIN,
    )
    const endCY = Math.min(
      Math.ceil(projectHeight / CHUNK_SIZE),
      Math.ceil(endTileY / CHUNK_SIZE) + CULL_MARGIN,
    )

    // Build the set of keys that SHOULD be visible this frame.
    const visibleKeys = new Set<string>()
    for (let cy = startCY; cy < endCY; cy++) {
      for (let cx = startCX; cx < endCX; cx++) {
        visibleKeys.add(`${cx},${cy}`)
      }
    }

    const spriteMap = chunkSpriteMapRef.current

    // 3. Remove sprites for chunks that left the viewport.
    for (const [key, { sprite }] of spriteMap) {
      if (!visibleKeys.has(key)) {
        worldContainer.removeChild(sprite)
        sprite.destroy()
        spriteMap.delete(key)
      }
    }

    // 4. Add or update sprites for currently visible chunks.
    //
    //    Chunk sprites are inserted just before nationContainer so nations
    //    always appear on top.  nationContainer is always the LAST child of
    //    worldContainer, so inserting at (children.length - 1) places the new
    //    sprite immediately before it.
    for (let cy = startCY; cy < endCY; cy++) {
      for (let cx = startCX; cx < endCX; cx++) {
        const key = `${cx},${cy}`
        const chunkCanvas = getChunkCanvas(store.project, cx, cy)
        const existing = spriteMap.get(key)

        if (existing) {
          // Sprite already exists.  Only swap the texture if the chunk was
          // invalidated (the LRU cache returned a fresh canvas reference).
          if (existing.canvas !== chunkCanvas) {
            existing.sprite.texture = getChunkTexture(chunkCanvas)
            existing.canvas = chunkCanvas
          }
          // Position/scale are in baseTileSize units — they never change.
        } else {
          // New chunk entering the viewport.
          const texture = getChunkTexture(chunkCanvas)
          const sprite = new Sprite(texture)
          sprite.x = cx * CHUNK_SIZE * baseTileSize
          sprite.y = cy * CHUNK_SIZE * baseTileSize
          // Scale from the 1px-per-tile canvas up to baseTileSize px-per-tile.
          sprite.scale.set(baseTileSize)
          // Insert before nationContainer (always the last child).
          worldContainer.addChildAt(sprite, worldContainer.children.length - 1)
          spriteMap.set(key, { sprite, canvas: chunkCanvas })
        }
      }
    }

    // 5. Rebuild nation markers only when the project content changed.
    if (renderRevision !== lastRenderRevisionRef.current) {
      nationContainer
        .removeChildren()
        .forEach((child) => child.destroy({ children: true }))
      store.project.nations.forEach((nation) => {
        nationContainer.addChild(createNationContainer(nation.x, nation.y, baseTileSize))
      })
      lastRenderRevisionRef.current = renderRevision
    }

    // 6. Draw.
    renderer.render(worldContainer)
  }, [baseTileSize, canvasRef])

  /**
   * Schedule renderFrame on the next animation frame.
   *
   * Multiple calls within the same JS task are coalesced — only ONE frame is
   * ever queued at a time.  This prevents redundant re-renders when zoom AND
   * panX AND panY all update synchronously (e.g. from handleWheel).
   */
  const scheduleRender = useCallback(() => {
    if (rafIdRef.current !== null) return // frame already queued
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      renderFrame()
    })
  }, [renderFrame])

  /**
   * Public API consumed by the PixiMapEditor component.
   * Parameters are accepted for interface compatibility but the actual values
   * are read from the store inside renderFrame so they are always fresh.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderWithViewport = useCallback(
    (zoom: number, panX: number, panY: number) => {
      void zoom; void panX; void panY
      scheduleRender()
    },
    [scheduleRender],
  )

  return {
    isReady,
    renderWithViewport,
  }
}

// ─── Canvas component ─────────────────────────────────────────────────────────

export function PixiMapEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const zoom = useEditorStore((state) => state.zoom)
  const panX = useEditorStore((state) => state.panX)
  const panY = useEditorStore((state) => state.panY)
  const renderRevision = useEditorStore((state) => state.renderRevision)

  const isDrawingRef = useRef(false)
  const isSpacePressedRef = useRef(false)
  const pointerSequenceActiveRef = useRef(false)

  const { isReady, renderWithViewport } = usePixiMapRenderer(canvasRef, {
    width: 0,
    height: 0,
    tileSize: BASE_TILE_SIZE,
  })

  useEffect(() => {
    if (!isReady) return
    renderWithViewport(zoom, panX, panY)
  }, [isReady, renderWithViewport, zoom, panX, panY, renderRevision])

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

  // Native wheel listener with { passive: false } to suppress page scrolling.
  const handleWheel = useCallback((event: WheelEvent) => {
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
  }, [])

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