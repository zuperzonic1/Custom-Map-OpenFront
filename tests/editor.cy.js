function setRangeInput(label, value) {
  return cy.contains('.field', label)
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

function getCanvasColorAt(canvas, x, y) {
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

function expectLand(color) {
  expect(color.a).to.be.greaterThan(0)
  expect(color.g).to.be.greaterThan(color.b)
  expect(color.b).to.be.greaterThan(color.r)
}

function expectWater(color) {
  expect(color.a).to.be.greaterThan(0)
  expect(color.b).to.be.greaterThan(color.g)
  expect(color.b).to.be.greaterThan(color.r)
}

function paintCanvasAt(canvas, x, y) {
  cy.wrap(canvas).click(x, y, { force: true })
}

function waitForLand(canvas, x, y) {
  cy.wrap(null).should(() => {
    expectLand(getCanvasColorAt(canvas, x, y))
  })
}

function waitForWater(canvas, x, y) {
  cy.wrap(null).should(() => {
    expectWater(getCanvasColorAt(canvas, x, y))
  })
}

describe('OpenFront editor', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('loads the editor shell and canvas', () => {
    cy.contains('OpenFront map editor').should('be.visible')
    cy.contains('Sprint 1 foundation').should('be.visible')
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

  it('paints land with the brush and leaves neighboring tiles untouched at size 1', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 320
      const paintY = 220
      const adjacentX = paintX + 14
      const adjacentY = paintY

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Brush size', 1)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForWater(canvas, adjacentX, adjacentY)
    })
  })

  it('expands the painted area when brush size is increased', () => {
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      const paintX = 320
      const paintY = 220
      const adjacentX = paintX + 14
      const adjacentY = paintY

      cy.contains('.button-group button', 'Land').click()
      setRangeInput('Brush size', 3)
      paintCanvasAt(canvas, paintX, paintY)

      waitForLand(canvas, paintX, paintY)
      waitForLand(canvas, adjacentX, adjacentY)
    })
  })

  it('switches to water and repaints tiles back to water', () => {
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