export function setRangeInput(label, value) {
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

export function expectLand(color) {
  expect(color.a).to.be.greaterThan(0)
  expect(color.g).to.be.greaterThan(color.b)
  expect(color.b).to.be.greaterThan(color.r)
}

export function expectWater(color) {
  expect(color.a).to.be.greaterThan(0)
  expect(color.b).to.be.greaterThan(color.g)
  expect(color.b).to.be.greaterThan(color.r)
}

export function paintCanvasAt(canvas, x, y) {
  cy.wrap(canvas).click(x, y, { force: true })
}

export function waitForLand(canvas, x, y) {
  cy.wrap(null).should(() => {
    expectLand(getCanvasColorAt(canvas, x, y))
  })
}

export function waitForWater(canvas, x, y) {
  cy.wrap(null).should(() => {
    expectWater(getCanvasColorAt(canvas, x, y))
  })
}