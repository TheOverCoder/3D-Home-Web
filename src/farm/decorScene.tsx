import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, MeshBasicMaterial, MeshStandardMaterial, Vector3, type Material } from 'three'
import { registerInteractable } from '../lib/interaction'
import { Parts, shadowPart, smoothstep, type PartDef } from '../lib/sculpt'
import { cropGeometries, STALK_END } from '../models/crops'
import type { Structure } from '../models/structures'
import { DAY, PRODUCERS } from './data'
import { DECOR_KINDS, FRUIT, FRUIT_KINDS, type DecorKind, type FruitId, type FruitKind, type ShopKind } from './decor'
import { decorModel, fruitPlantModel, fruitSpots } from './decorModels'
import { moodAt, phaseDef } from './day'
import { useEdit } from './edit'
import { DECOR_FEET, isPlant, toWorld, turnOf, type DecorPiece } from './layout'
import { dayIsFrozen, farm, stockOf, useFarm } from './state'
import { producerOffer } from './useProducer'

// The farm's decoration and its fruit trees and bushes, bought in the edit mode's shop (src/farm/decor.ts) and standing
// where the layout puts them (src/farm/layout.ts, `decor`): each kind one crowd (src/lib/sculpt/parts.ts) of its model
// (src/farm/decorModels.ts), so a hundred fence sections or path tiles cost the draws of one, and the drawing pass draws
// only those in view (a far one with its lighter copy). A piece being dragged is drawn where the finger is.
//
// The lamps and the lanterns light up from the evening: their glass glows (a `glow` part's emissive light), and a soft
// pool of light lies on the ground round each (an additive disc) — no light is added to the scene. The slim things cast
// their shadows in the sun's map (a fence, a lamp, a bench, the well…); the leafy ones a soft shadow on the ground under
// them, like the corner trees and the woods. Each fruit plant is one of its kind's producer (PRODUCERS in data.ts): its
// fruit hang under its crown as they ripen, and the action button picks them as it picks the lemons.

/** The kinds that cast into the sun's shadow map: slim and light (a few hundred triangles), their shadows read as
 *  shapes on the ground. The leafy and the flat ones do not: the soft shadow under them grounds them. */
const CASTS: ReadonlySet<ShopKind> = new Set<ShopKind>(['lamp', 'lantern', 'fence', 'bench', 'birdbath', 'planter', 'well'])
/** The kinds with a soft shadow on the ground under them (half its size each way: a little past the footprint's). */
const SOFT: Partial<Record<ShopKind, number>> = {
  hedge: 1.15,
  tree: 1.25,
  pine: 1.0,
  bush: 1.1,
  roses: 1.1,
  'apple-tree': 1.2,
  'orange-tree': 1.2,
  'cherry-tree': 1.2,
  'blueberry-bush': 1.1,
  'raspberry-bush': 1.1,
}
/** The lights' pools on the ground: how far each reaches (m). */
const POOL: Partial<Record<ShopKind, number>> = { lamp: 2.6, lantern: 1.1 }
/** A part whose name says it is glass, a flame or a bulb lights up at night. */
const GLOWS = /glow|glass|light|flame|bulb/i

/** How the decoration is lit now: 0 by day, rising through the evening to 1 at night (the day's light, src/farm/day.ts;
 *  noon while the day is stopped, as in the tests). */
const NOON = phaseDef('noon').mood
export function glowLevel() {
  const m = dayIsFrozen() ? NOON : moodAt(farm.day.t)
  return smoothstep(0.9, Math.max(DAY.minLight, 0.5), m.sun)
}

/** The glass of every lamp and lantern: lit by its own colour, brighter as night falls. */
const glass = new MeshStandardMaterial({ vertexColors: true, roughness: 0.25, emissive: new Color(0xffc477), emissiveIntensity: 0 })

