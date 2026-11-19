import { SPAWN } from '../data/layout'
import { FARM_START, type Spot } from '../data/maps'
import { farm, useFarm, type Place } from '../farm/state'
import { stopDecorating } from '../home/decorate'
import { dropPosition } from '../lib/interaction'
import { look, stopTurn } from '../lib/look'
import { playerState } from '../lib/playerState'
import { stopWalk } from '../lib/route/walking'
import { useHome } from '../store'

// The two maps in the scene, one at a time (src/data/maps.ts; Maps.tsx mounts the one `useHome.map` names). Which one
// follows the save's `place`, and a change of map happens behind a curtain: the screen goes dark, the old map leaves the
// scene and the new one comes in, you are put where you get out, its shaders are compiled (nothing stalls the first
// time you look round there), and the screen comes back. A drive (./travel.ts) is that with the drive in between; a
// save that loads on the other map (another farm switched to, a file imported, the farm started again) the same, with
// you at the map's start.

/** Where each map starts: the house in its living room, where it always started; the farm on the path among the beds,
 *  facing the east beds (src/data/maps.ts, FARM_START). A new farm starts on the farm, a save on the map it was left
 *  on. */
export const START: Record<Place, Spot> = {
  home: { x: SPAWN[0], z: SPAWN[2], heading: Math.PI },
  farm: FARM_START,
}

/** How long the curtain takes to fall (src/ui/Curtain.tsx: its CSS takes as long). */
export const CURTAIN_MS = 400

/** The body's middle when it is put somewhere (its feet on the floor once it settles). */
const BODY_Y = SPAWN[1]

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** How the last change of map went (ms since it asked for the map; ?debug: window.__home.maps.timing): the map mounted
 *  (`mounted`), its first frame drawn (`drawn`), compiled, its textures up, and you in it (`ready`). */
export const mapTiming: Record<string, number> = {}
let asked = 0
/** Notes a step of the change under way (Maps.tsx). */
export const mapStep = (step: string) => void (mapTiming[step] = Math.round(performance.now() - asked))

/** Stops the scene's frames (Maps.tsx sets it): from the moment the other map is asked for, nothing is drawn until it is
 *  in and compiled (its `Arrived` starts them again). */
let holdFrames: (() => void) | null = null
export function holdFramesWith(hold: () => void) {
  holdFrames = hold
  return () => {
    if (holdFrames === hold) holdFrames = null
  }
}

/** The map the scene is bringing in, and what to do once it is in (Maps.tsx calls `mapArrived`). */
let expected: { map: Place; resolve: () => void } | null = null

/** Whether the scene is bringing `map` in for a change of map (and should compile it): not when it is the first map of
 *  a scene starting (the warm-up compiles everything then). */
export const expecting = (map: Place) => expected?.map === map

/** The scene has the map in, compiled (Maps.tsx). */
export function mapArrived(map: Place) {
  if (expected?.map !== map) return
  const done = expected.resolve
  expected = null
  done()
}

let changing: Promise<void> | null = null

/** A change of map is under way (the curtain down or on its way). */
export const changingMap = () => changing !== null

/** Leaves what the map you are on has open: a panel, a screen, the edit or decorate mode, a walk to a mark, what you
 *  carry (put down where you stand: it stays on that map). */
function leave() {
  stopWalk('moved')
  stopTurn()
  const s = useHome.getState()
  if (s.decorating) stopDecorating()
  if (s.editing) s.setEditing(false)
  if (s.screen) s.closeScreen()
  if (s.panel) s.closePanel()
  if (s.confirm) s.setConfirm(null)
  if (s.carrying) s.drop(dropPosition())
}

/** Brings `to` into the scene with you standing at `at`, facing its heading; resolves once you stand in it. */
async function show(to: Place, at: Spot) {
  const hold = { x: at.x, y: BODY_Y, z: at.z }
  // the body waits there, whatever ground is under it while the maps change (src/scene/Player.tsx)
  playerState.hold = hold
  look.yaw = at.heading
  look.pitch = at.pitch ?? 0
  const s = useHome.getState()
  s.setActions([])
  s.setCompass([])
  s.setTag(null)
  s.setGuide(null)
  if (s.map !== to) {
    await new Promise<void>((resolve) => {
      expected = { map: to, resolve }
      for (const k of Object.keys(mapTiming)) delete mapTiming[k]
      asked = performance.now()
      // (not while the warm-up of a scene starting holds them itself)
      if (useHome.getState().ready.warm) holdFrames?.()
      useHome.setState({ map: to, mapReady: false })
    })
  }
  playerState.hold = null
  playerState.moveTo = hold
  mapStep('ready')
  useHome.setState({ mapReady: true })
}

/**
 * Changes the map behind the curtain: the curtain falls, `between` runs (a drive: the move in the save, and the drive's
 * film; false: no change after all), the map `to` comes into the scene with you standing at `at`, and the curtain
 * rises. Resolves when it is over. One at a time: a change asked for during another waits for it. `to` may be asked
 * once the curtain is down (a save loaded: the map it is on then; the map you are on already, nothing changes).
 */
export function changeMap(to: Place | (() => Place), at: Spot | ((to: Place) => Spot), between?: () => Promise<boolean>): Promise<void> {
  const before = changing ?? Promise.resolve()
  const run = async () => {
    await before
    leave()
    useHome.setState({ curtain: true })
    await wait(CURTAIN_MS)
    try {
      if (between && !(await between())) return
      const map = typeof to === 'function' ? to() : to
      if (map === useHome.getState().map && typeof to === 'function') return
      await show(map, typeof at === 'function' ? at(map) : at)
    } finally {
      useHome.setState({ curtain: false })
    }
  }
  const mine: Promise<void> = run().finally(() => {
    if (changing === mine) changing = null
    follow()
  })
  changing = mine
  return mine
}

/** The scene follows the save: a farm that loads on the other map (switched to, imported, started again) is shown there,
 *  you at that map's start. (A drive moves the save itself, behind its own curtain: `changeMap` with `between`.) */
function follow() {
  const map = useHome.getState().map
  if (changing || map === null || farm.place === map) return
  void changeMap(
    () => farm.place,
    (to) => START[to],
  )
}

// looked at once the change that moved the save is over (a farm started again and put back on its map at once, by a
// test or the console, is no change at all)
useFarm.subscribe(() => {
  if (farm.place !== useHome.getState().map) setTimeout(follow, 0)
})
