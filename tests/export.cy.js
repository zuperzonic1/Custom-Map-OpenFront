describe('OpenFront ZIP export', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('Export ZIP button downloads an archive containing all required map files', () => {
    cy.contains('.field', 'Author').find('input').clear().type('Export Tester')

    cy.contains('.field', 'Description')
      .find('textarea')
      .clear({ force: true })
      .type('Sprint 3 export test', { force: true })

    cy.contains('.field-inline', 'Name').find('input').clear().type('Test Map')

    cy.contains('.button-group button', 'Land').click()

    cy.get('canvas').then(($canvas) => {
      cy.wrap($canvas[0]).click(120, 120, { force: true })
    })

    cy.contains('Export ZIP').click()

    cy.contains('Export complete').should('exist')
    cy.contains('testmap/manifest.json').should('exist')
    cy.contains('testmap/map.bin').should('exist')
    cy.contains('testmap/map4x.bin').should('exist')
    cy.contains('testmap/map16x.bin').should('exist')
    cy.contains('testmap/thumbnail.webp').should('exist')
  })
})