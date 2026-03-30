describe('OpenFront map size', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/')
  })

  it('creates a new blank map with the selected width and height', () => {
    cy.contains('.status-card', 'Map size').within(() => {
      cy.get('input[type="number"]').first().clear().type('96')
      cy.get('input[type="number"]').last().clear().type('72')
      cy.contains('New blank map').click()
    })

    cy.contains('dt', 'Width').parent().contains('dd', '96').should('exist')
    cy.contains('dt', 'Height').parent().contains('dd', '72').should('exist')
    cy.contains('dt', 'Tiles').parent().contains('dd', '6912').should('exist')
  })
})