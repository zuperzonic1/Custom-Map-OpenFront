import { setRangeInput } from './editorHelpers.js'

describe('OpenFront tool controls', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/#/editor')
  })

  it('shows all four tool buttons: Land, Water, Elevation and Nation', () => {
    cy.contains('.button-group button', 'Land').should('exist')
    cy.contains('.button-group button', 'Water').should('exist')
    cy.contains('.button-group button', 'Elevation').should('exist')
    cy.contains('.button-group button', 'Nation').should('exist')
  })

  it('activates only the clicked tool button and deactivates the rest', () => {
    cy.contains('.button-group button', 'Land').should('have.class', 'active')

    cy.contains('.button-group button', 'Water').click()
    cy.contains('.button-group button', 'Water').should('have.class', 'active')
    cy.contains('.button-group button', 'Land').should('not.have.class', 'active')

    cy.contains('.button-group button', 'Elevation').click()
    cy.contains('.button-group button', 'Elevation').should('have.class', 'active')
    cy.contains('.button-group button', 'Water').should('not.have.class', 'active')

    cy.contains('.button-group button', 'Nation').click()
    cy.contains('.button-group button', 'Nation').should('have.class', 'active')
    cy.contains('.button-group button', 'Elevation').should('not.have.class', 'active')
  })

  it('brush size label updates when the slider changes', () => {
    setRangeInput('Brush size', 5)
    cy.contains('.field', 'Brush size').find('strong').should('have.text', '5')
  })

  it('elevation label updates when the slider changes', () => {
    setRangeInput('Elevation', 200)
    cy.contains('.field', 'Elevation').find('strong').should('have.text', '200')
  })
})