let poolGeometry: BufferGeometry | null = null
/** A disc of warm light on the ground (radius 1), brightest in the middle, nothing at its rim. */
function pool(): BufferGeometry {
  if (poolGeometry) return poolGeometry
  const seg = 28
  const p: number[] = [0, 0, 0]
  const c: number[] = [1, 1, 1, 1]
  for (const [r, a] of [
    [0.35, 0.75],
    [0.7, 0.3],
    [1, 0],
  ])
    for (let k = 0; k < seg; k++) {
      const t = (k / seg) * Math.PI * 2
      p.push(Math.cos(t) * r, 0, Math.sin(t) * r)
      c.push(1, 1, 1, a)
    }
  const idx: number[] = []
  for (let k = 0; k < seg; k++) idx.push(0, 1 + ((k + 1) % seg), 1 + k)
  for (let ring = 0; ring < 2; ring++)
    for (let k = 0; k < seg; k++) {
      const a = 1 + ring * seg + k
      const b = 1 + ring * seg + ((k + 1) % seg)
      idx.push(a, b, b + seg, a, b + seg, a + seg)
    }
  poolGeometry = new BufferGeometry()
  poolGeometry.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
  poolGeometry.setAttribute('color', new BufferAttribute(new Float32Array(c), 4))
  poolGeometry.setIndex(idx)
  poolGeometry.computeBoundingSphere()
  return poolGeometry
}
const poolMaterial = new MeshBasicMaterial({ color: 0xffb86a, vertexColors: true, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })

/** A kind's model (a fruit plant's or a piece of decoration's). */
const modelOf = (kind: ShopKind): Structure<string> => (isPlant(kind) ? fruitPlantModel(kind as FruitKind) : decorModel(kind as DecorKind))

interface Crowd {
  parts: Parts<string>
  keys: string[]
  /** room for this many pieces (made again, twice the size, when more stand) */
  max: number
}

/** A kind's crowd with room for `max` pieces: its model's parts, the glass on the glowing material. */
function makeCrowd(kind: ShopKind, max: number): Crowd {
  const model = modelOf(kind)
  const keys = Object.keys(model)
  const defs: Record<string, PartDef> = {}
  for (const k of keys) {
    const part = model[k]
    const material: Material | PartDef['material'] = GLOWS.test(k) ? glass : part.material
    defs[k] = { geometry: part.shape.geometry(), max, material, castShadow: CASTS.has(kind) && (part.castShadow ?? true), receiveShadow: part.receiveShadow ?? true }
  }
  return { parts: new Parts(defs, `decor-${kind}`), keys, max }
}

const KINDS = [...DECOR_KINDS, ...FRUIT_KINDS] as ShopKind[]

/** Where each piece is drawn now: where it stands, or where the edit mode drags it. */
function shownPieces(): DecorPiece[] {
  const drag = useEdit.getState().drag
  const list = farm.layout.decor
  if (!drag || drag.thing.kind !== 'decor') return list
  const id = drag.thing.id
  return list.map((d) => (d.id === id ? { ...d, x: drag.at.x, z: drag.at.z, rot: drag.at.rot } : d))
}

/** Every piece of decoration and every fruit plant, each kind one crowd; the soft shadows under the leafy ones; the
 *  lights' pools on the ground. */
