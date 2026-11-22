import { Suspense, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { Car } from '../farm/car/Car'
import { Garden } from '../farm/Garden'
import { FarmGround } from '../farm/Ground'
import { Mailbox } from '../farm/Mailbox'
import { driveTo, farm, type Place } from '../farm/state'
import { debugSet } from '../lib/debug'
import { spaceHere } from '../lib/world'
import { useHome } from '../store'
import { House } from './House'
import { LightShafts } from './LightShafts'
import { Pickups } from './Pickups'
import { Screens } from './Screens'
import { START, changeMap, changingMap, expecting, holdFramesWith, mapArrived, mapStep, mapTiming } from './maps'
import { canTravel, setDriveFilm, travel } from './travel'
import { compileScene, uploadTextures } from './Warmup'
import { runFrames } from './frameRate'

// The two maps (src/data/maps.ts), only the one you are on in the scene (`useHome.map`, following the save's `place`:
// ./maps.ts): the farm, and the house on its own plot. What either has is mounted with it — its ground, its colliders,
// what you can do there (the action button offers only what is registered), the walls that hide things — and goes with
// it; the farm's clock, the player and the modes are beside them, on both (src/scene/Experience.tsx).

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** The map in, every part of it mounted (this is its last child, so its effect runs after theirs): for a change of map,
 *  with the frame loop held still since the map was asked for (./maps.ts) — every model it loads in, its shaders
 *  compiled (in parallel where the browser can) and its textures on the graphics card before it is drawn at all, so
 *  nothing stalls the first time you look round there — then frames again, and the change goes on; the first map of a
 *  scene starting is ready at once (the warm-up compiles it). */
function Arrived({ map }: { map: Place }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    if (!expecting(map)) {
      useHome.setState({ mapReady: true })
      return
    }
    let cancelled = false
    mapStep('mounted')
    // (while the warm-up of a scene starting runs, it compiles what there is itself, and starts the frames again)
    const warm = () => useHome.getState().ready.warm
    void (async () => {
      try {
        // every model and texture it asked for arrived (a piece of furniture stands in as a plain box while its model
        // loads: the model it is, not the box, is compiled), or 15 s; then a moment for what came in to mount
        for (let waited = 0; waited < 15_000 && useProgress.getState().active; waited += 50) {
          await new Promise((r) => setTimeout(r, 50))
          if (cancelled) return
        }
        mapStep('loaded')
        await frame()
        await frame()
        if (cancelled) return
        if (warm()) {
          await compileScene(gl, scene, camera)
          mapStep('compiled')
          await uploadTextures(gl, scene, undefined, () => cancelled)
          mapStep('uploaded')
        }
      } finally {
        if (warm()) runFrames(setFrameloop)
      }
      // one frame drawn, you standing where you get out
      await frame()
      await frame()
      if (!cancelled) mapArrived(map)
    })()
    return () => {
      cancelled = true
    }
  }, [map, gl, scene, camera, setFrameloop])
  return null
}

/** The house as it always was (rooms, furniture, screens, lamps, the things you pick up, the light through its windows)
 *  on its own plot in the countryside, and the car on its driveway. (Its wardrobes, which film you, come after the
 *  player: Experience.tsx.) */
function HomeMap() {
  return (
    <group name="home-map">
      <House />
      <LightShafts />
      <Screens />
      <Pickups />
      <Car place="home" />
      <Arrived map="home" />
    </group>
  )
}

/** The farm: its ground, and everything it has (the land, the beds, the animals, the machines, the buyers, the lane, the
 *  market, the contractor, the tractor, the woods, the mailbox by the gate). All of it outdoors, for the drawing pass. */
function FarmMap() {
  return (
    <group name="farm-map" userData={{ cell: 'outside' }}>
      <FarmGround />
      <Garden />
      <Mailbox />
      <Arrived map="farm" />
    </group>
  )
}

export function Maps() {
  const map = useHome((s) => s.map)
  const setFrameloop = useThree((s) => s.setFrameloop)
  // a change of map holds the frames from the moment it asks for the other map until that map is compiled (Arrived)
  useEffect(() => holdFramesWith(() => setFrameloop('never')), [setFrameloop])
  useEffect(() => {
    // tests and the console: window.__home.maps
    debugSet('maps', {
      start: START,
      travel,
      canTravel,
      setDriveFilm,
      changing: changingMap,
      timing: mapTiming,
      state: () => {
        const s = useHome.getState()
        return { map: s.map, ready: s.mapReady, curtain: s.curtain, place: farm.place, owned: farm.apartment.owned }
      },
      /** For the tests: the save on that map (the house yours first), as if it had been left there; the scene follows,
       *  you at the map's start (`changeMap`, behind the curtain). Whether it moved. */
      go: (to: Place) => {
        if (to === 'home') farm.apartment.owned = true
        return driveTo(to)
      },
      /** For the tests: the map change itself, you put at `at` (a spot: x, z, heading). */
      change: changeMap,
      /** The space a point is in on this map, as the action button has it (a room, a walk-in's room, the lane, out). */
      space: spaceHere,
    })
  }, [])
  if (map === null) return null
  return map === 'home' ? (
    <Suspense key="home" fallback={null}>
      <HomeMap />
    </Suspense>
  ) : (
    <Suspense key="farm" fallback={null}>
      <FarmMap />
    </Suspense>
  )
}
