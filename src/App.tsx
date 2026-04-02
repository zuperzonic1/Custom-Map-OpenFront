import React, { useEffect, useState } from 'react'
import { LandingPage } from './pages/LandingPage'
import { EditorPage } from './pages/EditorPage'

type Route = 'landing' | 'editor'

function getRouteFromHash(): Route {
  return window.location.hash === '#/editor' ? 'editor' : 'landing'
}

function App(): React.ReactElement {
  const [route, setRoute] = useState<Route>(getRouteFromHash)

  // Keep route in sync with browser back/forward navigation
  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const goToEditor = (): void => {
    window.location.hash = '#/editor'
    setRoute('editor')
  }

  const goToLanding = (): void => {
    window.location.hash = '#/'
    setRoute('landing')
  }

  if (route === 'editor') {
    return <EditorPage onGoHome={goToLanding} />
  }

  return <LandingPage onEnterEditor={goToEditor} />
}

export default App