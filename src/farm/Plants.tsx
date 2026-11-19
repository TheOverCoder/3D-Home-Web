import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { cropShown, reacting, reaction, slotsShown } from '../fx/react'
import { cropParts } from '../models/crops'
import { GROWERS, hash, putEgg, putLemon } from '../models/plants'
import { lemonSpots } from '../models/structures'
import { nestSpots, placedPoint } from '../models/tools'
import { BED, BEDS, NEST, PRODUCERS, type CropId } from './data'
import { shownAt, shownPlacement, useEdit } from './edit'
import { toWorld, type Placement } from './layout'
import { bedProgress, eggsShown, farm, skinWorn, stockOf, toolOwned } from './state'

// Every plant in every bed, the lemons on the tree and the eggs in the nest box (or, once the hens' coop stands, in each
// hen's nest of it: src/farm/ToolStands.tsx): sculpted parts (src/models/crops.ts)
// put together by each crop's grower (src/models/plants.ts) for its stage of growth — one instanced draw per kind of
// part for the whole garden. They are rebuilt a few times a second as things grow, and every frame while one reacts (a
// harvest's pluck, a sowing's sprout, a watering's perk, a lemon or an egg picked: src/fx/react.ts, a stretch of the
// model's own scale, so nothing new is drawn); nothing here casts a shadow, so the sun's shadow map never has to be
// redrawn because a lettuce got bigger.

export const SOIL_Y = BED.h - 0.045 // the soil surface in a bed
/** The top of the straw in the nest box (see the nest box in Garden.tsx): eggs lie on it. */
const NEST_FLOOR = 0.645

/** Where the plants of a crop stand in a bed (bed-local x along the bed, z across it). */
const LAYOUT: Record<CropId, [number, number][]> = {
  lettuce: grid(4, 2, 0.38, 0.36),
  carrot: grid(6, 2, 0.25, 0.32),
  strawberry: grid(4, 2, 0.38, 0.36),
  tomato: grid(3, 1, 0.5, 0),
  corn: grid(3, 2, 0.5, 0.3),
  pumpkin: grid(2, 1, 0.78, 0),
  wheat: grid(5, 3, 0.3, 0.24),
  sugarcane: grid(3, 2, 0.5, 0.34),
  sunflower: grid(3, 1, 0.5, 0),
  potato: grid(4, 2, 0.38, 0.36),
  melon: grid(2, 1, 0.78, 0),
  cotton: grid(3, 2, 0.5, 0.3),
}

