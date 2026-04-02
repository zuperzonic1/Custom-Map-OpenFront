/**
 * Performance benchmarks — targeting Figma-like interaction responsiveness.
 *
 * Pass criteria (asserted):
 *   • Brush-stroke dispatch  200 events in < 500 ms  (hard gate)
 *   • Per-event paint cost   < 2 ms on average       (Figma target)
 *   • Idle rAF avg frame     < 16.7 ms               (60 fps)
 *   • rAF p95 frame          < 33.4 ms               (no sustained drops)
 *   • FPS counter            ≥ 30 after interaction
 *
 * We measure wall-clock time inside cy.window().then() so the
 * Cypress command queue does not inflate the numbers.
 */
import { setRangeInput, waitForFpsAtLeast } from './editorHelpers.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find the editor container div (parent of the FPS counter).
 * Pixi injects its <canvas> INSIDE this element; events go on the div.
 */
function getEditorContainer(win) {
  const fps = win.document.querySelector('[aria-label="Frames per second"]')
  if (!fps) throw new Error('[perf] FPS counter element not found — is the editor mounted?')
  return fps.parentElement
}

/**
 * Synchronously dispatch N pointermove "paint" events across a horizontal
 * line starting at the centre of the container.
 * Returns { elapsed, perEvent } in milliseconds.
 */
function benchmarkBrushStroke(win, n = 200) {
  const container = getEditorContainer(win)
  const rect = container.getBoundingClientRect()
  const cx = rect.left + rect.width * 0.25
  const cy = rect.top + rect.height * 0.40
  const step = Math.min(14, (rect.width * 0.5) / n)

  container.dispatchEvent(
    new win.PointerEvent('pointerdown', {
      clientX: cx,
      clientY: cy,
      pointerId: 1,
      button: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
    }),
  )

  const t0 = win.performance.now()
  for (let i = 0; i < n; i++) {
    container.dispatchEvent(
      new win.PointerEvent('pointermove', {
        clientX: cx + i * step,
        clientY: cy,
        pointerId: 1,
        button: 0,
        buttons: 1,
        bubbles: true,
      }),
    )
  }
  const elapsed = win.performance.now() - t0

  container.dispatchEvent(
    new win.PointerEvent('pointerup', {
      clientX: cx + n * step,
      clientY: cy,
      pointerId: 1,
      button: 0,
      buttons: 0,
      bubbles: true,
    }),
  )

  return { elapsed, perEvent: elapsed / n }
}

/**
 * Count rAF callbacks over a fixed duration and return per-frame deltas (ms).
 * Uses Cypress.Promise so Cypress waits for the async measurement to finish.
 */
function measureRafFrameTimes(win, durationMs = 1000) {
  return new Cypress.Promise((resolve) => {
    const deltas = []
    let prev = win.performance.now()
    const deadline = prev + durationMs

    const tick = () => {
      const now = win.performance.now()
      deltas.push(now - prev)
      prev = now
      if (now < deadline) {
        win.requestAnimationFrame(tick)
      } else {
        resolve(deltas)
      }
    }
    win.requestAnimationFrame(tick)
  })
}

/**
 * Count rAF frames while dispatching paint events every frame.
 * Returns per-frame deltas measured around each rAF callback.
 */
