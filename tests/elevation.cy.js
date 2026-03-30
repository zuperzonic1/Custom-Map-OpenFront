import { getCanvasColorAt, paintCanvasAt, setRangeInput } from './editorHelpers.js'

describe('OpenFront elevation', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('paints elevation with the elevation tool', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 120
      const paintY = 120

      cy.contains('.button-group button', 'Elevation').click()
      setRangeInput('Elevation', 64)
      paintCanvasAt(canvas, paintX, paintY)

      cy.then(() => {
        const color = getCanvasColorAt(canvas, paintX, paintY)
        expect(color).to.deep.equal({
          r: 64,
          g: 94,
          b: 74,
          a: 255,
        })
      })
    })
  })
})