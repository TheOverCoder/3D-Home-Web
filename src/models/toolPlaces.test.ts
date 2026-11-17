import { beforeAll, describe, expect, it } from 'vitest'
import { loadSolids } from '../lib/sculpt'
import { TOOLS, TOOL_KINDS } from '../farm/data'
import { PLACES } from '../farm/layout'
import { TOOL_PLACES, TOOL_STYLES, modelBox, nestSpots, placedBox, placedPoint, toolModel, type Bounds } from './tools'

// The animals' tools at their fences (src/models/tools.ts, TOOL_PLACES; drawn by src/farm/ToolStands.tsx): every skin
// of each stands inside its place's footprint (PLACES in src/farm/layout.ts, which the edit mode keeps other things off)
// and out of the place's way in; its row (TOOLS in src/farm/data.ts) stands you in front of the deepest skin, clear of
// it, and looks at its middle; the coop's six nests lie in its box.

beforeAll(async () => {
  await loadSolids()
})

/** Less than this is touching, not overlapping. */
const EPS = 1e-3
const boxOf = (kind: (typeof TOOL_KINDS)[number], style: (typeof TOOL_STYLES)[number]) => placedBox(TOOLS[kind].look, modelBox(toolModel(TOOLS[kind].look, style)))
/** How far a point is from a box on the ground (0 inside it). */
const groundGap = (b: Bounds, x: number, z: number) => Math.hypot(Math.max(0, b.min[0] - x, x - b.max[0]), Math.max(0, b.min[2] - z, z - b.max[2]))

describe("the animals' tools at their fences", () => {
  it.each(TOOL_KINDS.flatMap((kind) => TOOL_STYLES.map((style) => [kind, style] as const)))('the %s’ tool, skin %s: inside its place’s footprint, out of its way in', (kind, style) => {
    const { place } = TOOL_PLACES[TOOLS[kind].look]
    const b = boxOf(kind, style)
    const local = PLACES[place].local
    expect(b.min[0], 'west').toBeGreaterThanOrEqual(local.minX - EPS)
    expect(b.max[0], 'east').toBeLessThanOrEqual(local.maxX + EPS)
    expect(b.min[2], 'north').toBeGreaterThanOrEqual(local.minZ - EPS)
    expect(b.max[2], 'south').toBeLessThanOrEqual(local.maxZ + EPS)
    expect(b.min[1], 'on the ground').toBeGreaterThan(-0.01)
    const door = PLACES[place].door!
    const overlaps = b.min[0] < door.maxX - EPS && b.max[0] > door.minX + EPS && b.min[2] < door.maxZ - EPS && b.max[2] > door.minZ + EPS
    expect(overlaps, `in the way into the ${place}`).toBe(false)
  })

  it.each(TOOL_KINDS)('the %s’ tool: you stand in front of every skin, clear of it, and look at its middle', (kind) => {
    const [sx, , sz] = TOOLS[kind].stand
    const [ax, ay, az] = TOOLS[kind].aim
    for (const style of TOOL_STYLES) {
      const b = boxOf(kind, style)
      const gap = groundGap(b, sx, sz)
      // (room for the player, and near enough that the tool fills the view)
      expect(gap, `${style}: from where you stand`).toBeGreaterThanOrEqual(0.45)
      expect(gap, `${style}: from where you stand`).toBeLessThanOrEqual(1.1)
      expect(groundGap(b, ax, az), `${style}: what you look at`).toBe(0)
      expect(ay, `${style}: what you look at`).toBeGreaterThan(b.min[1])
      expect(ay, `${style}: what you look at`).toBeLessThan(b.max[1])
      // within its reach from where you stand, with a step to spare
      expect(Math.hypot(ax - sx, az - sz) + 0.5).toBeLessThanOrEqual(TOOLS[kind].reach)
    }
  })

  it.each(TOOL_STYLES)('the coop, skin %s: a nest for each of the six hens, each in the coop', (style) => {
    const b = boxOf('hens', style)
    const spots = nestSpots(style)
    expect(spots).toHaveLength(6)
    for (const s of spots) {
      const [x, y, z] = placedPoint('nests', s)
      expect(groundGap(b, x, z)).toBe(0)
      expect(y).toBeGreaterThan(b.min[1])
      expect(y).toBeLessThan(b.max[1])
    }
  })
})
