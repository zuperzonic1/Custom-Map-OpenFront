/**
 * Set a range input to a specific value by bypassing React's synthetic event
 * system and directly triggering native input/change events.
 */
export function setRangeInput(label, value) {
  return cy
    .contains('.field', label)
    .find('input[type="range"]')
    .then(($input) => {
      const input = $input[0]
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set

      if (!nativeValueSetter) {
        throw new Error('missing native input value setter')
      }

      nativeValueSetter.call(input, String(value))
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
      input.dispatchEvent(new window.Event('change', { bubbles: true }))
    })
    .should('have.value', String(value))
}

/**
 * Read the RGBA colour of the canvas pixel at (x, y) in CSS coordinates.
 * Works with PixiJS CanvasRenderer because it uses a real 2D canvas context.
 */
export function getCanvasColorAt(canvas, x, y) {
  const context = canvas.getContext('2d')

  if (context === null) {
    throw new Error('canvas context missing')
  }

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const pixel = context.getImageData(
    Math.floor(x * scaleX),
    Math.floor(y * scaleY),
    1,
    1,
  ).data

  return {
    r: pixel[0],
    g: pixel[1],
    b: pixel[2],
    a: pixel[3],
  }
}

/** Land tiles have green channel dominant (g > b > r). */
export function expectLand(color) {
  expect(color.a).to.be.greaterThan(0)
  expect(color.g).to.be.greaterThan(color.b)
  expect(color.b).to.be.greaterThan(color.r)
}

/** Water tiles have blue channel dominant (b > g > r). */
export function expectWater(color) {
  expect(color.a).to.be.greaterThan(0)
  expect(color.b).to.be.greaterThan(color.g)
  expect(color.b).to.be.greaterThan(color.r)
}

/**
 * Paint a single tile by clicking at canvas-relative coordinates (x, y).
 * Cypress .click() fires the full pointer + mouse event sequence including
 * pointerdown, which is what React's onPointerDown listens for.
 */
export function paintCanvasAt(canvas, x, y) {
  cy.wrap(canvas).click(x, y, { force: true })
}

/** Retry until the pixel at (x, y) is a land colour. */
export function waitForLand(canvas, x, y) {
  cy.wrap(null).should(() => {
    expectLand(getCanvasColorAt(canvas, x, y))
  })
}

/** Retry until the pixel at (x, y) is a water colour. */
export function waitForWater(canvas, x, y) {
  cy.wrap(null).should(() => {
    expectWater(getCanvasColorAt(canvas, x, y))
  })
}

/** Retry until the FPS counter shows at least `minimum` frames per second. */
export function waitForFpsAtLeast(minimum) {
  cy.get('[aria-label="Frames per second"]').should(($el) => {
    const match = $el.text().match(/^FPS\s+(\d+)$/)
    expect(match, 'fps label format').to.not.equal(null)
    const fps = Number(match?.[1] ?? 0)
    expect(fps, 'fps value').to.be.at.least(minimum)
  })
}

/**
 * Simulate a click-and-drag paint stroke through an array of
 * canvas-relative {x, y} points.
 *
 * Uses pointer events (pointerdown → pointermove → pointerup) because
 * React's onPointerMove handler is only triggered by pointermove, not
 * mousemove.  clientX/Y are computed by adding the canvas bounding rect so
 * that getTileFromPoint() calculates the correct tile.
 */
export function holdDraw(canvas, points) {
  const rect = canvas.getBoundingClientRect()
  const [firstPoint, ...rest] = points

  cy.wrap(canvas).trigger('pointerdown', {
    clientX: rect.left + firstPoint.x,
    clientY: rect.top + firstPoint.y,
    pointerId: 1,
    button: 0,
    buttons: 1,
    bubbles: true,
    force: true,
  })

  rest.forEach((point) => {
    cy.wrap(canvas).trigger('pointermove', {
      clientX: rect.left + point.x,
      clientY: rect.top + point.y,
      pointerId: 1,
      button: 0,
      buttons: 1,
      bubbles: true,
      force: true,
    })
  })

  cy.wrap(canvas).trigger('pointerup', {
    clientX: rect.left + points[points.length - 1].x,
    clientY: rect.top + points[points.length - 1].y,
    pointerId: 1,
    button: 0,
    buttons: 0,
    bubbles: true,
    force: true,
  })
}

/**
 * Pan the map by holding Space and dragging from fromPoint to toPoint
 * (both in canvas-relative pixel coordinates).
 *
 * - Space keydown must fire first so isSpacePressedRef is set before
 *   pointerdown reaches React's onPointerDown handler.
 * - The pan handler registers pointermove and mousemove on *window*, so the
 *   move event is dispatched on cy.window() rather than the canvas.
 */
export function panWithSpace(canvas, fromPoint, toPoint) {
  const rect = canvas.getBoundingClientRect()

  cy.window().trigger('keydown', {
    code: 'Space',
    key: ' ',
    bubbles: true,
  })

  cy.wrap(canvas).trigger('pointerdown', {
    clientX: rect.left + fromPoint.x,
    clientY: rect.top + fromPoint.y,
    pointerId: 1,
    button: 0,
    buttons: 1,
    bubbles: true,
    force: true,
  })

  cy.window().trigger('pointermove', {
    clientX: rect.left + toPoint.x,
    clientY: rect.top + toPoint.y,
    bubbles: true,
  })

  cy.window().trigger('pointerup', {
    clientX: rect.left + toPoint.x,
    clientY: rect.top + toPoint.y,
    bubbles: true,
  })

  cy.window().trigger('keyup', {
    code: 'Space',
    key: ' ',
    bubbles: true,
  })
}