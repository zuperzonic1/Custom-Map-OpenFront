/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from 'react'
import { autoDetectRenderer, Container, Sprite, Text, Texture, type Renderer } from 'pixi.js'
import { useEditorStore, paintTilesDirect } from '../store/editorStore'
import { useViewportStore } from '../store/viewportStore'
import {
  mapCanvas,
  mapCanvasVersion,
  consumeTextureUpload,
  buildMapTexture,
} from './mapTexture'

export type PixiMapOptions = {
  width: number
  height: number
  tileSize: number
}

export const BASE_TILE_SIZE = 14

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

/**
 * Creates a nation marker container anchored at the tile-centre in
 * worldContainer local (world-pixel) space.  Children are expressed in
 * screen-pixel units; the caller must set container.scale.set(1/zoom) every
 * frame so the marker stays a constant physical size regardless of zoom.
 */
function createNationContainer(x: number, y: number, tileSize: number, name: string): Container {
  const container = new Container()
  container.label = `nation-${x}-${y}`

  // Anchor in worldContainer space — zoom is applied by the parent.
  container.position.set(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2)

  // Marker is drawn in screen-pixel space (scale-compensated each frame).
  const markerSize = 10

  // Dark shadow
  container.addChild(createNationSprite(-markerSize / 2 - 2, -markerSize / 2 - 2, 0x1e293b, markerSize + 4))
  // Orange square
  container.addChild(createNationSprite(-markerSize / 2, -markerSize / 2, 0xff9726, markerSize))

  // Nation name label
  const label = new Text({
    text: name,
    style: {
      fontSize: 11,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3 },
      fontWeight: 'bold',
      fontFamily: 'sans-serif',
    },
  })
  label.anchor.set(0.5, 0)
  label.position.set(0, markerSize / 2 + 3)
  container.addChild(label)

  return container
}

// ─── Main renderer hook ───────────────────────────────────────────────────────

