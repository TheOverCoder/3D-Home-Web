import { lazy, Suspense, useEffect } from 'react'
import { SoundDirector } from './audio/SoundDirector'
import { FarmUI } from './farm/FarmUI'
import { ErrorBoundary } from './lib/ErrorBoundary'
import { preload, useLoader } from './lib/loader'
import { useMusic } from './audio/music'
import { currentSlot, deleteSlot, exportSlot, importSlot, slotSummary, switchSlot } from './farm/state'
import { playerState } from './lib/playerState'
import { handleContextLost, handleSceneError } from './lib/startup'
import { useHome } from './store'
import { GraphicsNotice } from './ui/GraphicsNotice'
import { Hud } from './ui/Hud'
import { HudMode } from './ui/HudMode'
import { Intro } from './ui/Intro'
import { ScreenModal } from './ui/ScreenModal'
import { SettingsPanel } from './ui/SettingsPanel'
import { coarsePointer } from './lib/device'

// three.js, Rapier and the whole scene load in their own chunks so the intro paints immediately. First the loader
// fetches every file the scene needs with a progress count (and the service worker keeps them on the device);
// then the scene's code is imported — from the device, not the network. Real texture sets (if any were dropped
// in src/assets/textures) must be decoded before the scene builds its materials.
const Experience = lazy(async () => {
  await preload()
  const [scene, textures] = await Promise.all([import('./scene/Experience'), import('./lib/realTextures')])
  await textures.loadRealTextures()
  return scene
})

// The on-screen stick comes from ecctrl, which is part of the 3D bundle: imported on touch screens only, and
// lazily, so the page shell (the intro) never waits for the 3D engine to download.
const TouchControls = lazy(() => import('./ui/TouchControls').then((m) => ({ default: m.TouchControls })))

if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as Record<string, unknown>).__home = { useHome, playerState, loader: useLoader, music: useMusic, slots: { switchSlot, exportSlot, importSlot, slotSummary, deleteSlot, currentSlot } }
}

export function App() {
  // a new attempt (after the graphics were lost, or in light graphics) mounts a fresh scene on a fresh context
  const attempt = useHome((s) => s.attempt)
  useEffect(
    () =>
      useHome.subscribe((s, prev) => {
        if (s.graphics === 'lost' && prev.graphics !== 'lost') handleContextLost()
      }),
    [],
  )
  return (
    <>
      <ErrorBoundary key={attempt} fallback={null} onError={handleSceneError}>
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </ErrorBoundary>
      <SoundDirector />
      <Hud />
      <FarmUI />
      {coarsePointer && (
        <Suspense fallback={null}>
          <TouchControls />
        </Suspense>
      )}
      <ScreenModal />
      <SettingsPanel />
      <Intro />
      <GraphicsNotice />
      <HudMode />
    </>
  )
}
