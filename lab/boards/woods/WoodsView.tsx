import { useMemo } from 'react'
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { surface } from '../../../src/lib/proceduralTextures'
import { ModelView, type Built, type View3D } from '../../three/ModelView'
import { farmPlace, todaysTree, todaysTriangles, treeSpotsAll, type TreeSpot } from '../../three/place'
import type { WoodsState } from './index'
import { referenceChecks, referenceTree, referenceTriangles, type Kind } from './models/woods'

// The big trees on the screen (./index.tsx): in the game, the farm from the garden as the player sees it — the woods
// beyond the fence in the haze (sideways also the lemon tree, the shed and the corner tree); close, the reference's
// four kinds side by side on the lawn (today: its one tree), turning under a finger. The chip: the triangles of all
// seventeen big trees against today's.

export type WoodsVariant = 'today' | 'd'

/** From the path among the beds, looking south-west over the fence to the woods (sideways: the lemon tree, the shed
 *  and the corner tree too). */
const GAME: View3D = { kind: 'eye', at: [-1.2, 0, 8.0], look: [-10, 4.2, 18] }

/** Close: the first corner tree (its height and seed) on the lawn; the reference's four kinds in a little grove, the
 *  round oak and the birch in front, the tall poplar and the pine behind them. */
const CLOSE_TODAY: TreeSpot = { x: 0, z: 0, height: 7.5, seed: 21, index: 0, corner: true }
const CLOSE_KINDS: [TreeSpot, Kind][] = [
  [{ x: -3.2, z: 1.4, height: 7.5, seed: 21, index: 0, corner: true }, 'oak'],
  [{ x: 1.1, z: 2.4, height: 8.2, seed: 46, index: 6, corner: false }, 'birch'],
  [{ x: -0.6, z: -2.6, height: 8.4, seed: 45, index: 5, corner: false }, 'poplar'],
  [{ x: 3.6, z: -1.6, height: 8.0, seed: 41, index: 1, corner: false }, 'pine'],
]

const ALL = treeSpotsAll()
const TODAY = ALL.reduce((n, s) => n + todaysTriangles(s), 0)

function lawn() {
  const grass = surface('grass', 130, 130)
  const m = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ map: grass.map, normalMap: grass.normalMap, roughnessMap: grass.roughnessMap, roughness: 1 }))
  m.rotation.x = -Math.PI / 2
  m.position.y = -0.03
  m.receiveShadow = true
  return m
}

export function WoodsView({ v, s }: { v: WoodsVariant; s: WoodsState }) {
  const close = s.view === 'close'
  const triangles = useMemo(() => (v === 'today' ? TODAY : ALL.reduce((n, spot) => n + referenceTriangles(spot), 0)), [v])
  const build = async (): Promise<Built> => {
    if (!close) return { root: await farmPlace({ trees: v === 'today' ? todaysTree : (spot) => referenceTree(spot), yard: true }) }
    const root = new Group()
    root.add(lawn())
    const trees = v === 'today' ? [todaysTree(CLOSE_TODAY)] : CLOSE_KINDS.map(([spot, kind]) => referenceTree(spot, kind))
    for (const t of trees) {
      // close up a tree throws its shadow on the lawn, to show its shape (in the game the big trees throw none)
      t.traverse((x) => (x.castShadow = true))
      root.add(t)
    }
    return { root }
  }
  const view: View3D = close ? { kind: 'orbit', target: [0, 4.6, 0], size: [v === 'd' ? 10 : 7.2, 10], azimuth: 10, elevation: 8 } : GAME
  return <ModelView build={build} view={view} count={{ triangles, weight: TODAY }} checks={() => (v === 'today' ? [] : referenceChecks(ALL))} haze={!close} />
}
