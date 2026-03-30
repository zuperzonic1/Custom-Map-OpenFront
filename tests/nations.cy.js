function setFieldValue(label, selector, value) {
  cy.contains('.field', label)
    .find(selector)
    .clear()
    .type(value)
}

describe('OpenFront nations', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('places nations and persists them after reload', () => {
    cy.contains('.button-group button', 'Nation').click()

    setFieldValue('Nation name', 'input', 'Spawn Alpha')

    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      cy.wrap(canvas).click(120, 120, { force: true })
    })

    cy.contains('.nation-row', 'Spawn Alpha').should('exist')
    cy.contains('.nation-row', '8, 8').should('exist')

    cy.reload()

    cy.contains('.nation-row', 'Spawn Alpha').should('exist')
    cy.contains('.nation-row', '8, 8').should('exist')

    cy.contains('.nation-row', 'Spawn Alpha').find('button').click()
    cy.contains('No nations placed yet.').should('exist')
  })
})