import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { EditorPage } from './pages/EditorPage'
import { useProjectManagerStore } from './store/projectManagerStore'

function App(): React.ReactElement {
  // On mount, load the most recent project if there is one and we're on the editor route
  React.useEffect(() => {
    const path = window.location.pathname
    if (path === '/editor') {
      const pm = useProjectManagerStore.getState()
      const mostRecent = pm.loadMostRecent()
      if (mostRecent) {
        pm.loadProject(mostRecent)
      }
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App