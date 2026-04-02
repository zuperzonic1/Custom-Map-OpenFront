describe('OpenFront nation placement', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/#/editor')
  })

  it('placed nations are saved to localStorage and restored after reload', () => {
    cy.contains('.button-group button', 'Nation').click()

    cy.contains('.field', 'Nation name').find('input').clear().type('Spawn Alpha')

    // Click at canvas pixel (120, 120) → tile (8, 8) at zoom=1 (tileSize=14px)
    cy.get('canvas').then(($canvas) => {
      cy.wrap($canvas[0]).click(120, 120, { force: true })
    })

    cy.contains('.nation-row', 'Spawn Alpha').should('exist')
    cy.contains('.nation-row', '8, 8').should('exist')

    cy.reload()

    cy.contains('.nation-row', 'Spawn Alpha').should('exist')
    cy.contains('.nation-row', '8, 8').should('exist')

    cy.contains('.nation-row', 'Spawn Alpha').find('button').click()
    cy.contains('No nations placed yet.').should('exist')
  })

  it('placing nations with different names adds a separate row for each', () => {
    cy.contains('.button-group button', 'Nation').click()

    cy.contains('.field', 'Nation name').find('input').clear().type('Alpha')
    cy.get('canvas').then(($canvas) => {
      cy.wrap($canvas[0]).click(120, 120, { force: true })
    })

    cy.contains('.field', 'Nation name').find('input').clear().type('Beta')
    cy.get('canvas').then(($canvas) => {
      cy.wrap($canvas[0]).click(200, 120, { force: true })
    })

    cy.contains('.nation-row', 'Alpha').should('exist')
    cy.contains('.nation-row', 'Beta').should('exist')
  })

  it('Remove button deletes a nation row from the list', () => {
    cy.contains('.button-group button', 'Nation').click()

    cy.contains('.field', 'Nation name').find('input').clear().type('ToRemove')
    cy.get('canvas').then(($canvas) => {
      cy.wrap($canvas[0]).click(120, 120, { force: true })
    })

    cy.contains('.nation-row', 'ToRemove').find('button').click()
    cy.contains('.nation-row', 'ToRemove').should('not.exist')
  })

  it('Nations count in Project stats increments as nations are placed', () => {
    cy.contains('.status-card', 'Project')
      .contains('dt', 'Nations')
      .parent()
      .find('dd')
      .should('have.text', '0')

    cy.contains('.button-group button', 'Nation').click()

    cy.contains('.field', 'Nation name').find('input').clear().type('Alpha')
    cy.get('canvas').then(($canvas) => {
      cy.wrap($canvas[0]).click(120, 120, { force: true })
    })

    cy.contains('.status-card', 'Project')
      .contains('dt', 'Nations')
      .parent()
      .find('dd')
      .should('have.text', '1')

    cy.contains('.field', 'Nation name').find('input').clear().type('Beta')
    cy.get('canvas').then(($canvas) => {
      cy.wrap($canvas[0]).click(200, 120, { force: true })
    })

    cy.contains('.status-card', 'Project')
      .contains('dt', 'Nations')
      .parent()
      .find('dd')
      .should('have.text', '2')
  })
})