import {
  paintCanvasAt,
  panWithSpace,
  setRangeInput,
  waitForFpsAtLeast,
  waitForLand,
  waitForWater,
} from './editorHelpers.js'

describe('OpenFront viewport and performance', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('Space+drag pans the viewport so a tile that was land becomes water at the original cursor position', () => {
    cy.contains('.button-group button', 'Land').click()
    setRangeInput('Brush size', 1)

    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const origin = { x: 112, y: 112 }
      const panTarget = { x: 168, y: 112 }

      paintCanvasAt(canvas, origin.x, origin.y)
      waitForLand(canvas, origin.x, origin.y)

      panWithSpace(canvas, origin, panTarget)
      waitForWater(canvas, origin.x, origin.y)

      paintCanvasAt(canvas, origin.x, origin.y)
      waitForLand(canvas, origin.x, origin.y)
    })
  })

  it('mouse wheel triggers zoom-in and the FPS counter remains active', () => {
    cy.contains('.button-group button', 'Land').click()
    setRangeInput('Brush size', 1)

    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const points = [
        { x: 112, y: 112 },
        { x: 126, y: 112 },
        { x: 140, y: 112 },
        { x: 154, y: 112 },
        { x: 168, y: 112 },
      ]

      points.forEach((point) => {
        paintCanvasAt(canvas, point.x, point.y)
      })

      // Trigger zoom-in via the native wheel listener (passive: false)
      cy.wrap(canvas).trigger('wheel', {
        clientX: 112,
        clientY: 112,
        deltaY: -600,
        bubbles: true,
        force: true,
      })
    })

    cy.contains('.field', 'Zoom')
      .find('strong')
      .should(($strong) => {
        const zoomValue = Number($strong.text().replace('x', ''))
        expect(zoomValue).to.be.greaterThan(1)
      })

    waitForFpsAtLeast(1)
  })

  it('minimap frame aspect-ratio style matches the map width-to-height ratio', () => {
    cy.contains('.status-card', 'Project')
      .contains('dt', 'Width')
      .parent()
      .find('dd')
      .invoke('text')
      .then((widthText) => {
        const mapWidth = Number(widthText.trim())

        cy.contains('.status-card', 'Project')
          .contains('dt', 'Height')
          .parent()
          .find('dd')
          .invoke('text')
          .then((heightText) => {
            const mapHeight = Number(heightText.trim())
            const mapRatio = mapWidth / mapHeight

            cy.get('.minimap-card')
              .find('.minimap-frame')
              .should(($frame) => {
                const ar = $frame[0].style.aspectRatio
                const parts = ar.split('/').map((s) => Number(s.trim()))
                const frameRatio = parts[0] / parts[1]

                expect(frameRatio).to.be.closeTo(mapRatio, 0.01)
              })
          })
      })
  })
})