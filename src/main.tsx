import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { installDiagnostics } from './lib/diagnostics'
import './lib/sw' // registers the service worker that keeps the game on this device

installDiagnostics()

const root = createRoot(document.getElementById('root')!)
if (new URLSearchParams(location.search).has('gallery')) {
  // the model gallery (src/models/Gallery.tsx): its own small page, loaded only when asked for
  import('./models/Gallery').then(({ Gallery }) => root.render(<Gallery />))
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
