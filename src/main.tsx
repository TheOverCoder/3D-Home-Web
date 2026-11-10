import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// the game's type: Fredoka for titles, buttons and words on the buttons, Nunito for text and every number (its
// digits are all one width); Fredoka also carries Hebrew (only fetched when Hebrew shows)
import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import './styles.css'
import { installDiagnostics } from './lib/diagnostics'
import './lib/sw' // registers the service worker that keeps the game on this device

installDiagnostics()

const root = createRoot(document.getElementById('root')!)
if (new URLSearchParams(location.search).has('gallery')) {
  // the model gallery (src/models/Gallery.tsx): its own small page, loaded only when asked for
  // (its models are built at once, so the solid engine some of them are cut with loads first)
  Promise.all([import('./models/Gallery'), import('./lib/sculpt').then((k) => k.loadSolids())]).then(([{ Gallery }]) => root.render(<Gallery />))
} else if (new URLSearchParams(location.search).has('furniture')) {
  // the furniture's pictures drawn from the pieces (src/home/FurnitureArtPage.tsx), to look at and to save
  import('./home/FurnitureArtPage').then(({ FurnitureArtPage }) => root.render(<FurnitureArtPage />))
} else if (import.meta.env.DEV && new URLSearchParams(location.search).has('gainmap')) {
  // the sky light as a JPEG with a gain map (src/tools/hdrToGainmap.ts), for scripts/hdr-to-gainmap.mjs to save
  // (while developing only: the build leaves it, and the .hdr it reads, out)
  import('./tools/hdrToGainmap').then(async ({ hdrToGainmap }) => {
    ;(window as unknown as { __gainmap: Record<string, string> }).__gainmap = await hdrToGainmap()
  })
} else if (new URLSearchParams(location.search).has('items')) {
  // the item pictures drawn from the models (src/models/ItemArtPage.tsx), to look at and to save
  import('./models/ItemArtPage').then(({ ItemArtPage }) => root.render(<ItemArtPage />))
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
          const { describeIssue, loadSolids } = await import('./lib/sculpt')
          await loadSolids()
          for (const c of MODEL_CHECKS) for (const i of c.run()) console.warn(`[model check] ${describeIssue(i)}`)
        }),
      8000,
    )
}