export function usePixiMapRenderer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: PixiMapOptions,
) {
  const rendererRef = useRef<Renderer | null>(null)
  const worldContainerRef = useRef<Container | null>(null)
  const nationContainerRef = useRef<Container | null>(null)

  /**
   * Pixi's injected canvas — used for pointer hit-testing
   * (getBoundingClientRect).
   */
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  /** The single sprite that displays the entire map. */
  const mapSpriteRef = useRef<Sprite | null>(null)

  /** The Pixi Texture wrapping mapCanvas. Recreated when mapCanvasVersion
   *  changes (i.e. the project dimensions changed). */
  const mapTextureRef = useRef<Texture | null>(null)

  /** mapCanvasVersion value at the time the current texture was created. */
  const lastMapCanvasVersionRef = useRef(-1)

  /** rAF handle for the continuous render loop. */
  const rafIdRef = useRef<number | null>(null)

  /** renderRevision value from the last nation-marker rebuild. */
  const lastRenderRevisionRef = useRef<number>(-1)

  // FPS tracking
  const fpsFrameCountRef = useRef(0)
  const fpsLastTimeRef = useRef(0)
  const [fps, setFps] = useState(0)

  const [isReady, setIsReady] = useState(false)

  const baseTileSize = options.tileSize || BASE_TILE_SIZE

  // ── Fit-map-to-view helper ──────────────────────────────────────────────────
  const fitMapToView = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    const store = useEditorStore.getState()
    const { project } = store
    const vw = renderer.screen.width
    const vh = renderer.screen.height
    const fitZoom = Math.min(
      6,
      Math.max(0.05, Math.min(vw / (project.width * baseTileSize), vh / (project.height * baseTileSize))),
    )
    const panX = (vw - project.width * baseTileSize * fitZoom) / 2
    const panY = (vh - project.height * baseTileSize * fitZoom) / 2
    useViewportStore.setState({ zoom: fitZoom, panX, panY })
  }, [baseTileSize])

  // ── Renderer init / teardown ────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let destroyed = false

    const init = async () => {
      // Belt-and-suspenders: ensure the pixel buffer exists before creating the
      // GPU texture.  onRehydrateStorage in editorStore should have done this
      // already, but guard anyway.
      if (!mapCanvas) {
        buildMapTexture(useEditorStore.getState().project)
      }

      const rendererOptions = {
        // Do NOT pass canvas — Pixi owns it to avoid WebGL context conflicts on
        // React StrictMode double-invoke.
        width: container.clientWidth || options.width,
        height: container.clientHeight || options.height,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        backgroundColor: 0x0f172a,
        antialias: false,
      }

      let renderer
      try {
        renderer = await autoDetectRenderer(rendererOptions)
      } catch (e) {
        console.warn('[PixiMap] Hardware renderer failed, falling back to canvas:', e)
        renderer = await autoDetectRenderer({ ...rendererOptions, preference: 'canvas' })
      }

      if (destroyed) {
        renderer.destroy(true)
        return
      }

      // Inject Pixi's canvas into our container div.
      const pixiCanvas = renderer.canvas as HTMLCanvasElement
      pixiCanvas.style.display = 'block'
      pixiCanvas.style.width = '100%'
      pixiCanvas.style.height = '100%'
      container.prepend(pixiCanvas)
      canvasRef.current = pixiCanvas

      // ── Single map sprite ──────────────────────────────────────────────────
      //
      // The map canvas is projectWidth × projectHeight pixels (1 px per tile).
      // Scale the sprite by baseTileSize so 1 canvas pixel = 1 tile in world
      // space.  worldContainer.scale = zoom handles the screen-space scaling.
      const currentCanvas = mapCanvas!
      const texture = Texture.from(currentCanvas)
      texture.source.scaleMode = 'nearest'
      mapTextureRef.current = texture
      lastMapCanvasVersionRef.current = mapCanvasVersion

      const mapSprite = new Sprite(texture)
      mapSprite.x = 0
      mapSprite.y = 0
      mapSprite.scale.set(baseTileSize)
      mapSpriteRef.current = mapSprite

      const worldContainer = new Container()
      worldContainer.label = 'world-container'
      worldContainer.addChild(mapSprite)

      // Nation markers in a dedicated child so they always render on top.
      const nationContainer = new Container()
      nationContainer.label = 'nation-container'
      worldContainer.addChild(nationContainer)

      rendererRef.current = renderer
      worldContainerRef.current = worldContainer
      nationContainerRef.current = nationContainer

      // Tell the viewport store the initial size so the minimap viewport
      // indicator is correct before the first ResizeObserver fires.
      useViewportStore.setState({ viewportWidth: renderer.screen.width, viewportHeight: renderer.screen.height })

      setIsReady(true)
    }

    void init()

    return () => {
      destroyed = true
      setIsReady(false)

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      // Destroy the GPU texture (does NOT destroy the backing mapCanvas —
      // that belongs to mapTexture.ts and is reused across remounts).
      if (mapTextureRef.current) {
        mapTextureRef.current.destroy(false)
        mapTextureRef.current = null
      }
      mapSpriteRef.current = null

      if (rendererRef.current) {
        if (canvasRef.current?.parentElement) {
          canvasRef.current.parentElement.removeChild(canvasRef.current)
        }
        canvasRef.current = null
        rendererRef.current.destroy(true)
        rendererRef.current = null
      }

      worldContainerRef.current = null
      nationContainerRef.current = null
      lastRenderRevisionRef.current = -1
      lastMapCanvasVersionRef.current = -1
    }
  }, [containerRef]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core render function ────────────────────────────────────────────────────
  const renderFrame = useCallback(() => {
    const renderer = rendererRef.current
    const worldContainer = worldContainerRef.current
    const nationContainer = nationContainerRef.current
    if (!renderer || !worldContainer || !nationContainer) return

    const store = useEditorStore.getState()
    const viewport = useViewportStore.getState()
    const { renderRevision } = store
    const { zoom, panX, panY, pendingFitToView } = viewport

    // 0. Fit the entire map into the viewport when a new project was created.
    if (pendingFitToView) {
      fitMapToView()
      useViewportStore.setState({ pendingFitToView: false })
    }

    // 1. Apply world transform — always cheap.
    worldContainer.scale.set(zoom)
    worldContainer.position.set(panX, panY)

    // 2. If the project dimensions changed (new project was created/loaded),
    //    mapCanvasVersion will have incremented.  Swap to the new texture so
    //    the sprite shows the new map.
    if (mapCanvas && mapCanvasVersion !== lastMapCanvasVersionRef.current) {
      const oldTexture = mapTextureRef.current
      const newTexture = Texture.from(mapCanvas)
      newTexture.source.scaleMode = 'nearest'

      if (mapSpriteRef.current) {
        mapSpriteRef.current.texture = newTexture
        mapSpriteRef.current.scale.set(baseTileSize)
      }

      mapTextureRef.current = newTexture
      // Destroy old GPU resource but NOT its source — if the old canvas is
      // gone, we don't want to touch it; if it's the same, we need it.
      oldTexture?.destroy(false)
      lastMapCanvasVersionRef.current = mapCanvasVersion
    }

    // 3. Re-upload the canvas texture to the GPU if tile data was painted this
    //    frame.  consumeTextureUpload() resets the flag — call exactly once.
    if (consumeTextureUpload() && mapTextureRef.current) {
      mapTextureRef.current.source.update()
    }

    // 4. Rebuild nation markers only when the project content changed.
    if (renderRevision !== lastRenderRevisionRef.current) {
      nationContainer
        .removeChildren()
        .forEach((child) => child.destroy({ children: true }))
      store.project.nations.forEach((nation) => {
        nationContainer.addChild(createNationContainer(nation.x, nation.y, baseTileSize, nation.name))
      })
      lastRenderRevisionRef.current = renderRevision
    }

    // 5. Scale-compensate nation markers so they remain a constant screen size
    //    regardless of the current zoom level.
    if (nationContainer.children.length > 0) {
      const invZoom = 1 / zoom
      for (const child of nationContainer.children) {
        child.scale.set(invZoom)
      }
    }

    // 6. Draw — one draw call for the map sprite + one for each nation marker.
    renderer.render(worldContainer)

    // 7. FPS counter — updated once per second.
    const now = performance.now()
    fpsFrameCountRef.current += 1
    if (fpsLastTimeRef.current === 0) fpsLastTimeRef.current = now
    const elapsed = now - fpsLastTimeRef.current
    if (elapsed >= 1000) {
      setFps(Math.round((fpsFrameCountRef.current * 1000) / elapsed))
      fpsFrameCountRef.current = 0
      fpsLastTimeRef.current = now
    }
  }, [baseTileSize, fitMapToView])

  // ── Continuous render loop ───────────────────────────────────────────────────
  // Reads the latest Zustand state every tick — zero React-subscription latency
  // on paint / pan / zoom.
  useEffect(() => {
    if (!isReady) return
    let running = true
    const loop = () => {
      if (!running) return
      renderFrame()
      rafIdRef.current = requestAnimationFrame(loop)
    }
    rafIdRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [isReady, renderFrame])

  // ── ResizeObserver — keep renderer in sync with container size ───────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry || !rendererRef.current) return
      const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          rendererRef.current.resize(width, height)
          useViewportStore.setState({ viewportWidth: width, viewportHeight: height })
        }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef])

  return { isReady, fps, canvasRef }
}

