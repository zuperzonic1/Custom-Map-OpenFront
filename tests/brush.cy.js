import {
  expectLand,
  expectWater,
  getCanvasColorAt,
  paintCanvasAt,
  setRangeInput,
  waitForLand,
  waitForWater,
} from './editorHelpers.js'

function holdDraw(canvas, points) {
  const rect = canvas.getBoundingClientRect()
  const [firstPoint, ...rest] = points

  cy.wrap(canvas).trigger('mousedown', {
    clientX: rect.left + firstPoint.x,
    clientY: rect.top + firstPoint.y,
    button: 0,
    buttons: 1,
    bubbles: true,
    force: true,
  })

  rest.forEach((point) => {
    cy.wrap(canvas).trigger('mousemove', {
      clientX: rect.left + point.x,
      clientY: rect.top + point.y,
      button: 0,
      buttons: 1,
      bubbles: true,
      force: true,
    })
  })

  cy.wrap(canvas).trigger('mouseup', {
    clientX: rect.left + points[points.length - 1].x,
    clientY: rect.top + points[points.length - 1].y,
    button: 0,
    buttons: 0,
    bubbles: true,
    force: true,
  })
}

describe('OpenFront brush', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('paints land on click', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 320
      const paintY = 220

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Brush size', 1)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForWater(canvas, paintX + 14, paintY)
    })
  })

  it('keeps drawing while the mouse is held down', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const startX = 320
      const startY = 220
      const nextX = 334
      const nextY = 220

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Brush size', 1)

      holdDraw(canvas, [
        { x: startX, y: startY },
        { x: nextX, y: nextY },
      ])

      waitForLand(canvas, startX, startY)
      waitForLand(canvas, nextX, nextY)
    })
  })

  it('switches to water and repaints painted tiles', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 320
      const paintY = 220

      cy.contains('.button-group button', 'Land').click()
      paintCanvasAt(canvas, paintX, paintY)

      cy.contains('.button-group button', 'Water').click()
      paintCanvasAt(canvas, paintX, paintY)

      waitForWater(canvas, paintX, paintY)
    })
  })

  it('expands the painted area when brush size increases', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 320
      const paintY = 220
      const adjacentX = paintX + 14

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Brush size', 3)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForLand(canvas, adjacentX, paintY)
    })
  })

  it('can read painted pixels from the canvas', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 320
      const paintY = 220

      cy.contains('.button-group button', 'Land').click()
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      cy.then(() => {
        const color = getCanvasColorAt(canvas, paintX, paintY)
        expectLand(color)
      })
    })
  })
})