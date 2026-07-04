import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeProjectManager } from './store/projectManagerStore'

// Initialize the project manager (loads project registry from localStorage)
initializeProjectManager()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)