import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, MeshBasicMaterial, Vector3 } from 'three'
import { inSunShadow } from '../data/layout'
import { registerInteractable } from '../lib/interaction'
import { Parts, setSculptGlow, shadowPart, smoothstep, type PartDef } from '../lib/sculpt'
import { partGeometry, type Structure } from '../models/structures'
import { DAY, PRODUCERS } from './data'
import { DECOR_KINDS, FRUIT, FRUIT_KINDS, lookTints, SHOP, type BearerKind, type DecorKind, type FruitId, type FruitKind, type ShopKind } from './decor'
import { decorModel, fruitParts, fruitPlantModel, fruitSpots, putFruit } from './decorModels'
import { moodAt, phaseDef } from './day'
import { useEdit } from './edit'
import { reacting, reaction, slotsShown } from '../fx/react'
import { DECOR_FEET, bears, isPlant, toWorld, turnOf, type DecorPiece } from './layout'
import { dayIsFrozen, farm, stockOf, useFarm } from './state'
import { producerOffer } from './useProducer'

// The farm's decoration and its fruit trees and bushes, bought in the edit mode's shop (src/farm/decor.ts) and standing
// where the layout puts them (src/farm/layout.ts, `decor`): each kind one crowd (src/lib/sculpt/parts.ts) of its model
// (src/farm/decorModels.ts), so a hundred fence sections or path tiles cost the draws of one, and the drawing pass draws
// only those in view (a far one with its lighter copy). A piece being dragged is drawn where the finger is.
//
// The lamps and the lanterns light up from the evening: their glass glows (its material's `glow`, at the level
// `setSculptGlow` sets), and a soft pool of light lies on the ground round each (an additive disc) — no light is added
// to the scene. Each casts its shadow into the sun's map, and where the sun's map does not reach has a soft shadow on
// the ground under it instead (CASTS, below). Each fruit plant is one of its kind's
// producer (PRODUCERS in data.ts): its fruit hang from its crown as they ripen (one crowd, src/models/fruit.ts), and the
// action button picks them as it picks the lemons.

/** The kinds that cast into the sun's shadow map: all but the flat ones (a path, stepping stones). A crowd that casts
 *  is drawn into the map by meshes of its own, from its lighter copies for the sun (src/lib/sculpt/sun.ts), and is seen
 *  like any other: only where in view, a far one from its copy. The fruit does not cast (it hangs in its crown's). */
const CASTS: ReadonlySet<ShopKind> = new Set(([...DECOR_KINDS, ...FRUIT_KINDS] as ShopKind[]).filter((k) => !DECOR_FEET[k].flat))
/** A soft shadow's size against the footprint (the leafy ones' crowns spread past theirs): none where the piece casts a
 *  real one — its foot and its top inside the sun's shadow box (`inSunShadow`), its footprint's width in from its
 *  sides — and none for the flat ones. */
function softShadow(d: DecorPiece, top: number): number {
  const f = DECOR_FEET[d.kind]
  if (f.flat) return 0
  const margin = Math.max(f.hx, f.hz) + 0.5
  if (CASTS.has(d.kind) && inSunShadow(d.x, 0, d.z, margin) && inSunShadow(d.x, top, d.z, margin)) return 0
  return isPlant(d.kind) || /tree|pine|bush|roses|hedge/.test(d.kind) ? 1.15 : 0.9
}
/** The lights' pools on the ground: how far each reaches (m). */
const POOL: Partial<Record<ShopKind, number>> = { lamp: 2.6, lantern: 1.1 }

/** How the decoration is lit now: 0 by day, rising through the evening to 1 at night (the day's light, src/farm/day.ts;
 *  noon while the day is stopped, as in the tests). */
const NOON = phaseDef('noon').mood
export function glowLevel() {
  const m = dayIsFrozen() ? NOON : moodAt(farm.day.t)
  return smoothstep(0.9, Math.max(DAY.minLight, 0.5), m.sun)
}

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
  /** the model's top, above the ground under it (m) */
  top: number
  /** room for this many pieces (made again, twice the size, when more stand) */
  max: number
  /** a kind that wears looks (mission 02 F5): the mean colour of its painted part, and each look's colours by part */
  looks: { base: [number, number, number] | null; byLook: Map<string, Record<string, Color>> } | null
}