function Crowds() {
  const root = useMemo(() => new Group(), [])
  const crowds = useRef(new Map<ShopKind, Crowd>())
  const extras = useMemo(() => {
    const shadows = new Parts({ shadow: shadowPart(256, 0.24) }, 'decor-shadows', false)
    const pools = new Parts({ pool: { geometry: pool(), max: 256, material: poolMaterial, receiveShadow: false } }, 'decor-light', false)
    root.add(shadows.group, pools.group)
    return { shadows, pools }
  }, [root])
  const seen = useRef<{ list: DecorPiece[] | null; drag: unknown }>({ list: null, drag: null })
  useEffect(() => {
    const own = crowds.current
    return () => {
      for (const c of own.values()) c.parts.dispose()
      own.clear()
      extras.shadows.dispose()
      extras.pools.dispose()
    }
  }, [extras])

  useFrame(() => {
    // the lights, as the day goes
    const level = glowLevel()
    glass.emissiveIntensity = 1.8 * level
    poolMaterial.opacity = 0.42 * level
    extras.pools.group.visible = level > 0.001
    const drag = useEdit.getState().drag
    const list = farm.layout.decor
    if (list === seen.current.list && drag === seen.current.drag) return
    seen.current = { list, drag }
    const shown = shownPieces()
    const counts = new Map<ShopKind, number>()
    for (const d of shown) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1)
    for (const kind of KINDS) {
      const n = counts.get(kind) ?? 0
      let crowd = crowds.current.get(kind)
      if (!n && !crowd) continue
      if (!crowd || crowd.max < n) {
        // a crowd made (again) with room for twice as many: only while the farm's decoration grows
        if (crowd) {
          root.remove(crowd.parts.group)
          crowd.parts.dispose()
        }
        crowd = makeCrowd(kind, Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(1, n)))))
        crowds.current.set(kind, crowd)
        root.add(crowd.parts.group)
      }
      const c = crowd
      c.parts.begin()
      for (const d of shown) {
        if (d.kind !== kind) continue
        // each piece a model of its own: the drawing pass draws the ones in view
        c.parts.at(d.x, 0, d.z, turnOf(d))
        for (const k of c.keys) c.parts.put(k, 0, 0, 0)
      }
      c.parts.end()
    }
    extras.shadows.begin()
    extras.pools.begin()
    for (const d of shown) {
      const soft = SOFT[d.kind]
      const f = DECOR_FEET[d.kind]
      if (soft) {
        extras.shadows.at(d.x, 0, d.z, turnOf(d))
        extras.shadows.put('shadow', 0, 0.012, 0, 0, 0, 0, SCALE.set(f.hx * soft, 1, f.hz * soft))
      }
      const reach = POOL[d.kind]
      if (reach) {
        extras.pools.at(d.x, 0, d.z)
        extras.pools.put('pool', 0, 0.02, 0, 0, 0, 0, reach)
      }
    }
    extras.shadows.end()
    extras.pools.end()
  })

  return <primitive object={root} />
}
const SCALE = new Vector3()

// ───────────────────────────── the fruit ─────────────────────────────

/** How each fruit looks hanging on its plant: its colour and size (the garden's round fruit, src/models/crops.ts). */
const HANGING: Record<FruitId, { color: number; size: number }> = {
  apple: { color: 0xc8352b, size: 0.085 },
  orange: { color: 0xf08a1c, size: 0.09 },
  cherry: { color: 0x9a1426, size: 0.038 },
  blueberry: { color: 0x3a4a86, size: 0.026 },
  raspberry: { color: 0xd2335a, size: 0.032 },
}

/** Where each kind's fruit hang, in its own frame (as many places as the most it bears). */
const SPOTS = Object.fromEntries(FRUIT_KINDS.map((k) => [k, fruitSpots(k, PRODUCERS[k].max)])) as Record<FruitKind, [number, number, number][]>

const fruitColor = new Color()
/** The fruit hanging on every fruit plant: one crowd of the garden's round fruit, tinted for each kind. */
function Fruit() {
  const parts = useMemo(() => new Parts({ fruit: { geometry: cropGeometries().tomato, max: 512, material: { roughness: 0.38 } } }, 'decor-fruit'), [])
  useEffect(() => () => parts.dispose(), [parts])
  const last = useRef(-1)
  const seen = useRef<unknown>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const drag = useEdit.getState().drag
    const key = [farm.layout.decor, drag]
    const moved = key[0] !== (seen.current as unknown[] | null)?.[0] || key[1] !== (seen.current as unknown[] | null)?.[1]
    if (!moved && Math.abs(t - last.current) < 0.25) return
    last.current = t
    seen.current = key
    parts.begin()
    const index = new Map<FruitKind, number>()
    for (const d of shownPieces()) {
      if (!isPlant(d.kind)) continue
      const kind = d.kind as FruitKind
      const i = index.get(kind) ?? 0
      index.set(kind, i + 1)
      const look = HANGING[FRUIT[kind].fruit]
      fruitColor.setHex(look.color)
      const n = stockOf(kind, i)
      for (let k = 0; k < n; k++) {
        const [lx, y, lz] = SPOTS[kind][k]
        const [x, z] = toWorld(d, lx, lz)
        // hanging from its stalk's end, the fruit a little below it
        parts.at(0, 0, 0)
        parts.put('fruit', x, y - STALK_END.tomato[1] * look.size, z, 0, k * 1.9, 0, look.size, fruitColor)
      }
    }
    parts.end()
  })
  return <primitive object={parts.group} />
}

