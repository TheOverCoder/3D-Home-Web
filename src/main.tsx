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
  // while developing: the models' checks run once the game has settled, and warn about any piece that has come
  // apart from its model or anything floating (the gallery lists them too, and the e2e suite fails on them)
  if (import.meta.env.DEV)
    setTimeout(
      () =>
        import('./models/checks').then(async ({ MODEL_CHECKS }) => {
          const { describeIssue } = await import('./lib/sculpt')
          for (const c of MODEL_CHECKS) for (const i of c.run()) console.warn(`[model check] ${describeIssue(i)}`)
        }),
      8000,
    )
}
