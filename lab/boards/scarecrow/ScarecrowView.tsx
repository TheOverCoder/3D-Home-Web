import { useMemo } from 'react'
import { Group } from 'three'
import { PATH_X } from '../../../src/farm/data'
import { decorModel } from '../../../src/farm/decorModels'
import { DECOR, type DecorKind } from '../../../src/farm/decor'
import type { V3 } from '../../../src/lib/sculpt'
import { ModelView, type Built, type View3D } from '../../three/ModelView'
import { checkModel, modelGroup, trianglesOf } from '../../three/model'
import { farmPlace } from '../../three/place'
import type { ScarecrowState } from './index'

// The scarecrows on the screen (./index.tsx): B's three, as the game has them now (three kinds of the farm's
// decoration: src/models/scarecrows.ts, bought in the edit mode's shop), at the far end of the west beds by the fence,
// the first thing seen down the path on the way out of the garden door. In the game: from the path, at the player's
// eye, the three a little apart and turned to face the path, as a player puts them (a quarter turn at a time: here a
// half turn, facing north); close: the three in a row a step apart (the middle one a step nearer, their arms
// passing), turning round them. "Before": the place as it was, without them.

export const SCARECROW_KINDS: DecorKind[] = ['scarecrow-squire', 'scarecrow-ploughman', 'scarecrow-bogle']

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
const MIDDLE: V3 = [-3.95, 0, 12.3]

/** Out of the garden door, on the path, looking down the beds to the three by the fence. */
const GAME: View3D = { kind: 'eye', at: EYE, look: [MIDDLE[0] + 0.25, 1.0, MIDDLE[2]] }
/** Close: round the three, from the beds' side (clear of the lemon tree). */
const CLOSE: View3D = { kind: 'orbit', target: [MIDDLE[0] + 0.1, 1.05, MIDDLE[2]], size: [2.8, 2.4], azimuth: 162, elevation: 8 }

export const scarecrowTriangles = () => SCARECROW_KINDS.map((k) => trianglesOf(decorModel(k)))

export function ScarecrowView({ v, s }: { v: 'today' | 'b'; s: ScarecrowState }) {
  const triangles = useMemo(() => (v === 'today' ? 0 : scarecrowTriangles().reduce((a, b) => a + b, 0)), [v])
  const build = async (): Promise<Built> => {
    const root = new Group()
    root.add(await farmPlace({ yard: true, market: true }))
    if (v === 'today') return { root }
    const spots = s.view === 'close' ? CLOSE_SPOTS : GAME_SPOTS
    SCARECROW_KINDS.forEach((kind, k) => {
      const it = modelGroup(decorModel(kind), kind)
      it.position.set(...spots[k])
      // a half turn: facing the path and the garden door (north)
      it.rotation.y = Math.PI
      root.add(it)
    })
    return { root }
  }
  const checks = () => (v === 'today' ? [] : SCARECROW_KINDS.flatMap((k) => checkModel(DECOR[k].name, decorModel(k))))
  return <ModelView build={build} view={s.view === 'close' ? CLOSE : GAME} focus={MIDDLE} count={{ triangles }} checks={checks} />
}
