import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { ErrorBoundary } from './lib/ErrorBoundary'
import { preload, useLoader } from './lib/loader'
import { useMusic } from './audio/music'
import { currentSlot, deleteSlot, exportSlot, importSlot, slotSummary, switchSlot } from './farm/state'
import { playerState } from './lib/playerState'
import { handleContextLost, handleSceneError } from './lib/startup'
import { useHome } from './store'
import { Intro } from './ui/Intro'
import { MotionRoot } from './ui/motion'
import { collectDiagnostics } from './lib/diagnostics'

// The game's interface (the HUD, the panels, the settings, the corner menu: src/ui/GameLayer.tsx) is not part of the
// page shell either: the intro paints before it has downloaded. Its chunk is among the files the loader fetches with a
// progress count, and it is imported once they are in, as the scene is; the scene waits for it too, so the game's
// button never comes before the interface it opens on. One that did not download draws nothing: the scene, which
// failed with it, says what happened.
const layer = () => preload().then(() => import('./ui/GameLayer'))
const none = () => null
const GameLayer = lazy<() => ReactNode>(() =>
  layer().then(
    (m) => ({ default: m.GameLayer }),
    () => ({ default: none }),
  ),
)
const GameCorner = lazy<() => ReactNode>(() =>
  layer().then(
    (m) => ({ default: m.GameCorner }),
    () => ({ default: none }),
  ),
)

// three.js, Rapier and the whole scene load in their own chunks so the intro paints immediately. First the loader
// fetches every file the scene needs with a progress count (and the service worker keeps them on the device);
// then the scene's code is imported — from the device, not the network. Real texture sets (if any were dropped
// in src/assets/textures) must be decoded before the scene builds its materials.
const Experience = lazy(async () => {
  await preload()
  const [scene, textures] = await Promise.all([import('./scene/Experience'), import('./lib/realTextures'), layer()])
  await textures.loadRealTextures()
  return scene
})

if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as Record<string, unknown>).__home = {
    useHome,
    playerState,
    loader: useLoader,
    music: useMusic,
    slots: { switchSlot, exportSlot, importSlot, slotSummary, deleteSlot, currentSlot },
    // the report Copy diagnostics gives (and with the game's interface, src/ui/GameLayer.tsx: `guard`, a part of the
    // interface that throws on purpose, and `cards`, the cards that open by themselves)
    diagnostics: collectDiagnostics,
  }
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
  // part of it that can throw is guarded (src/ui/PanelGuard.tsx, round each part in src/ui/GameLayer.tsx): what is
  // open closes, a layer is left out a moment, and the game plays on
  return (
    <MotionRoot>
      <ErrorBoundary key={attempt} fallback={null} onError={handleSceneError}>
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </ErrorBoundary>
      <Suspense fallback={null}>
        <GameLayer />
      </Suspense>
      <Intro />
      <Suspense fallback={null}>
        <GameCorner />
      </Suspense>
    </MotionRoot>
  )
}
