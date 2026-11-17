import { useMemo } from 'react'
import { Group } from 'three'
import { decorModel } from '../../../src/farm/decorModels'
import { DECOR } from '../../../src/farm/decor'
import type { V3 } from '../../../src/lib/sculpt'
import { SCARECROW_KINDS } from '../../../src/models/scarecrows'
import { ModelView, type Built, type View3D } from '../../three/ModelView'
import { checkModel, modelGroup, trianglesOf } from '../../three/model'
import { farmPlace } from '../../three/place'
import type { ScarecrowState } from './index'

// The scarecrows on the screen (./index.tsx): the nine the game has now (nine kinds of the farm's decoration:
// src/models/scarecrows.ts, bought in the edit mode's shop), in three styles of three, standing in a row where the house
// stood, facing the player: in the game, from about eight metres at the player's eye; close, turning round them. "Before":
// the place as it was, without them.

const ROW_Z = 1
/** Where each of the nine stands: a style to a group, a little apart. */
const spot = (k: number): V3 => [(k - 4) * 1.6 + (Math.floor(k / 3) - 1) * 0.4, 0, ROW_Z]

/** From the player's eye, about eight metres off. */
const GAME: View3D = { kind: 'eye', at: [0, 0, 9.2], look: [0, 1.0, ROW_Z] }
/** Close: round the nine. */
const CLOSE: View3D = { kind: 'orbit', target: [0, 1.1, ROW_Z], size: [14.5, 2.6], azimuth: 12, elevation: 8 }

export const scarecrowTriangles = () => SCARECROW_KINDS.map((k) => trianglesOf(decorModel(k)))

export function ScarecrowView({ v, s }: { v: 'today' | 'nine'; s: ScarecrowState }) {
  const triangles = useMemo(() => (v === 'today' ? 0 : scarecrowTriangles().reduce((a, b) => a + b, 0)), [v])
  const build = async (): Promise<Built> => {
    const root = new Group()
    root.add(await farmPlace({ yard: true, market: true }))
    if (v === 'today') return { root }
    SCARECROW_KINDS.forEach((kind, k) => {
      const it = modelGroup(decorModel(kind), kind)
      it.position.set(...spot(k))
      root.add(it)
    })
    return { root }
  }
  const checks = () => (v === 'today' ? [] : SCARECROW_KINDS.flatMap((k) => checkModel(DECOR[k].name, decorModel(k))))
  return <ModelView build={build} view={s.view === 'close' ? CLOSE : GAME} focus={[0, 0, ROW_Z]} count={{ triangles }} checks={checks} />
}