/** Each fruit plant on the action button where it stands: pick its fruit (the lemon tree's rules: src/farm/useProducer.ts). */
function FruitOffers() {
  const list = useFarm(() => farm.layout.decor)
  useEffect(() => {
    const offs: (() => void)[] = []
    const index = new Map<FruitKind, number>()
    for (const d of list) {
      if (!isPlant(d.kind)) continue
      const kind = d.kind as FruitKind
      const i = index.get(kind) ?? 0
      index.set(kind, i + 1)
      const def = PRODUCERS[kind]
      const point = ([x, y, z]: readonly [number, number, number]) => {
        const [wx, wz] = toWorld(d, x, z)
        return { x: wx, y, z: wz }
      }
      offs.push(registerInteractable(producerOffer(kind, i, { stand: point(def.stand), aim: point(def.aim) })))
    }
    return () => offs.forEach((off) => off())
  }, [list])
  return null
}

// ───────────────────────────── what is solid ─────────────────────────────

type Solid = { box: [number, number, number] } | { post: [number, number] }
/** Each kind's body, in its own frame round its middle (half sizes: a box's, or a post's half height and radius); the
 *  flat ones and the flowers are walked over. */
const SOLID: Partial<Record<ShopKind, Solid>> = {
  lamp: { post: [1.15, 0.1] },
  lantern: { post: [0.35, 0.08] },
  fence: { box: [1.0, 0.5, 0.06] },
  hedge: { box: [1.0, 0.5, 0.28] },
  bench: { box: [0.78, 0.25, 0.3] },
  tree: { post: [1.2, 0.25] },
  pine: { post: [1.2, 0.22] },
  bush: { post: [0.4, 0.4] },
  roses: { post: [0.4, 0.35] },
  planter: { box: [0.48, 0.2, 0.23] },
  birdbath: { post: [0.4, 0.2] },
  well: { post: [0.45, 0.65] },
  'apple-tree': { post: [1.0, 0.2] },
  'orange-tree': { post: [1.0, 0.2] },
  'cherry-tree': { post: [1.0, 0.2] },
  'blueberry-bush': { post: [0.4, 0.4] },
  'raspberry-bush': { post: [0.4, 0.4] },
}

/** The bodies of everything standing (made again when anything is put down, moved or put away). */
function Bodies() {
  const list = useFarm(() => farm.layout.decor)
  const key = useMemo(() => list.map((d) => `${d.kind}@${d.x},${d.z},${d.rot}`).join('|'), [list])
  return (
    <RigidBody key={key} type="fixed" colliders={false}>
      {list.map((d) => {
        const s = SOLID[d.kind]
        if (!s) return null
        if ('box' in s) {
          const [hx, hy, hz] = s.box
          return <CuboidCollider key={d.id} args={[hx, hy, hz]} position={[d.x, hy, d.z]} rotation={[0, turnOf(d), 0]} />
        }
        const [half, radius] = s.post
        return <CylinderCollider key={d.id} args={[half, radius]} position={[d.x, half, d.z]} />
      })}
    </RigidBody>
  )
}

/** The farm's decoration and fruit plants (mounted with the farm, in its outside cell). */
export function Decor() {
  return (
    <group name="farm-decor">
      <Crowds />
      <Fruit />
      <FruitOffers />
      <Bodies />
    </group>
  )
}
