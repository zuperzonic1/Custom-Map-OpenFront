import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    specPattern: 'tests/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: false,
    baseUrl: 'http://localhost:5173',
  },
})