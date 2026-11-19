import { Parts, lathe, merge, rgb, type PartDef, type Shape, type V3 } from '../lib/sculpt'
import { DEALER_DESK, PAINT_WALL, TURNTABLE } from '../data/dealer'
import { CAR_PAINTS, PAINT_IDS } from '../farm/carPaints'
import { box, cuboid, type Paint } from './boxes'
import { grain, mix } from './structures'

// The car dealer's fittings (src/data/dealer.ts), in world metres: the seller's desk with a laptop, the wall of the
// paints (a swatch panel for each, on a board along the back wall) and the turntable the showroom's car stands on (the
// car itself is a car crowd's: src/farm/Dealer.tsx). One part, casting nothing (the shell shades all of it). Its shell
// is the walk-ins' (src/models/market.ts, walkInShellModel).

const WHITE = rgb(0xf2f0ea)
const BLACK = rgb(0x2a2c2f)
const STEEL = rgb(0x9aa2a8)
const BOARD = rgb(0x3a3f45)

const linear = (hex: string): V3 => rgb(Number.parseInt(hex.slice(1), 16))

/** The desk: a top on a pedestal and a leg panel, a laptop open on it facing the seller. */
function deskShape(): Shape {
  const d = DEALER_DESK
  const top = d.y1
  const wood = (n: V3, m: V3): Paint => ({ color: grain(0, 71)(m[0] + n[0] * 0.3, m[1], m[2]) })
  return merge(
    cuboid(box(d.x0, d.x1, top - 0.03, top, d.z0, d.z1), wood),
    cuboid(box(d.x0 + 0.02, d.x0 + 0.42, 0, top - 0.03, d.z0 + 0.03, d.z1 - 0.02), { color: WHITE }),
    cuboid(box(d.x1 - 0.05, d.x1 - 0.02, 0, top - 0.03, d.z0 + 0.03, d.z1 - 0.02), { color: WHITE }),
    // the laptop: its base on the desk, its lid up behind it (towards the seller)
    cuboid(box(d.x1 - 0.55, d.x1 - 0.2, top, top + 0.02, d.z0 + 0.12, d.z0 + 0.36), { color: STEEL }),
    cuboid(box(d.x1 - 0.55, d.x1 - 0.2, top + 0.005, top + 0.26, d.z0 + 0.35, d.z0 + 0.37), (n) => ({ color: n[2] < 0 ? STEEL : BLACK })),
  )
}

/** The paint wall: a dark board along the back wall, a swatch panel for each paint on it, in the dealer's order. */
function paintWallShape(): Shape {
  const w = PAINT_WALL
  const z = w.z
  const parts: Shape[] = [cuboid(box(w.x0 - 0.06, w.x1 + 0.06, w.y0 - 0.08, w.y1 + 0.08, z - 0.03, z), { color: BOARD })]
  const n = PAINT_IDS.length
  const step = (w.x1 - w.x0) / n
  PAINT_IDS.forEach((id, k) => {
    const x0 = w.x0 + k * step + 0.04
    parts.push(cuboid(box(x0, x0 + step - 0.08, w.y0 + 0.08, w.y1 - 0.08, z - 0.05, z - 0.03), { color: linear(CAR_PAINTS[id].hex) }))
  })
  return merge(...parts)
}

/** The turntable: a low steel disc with a darker rim. */
function turntableShape(): Shape {
  const t = TURNTABLE
  return lathe(
    [
      [0, 0.09],
      [t.r - 0.06, 0.09],
      [t.r, 0.06],
      [t.r, 0],
      [0, 0],
    ],
    { seg: 32, steps: 1 },
  )
    .place([t.x, 0, t.z])
    .paint((_x, y) => (y > 0.08 ? STEEL : mix(STEEL, BLACK, 0.5)), 0)
}

/** The fittings' shape (made once). */
let made: Shape | null = null
export const dealerFittingsShape = () => (made ??= merge(deskShape(), paintWallShape(), turntableShape()))

/** The fittings drawn: one draw, casting nothing, put at the origin. */
export function dealerFittingsParts(): Parts<'fittings'> {
  const defs: Record<'fittings', PartDef> = { fittings: { geometry: dealerFittingsShape().geometry(), max: 1, material: { roughness: 0.6 }, castShadow: false, receiveShadow: true } }
  const parts = new Parts<'fittings'>(defs, 'dealer-fittings')
  putDealerFittings(parts)
  return parts
}

/** Puts the fittings where they stand (they are in world metres). */
export function putDealerFittings(parts: Parts<'fittings'>) {
  parts.begin()
  parts.at(0, 0, 0)
  parts.put('fittings', 0, 0, 0)
  parts.end()
}
