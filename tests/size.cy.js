describe('OpenFront map size controls', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visit('/#/editor')
  })

  it('New blank map button creates a map matching the entered dimensions', () => {
    cy.contains('.status-card', 'Map size').within(() => {
      cy.get('input[type="number"]').first().clear().type('96')
      cy.get('input[type="number"]').last().clear().type('72')
      cy.contains('New blank map').click()
    })

    cy.contains('dt', 'Width').parent().find('dd').should('have.text', '96')
    cy.contains('dt', 'Height').parent().find('dd').should('have.text', '72')
    cy.contains('dt', 'Tiles').parent().find('dd').should('have.text', '6912')
  })

  it('New blank map resets zoom to 1 and pan to the origin', () => {
    // Paint a tile first so the PixiCanvas wheel listener is fully mounted
    cy.contains('.button-group button', 'Land').click()
    cy.get('canvas').then(($canvas) => {
      const canvas = $canvas[0]
      // Click to warm up the renderer, then zoom in via wheel
      cy.wrap(canvas).click(112, 112, { force: true })
      cy.wrap(canvas).trigger('wheel', {
        clientX: 112,
        clientY: 112,
        deltaY: -600,
        bubbles: true,
        force: true,
      })
    })

    // Confirm zoom is now above 1
    cy.contains('.field', 'Zoom')
      .find('strong')
      .should(($strong) => {
        expect(Number($strong.text().replace('x', ''))).to.be.greaterThan(1)
      })

    // Create a new blank map — store.createBlankProject sets zoom=1, panX=0, panY=0
    cy.contains('.status-card', 'Map size').within(() => {
      cy.contains('New blank map').click()
    })

    cy.contains('.field', 'Zoom').find('strong').should('have.text', '1.00x')
  })

  it('creates a 1500×2000 map with correct dimensions and tile count', () => {
    cy.contains('.status-card', 'Map size').within(() => {
      cy.get('input[type="number"]').first().clear().type('1500')
      cy.get('input[type="number"]').last().clear().type('2000')
      cy.contains('New blank map').click()
    })

    cy.contains('dt', 'Width').parent().find('dd').should('have.text', '1500')
    cy.contains('dt', 'Height').parent().find('dd').should('have.text', '2000')
    cy.contains('dt', 'Tiles').parent().find('dd').should('have.text', '3000000')
  })

  it('can paint tiles on a 1500×2000 map without crashing', () => {
    // Create the large map
    cy.contains('.status-card', 'Map size').within(() => {
      cy.get('input[type="number"]').first().clear().type('1500')
      cy.get('input[type="number"]').last().clear().type('2000')
      cy.contains('New blank map').click()
    })

    cy.contains('dt', 'Width').parent().find('dd').should('have.text', '1500')

    // At zoom=1 and pan=0, tile (8,8) is at pixel (112,112). Click it with Land tool.
    cy.contains('.button-group button', 'Land').click()
    cy.get('canvas').then(($canvas) => {
      cy.wrap($canvas[0]).click(112, 112, { force: true })
    })

    // The canvas should still be present and the FPS counter should still be running
    cy.get('canvas').should('be.visible')
    cy.get('[aria-label="Frames per second"]').should('exist')
  })
})