import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { cropParts } from '../models/crops'
import { GROWERS, hash, putEgg, putLemon } from '../models/plants'
import { BED, BEDS, LEMON_TREE, NEST, type CropId } from './data'
import { bedProgress, farm } from './state'

// Every plant in every bed, the lemons on the tree and the eggs in the nest: sculpted parts (src/models/crops.ts)
// put together by each crop's grower (src/models/plants.ts) for its stage of growth — one instanced draw per kind of
// part for the whole garden. They are rebuilt a few times a second as things grow; nothing here casts a shadow, so
// the sun's shadow map never has to be redrawn because a lettuce got bigger.

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
}

function grid(cols: number, rows: number, dx: number, dz: number): [number, number][] {
  const out: [number, number][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([(c - (cols - 1) / 2) * dx, (r - (rows - 1) / 2) * dz])
  return out
}

/** Spots on the lemon tree's crown where fruit hangs, and the egg places in the nest box. */
export const LEMON_SPOTS: [number, number, number][] = Array.from({ length: LEMON_TREE.max }, (_, k) => {
  const a = (k / LEMON_TREE.max) * Math.PI * 2 + 0.4
  const r = 0.78 + (k % 2) * 0.12
  return [LEMON_TREE.x + Math.cos(a) * r, 1.72 + ((k * 7) % 3) * 0.16, LEMON_TREE.z + Math.sin(a) * r]
})
const EGG_SPOTS: [number, number][] = grid(3, 2, 0.085, 0.085)

export function Plants() {
  const parts = useMemo(() => cropParts(), [])
  useEffect(() => () => parts.dispose(), [parts])
  const last = useRef(-1)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (Math.abs(t - last.current) < 0.2) return
    last.current = t
    parts.begin()
    parts.at(0, 0, 0)
    BEDS.forEach((def, i) => {
      const bed = farm.beds[i]
      if (!bed.built || !bed.crop) return
      const g = bedProgress(i)
      LAYOUT[bed.crop].forEach(([lx, lz], k) => {
        const seed = hash(i + 1, k + 1)
        GROWERS[bed.crop!](parts, def.x + lx + (hash(k, i) - 0.5) * 0.04, SOIL_Y, def.z + lz + (hash(i, k) - 0.5) * 0.04, g, seed)
      })
    })
    for (let k = 0; k < farm.lemons; k++) {
      const [x, y, z] = LEMON_SPOTS[k]
      putLemon(parts, x, y, z, k)
    }
    for (let k = 0; k < farm.eggs; k++) {
      const [ex, ez] = EGG_SPOTS[k]
      putEgg(parts, NEST.x + ez, NEST_FLOOR, NEST.z + ex, k)
    }
    parts.end()
  })

  return (
    <group name="farm-plants">
      <primitive object={parts.group} />
    </group>
  )
}
