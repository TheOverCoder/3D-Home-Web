import { useMemo } from 'react'
import { Group } from 'three'
import { BED, BEDS, PATH_X } from '../../../src/farm/data'
import { GARDEN } from '../../../src/data/layout'
import type { V3 } from '../../../src/lib/sculpt'
import { ModelView, type Built, type View3D } from '../../three/ModelView'
import { farmPlace } from '../../three/place'
import type { ScarecrowState } from './index'
import { scarecrowChecks, scarecrowObject, scarecrowTriangles, type ScarecrowVariant } from './models/scarecrow'

// The scarecrow on the screen (./index.tsx), in its place: at the far end of the west beds, between the last
// staked-out plot and the fence, facing the garden door. In the game: from the path by the garden door, at the player's
// eye, as one sees the beds coming out of the house; close: turning round it. "Today": the place as it is, without it.

/** Where it stands: past the end of the west column of beds (bed 4, its far side from the path: clear of the plot's
 *  price board), half way from that plot's end to the south fence. */
const last = BEDS[4]
export const SPOT: V3 = [last.x - 0.5, 0, (last.z + BED.d / 2 + 0.08 + GARDEN.maxZ) / 2]

/** Out of the garden door, on the path, looking down the beds to the fence. */
const GAME: View3D = { kind: 'eye', at: [PATH_X + 0.15, 0, 7.4], look: [SPOT[0] + 0.4, 1.05, SPOT[2]] }
const CLOSE: View3D = { kind: 'orbit', target: [SPOT[0], 1.2, SPOT[2]], size: [1.6, 2.0], azimuth: 200, elevation: 10 }

export function ScarecrowView({ v, s }: { v: ScarecrowVariant | 'today'; s: ScarecrowState }) {
  const triangles = useMemo(() => (v === 'today' ? 0 : scarecrowTriangles(v)), [v])
  const build = async (): Promise<Built> => {
    const root = new Group()
    root.add(await farmPlace({ yard: true, market: true }))
    if (v === 'today') return { root }
    const it = scarecrowObject(v)
    // facing the house (its front is +z in its own frame)
    it.root.position.set(...SPOT)
    it.root.rotation.y = Math.PI
    root.add(it.root)
    return { root, tick: it.tick }
  }
  return <ModelView build={build} view={s.view === 'close' ? CLOSE : GAME} focus={SPOT} count={{ triangles }} checks={() => (v === 'today' ? [] : scarecrowChecks(v))} />
}