const WHITE = new Color(1, 1, 1)

/** The mean vertex colour of a geometry (a painted part's: what its paint is measured against). */
function meanColour(g: BufferGeometry): [number, number, number] {
  const c = g.getAttribute('color')
  const sum = [0, 0, 0]
  for (let i = 0; i < c.count; i++) for (let k = 0; k < 3; k++) sum[k] += c.getComponent(i, k)
  return [sum[0] / c.count, sum[1] / c.count, sum[2] / c.count]
}

/** The instance colour of a piece's part: its look's on the parts it tints, white (as it was made) elsewhere. */
function tintOf(c: Crowd, d: DecorPiece, part: string): Color {
  if (!c.looks || !d.look) return WHITE
  let by = c.looks.byLook.get(d.look)
  if (!by) {
    by = Object.fromEntries(Object.entries(lookTints(d.kind, d.look, c.looks.base)).map(([k, [r, g, b]]) => [k, new Color(r, g, b)]))
    c.looks.byLook.set(d.look, by)
  }
  return by[part] ?? WHITE
}

/** A kind's crowd with room for `max` pieces: its model's parts (the lamps' glass glows by its own material: `glow`). */
function makeCrowd(kind: ShopKind, max: number): Crowd {
  const model = modelOf(kind)
  const keys = Object.keys(model)
  const defs: Record<string, PartDef> = {}
  let top = 0
  const tints = SHOP[kind].tints
  let base: [number, number, number] | null = null
  for (const k of keys) {
    const part = model[k]
    const geometry = partGeometry(part)
    top = Math.max(top, geometry.boundingBox!.max.y)
    if (k === SHOP[kind].paint) base = meanColour(geometry)
    defs[k] = { geometry, max, material: part.material, castShadow: CASTS.has(kind) && (part.castShadow ?? true), receiveShadow: part.receiveShadow ?? true }
  }
  return { parts: new Parts(defs, `decor-${kind}`), keys, max, top, looks: tints?.length ? { base, byLook: new Map() } : null }
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
  // the soft shadows and the pools of light: room for every piece, made again twice the size when more stand
  const extras = useRef<{ shadows: Parts<'shadow'>; pools: Parts<'pool'>; max: number } | null>(null)
  const roomFor = (n: number) => {
    const now = extras.current
    if (now && now.max >= n) return now
    if (now) {
      root.remove(now.shadows.group, now.pools.group)
      now.shadows.dispose()
      now.pools.dispose()
    }
    const max = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, n))))
    const shadows = new Parts({ shadow: shadowPart(max, 0.24) }, 'decor-shadows', false)
    const pools = new Parts({ pool: { geometry: pool(), max, material: poolMaterial, receiveShadow: false } }, 'decor-light', false)
    root.add(shadows.group, pools.group)
    return (extras.current = { shadows, pools, max })
  }
  const seen = useRef<{ list: DecorPiece[] | null; drag: unknown }>({ list: null, drag: null })
  /** a piece reacted at the last put */
  const stirred = useRef(false)
  useEffect(() => {
    const own = crowds.current
    return () => {
      for (const c of own.values()) c.parts.dispose()
      own.clear()
      extras.current?.shadows.dispose()
      extras.current?.pools.dispose()
      extras.current = null
    }
  }, [])

  useFrame(() => {
    // the lights, as the day goes
    const level = glowLevel()
    setSculptGlow(level)
    poolMaterial.opacity = 0.42 * level
    if (extras.current) extras.current.pools.group.visible = level > 0.001
    const drag = useEdit.getState().drag
    const list = farm.layout.decor
    // (put again every frame while a piece settles or a fruit plant rustles, and once more as the last ends, at rest)
    const now = reacting('thing') || reacting('plant')
    if (list === seen.current.list && drag === seen.current.drag && !now && !stirred.current) return
    stirred.current = now
    seen.current = { list, drag }
    const shown = shownPieces()
    const stretches = stretchesOf(shown)
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
        // each piece a model of its own: the drawing pass draws the ones in view (stretched round its foot while it
        // settles or rustles: src/fx/react.ts)
        const r = stretches.get(d.id)
        c.parts.at(d.x, 0, d.z, turnOf(d), r ? SCALE.set(r.xz, r.y, r.xz) : 1)
        // (a kind that wears looks puts each part's colour every time: an instance's slot may have worn another's)
        if (c.looks) for (const k of c.keys) c.parts.put(k, 0, 0, 0, 0, 0, 0, 1, tintOf(c, d, k))
        else for (const k of c.keys) c.parts.put(k, 0, 0, 0)
      }
      c.parts.end()
    }
    const extra = roomFor(shown.length)
    extra.pools.group.visible = level > 0.001
    extra.shadows.begin()
    extra.pools.begin()
    for (const d of shown) {
      const soft = softShadow(d, crowds.current.get(d.kind)?.top ?? 0)
      const f = DECOR_FEET[d.kind]
      if (soft) {
        // (squashed along with it, across the ground)
        const across = soft * (stretches.get(d.id)?.xz ?? 1)
        extra.shadows.at(d.x, 0, d.z, turnOf(d))
        extra.shadows.put('shadow', 0, 0.012, 0, 0, 0, 0, SCALE.set(f.hx * across, 1, f.hz * across))
      }
      const reach = POOL[d.kind]
      if (reach) {
        extra.pools.at(d.x, 0, d.z)
        extra.pools.put('pool', 0, 0.02, 0, 0, 0, 0, reach)
      }
    }
    extra.shadows.end()
    extra.pools.end()
  })

  return <primitive object={root} />
}
const SCALE = new Vector3()
const FRUIT_SCALE = new Vector3()