function measureRafDuringPaint(win, eventsPerFrame = 4, totalFrames = 60) {
  return new Cypress.Promise((resolve) => {
    const container = getEditorContainer(win)
    const rect = container.getBoundingClientRect()
    const cx = rect.left + rect.width * 0.25
    const cy = rect.top + rect.height * 0.40

    const deltas = []
    let prev = win.performance.now()
    let eventIdx = 0

    container.dispatchEvent(
      new win.PointerEvent('pointerdown', {
        clientX: cx,
        clientY: cy,
        pointerId: 1,
        button: 0,
        buttons: 1,
        bubbles: true,
      }),
    )

    const tick = () => {
      const now = win.performance.now()
      deltas.push(now - prev)
      prev = now

      for (let j = 0; j < eventsPerFrame; j++) {
        container.dispatchEvent(
          new win.PointerEvent('pointermove', {
            clientX: cx + eventIdx * 3,
            clientY: cy + (eventIdx % 5) * 3,
            pointerId: 1,
            buttons: 1,
            bubbles: true,
          }),
        )
        eventIdx++
      }

      if (deltas.length < totalFrames) {
        win.requestAnimationFrame(tick)
      } else {
        container.dispatchEvent(
          new win.PointerEvent('pointerup', { clientX: cx, clientY: cy, pointerId: 1, bubbles: true }),
        )
        resolve(deltas)
      }
    }
    win.requestAnimationFrame(tick)
  })
}

function stats(deltas) {
  const sorted = [...deltas].sort((a, b) => a - b)
  const avg = deltas.slice(1).reduce((s, d) => s + d, 0) / Math.max(1, deltas.length - 1)
  const p50 = sorted[Math.floor(sorted.length * 0.5)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]
  return { avg, p50, p95, p99 }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Performance benchmarks', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/#/editor')
    cy.get('[aria-label="Frames per second"]', { timeout: 10000 }).should('be.visible')
    cy.contains('.button-group button', 'Land').click()
    setRangeInput('Brush size', 3)
  })

  // ── Paint throughput ────────────────────────────────────────────────────────

  it('dispatches 200 brush-move events in < 500 ms (hard gate)', () => {
    cy.window().then((win) => {
      const { elapsed, perEvent } = benchmarkBrushStroke(win, 200)
      cy.log(
        `Brush stroke: 200 events in ${elapsed.toFixed(1)} ms  (${perEvent.toFixed(2)} ms/event)`,
      )
      expect(elapsed, '200-event stroke wall time').to.be.lessThan(500)
    })
  })

  it('averages < 2 ms per paint event (Figma target)', () => {
    cy.window().then((win) => {
      const { perEvent, elapsed } = benchmarkBrushStroke(win, 100)
      cy.log(`Per-event: ${perEvent.toFixed(3)} ms  (total 100 events: ${elapsed.toFixed(1)} ms)`)
      expect(perEvent, 'avg ms per paint event').to.be.lessThan(2)
    })
  })

  // ── Idle rAF frame timing ───────────────────────────────────────────────────

  it('idle render loop averages < 16.7 ms per frame (≥ 60 fps)', () => {
    cy.window()
      .then((win) => measureRafFrameTimes(win, 1000))
      .then((deltas) => {
        const { avg, p95 } = stats(deltas)
        cy.log(
          `Idle frames: ${deltas.length}  avg=${avg.toFixed(1)} ms  p95=${p95.toFixed(1)} ms`,
        )
        expect(avg, 'avg idle frame time').to.be.lessThan(16.7)
        expect(p95, 'p95 idle frame time').to.be.lessThan(33.4)
      })
  })

  // ── Frame timing under load ─────────────────────────────────────────────────

  it('p95 frame time stays < 33 ms while painting (≥ 30 fps under load)', () => {
    cy.window()
      .then((win) => measureRafDuringPaint(win, 4, 60))
      .then((deltas) => {
        const { avg, p95, p99 } = stats(deltas)
        cy.log(
          `Paint-load frames: ${deltas.length}  avg=${avg.toFixed(1)} ms  p95=${p95.toFixed(1)} ms  p99=${p99.toFixed(1)} ms`,
        )
        expect(p95, 'p95 frame time during brush stroke').to.be.lessThan(33.4)
      })
  })

  // ── FPS counter ─────────────────────────────────────────────────────────────

  it('FPS counter reports ≥ 30 fps after a brush stroke', () => {
    cy.window().then((win) => {
      benchmarkBrushStroke(win, 50)
    })
    waitForFpsAtLeast(30)
  })
})