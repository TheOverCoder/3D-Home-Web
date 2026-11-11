import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, MathUtils, MeshStandardMaterial, type BufferGeometry, type Group } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { create } from 'zustand'
import { GARDEN, GATE } from '../data/layout'
import { boxProject } from '../lib/boxProject'
import { debugSet } from '../lib/debug'
import { playerState } from '../lib/playerState'
import { material } from '../lib/proceduralTextures'
import { WOOD } from './Places'

// The garden's gate, in the south fence: the way out to the lane and the lot beyond it. Its leaf stays in the yard's
// merged batch while shut (no draw of its own); when you come near, it is taken out of the merge (the batch's
// `exclude`, as decorating takes a piece out: src/scene/House.tsx) and swings away from you, damped as the tractor's
// gate is (FarmGate, src/farm/OrderYard.tsx); once it is shut and you have gone, it goes back in.

/** You come this near the gate's middle (on the ground, metres) and it opens. */
const OPEN_WITHIN = 1.8
/** How far it swings open (radians). */
const OPEN_ANGLE = 1.45
/** The damping rate: most of the way open (or shut) in about 0.4 s, so a runner finds it open. */
const RATE = 7.5
/** The leaf hangs from the west post (its inner side), along the fence. */
const HINGE = -GATE.width / 2 + 0.06

/** While the leaf swings (or stands open) it is drawn on its own, out of the yard's merged batch. */
export const useGate = create<{ out: boolean }>()(() => ({ out: false }))
const SWINGING: ReadonlySet<string> = new Set(['gate-leaf'])
const SHUT: ReadonlySet<string> = new Set()
/** The parts of the yard's batch drawn on their own now (src/farm/Garden.tsx). */
export const useGateExclude = () => useGate((s) => (s.out ? SWINGING : SHUT))

/** The leaf's group (turned about the hinge), once mounted. */
const leaf = { group: null as Group | null }

/** The leaf's slats, rails and brace (each as the garden's boxes make it), pre-merged into one mesh for each look: 0
 *  draws while it is merged with the yard, 2 while it swings. Laid out round the hinge. */
function leafGeometry(): { slats: BufferGeometry; frame: BufferGeometry } {
  const slats = Array.from({ length: 7 }, (_, i) => {
    const x = -GATE.width / 2 + 0.16 + i * ((GATE.width - 0.32) / 6)
    // the grain projected as a box of the garden's would have it there (its offset from where it stands)
    const g = boxProject(new BoxGeometry(0.11, 1.0, 0.03), 0.9, x * 3.1)
    return g.translate(x - HINGE, 0.58, 0)
  })
  const rails = [0.32, 0.92].map((y) => new BoxGeometry(GATE.width - 0.12, 0.08, 0.035).translate(-HINGE, y, 0.02))
  const brace = new BoxGeometry(0.07, 1.3, 0.03).rotateZ(0.62).translate(-HINGE, 0.62, 0.035)
  const out = { slats: mergeGeometries(slats)!, frame: mergeGeometries([...rails, brace])! }
  for (const g of [...slats, ...rails, brace]) g.dispose()
  return out
}

/** The leaf, standing shut in the fence (inside the yard's StaticBatch: src/farm/Garden.tsx, in the gate's own group). */
export function GateLeaf() {
  const parts = useMemo(() => {
    const grain = material('veneer')
    // the same looks as the garden's boxes of wood (src/scene/Furnishings.tsx, B), so the leaf merges into the yard's
    // batch with them
    const plain = new MeshStandardMaterial({ color: WOOD, roughness: 0.8, metalness: 0 })
    plain.normalScale.set(0.8, 0.8)
    return {
      ...leafGeometry(),
      wood: new MeshStandardMaterial({ color: WOOD, roughness: 0.8, metalness: 0, map: grain.map, normalMap: grain.normalMap, roughnessMap: grain.roughnessMap }),
      plain,
    }
  }, [])
  useEffect(() => () => [parts.slats, parts.frame, parts.wood, parts.plain].forEach((d) => d.dispose()), [parts])
  const ref = (g: Group | null) => {
    leaf.group = g
  }
  return (
    <group ref={ref} position={[HINGE, 0, 0]} userData={{ part: 'gate-leaf' }}>
      <mesh geometry={parts.slats} material={parts.wood} castShadow receiveShadow />
      <mesh geometry={parts.frame} material={parts.plain} castShadow receiveShadow />
    </group>
  )
}

/** Opens the gate as you come near and shuts it once you have gone (mounted in the garden: src/farm/Garden.tsx). */
export function GardenGate() {
  // 0 shut … 1 open, and which way: 1 out to the lane (you came from the garden), −1 into the garden
  const open = useRef(0)
  const side = useRef(1)
  useEffect(() => {
    // ?debug: how open the gate is, and whether its leaf is out of the yard's batch
    debugSet('gate', () => ({ open: open.current, out: useGate.getState().out }))
  }, [])
  useFrame((_, rawDt) => {
    // (exact for any step: a slow page's few frames still open it in time)
    const dt = Math.min(rawDt, 0.25)
    const p = playerState.position
    const near = Math.hypot(p.x - GATE.x, p.z - GARDEN.maxZ) < OPEN_WITHIN
    // out of the yard's batch as you come; back in once it is shut and you have gone
    const out = near || open.current > 0
    if (out !== useGate.getState().out) useGate.setState({ out })
    // it swings only once it is drawn on its own (the batch lets it go a frame or so after it is asked)
    const g = leaf.group
    if (!g?.children[0]?.visible) return
    // from shut, it swings away from you, and keeps that way until it is shut again
    if (open.current === 0 && near) side.current = p.z < GARDEN.maxZ ? 1 : -1
    open.current = MathUtils.damp(open.current, near ? 1 : 0, RATE, dt)
    // and comes to rest exactly, open or shut (the picture stops changing)
    if (near && open.current > 1 - 1e-3) open.current = 1
    if (!near && open.current < 1e-3) open.current = 0
    // about the hinge: a turn of −a takes the leaf's free end south (+z), out to the lane
    g.rotation.y = -side.current * open.current * OPEN_ANGLE
  })
  return null
}
