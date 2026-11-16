import { useMemo } from 'react'
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, type Object3D } from 'three'
import { surface } from '../../../src/lib/proceduralTextures'
import { bigTreeKind, bigTreeModel, type TreeKind } from '../../../src/models/trees'
import { ModelView, type Built, type View3D } from '../../three/ModelView'
import { checkModel, modelGroup, trianglesOf } from '../../three/model'
import { farmPlace, formerTree, formerTriangles, gameTree, treeSpotsAll, type TreeSpot } from '../../three/place'
import type { WoodsState } from './index'

// The big trees on the screen (./index.tsx): in the game, the farm from the garden as the player sees it — the woods
// beyond the fence in the haze (sideways also the lemon tree, the shed and the corner tree); close, D's four kinds side
// by side on the lawn (before: its one tree), turning under a finger. D is the game's own now (src/models/trees.ts);
// "before" the trees it replaced (src/scene/flora.ts `tree`). The chip: the triangles of all seventeen big trees
// against the ones before.

export type WoodsVariant = 'today' | 'd'

/** From the path among the beds, looking south-west over the fence to the woods (sideways: the lemon tree, the shed
 *  and the corner tree too). */
const GAME: View3D = { kind: 'eye', at: [-1.2, 0, 8.0], look: [-10, 4.2, 18] }

/** Close: the first corner tree (its height and seed) on the lawn; D's four kinds in a little grove, the round oak and
 *  the birch in front, the tall poplar and the pine behind them. */
const CLOSE_BEFORE: TreeSpot = { x: 0, z: 0, height: 7.5, seed: 21, index: 0, corner: true }
const CLOSE_KINDS: [TreeSpot, TreeKind][] = [
  [{ x: -3.2, z: 1.4, height: 7.5, seed: 21, index: 0, corner: true }, 'oak'],
  [{ x: 1.1, z: 2.4, height: 8.2, seed: 46, index: 6, corner: false }, 'birch'],
  [{ x: -0.6, z: -2.6, height: 8.4, seed: 45, index: 5, corner: false }, 'poplar'],
  [{ x: 3.6, z: -1.6, height: 8.0, seed: 41, index: 1, corner: false }, 'pine'],
]

const ALL = treeSpotsAll()
const BEFORE = ALL.reduce((n, s) => n + formerTriangles(s), 0)

/** One of D's kinds at a spot, as the game draws that kind. */
function kindTree(s: TreeSpot, kind: TreeKind): Object3D {
  const g = modelGroup(bigTreeModel(s, kind), `tree-${kind}`)
  g.position.set(s.x, 0, s.z)
  return g
}

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
  const triangles = useMemo(() => (v === 'today' ? BEFORE : ALL.reduce((n, spot) => n + trianglesOf(bigTreeModel(spot)), 0)), [v])
  const build = async (): Promise<Built> => {
    if (!close) return { root: await farmPlace({ trees: v === 'today' ? formerTree : gameTree, yard: true }) }
    const root = new Group()
    root.add(lawn())
    const trees = v === 'today' ? [formerTree(CLOSE_BEFORE)] : CLOSE_KINDS.map(([spot, kind]) => kindTree(spot, kind))
    for (const t of trees) {
      // close up a tree throws its shadow on the lawn, to show its shape (in the game the big trees throw none)
      t.traverse((x) => (x.castShadow = true))
      root.add(t)
    }
    return { root }
  }
  const view: View3D = close ? { kind: 'orbit', target: [0, 4.6, 0], size: [v === 'd' ? 10 : 7.2, 10], azimuth: 10, elevation: 8 } : GAME
  const checks = () => (v === 'today' ? [] : ALL.flatMap((spot) => checkModel(`D · ${bigTreeKind(spot)} ${spot.corner ? 'corner' : 'woods'} ${spot.index}`, bigTreeModel(spot))))
  return <ModelView build={build} view={view} count={{ triangles, weight: BEFORE }} checks={checks} haze={!close} />
}
