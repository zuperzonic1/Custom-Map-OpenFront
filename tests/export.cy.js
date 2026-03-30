describe('OpenFront export', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('exports the generated map bundle', () => {
    cy.contains('.field', 'Author')
      .find('input')
      .clear()
      .type('Export Tester')

    cy.contains('.field', 'Description')
      .find('textarea')
      .clear()
      .type('Sprint 3 export test')

    cy.contains('.field', 'Name')
      .find('input')
      .clear()
      .type('Test Map')
    cy.contains('.button-group button', 'Land').click()

    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      cy.wrap(canvas).click(120, 120, { force: true })
    })

    cy.contains('Export ZIP').click()

    cy.contains('Export complete').should('be.visible')
    cy.contains('testmap/manifest.json').should('exist')
    cy.contains('testmap/map.bin').should('exist')
    cy.contains('testmap/map4x.bin').should('exist')
    cy.contains('testmap/map16x.bin').should('exist')
    cy.contains('testmap/thumbnail.webp').should('exist')
  })
})