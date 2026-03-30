describe('OpenFront metadata', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('updates and persists map metadata', () => {
    cy.contains('.field', 'Author')
      .find('input')
      .clear()
      .type('OpenFront Team')
      .should('have.value', 'OpenFront Team')

    cy.contains('.field', 'Description')
      .find('textarea')
      .clear()
      .type('Sprint 2 test map')
      .should('have.value', 'Sprint 2 test map')

    cy.reload()

    cy.contains('.field', 'Author')
      .find('input')
      .should('have.value', 'OpenFront Team')

    cy.contains('.field', 'Description')
      .find('textarea')
      .should('have.value', 'Sprint 2 test map')
  })
})