// ─── Canvas component ─────────────────────────────────────────────────────────

export function PixiMapEditor() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const isDrawingRef = useRef(false)
  const isSpacePressedRef = useRef(false)
  const pointerSequenceActiveRef = useRef(false)

  const { fps, canvasRef } = usePixiMapRenderer(containerRef, {
    width: 0,
    height: 0,
    tileSize: BASE_TILE_SIZE,
  })

  // Key and global pointer-up listeners
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
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault()

      const viewport = useViewportStore.getState()
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * 0.001)
      const nextZoom = Math.min(6, Math.max(0.05, viewport.zoom * factor))

      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      const currentTileSize = BASE_TILE_SIZE * viewport.zoom
      const worldX = (localX - viewport.panX) / currentTileSize
      const worldY = (localY - viewport.panY) / currentTileSize
      const nextPanX = localX - worldX * (BASE_TILE_SIZE * nextZoom)
      const nextPanY = localY - worldY * (BASE_TILE_SIZE * nextZoom)

      // Plain-object setState to plain store — zero overhead (no Immer, no persist).
      useViewportStore.setState({ zoom: nextZoom, panX: nextPanX, panY: nextPanY })
    },
    [canvasRef],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const getTileFromPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const viewport = useViewportStore.getState()
    const store = useEditorStore.getState()
    const tileSize = BASE_TILE_SIZE * viewport.zoom
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const x = Math.floor((localX - viewport.panX) / tileSize)
    const y = Math.floor((localY - viewport.panY) / tileSize)

    if (x < 0 || y < 0 || x >= store.project.width || y >= store.project.height) {
      return null
    }

    return { x, y }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()

    const store = useEditorStore.getState()
    const container = containerRef.current
    if (!container) return

    pointerSequenceActiveRef.current = true
    container.setPointerCapture(event.pointerId)

    if (event.button === 1 || isSpacePressedRef.current) {
      isDrawingRef.current = false
      const viewport = useViewportStore.getState()
      const originPan = { x: viewport.panX, y: viewport.panY }
      const startX = event.clientX
      const startY = event.clientY

      // Use only pointer events — mousemove/mouseup also fire for the same
      // physical events on desktop, so registering both would double the rate.
      // Plain-object setState to plain store — zero overhead (no Immer, no persist).
      const onMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        useViewportStore.setState({ panX: originPan.x + dx, panY: originPan.y + dy })
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return
    }

    const tile = getTileFromPoint(event.clientX, event.clientY)
    if (!tile) return

    if (store.tool === 'nation') {
      store.addNationAt(tile.x, tile.y)
      return
    }

    isDrawingRef.current = true
    paintTilesDirect(tile.x, tile.y)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current) return
    if (useEditorStore.getState().tool === 'nation') return

    const tile = getTileFromPoint(event.clientX, event.clientY)
    if (!tile) return

    paintTilesDirect(tile.x, tile.y)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (container) {
      try {
        container.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore if capture was already released.
      }
    }

    if (isDrawingRef.current) {
      useEditorStore.getState().commitPaint()
    }

    isDrawingRef.current = false
    pointerSequenceActiveRef.current = false
  }

  const handleMouseLeave = () => {
    isDrawingRef.current = false
    pointerSequenceActiveRef.current = false
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', cursor: 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Pixi injects its <canvas> here after async init */}
      <div className="fps-counter" aria-label="Frames per second">
        FPS {fps}
      </div>
    </div>
  )
}