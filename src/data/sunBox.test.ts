import { OrthographicCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { SUN, SUN_SHADOW, inSunShadow } from './layout'
import { FARM_SUN_BOX_PLANNED, SUN_BOXES, TODAY_SUN_BOX, boxMargin, boxSide, inBox, lightView, texelsFor, type SunBox } from './sunBox'

// The sun's shadow box map by map (./sunBox.ts): its bounds are three's own (a camera made as src/scene/Lighting.tsx
// makes the sun's sees what they say), today's box is the one inSunShadow knows, and the farm's planned box holds all of
// today's and is as sharp.

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
  it("is today's on both maps, for now", () => {
    expect(SUN_BOXES.farm).toBe(TODAY_SUN_BOX)
    expect(SUN_BOXES.home).toBe(TODAY_SUN_BOX)
    expect(TODAY_SUN_BOX).toEqual({ left: -SUN_SHADOW.half, right: SUN_SHADOW.half, bottom: -SUN_SHADOW.half, top: SUN_SHADOW.half })
  })

  it("with today's box, inBox says what inSunShadow says, with and without a margin", () => {
    for (const [x, y, z] of POINTS) {
      expect(inBox(x, y, z, TODAY_SUN_BOX), `${x}, ${y}, ${z}`).toBe(inSunShadow(x, y, z))
      expect(inBox(x, y, z, TODAY_SUN_BOX, 1.5), `${x}, ${y}, ${z}`).toBe(inSunShadow(x, y, z, 1.5))
    }
  })

  for (const [name, box] of [
    ['today', TODAY_SUN_BOX],
    ['the farm as planned', FARM_SUN_BOX_PLANNED],
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

  it("the farm's planned box: left the south-west and bottom the south-east, so it reaches over the lot", () => {
    // the lot beyond the lane, south of the market: outside today's box, inside the planned one
    for (const [x, z] of [
      [0.2, 19.9],
      [16.45, 22.9],
      [14, 25.6],
    ]) {
      expect(inBox(x, 0, z, TODAY_SUN_BOX), `${x}, ${z} today`).toBe(false)
      expect(inBox(x, 0, z, FARM_SUN_BOX_PLANNED), `${x}, ${z} planned`).toBe(true)
    }
    // the south-west is less u, the south-east less v
    expect(lightView(-10, 0, 10).u).toBeLessThan(lightView(0, 0, 0).u)
    expect(lightView(10, 0, 10).v).toBeLessThan(lightView(0, 0, 0).v)
  })

  it("the farm's planned box holds all of today's: every point today's sides hold, it holds", () => {
    expect(FARM_SUN_BOX_PLANNED.left).toBeLessThanOrEqual(TODAY_SUN_BOX.left)
    expect(FARM_SUN_BOX_PLANNED.bottom).toBeLessThanOrEqual(TODAY_SUN_BOX.bottom)
    expect(FARM_SUN_BOX_PLANNED.right).toBeGreaterThanOrEqual(TODAY_SUN_BOX.right)
    expect(FARM_SUN_BOX_PLANNED.top).toBeGreaterThanOrEqual(TODAY_SUN_BOX.top)
    let held = 0
    for (const [x, y, z] of POINTS)
      if (inBox(x, y, z, TODAY_SUN_BOX)) {
        held++
        expect(inBox(x, y, z, FARM_SUN_BOX_PLANNED), `${x}, ${y}, ${z}`).toBe(true)
      }
    expect(held, 'points inside today’s box to prove it on').toBeGreaterThan(50)
  })

  it("is 28 m a side with 7/6 the texels, so a texel is no bigger than today's", () => {
    expect(boxSide(TODAY_SUN_BOX)).toBe(24)
    expect(boxSide(FARM_SUN_BOX_PLANNED)).toBe(28)
    expect(texelsFor(TODAY_SUN_BOX, 2048)).toBe(2048)
    expect(texelsFor(TODAY_SUN_BOX, 1024)).toBe(1024)
    expect(texelsFor(FARM_SUN_BOX_PLANNED, 2048)).toBe(2400)
    expect(texelsFor(FARM_SUN_BOX_PLANNED, 1024)).toBe(1200)
    for (const today of [1024, 2048]) expect(boxSide(FARM_SUN_BOX_PLANNED) / texelsFor(FARM_SUN_BOX_PLANNED, today)).toBeLessThanOrEqual(boxSide(TODAY_SUN_BOX) / today)
  })
})
