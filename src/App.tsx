import { lazy, Suspense } from 'react'
import { ErrorBoundary } from './lib/ErrorBoundary'
import { playerState } from './lib/playerState'
import { useHome } from './store'
import { Hud } from './ui/Hud'
import { Intro } from './ui/Intro'
import { ScreenModal } from './ui/ScreenModal'
import { SettingsPanel } from './ui/SettingsPanel'
import { TouchControls } from './ui/TouchControls'

// three.js, Rapier and the whole scene load in their own chunk so the intro paints immediately.
// real texture sets (if any were dropped in src/assets/textures) must be decoded before the scene builds its materials
const Experience = lazy(async () => {
  const [scene, textures] = await Promise.all([import('./scene/Experience'), import('./lib/realTextures')])
  await textures.loadRealTextures()
  return scene
})

if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as Record<string, unknown>).__home = { useHome, playerState }
}

export function App() {
  return (
    <>
      <ErrorBoundary
        fallback={null}
        onError={() =>
          useHome.getState().setFailure('The 3D scene could not start. WebGL or WebAssembly is probably blocked in this browser or frame.')
        }
      >
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </ErrorBoundary>
      <Hud />
      <TouchControls />
      <ScreenModal />
      <SettingsPanel />
      <Intro />
    </>
  )
}
