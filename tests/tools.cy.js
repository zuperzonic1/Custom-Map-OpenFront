import { setRangeInput } from './editorHelpers.js'

describe('OpenFront tool controls', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/#/editor')
  })

  it('shows three tool buttons: Land, Water and Nation', () => {
    cy.contains('.button-group button', 'Land').should('exist')
    cy.contains('.button-group button', 'Water').should('exist')
    cy.contains('.button-group button', 'Nation').should('exist')
    cy.contains('.button-group button', 'Elevation').should('not.exist')
  })

  it('activates only the clicked tool button and deactivates the rest', () => {
    cy.contains('.button-group button', 'Land').should('have.class', 'active')

    cy.contains('.button-group button', 'Water').click()
    cy.contains('.button-group button', 'Water').should('have.class', 'active')
    cy.contains('.button-group button', 'Land').should('not.have.class', 'active')

    cy.contains('.button-group button', 'Nation').click()
    cy.contains('.button-group button', 'Nation').should('have.class', 'active')
    cy.contains('.button-group button', 'Water').should('not.have.class', 'active')
  })

  it('brush size label updates when the slider changes', () => {
    setRangeInput('Brush size', 5)
    cy.contains('.field', 'Brush size').find('strong').should('have.text', '5')
  })

  it('land elevation label updates when the slider changes', () => {
    setRangeInput('Land elevation', 200)
    cy.contains('.field', 'Land elevation').find('strong').should('have.text', '200')
  })
})