import {
  getCanvasColorAt,
  expectLand,
  paintCanvasAt,
  setRangeInput,
  waitForLand,
  waitForWater,
} from './editorHelpers.js'

describe('OpenFront canvas editor', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('shows the page header, canvas and tools panel on load', () => {
    cy.contains('OpenFront map editor').should('be.visible')
    cy.contains('Sprint 1 foundation').should('be.visible')
    cy.contains('Sprint 2: editor depth').should('be.visible')
    cy.contains('Reset map').should('be.visible')
    cy.get('canvas').should('be.visible')
    cy.contains('Tools').should('be.visible')
  })

  it('clicking a tool button marks it active and deactivates the previous one', () => {
    cy.contains('.button-group button', 'Land').should('have.class', 'active')
    cy.contains('.button-group button', 'Water').should('not.have.class', 'active')

    cy.contains('.button-group button', 'Water').click()

    cy.contains('.button-group button', 'Water').should('have.class', 'active')
    cy.contains('.button-group button', 'Land').should('not.have.class', 'active')
  })

  it('paints land with the brush and leaves neighboring tiles untouched at size 1', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      // (112,112) → tile (8,8) — safely within canvas pixel buffer
      const paintX = 112
      const paintY = 112
      const adjacentX = paintX + 14

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Brush size', 1)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForWater(canvas, adjacentX, paintY)
    })
  })

  it('expands the painted area when brush size is increased', () => {
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

  it('switching to Water tool and clicking a land tile returns it to water', () => {
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

  it('Reset map button clears all painted tiles back to water', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 112
      const paintY = 112

      cy.contains('.button-group button', 'Land').click()
      paintCanvasAt(canvas, paintX, paintY)

      cy.contains('Reset map').click()

      waitForWater(canvas, paintX, paintY)
    })
  })

  it('at zoom 2× a clicked pixel maps to a larger tile so a +14 px offset stays inside the same tile', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      // At zoom=2 each tile is 28px wide, so (112,112) and (126,112) are the same tile
      const paintX = 112
      const paintY = 112
      const adjacentX = paintX + 14

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Zoom', 2)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForLand(canvas, adjacentX, paintY)
    })
  })

  it('canvas 2D readback returns the correct land colour after painting', () => {
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

  it('Project stats panel shows width, height and tile count for the default map', () => {
    cy.contains('.status-card', 'Project').should('exist')
    cy.contains('dt', 'Width').parent().find('dd').should('have.text', '64')
    cy.contains('dt', 'Height').parent().find('dd').should('have.text', '48')
    cy.contains('dt', 'Tiles').parent().find('dd').should('have.text', '3072')
  })
})