import { useMemo } from 'react'
import { Group } from 'three'
import { PATH_X } from '../../../src/farm/data'
import type { V3 } from '../../../src/lib/sculpt'
import { ModelView, type Built, type View3D } from '../../three/ModelView'
import { farmPlace } from '../../three/place'
import type { ScarecrowState } from './index'
import { SETS, scarecrowObject, setChecks, setTriangles, type SetId } from './models/scarecrows'

// The scarecrows on the screen (./index.tsx), a set of three at the far end of the west beds, by the fence, the first
// thing seen down the path on the way out of the house. In the game: from the path by the garden door, at the player's
// eye, the three a little apart as a player would put them (the tallest by the path, the next on the lawn beyond the
// beds, the smallest a step nearer); close: the three in a row a step apart (the middle one a step nearer, their arms
// passing), turning round them. "Today": the place as it is, without them.

const EYE: V3 = [PATH_X + 0.15, 0, 7.4]
const GAME_SPOTS: V3[] = [
  [-2.6, 0, 12.5],
  [-4.1, 0, 12.45],
  [-5.3, 0, 11.85],
]
const CLOSE_SPOTS: V3[] = [
  [-2.75, 0, 12.45],
  [-3.95, 0, 12.1],
  [-5.1, 0, 12.5],
]
/** Each turned towards the garden door, a little off it, as a person would stand. */
const facing = (p: V3, off: number) => Math.atan2(EYE[0] - p[0], EYE[2] - p[2]) + off
const MIDDLE: V3 = [-3.95, 0, 12.3]

/** Out of the garden door, on the path, looking down the beds to the three by the fence. */
const GAME: View3D = { kind: 'eye', at: EYE, look: [MIDDLE[0] + 0.25, 1.0, MIDDLE[2]] }
/** Close: round the three, from the beds' side (clear of the lemon tree). */
const CLOSE: View3D = { kind: 'orbit', target: [MIDDLE[0] + 0.1, 1.05, MIDDLE[2]], size: [2.8, 2.4], azimuth: 162, elevation: 8 }

export function ScarecrowView({ v, s }: { v: SetId | 'today'; s: ScarecrowState }) {
  const triangles = useMemo(() => (v === 'today' ? 0 : setTriangles(v).reduce((a, b) => a + b, 0)), [v])
  const build = async (): Promise<Built> => {
    const root = new Group()
    root.add(await farmPlace({ yard: true, market: true }))
    if (v === 'today') return { root }
    const spots = s.view === 'close' ? CLOSE_SPOTS : GAME_SPOTS
    SETS[v].forEach((one, k) => {
      const it = scarecrowObject(one)
      it.position.set(...spots[k])
      it.rotation.y = facing(spots[k], [0.12, -0.12, 0.22][k])
      root.add(it)
    })
    return { root }
  }
  return <ModelView build={build} view={s.view === 'close' ? CLOSE : GAME} focus={MIDDLE} count={{ triangles }} checks={() => (v === 'today' ? [] : setChecks(v))} />
}
