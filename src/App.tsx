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
import { Curtain } from './ui/Curtain'
import { FilmLayer } from './ui/FilmLayer'
import { GraphicsNotice } from './ui/GraphicsNotice'
import { Hud } from './ui/Hud'
import { HudMode } from './ui/HudMode'
import { PhotoButton } from './ui/PhotoButton'
import { Intro } from './ui/Intro'
import { ScreenModal } from './ui/ScreenModal'
import { SettingsPanel } from './ui/SettingsPanel'
import { coarsePointer } from './lib/device'
import { MotionRoot } from './ui/motion'
import { guardHooks, PanelGuard } from './ui/PanelGuard'
import { collectDiagnostics } from './lib/diagnostics'
import { cardShowing, visitNow } from './ui/cardQueue'
import { gameFree } from './ui/useGameFree'

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
  ;(window as unknown as Record<string, unknown>).__home = {
    useHome,
    playerState,
    loader: useLoader,
    music: useMusic,
    slots: { switchSlot, exportSlot, importSlot, slotSummary, deleteSlot, currentSlot },
    // a part of the interface that throws, on purpose (src/ui/PanelGuard.tsx), and the report Copy diagnostics gives
    guard: guardHooks,
    diagnostics: collectDiagnostics,
    // the cards that open by themselves (src/ui/cardQueue.ts): this visit, the card showing, whether the game is free
    cards: { visit: visitNow, showing: cardShowing, free: () => gameFree() },
  }
}

/** The screen open (the television, a computer): if it throws, it closes. */
function ScreenSlot() {
  const screen = useHome((s) => s.screen)
  return (
    <PanelGuard name={screen ? `screen:${screen}` : ''} close={useHome.getState().closeScreen}>
      <ScreenModal />
    </PanelGuard>
  )
}

/** The settings: if they throw, they close. */
function SettingsSlot() {
  const open = useHome((s) => s.settingsOpen)
  return (
    <PanelGuard name={open ? 'settings' : ''} close={() => useHome.getState().setSettingsOpen(false)}>
      <SettingsPanel />
    </PanelGuard>
  )
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
  // the interface moves with Motion (src/ui/motion.tsx): its features, and less motion for whoever asks for it. Each
  // part of it that can throw is guarded (src/ui/PanelGuard.tsx): what is open closes, a layer is left out a moment,
  // and the game plays on
  return (
    <MotionRoot>
      <ErrorBoundary key={attempt} fallback={null} onError={handleSceneError}>
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </ErrorBoundary>
      <SoundDirector />
      <PanelGuard name="hud" layer>
        <Hud />
      </PanelGuard>
      <FarmUI />
      {coarsePointer && (
        <PanelGuard name="touch" layer>
          <Suspense fallback={null}>
            <TouchControls />
          </Suspense>
        </PanelGuard>
      )}
      <ScreenSlot />
      <Curtain />
      <FilmLayer />
      <SettingsSlot />
      <Intro />
      <GraphicsNotice />
      <PanelGuard name="corner" layer>
        <HudMode />
      </PanelGuard>
      <PanelGuard name="photo" layer>
        <PhotoButton />
      </PanelGuard>
    </MotionRoot>
  )
}