function grid(cols: number, rows: number, dx: number, dz: number): [number, number][] {
  const out: [number, number][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([(c - (cols - 1) / 2) * dx, (r - (rows - 1) / 2) * dz])
  return out
}

/** Where lemons hang on the tree (each stalk's end, up in the leaves; round the trunk), and the egg places in the nest box. */
export const LEMON_SPOTS = lemonSpots(PRODUCERS.tree.max)
const EGG_SPOTS: [number, number][] = grid(3, 2, 0.085, 0.085)
/** The most eggs shown in one of the coop's nests (one, or two side by side: a nest's count is its tool panel's). */
const EGGS_A_NEST = 2

const s = new Vector3()
/** A reaction's stretch (src/fx/react.ts) as the scale a model is put at, round its own foot; 1 at rest. (One vector,
 *  copied by each `at`: use it before asking for the next.) */
const stretch = (r: { xz: number; y: number } | null): number | Vector3 => (r ? s.set(r.xz, r.y, r.xz) : 1)

/** Puts the places a producer's place draws (src/fx/react.ts, slotsShown: the lemons, a nest's eggs, and the ones just
 *  picked popping off where they were), each through `put(k, n, scale)`. */
function eachSlot(has: number, id: string, most: number, put: (k: number, n: number, scale: number | Vector3) => void) {
  const { n, popping } = slotsShown(has, reaction('fruit', id), most)
  for (let k = 0; k < n; k++) put(k, n, k < has ? 1 : stretch(popping))
}

export function Plants() {
  const parts = useMemo(() => cropParts(), [])
  useEffect(() => () => parts.dispose(), [parts])
  const last = useRef(-1)
  const seen = useRef<{ lemon?: Placement; hens?: Placement; beds?: unknown; drag?: unknown }>({})

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // the lemons and the eggs move with their tree and their run, the plants with their bed (dragged in the edit mode:
    // at once)
    const lemon = shownPlacement('lemon')
    const hens = shownPlacement('hens')
    const beds = farm.layout.beds
    const drag = useEdit.getState().drag
    const moved = lemon !== seen.current.lemon || hens !== seen.current.hens || beds !== seen.current.beds || drag !== seen.current.drag
    // (while anything reacts, every frame: its stretch moves)
    if (!moved && Math.abs(t - last.current) < 0.2 && !reacting('plant') && !reacting('fruit')) return
    last.current = t
    seen.current = { lemon, hens, beds, drag }
    parts.begin()
    // each plant, lemon and egg a model of its own (put where it stands, round its own foot, stretched while it reacts:
    // src/fx/react.ts): the view draws the ones it can see
    BEDS.forEach((_, i) => {
      const bed = farm.beds[i]
      if (!bed.built) return
      const r = reaction('plant', i)
      // a bed just harvested draws its crop as it was, plucked away, until the pluck is over (or the bed sown again)
      const crop = cropShown<CropId>(bed.crop, r)
      if (!crop) return
      const at = shownAt({ kind: 'bed', index: i })
      if (!at) return
      const g = bed.crop ? bedProgress(i) : 1
      const scale = stretch(r)
      LAYOUT[crop].forEach(([lx, lz], k) => {
        const seed = hash(i + 1, k + 1)
        const [x, z] = toWorld(at, lx + (hash(k, i) - 0.5) * 0.04, lz + (hash(i, k) - 0.5) * 0.04)
        parts.at(x, SOIL_Y, z, 0, scale)
        GROWERS[crop](parts, 0, 0, 0, g, seed)
      })
    })
    // the lemons there are, and the ones just picked popping off where they hung
    eachSlot(stockOf('tree'), 'tree:0', LEMON_SPOTS.length, (k, _, scale) => {
      const [lx, y, lz] = LEMON_SPOTS[k]
      const [x, z] = toWorld(lemon, lx, lz)
      parts.at(x, y, z, 0, scale)
      putLemon(parts, 0, 0, 0, k)
    })
    if (toolOwned('hens')) {
      // the coop of the skin it wears (src/farm/skins.ts): each hen's eggs in her own nest, on its straw (and the ones
      // just taken, popping off where they lay)
      const stock = farm.producers.hens.stock
      nestSpots(skinWorn('hens')).forEach(([sx, sy, sz], i) => {
        eachSlot(Math.min(EGGS_A_NEST, stock[i] ?? 0), `hens:${i}`, EGGS_A_NEST, (k, n, scale) => {
          const [lx, y, lz] = placedPoint('nests', [sx + (k - (n - 1) / 2) * 0.065, sy, sz + k * 0.02])
          const [x, z] = toWorld(hens, lx, lz)
          parts.at(x, y, z, 0, scale)
          putEgg(parts, 0, 0, 0, i + k)
        })
      })
    } else {
      // (every nest's eggs together, up to the six the box holds)
      eachSlot(eggsShown(), 'hens:0', EGG_SPOTS.length, (k, _, scale) => {
        const [ex, ez] = EGG_SPOTS[k]
        const [x, z] = toWorld(hens, NEST.x + ez, NEST.z + ex)
        parts.at(x, NEST_FLOOR, z, 0, scale)
        putEgg(parts, 0, 0, 0, k)
      })
    }
    parts.end()
  })

  return (
    <group name="farm-plants">
      <primitive object={parts.group} />
    </group>
  )
}