/** Each piece's stretch now, by its id (none at rest): a piece put down settling (`decor-<id>`, src/farm/edit.ts), a
 *  fruit plant picked rustling (its kind's `<kind>:<i>`, the i-th standing in the layout's order: the producers'). */
function stretchesOf(shown: readonly DecorPiece[]): Map<number, { xz: number; y: number }> {
  const out = new Map<number, { xz: number; y: number }>()
  const index = new Map<ShopKind, number>()
  for (const d of shown) {
    const i = index.get(d.kind) ?? 0
    index.set(d.kind, i + 1)
    const r = reaction('thing', `decor-${d.id}`) ?? (isPlant(d.kind) ? reaction('plant', `${d.kind}:${i}`) : null)
    if (r) out.set(d.id, { xz: r.xz, y: r.y })
  }
  return out
}

// ───────────────────────────── the fruit ─────────────────────────────

/** Where each kind's fruit hang, in its own frame (as many places as the most it bears). */
const SPOTS = Object.fromEntries(FRUIT_KINDS.map((k) => [k, fruitSpots(k, PRODUCERS[k].max)])) as Record<FruitKind, [number, number, number][]>

/** The fruit hanging on every fruit plant: one crowd (src/models/fruit.ts), a part for each fruit, made again with room
 *  for twice as many when more hang than it holds (only while the farm's plants grow in number). */
