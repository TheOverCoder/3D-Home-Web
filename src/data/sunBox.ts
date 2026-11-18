import type { Place } from '../farm/state'
import { SUN, SUN_SHADOW } from './layout'

// The sun's shadow box, map by map (update-v1/missions/11-buildings.md, foundation A). The sun's shadow camera stands
// at SUN × scale looking at the origin (src/scene/Lighting.tsx) and sees a box in its own view: from `left` to `right`
// across the sunlight (left is the south-west, right the north-east on the ground) and from `bottom` to `top` (bottom
// the south-east, top the north-west), the bounds three's OrthographicCamera takes. A surface outside the box is drawn
// as if nothing shaded it, so whatever must be shaded (a floor under a roof) has to stand inside (src/data/sunCheck.ts).
//
// Both maps use today's box, ±SUN_SHADOW.half (12 m) each way. The farm's planned box reaches 16 m to the south-west
// and south-east, over the lot beyond the lane, so the walk-in buildings there can grow; its map takes as many more
// texels as the box is wider, so a texel stays as small and no shadow gets softer. Nothing draws with it yet:
// Lighting.tsx and inSunShadow still use SUN_SHADOW.

/** A shadow box in the light's view, in metres from the point it looks at (the origin): three's own bounds. */
export interface SunBox {
  left: number
  right: number
  bottom: number
  top: number
}

/** Today's box, the same on both maps: ±SUN_SHADOW.half each way. */
export const TODAY_SUN_BOX: SunBox = { left: -SUN_SHADOW.half, right: SUN_SHADOW.half, bottom: -SUN_SHADOW.half, top: SUN_SHADOW.half }

/** The farm's box as planned: 4 m more to the south-west (left) and the south-east (bottom), today's on the other two
 *  sides. 28 m a side. */
export const FARM_SUN_BOX_PLANNED: SunBox = { left: -16, right: SUN_SHADOW.half, bottom: -16, top: SUN_SHADOW.half }

/** The box each map draws its sun's shadows in now. */
export const SUN_BOXES: Record<Place, SunBox> = { farm: TODAY_SUN_BOX, home: TODAY_SUN_BOX }

// the shadow camera's axes, as three's lookAt makes them: z towards the sun, x level (up × z), y = z × x
const L = Math.hypot(SUN[0], SUN[1], SUN[2])
const DX = SUN[0] / L
const DY = SUN[1] / L
const DZ = SUN[2] / L
const H = Math.hypot(DX, DZ)
const AX = DZ / H
const AZ = -DX / H
/** How far the shadow camera stands from the origin, along the sunlight. */
const EYE = L * SUN_SHADOW.scale

/** A world point in the light's view: across the sunlight (`u`, three's x), up its view (`v`, three's y), and how far
 *  in front of the shadow camera (`depth`). */
export function lightView(x: number, y: number, z: number): { u: number; v: number; depth: number } {
  return {
    u: x * AX + z * AZ,
    v: x * (DY * AZ) + y * (DZ * AX - DX * AZ) + z * (-DY * AX),
    depth: EYE - (x * DX + y * DY + z * DZ),
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

/** The texels a side a box's map needs to be as sharp as today's at `today` texels (2048, or 1024 on a light tier):
 *  as many more as its side is longer, rounded up to a multiple of 16. */
export const texelsFor = (box: SunBox, today: number) => Math.ceil((today * boxSide(box)) / boxSide(TODAY_SUN_BOX) / 16) * 16
