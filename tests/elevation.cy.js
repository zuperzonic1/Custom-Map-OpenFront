import { getCanvasColorAt, paintCanvasAt, setRangeInput } from './editorHelpers.js'

describe('OpenFront elevation tool', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('Elevation tool paints a land tile with the specified magnitude colour', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      // Tile (8,8) — safely inside the default 64×48 map
      const paintX = 120
      const paintY = 120

      cy.contains('.button-group button', 'Elevation').click()
      setRangeInput('Elevation', 64)
      paintCanvasAt(canvas, paintX, paintY)

      // getTerrainColor(1, 64): r=64, g=min(255,94)=94, b=min(255,74)=74
      cy.wrap(null).should(() => {
        const color = getCanvasColorAt(canvas, paintX, paintY)
        expect(color.r).to.equal(64)
        expect(color.g).to.equal(94)
        expect(color.b).to.equal(74)
        expect(color.a).to.be.greaterThan(0)
      })
    })
  })

  it('a higher elevation value produces brighter RGB channels on the canvas', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 120
      const paintY = 120

      cy.contains('.button-group button', 'Elevation').click()
      setRangeInput('Elevation', 200)
      paintCanvasAt(canvas, paintX, paintY)

      // At magnitude=200: r=200, g=230, b=210 — all channels higher than at magnitude=64
      cy.wrap(null).should(() => {
        const color = getCanvasColorAt(canvas, paintX, paintY)
        expect(color.r).to.be.greaterThan(64)
        expect(color.g).to.be.greaterThan(94)
        expect(color.b).to.be.greaterThan(74)
        expect(color.a).to.be.greaterThan(0)
      })
    })
  })
})