import type { Place } from '../farm/state'
import { SUN, SUN_SHADOW } from './layout'

// The sun's shadow box, map by map (update-v1/missions/11-buildings.md, foundation A). The sun's shadow camera stands
// at SUN × scale looking at the origin (src/scene/Lighting.tsx) and sees a box in its own view: from `left` to `right`
// across the sunlight (left is the south-west, right the north-east on the ground) and from `bottom` to `top` (bottom
// the south-east, top the north-west), the bounds three's OrthographicCamera takes. A surface outside the box is drawn
// as if nothing shaded it, so whatever must be shaded (a floor under a roof) has to stand inside (src/data/sunCheck.ts),
// and whatever stands outside it casts nothing there (a soft shadow on the ground instead: `inSunShadow` in ./layout).
//
// The house keeps the box it always had, 12 m each way. The farm's reaches 16⅛ m to the south-west and the south-east,
// over the lot beyond the lane, so the walk-in buildings there can grow; its map takes as many more texels as its side
// is longer (`texelsFor`: 2048 → 2400, 1024 → 1200), so a texel is exactly as small as the house's and no shadow is
// softer — and the sun's copies, measured against that texel (src/lib/sculpt/lod.ts, SUN_TEXEL), hold on both maps.
//
// (./layout imports this file for `inSunShadow`, and this file reads SUN and SUN_SHADOW from it: nothing here reads
// them while the modules load, only when a function is called, so either may load first.)

/** A shadow box in the light's view, in metres from the point it looks at (the origin): three's own bounds. */
export interface SunBox {
  left: number
  right: number
  bottom: number
  top: number
}

/** The house's box, as both maps had it before: 12 m each way (SUN_SHADOW.half: sunBox.test.ts holds them equal). */
export const TODAY_SUN_BOX: SunBox = { left: -12, right: 12, bottom: -12, top: 12 }

/** The farm's box: 4⅛ m more to the south-west (left) and the south-east (bottom), the house's on the other two sides.
 *  28⅛ m a side: 2400 texels of today's 11.7 mm (24 m at 2048) exactly. */
export const FARM_SUN_BOX: SunBox = { left: -16.125, right: 12, bottom: -16.125, top: 12 }

/** The farm's box as mission 11 planned it, now the farm's own (src/data/lotPlan.ts and src/farm/park.ts are checked
 *  against it). */
export const FARM_SUN_BOX_PLANNED = FARM_SUN_BOX

/** The box each map draws its sun's shadows in. */
export const SUN_BOXES: Record<Place, SunBox> = { farm: FARM_SUN_BOX, home: TODAY_SUN_BOX }

// the shadow camera's axes, as three's lookAt makes them: z towards the sun, x level (up × z), y = z × x; and how far
// it stands from the origin, along the sunlight (worked out on first use: see above)
let axes: { dx: number; dy: number; dz: number; ax: number; az: number; eye: number } | null = null
function sunAxes() {
  if (axes) return axes
  const l = Math.hypot(SUN[0], SUN[1], SUN[2])
  const dx = SUN[0] / l
  const dy = SUN[1] / l
  const dz = SUN[2] / l
  const h = Math.hypot(dx, dz)
  axes = { dx, dy, dz, ax: dz / h, az: -dx / h, eye: l * SUN_SHADOW.scale }
  return axes
}

/** A world point in the light's view: across the sunlight (`u`, three's x), up its view (`v`, three's y), and how far
 *  in front of the shadow camera (`depth`). */
export function lightView(x: number, y: number, z: number): { u: number; v: number; depth: number } {
  const { dx, dy, dz, ax, az, eye } = sunAxes()
  return {
    u: x * ax + z * az,
    v: x * (dy * az) + y * (dz * ax - dx * az) + z * (-dy * ax),
    depth: eye - (x * dx + y * dy + z * dz),
  }
}

/** How far a world point is inside a box, in metres (below 0: outside), its sides and its near and far planes. */
export function boxMargin(x: number, y: number, z: number, box: SunBox): number {
  const { u, v, depth } = lightView(x, y, z)
  return Math.min(u - box.left, box.right - u, v - box.bottom, box.top - v, depth - SUN_SHADOW.near, SUN_SHADOW.far - depth)
}

/** Whether the box's sides hold the point at least `margin` metres in (as inSunShadow, for any box). */
export function inBox(x: number, y: number, z: number, box: SunBox, margin = 0): boolean {
  const { u, v } = lightView(x, y, z)
  return u >= box.left + margin && u <= box.right - margin && v >= box.bottom + margin && v <= box.top - margin
}

/** A box's longer side, metres. */
export const boxSide = (box: SunBox) => Math.max(box.right - box.left, box.top - box.bottom)

/** The texels a side a box's map needs to be as sharp as the house's at `today` texels (2048, or 1024 on a light tier):
 *  as many more as its side is longer, rounded up to a multiple of 16. */
export const texelsFor = (box: SunBox, today: number) => Math.ceil((today * boxSide(box)) / boxSide(TODAY_SUN_BOX) / 16) * 16
