import { lazy, Suspense, useEffect } from 'react'
import { SoundDirector } from '../audio/SoundDirector'
import { FarmUI } from '../farm/FarmUI'
import { freeUpSpace, restoreCopy, saveState, saveWords, useFarm } from '../farm/state'
import { debugSet } from '../lib/debug'
import { coarsePointer } from '../lib/device'
import { useHome } from '../store'
import { cardShowing, visitNow } from './cardQueue'
import { Curtain } from './Curtain'
import { FilmLayer } from './FilmLayer'
import { GraphicsNotice } from './GraphicsNotice'
import { Hud } from './Hud'
import { HudMode } from './HudMode'
import { guardHooks, PanelGuard } from './PanelGuard'
import { PhotoButton } from './PhotoButton'
import { ScreenModal } from './ScreenModal'
import { SettingsPanel } from './SettingsPanel'
import { gameFree, useGameFree } from './useGameFree'

// What loads behind the start screen: the game's interface, everything drawn over the scene while you play (the sounds'
// director, the HUD and the farm's panels, the touch controls, a screen open, the curtain, a film, the settings; over
// the intro's place, the notice when the browser reset the graphics, the corner menu and the photo button). None of it
// is in the page shell: the intro shows before it has downloaded (src/App.tsx imports it lazily, once the loader has
// fetched it with the scene's files; the scene waits for it too, so the game's button never comes before it). Each part
// that can throw is guarded (./PanelGuard.tsx): what is open closes, a layer is left out a moment, and the game plays
// on. Two parts of the page, so that it keeps its order: this one under the intro, the corner over it.

// The on-screen stick comes from ecctrl, which is part of the 3D bundle: imported on touch screens only, and lazily, so
// this layer never waits for the 3D engine to download.
const TouchControls = lazy(() => import('./TouchControls').then((m) => ({ default: m.TouchControls })))

// (?debug) a part of the interface that throws, on purpose (./PanelGuard.tsx); the cards that open by themselves
// (./cardQueue.ts): this visit, the card showing, whether the game is free; how the save stands (src/farm/state/save.ts:
// the farm could not be read, the storage is full, another tab has it) and what the saves list does about it. Here with
// the interface they are about, which is in before the game can be entered
debugSet('guard', guardHooks)
debugSet('cards', { visit: visitNow, showing: cardShowing, free: () => gameFree() })
debugSet('saves', { state: saveState, restoreCopy, freeUpSpace })

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

/** How long the game is free before the save's words are said (ms): the world first, then the word, as the cards that
 *  open by themselves wait (./useGameFree.ts). */
const SAY_AFTER_MS = 900

/** What the player is told about the save, once a visit each, as the game is played with nothing over it: the farm
 *  could not be read (it is kept as it was, and the saves list has it), or the storage is full (the saves list frees up
 *  space). */
function SaveWords() {
  const free = useGameFree()
  const trouble = useFarm(() => {
    const s = saveState()
    return s.held ? 'held' : s.full ? 'full' : ''
  })
  useEffect(() => {
    if (!free || !trouble) return
    const t = window.setTimeout(() => {
      const words = saveWords()
      if (words) useHome.getState().showToast(words, 'floppy-disk')
    }, SAY_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [free, trouble])
  return null
}

/** The game's interface under the intro: the HUD, the farm's panels, the controls, a screen, the curtain, a film and
 *  the settings. */
export function GameLayer() {
  return (
    <>
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
      <SaveWords />
    </>
  )
}

/** Over the intro's place: what the graphics are doing when the browser reset them; the game's corner menu, and the
 *  photo button in the clear view. */
export function GameCorner() {
  return (
    <>
      <GraphicsNotice />
      <PanelGuard name="corner" layer>
        <HudMode />
      </PanelGuard>
      <PanelGuard name="photo" layer>
        <PhotoButton />
      </PanelGuard>
    </>
  )
}
