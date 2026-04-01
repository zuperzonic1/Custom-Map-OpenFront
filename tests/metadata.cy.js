describe('OpenFront map metadata', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('author and description are saved to localStorage and restored after reload', () => {
    cy.contains('.field', 'Author')
      .find('input')
      .clear()
      .type('OpenFront Team')
      .should('have.value', 'OpenFront Team')

    cy.contains('.field', 'Description')
      .find('textarea')
      .clear({ force: true })
      .type('Sprint 2 test map', { force: true })
      .should('have.value', 'Sprint 2 test map')

    cy.reload()

    cy.contains('.field', 'Author').find('input').should('have.value', 'OpenFront Team')

    cy.contains('.field', 'Description').find('textarea').should('have.value', 'Sprint 2 test map')
  })

  it('project name in the topbar is saved to localStorage and restored after reload', () => {
    cy.contains('.field-inline', 'Name')
      .find('input')
      .clear()
      .type('My Custom Map')
      .should('have.value', 'My Custom Map')

    cy.reload()

    cy.contains('.field-inline', 'Name').find('input').should('have.value', 'My Custom Map')
  })
})