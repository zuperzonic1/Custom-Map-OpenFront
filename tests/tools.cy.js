import {
  expectLand,
  expectWater,
  paintCanvasAt,
  setRangeInput,
  waitForLand,
  waitForWater,
} from './editorHelpers.js'

describe('OpenFront sprint 2 shell', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('loads the editor shell and canvas', () => {
    cy.contains('OpenFront map editor').should('be.visible')
    cy.contains('Sprint 2: editor depth').should('be.visible')
    cy.contains('Reset map').should('be.visible')
    cy.get('canvas').should('be.visible')
    cy.contains('Tools').should('be.visible')
  })

  it('switches between land and water tools', () => {
    cy.contains('.button-group button', 'Land').should('have.class', 'active')
    cy.contains('.button-group button', 'Water').should('not.have.class', 'active')

    cy.contains('.button-group button', 'Water').click()

    cy.contains('.button-group button', 'Water').should('have.class', 'active')
    cy.contains('.button-group button', 'Land').should('not.have.class', 'active')
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

  it('resets the map after painting', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 320
      const paintY = 220

      cy.contains('.button-group button', 'Land').click()
      paintCanvasAt(canvas, paintX, paintY)

      cy.contains('Reset map').click()

      waitForWater(canvas, paintX, paintY)
    })
  })

  it('uses zoom when painting into the canvas', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 320
      const paintY = 220
      const adjacentX = paintX + 14
      const adjacentY = paintY

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Zoom', 2)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForLand(canvas, adjacentX, adjacentY)
    })
  })

  it('renders the default project stats', () => {
    cy.get('.info').scrollTo('top')
    cy.contains('Project').scrollIntoView().should('exist')
    cy.contains('Width').should('exist')
    cy.contains('Height').should('exist')
    cy.contains('Tiles').should('exist')
  })
})