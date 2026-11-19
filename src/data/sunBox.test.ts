import { OrthographicCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { SUN, SUN_SHADOW, inSunShadow } from './layout'
import { FARM_SUN_BOX, SUN_BOXES, TODAY_SUN_BOX, boxMargin, boxSide, inBox, lightView, texelsFor, type SunBox } from './sunBox'
import { HOME_LAND, PARCELS } from '../farm/layout'
import { FINEST_SHADOW_MAP } from '../lib/profile'
import { SUN_TEXEL } from '../lib/sculpt/lod'

// The sun's shadow box map by map (./sunBox.ts): its bounds are three's own (a camera made as src/scene/Lighting.tsx
// makes the sun's sees what they say), the house keeps the box it always had, and the farm's holds all of it, reaches
// over the lot and is exactly as sharp.

/** The sun's shadow camera with a box's bounds, made as Lighting.tsx makes it. */
function cameraOf(box: SunBox) {
  const cam = new OrthographicCamera(box.left, box.right, box.top, box.bottom, SUN_SHADOW.near, SUN_SHADOW.far)
  cam.position.set(SUN[0] * SUN_SHADOW.scale, SUN[1] * SUN_SHADOW.scale, SUN[2] * SUN_SHADOW.scale)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  return cam
}

/** Points over the farm and the lot, from the ground up to 6 m. */
const POINTS = Array.from({ length: 400 }, (_, k) => [-30 + ((k * 37) % 70) + 0.31, (k % 7) * 0.9, -30 + ((k * 53) % 70) + 0.17] as const)

describe('the sun box', () => {
  it("is the house's as it always was, and the farm's own on the farm", () => {
    expect(SUN_BOXES.home).toBe(TODAY_SUN_BOX)
    expect(SUN_BOXES.farm).toBe(FARM_SUN_BOX)
    expect(TODAY_SUN_BOX).toEqual({ left: -SUN_SHADOW.half, right: SUN_SHADOW.half, bottom: -SUN_SHADOW.half, top: SUN_SHADOW.half })
  })

  it('inSunShadow asks the box of the map it is told, the farm’s unless told, with and without a margin', () => {
    for (const [x, y, z] of POINTS) {
      for (const place of ['farm', 'home'] as const) {
        expect(inSunShadow(x, y, z, 0, place), `${place} ${x}, ${y}, ${z}`).toBe(inBox(x, y, z, SUN_BOXES[place]))
        expect(inSunShadow(x, y, z, 1.5, place), `${place} ${x}, ${y}, ${z}`).toBe(inBox(x, y, z, SUN_BOXES[place], 1.5))
      }
      expect(inSunShadow(x, y, z)).toBe(inSunShadow(x, y, z, 0, 'farm'))
      expect(inSunShadow(x, y, z, 1.5)).toBe(inSunShadow(x, y, z, 1.5, 'farm'))
    }
  })

  for (const [name, box] of [
    ['the house', TODAY_SUN_BOX],
    ['the farm', FARM_SUN_BOX],
  ] as const)
    it(`${name}: the light's view and the margin are three's camera's (its bounds mean what three means)`, () => {
      const cam = cameraOf(box)
      for (const [x, y, z] of POINTS) {
        const v = new Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse)
        const view = lightView(x, y, z)
        expect(view.u).toBeCloseTo(v.x, 9)
        expect(view.v).toBeCloseTo(v.y, 9)
        expect(view.depth).toBeCloseTo(-v.z, 9)
        const margin = Math.min(v.x - box.left, box.right - v.x, v.y - box.bottom, box.top - v.y, -v.z - SUN_SHADOW.near, SUN_SHADOW.far + v.z)
        expect(boxMargin(x, y, z, box)).toBeCloseTo(margin, 9)
        // and three's projection puts the point inside its clip square exactly where the box's sides hold it
        const ndc = new Vector3(x, y, z).project(cam)
        expect(Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1, `${x}, ${y}, ${z}`).toBe(inBox(x, y, z, box))
      }
    })

  it("the farm's box: left the south-west and bottom the south-east, so it reaches over the lot", () => {
    // the lot beyond the lane, south of the market: outside the house's box, inside the farm's
    for (const [x, z] of [
      [0.2, 19.9],
      [16.45, 22.9],
      [14, 25.6],
    ]) {
      expect(inBox(x, 0, z, TODAY_SUN_BOX), `${x}, ${z} the house's`).toBe(false)
      expect(inBox(x, 0, z, FARM_SUN_BOX), `${x}, ${z} the farm's`).toBe(true)
    }
    // the south-west is less u, the south-east less v
    expect(lightView(-10, 0, 10).u).toBeLessThan(lightView(0, 0, 0).u)
    expect(lightView(10, 0, 10).v).toBeLessThan(lightView(0, 0, 0).v)
  })

  it("the farm's box holds all of the house's: every point its sides hold, the farm's hold", () => {
    expect(FARM_SUN_BOX.left).toBeLessThanOrEqual(TODAY_SUN_BOX.left)
    expect(FARM_SUN_BOX.bottom).toBeLessThanOrEqual(TODAY_SUN_BOX.bottom)
    expect(FARM_SUN_BOX.right).toBeGreaterThanOrEqual(TODAY_SUN_BOX.right)
    expect(FARM_SUN_BOX.top).toBeGreaterThanOrEqual(TODAY_SUN_BOX.top)
    let held = 0
    for (const [x, y, z] of POINTS)
      if (inBox(x, y, z, TODAY_SUN_BOX)) {
        held++
        expect(inBox(x, y, z, FARM_SUN_BOX), `${x}, ${y}, ${z}`).toBe(true)
      }
    expect(held, 'points inside the house’s box to prove it on').toBeGreaterThan(50)
  })

  it("is 28⅛ m a side with 75/64 the texels, so a texel is exactly the house's on every tier, and the sun's copies' texel", () => {
    expect(boxSide(TODAY_SUN_BOX)).toBe(24)
    expect(boxSide(FARM_SUN_BOX)).toBe(28.125)
    expect(texelsFor(TODAY_SUN_BOX, 2048)).toBe(2048)
    expect(texelsFor(TODAY_SUN_BOX, 1024)).toBe(1024)
    expect(texelsFor(FARM_SUN_BOX, 2048)).toBe(2400)
    expect(texelsFor(FARM_SUN_BOX, 1024)).toBe(1200)
    for (const today of [1024, 2048]) expect(boxSide(FARM_SUN_BOX) / texelsFor(FARM_SUN_BOX, today)).toBe(boxSide(TODAY_SUN_BOX) / today)
    // the copies for the sun are measured against the finest texel there is (src/lib/sculpt/lod.ts): the farm's finest
    // is no finer
    expect(boxSide(FARM_SUN_BOX) / texelsFor(FARM_SUN_BOX, FINEST_SHADOW_MAP)).toBe(SUN_TEXEL)
  })

  it("on the farm's land, every point its sides hold is between its near and far planes: inSunShadow's sides are the whole test there", () => {
    // the land the farm can own (the garden and every meadow), from the ground up to 6 m (a tree in a pot, a lamp)
    let held = 0
    for (const r of [HOME_LAND, ...Object.values(PARCELS).map((p) => p.rect)])
      for (let x = r.minX; x <= r.maxX; x += 0.5)
        for (let z = r.minZ; z <= r.maxZ; z += 0.5)
          for (let y = 0; y <= 6; y++) {
            if (!inBox(x, y, z, FARM_SUN_BOX)) continue
            held++
            const { depth } = lightView(x, y, z)
            expect(depth, `${x}, ${y}, ${z}`).toBeGreaterThanOrEqual(SUN_SHADOW.near)
            expect(depth, `${x}, ${y}, ${z}`).toBeLessThanOrEqual(SUN_SHADOW.far)
          }
    expect(held).toBeGreaterThan(10_000)
  })
})
