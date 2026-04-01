import {
  expectLand,
  getCanvasColorAt,
  holdDraw,
  paintCanvasAt,
  setRangeInput,
  waitForLand,
  waitForWater,
} from './editorHelpers.js'

describe('OpenFront brush tool', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('paints a land tile at the clicked position with brush size 1', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      // (112,112) → tile (8,8) — safely inside the default 64×48 map
      const paintX = 112
      const paintY = 112

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Brush size', 1)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForWater(canvas, paintX + 14, paintY)
    })
  })

  it('paints continuously as the pointer moves while held down', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const startX = 112
      const startY = 112
      const nextX = 126
      const nextY = 112

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

  it('switching to Water tool and clicking the same tile removes the land', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 112
      const paintY = 112

      cy.contains('.button-group button', 'Land').click()
      paintCanvasAt(canvas, paintX, paintY)

      cy.contains('.button-group button', 'Water').click()
      paintCanvasAt(canvas, paintX, paintY)

      waitForWater(canvas, paintX, paintY)
    })
  })

  it('brush size 3 paints the center tile and its immediate neighbours', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 112
      const paintY = 112
      const adjacentX = paintX + 14

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Brush size', 3)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForLand(canvas, adjacentX, paintY)
    })
  })

  it('canvas getContext readback returns a non-transparent colour for a painted land tile', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 112
      const paintY = 112

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