function Fruit() {
  const root = useMemo(() => new Group(), [])
  const crowd = useRef<{ parts: Parts<FruitId>; max: number } | null>(null)
  useEffect(
    () => () => {
      crowd.current?.parts.dispose()
      crowd.current = null
    },
    [],
  )
  const last = useRef(-1)
  const seen = useRef<{ list: unknown; drag: unknown }>({ list: null, drag: null })
  /** something reacted at the last put */
  const stirred = useRef(false)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const drag = useEdit.getState().drag
    const list = farm.layout.decor
    const moved = list !== seen.current.list || drag !== seen.current.drag
    // (every frame while fruit is picked or its plant settles or rustles, and once more as the last ends)
    const now = reacting('fruit') || reacting('plant') || reacting('thing')
    if (!moved && Math.abs(t - last.current) < 0.25 && !now && !stirred.current) return
    stirred.current = now
    last.current = t
    seen.current = { list, drag }
    // the most of any one fruit that could hang now: its plants, each full
    const most = new Map<FruitId, number>()
    for (const d of list) if (isPlant(d.kind)) most.set(FRUIT[d.kind as FruitKind].fruit, (most.get(FRUIT[d.kind as FruitKind].fruit) ?? 0) + PRODUCERS[d.kind as FruitKind].max)
    const need = Math.max(0, ...most.values())
    if (!need && !crowd.current) return
    if (!crowd.current || crowd.current.max < need) {
      if (crowd.current) {
        root.remove(crowd.current.parts.group)
        crowd.current.parts.dispose()
      }
      const max = Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(1, need))))
      crowd.current = { parts: fruitParts(max), max }
      root.add(crowd.current.parts.group)
    }
    const parts = crowd.current.parts
    parts.begin()
    const index = new Map<FruitKind, number>()
    const shown = shownPieces()
    const stretches = stretchesOf(shown)
    for (const d of shown) {
      if (!isPlant(d.kind)) continue
      const kind = d.kind as FruitKind
      const i = index.get(kind) ?? 0
      index.set(kind, i + 1)
      // each fruit a model of its own (the view draws those it sees), hanging from its spot where the plant stands — its
      // spot moving with the plant as it settles or rustles, and the ones just picked popping off where they hung
      const plant = stretches.get(d.id)
      const across = plant?.xz ?? 1
      const up = plant?.y ?? 1
      const { n, popping } = slotsShown(stockOf(kind, i), reaction('fruit', `${kind}:${i}`), SPOTS[kind].length)
      const has = stockOf(kind, i)
      for (let k = 0; k < n; k++) {
        const [lx, y, lz] = SPOTS[kind][k]
        const [x, z] = toWorld(d, lx * across, lz * across)
        parts.at(x, y * up, z, 0, k < has || !popping ? 1 : FRUIT_SCALE.set(popping.xz, popping.y, popping.xz))
        putFruit(parts, FRUIT[kind].fruit, 0, 0, 0, k)
      }
    }
    parts.end()
  })
  return <primitive object={root} />
}

/** Each fruit plant (and each beehive) on the action button where it stands: pick its fruit, collect its honey (the
 *  lemon tree's rules: src/farm/useProducer.ts). */
function FruitOffers() {
  const list = useFarm(() => farm.layout.decor)
  useEffect(() => {
    const offs: (() => void)[] = []
    const index = new Map<BearerKind, number>()
    for (const d of list) {
      if (!bears(d.kind)) continue
      const kind = d.kind
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
  lamp: { post: [1.25, 0.1] },
  lantern: { post: [0.6, 0.06] },
  fence: { box: [1.0, 0.5, 0.06] },
  hedge: { box: [1.2, 0.47, 0.3] },
  bench: { box: [0.72, 0.25, 0.28] },
  tree: { post: [1.5, 0.25] },
  pine: { post: [1.5, 0.2] },
  bush: { post: [0.44, 0.5] },
  roses: { post: [0.45, 0.45] },
  planter: { box: [0.48, 0.33, 0.24] },
  birdbath: { post: [0.45, 0.3] },
  well: { post: [0.5, 0.75] },
  // a scarecrow: its post and stuffed body, and its arms out at your shoulders (the little one's lower; the witch in
  // her skirt wider)
  'scarecrow-farmer': { box: [0.7, 0.95, 0.2] },
  'scarecrow-haymaker': { box: [0.7, 0.95, 0.2] },
  'scarecrow-sunflower': { box: [0.6, 0.8, 0.2] },
  'scarecrow-pumpkin': { box: [0.7, 0.95, 0.2] },
  'scarecrow-witch': { box: [0.7, 0.95, 0.3] },
  'scarecrow-crows': { box: [0.7, 0.95, 0.22] },
  // the seasons' pieces: the arch's two posts (you walk under it), the parasol's pole, the bales, the snowman
  parasol: { post: [1.1, 0.08] },
  'hay-bales': { box: [0.47, 0.34, 0.46] },
  snowman: { post: [0.65, 0.33] },
  // the season banner's pole (mission 02 c8)
  banner: { box: [0.3, 1.0, 0.06] },
  'scarecrow-ribbons': { box: [0.7, 0.95, 0.2] },
  'scarecrow-pinwheel': { box: [0.7, 0.95, 0.2] },
  'scarecrow-jingle': { box: [0.7, 0.95, 0.26] },
  'apple-tree': { post: [1.2, 0.18] },
  'orange-tree': { post: [1.2, 0.18] },
  'cherry-tree': { post: [1.2, 0.18] },
  'blueberry-bush': { post: [0.5, 0.6] },
  'raspberry-bush': { post: [0.7, 0.5] },
  // update v1's beehive on its stand
  beehive: { box: [0.3, 0.45, 0.28] },
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
