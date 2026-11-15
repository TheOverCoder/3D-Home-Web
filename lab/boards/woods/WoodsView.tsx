import { useMemo } from 'react'
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { surface } from '../../../src/lib/proceduralTextures'
import { ModelView, type Built, type View3D } from '../../three/ModelView'
import { farmPlace, todaysTree, todaysTriangles, treeSpotsAll, type TreeSpot } from '../../three/place'
import type { WoodsState } from './index'
import { makeTree, treeChecks, treeTriangles, type TreeVariant } from './models/trees'

// The big trees on the screen (./index.tsx): in the game, the farm from the garden as the player sees it — the woods
// beyond the fence in the haze (sideways also the lemon tree, the shed and the corner tree); close, one tree (C: its three kinds) on the
// lawn, turning under a finger. The chip: the triangles of all seventeen big trees against today's.

/** From the path among the beds, looking south-west over the fence to the woods (sideways: the lemon tree, the shed
 *  and the corner tree too). */
const GAME: View3D = { kind: 'eye', at: [-1.2, 0, 8.0], look: [-10, 4.2, 18] }

/** Close: the first corner tree (its height and seed), on the lawn at the origin; C shows its three kinds side by side. */
const CLOSE_SPOT: TreeSpot = { x: 0, z: 0, height: 7.5, seed: 21, index: 0, corner: true }
const CLOSE_KINDS: TreeSpot[] = [
  { x: -1.6, z: 4.2, height: 7.5, seed: 21, index: 0, corner: false },
  { x: 0, z: 0, height: 7.5, seed: 44, index: 1, corner: false },
  { x: 1.6, z: -4.2, height: 7.5, seed: 47, index: 2, corner: false },
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

export function WoodsView({ v, s }: { v: TreeVariant; s: WoodsState }) {
  const close = s.view === 'close'
  const spots = close ? (v === 'c' ? CLOSE_KINDS : [CLOSE_SPOT]) : ALL
  const make = (spot: TreeSpot) => (v === 'today' ? todaysTree(spot) : makeTree(v, spot))
  const triangles = useMemo(() => (v === 'today' ? TODAY : ALL.reduce((n, spot) => n + treeTriangles(v, spot), 0)), [v])
  const build = async (): Promise<Built> => {
    if (!close) return { root: await farmPlace({ trees: make, yard: true }) }
    const root = new Group()
    root.add(lawn())
    for (const spot of spots) {
      const t = make(spot)
      // close up the tree throws its shadow on the lawn, to show its shape (in the game the big trees throw none)
      t.traverse((x) => (x.castShadow = true))
      root.add(t)
    }
    return { root }
  }
  const view: View3D = close ? { kind: 'orbit', target: [0, 3.8, 0], size: [v === 'c' ? 12 : 7.2, 8], azimuth: 30, elevation: 8 } : GAME
  return <ModelView build={build} view={view} count={{ triangles, weight: TODAY }} checks={() => (v === 'today' ? [] : treeChecks(v, ALL))} haze={!close} />
}
