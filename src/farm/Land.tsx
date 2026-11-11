import { useEffect, useMemo, useRef } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Group, Mesh, MeshStandardMaterial, Vector2 } from 'three'
import { GARDEN, GATE } from '../data/layout'
import { debugSet } from '../lib/debug'
import { surface } from '../lib/proceduralTextures'
import { build, buildWhole } from './landGeometry'
import { lotEdges, type Edge, type FarmLayout, type ParcelId } from './layout'
import { farm, useFarm } from './state'

// The land the farm owns, drawn round its edge: a clipped hedge along the sides that face north and west, a
// slatted timber fence along those that face south and east (the sunny side, so it throws no shade into the rooms),
// with the farm gate in the garden's south fence and a gap in the west hedge where the tractor's track goes out (its
// gate: src/farm/OrderYard.tsx); and the woods beyond (made in landGeometry.ts). Buying a field moves all of it out
// round the new land: the woods step back so the field is open ground, and from the lane and the tractor's track.
// Through the gate (src/farm/GardenGate.tsx) is the lot across the lane (src/data/market.ts): invisible walls close it
// where nothing else does (`lotEdges`), and the walk-in buildings' own walls close the rest.

const GATE_L = GATE.x - GATE.width / 2
const GATE_R = GATE.x + GATE.width / 2

/** A wall's collider along a run of an edge, from `a` to `b`: `depth` thick each way, `shift` out from its line. */
function along(key: string, e: Edge, a: number, b: number, depth: number, shift: number) {
  const half = (b - a) / 2
  const mid = (a + b) / 2
  return e.axis === 'x' ? (
    <CuboidCollider key={key} args={[half, 1.2, depth]} position={[mid, 1.2, e.at + shift]} />
  ) : (
    <CuboidCollider key={key} args={[depth, 1.2, half]} position={[e.at + shift, 1.2, mid]} />
  )
}

/** Which way is out of an edge, as a sign on its axis. */
const outward = (e: Edge) => (e.out === 'south' || e.out === 'east' ? 1 : -1)

function Boundary({ layout }: { layout: FarmLayout }) {
  const built = useMemo(() => build(layout), [layout])
  const lot = useMemo(() => lotEdges(layout), [layout])
  const mats = useMemo(() => {
    const leaves = surface('grass', 1, 1)
    const bark = surface('veneer', 1, 1)
    const leaf = (color: string) =>
      new MeshStandardMaterial({ color, map: leaves.map, normalMap: leaves.normalMap, roughnessMap: leaves.roughnessMap, roughness: 1, normalScale: new Vector2(1.4, 1.4) })
    // in the order the single meshes were drawn: the hedge's sections, then the fence, the trunks, and the crowns shade
    // by shade (each shade's trees in turn)
    const hedge = built.hedge.map(() => leaf('#5f7a4a'))
    const fence = new MeshStandardMaterial({ color: '#7a6048', map: bark.map, normalMap: bark.normalMap, roughness: 0.85 })
    const wood = new MeshStandardMaterial({ color: '#6a5a4c', map: bark.map, normalMap: bark.normalMap, roughness: 0.95 })
    const shades = ['#5d7d43', '#6f8a46', '#4f6e3f'].map((color, k) => built.crowns.filter((c) => c.shade === k).map(() => leaf(color)))
    return {
      hedge,
      fence,
      wood,
      // tree i: the (i / 3)th tree of its shade
      crowns: built.crowns.map((c, i) => shades[c.shade][Math.floor(i / 3)]),
      shades,
      maps: [leaves.map, leaves.normalMap, leaves.roughnessMap, bark.map, bark.normalMap, bark.roughnessMap],
    }
  }, [built])
  const root = useRef<Group>(null)
  const pieces = useRef<Group>(null)
  useEffect(() => {
    // ?debug: `window.__home.land.whole(true)` draws the hedge and the crowns as one mesh each instead of the pieces
    let whole: Group | null = null
    debugSet('land', {
      pieces: () => pieces.current?.children ?? [],
      whole: (on: boolean) => {
        if (on && !whole) {
          const w = buildWhole(layout)
          whole = new Group()
          whole.name = 'farm-land-whole'
          // each with the first of its pieces' materials: where its pieces are drawn
          if (w.hedge) {
            const m = new Mesh(w.hedge, mats.hedge[0])
            m.castShadow = m.receiveShadow = true
            whole.add(m)
          }
          w.crowns.forEach((g, k) => whole!.add(new Mesh(g, mats.shades[k][0])))
          root.current?.add(whole)
        }
        if (whole) whole.visible = on
        if (pieces.current) pieces.current.visible = !on
      },
    })
    return () => {
      for (const g of [...built.hedge, built.fence, built.wood, ...built.crowns.map((c) => c.geometry)]) g?.dispose()
      if (whole) {
        whole.removeFromParent()
        whole.traverse((o) => (o as Mesh).geometry?.dispose())
      }
      for (const m of [...mats.hedge, mats.fence, mats.wood, ...mats.shades.flat()]) m.dispose()
      for (const t of mats.maps) t.dispose()
    }
  }, [built, mats, layout])
  return (
    <group name="farm-land" ref={root}>
      <group name="farm-land-pieces" ref={pieces}>
        {built.hedge.map((g, i) => (
          <mesh key={i} name="hedge" geometry={g} material={mats.hedge[i]} castShadow receiveShadow />
        ))}
        {/* the woods throw no shadow: the sun is low in the south-east and must keep reaching the windows */}
        {built.crowns.map((c, i) => (
          <mesh key={`c${i}`} name="crown" geometry={c.geometry} material={mats.crowns[i]} />
        ))}
      </group>
      {built.fence && <mesh geometry={built.fence} material={mats.fence} castShadow receiveShadow />}
      <mesh geometry={built.wood} material={mats.wood} />
      {/* the boundary is solid all round but for the gate in the garden's south fence, the way to the lot; the lot is
          closed by invisible walls where nothing else closes it, and the contractor's cabin stands in it */}
      <RigidBody type="fixed" colliders={false}>
        {built.edges.flatMap((e, i) => {
          const hedge = e.out === 'north' || e.out === 'west'
          const depth = hedge ? 0.5 : 0.1
          // a fence's collider sits just outside its line
          const shift = hedge ? 0 : 0.05 * outward(e)
          const gate = e.axis === 'x' && e.at === GARDEN.maxZ && e.from < GATE_L && e.to > GATE_R
          const runs = gate
            ? [
                [e.from - 0.05, GATE_L],
                [GATE_R, e.to + 0.05],
              ]
            : [[e.from - 0.05, e.to + 0.05]]
          return runs.map(([a, b], k) => along(`${i}.${k}`, e, a, b, depth, shift))
        })}
        {lot.map((e, i) => along(`lot${i}`, e, e.from - 0.05, e.to + 0.05, 0.1, 0.05 * outward(e)))}
      </RigidBody>
    </group>
  )
}

/** The farm's boundary and the woods, made again whenever a field is bought. */
export function Land() {
  const key = useFarm(() => farm.layout.land.join(','))
  const land = useMemo(() => key.split(',').filter(Boolean) as ParcelId[], [key])
  const layout = useMemo<FarmLayout>(() => ({ places: farm.layout.places, land }), [land])
  return <Boundary key={key} layout={layout} />
}
