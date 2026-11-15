import { describe, expect, it } from 'vitest'
import { DOOR, DOORWAYS, WINDOWS } from '../data/layout'
import { portalsOf } from '../lib/visibility/portals'
import {
  OPENINGS,
  RUNS,
  adjacentOf,
  defaultShell,
  floorOf,
  gardenDoorOf,
  hingedDoorOf,
  openingProblem,
  openingRange,
  openingsOf,
  runById,
  sanitizeShell,
  slideOnRun,
  wallSegments,
  windowsOf,
  withOpening,
  type HomeShell,
} from './shell'

// The house's shell as the save has it (src/home/shell.ts): the default is the house as it was built, an opening slides
// only along the walls it may be in, never round a corner or over another, and a saved shell broken by hand loads as
// the house it can be.

const moved = (id: string, run: string, centre: number, closed = false): HomeShell => withOpening(defaultShell(), id, { run: run as never, centre, closed })

describe('the house as it was built', () => {
  it('every opening is where src/data/layout.ts has it, and fits', () => {
    const shell = defaultShell()
    for (const o of OPENINGS) expect(openingProblem(shell, o.id, shell.openings[o.id]), o.id).toBeNull()
    const placed = openingsOf(shell)
    for (const [id, d] of Object.entries(DOORWAYS)) expect(placed.find((o) => o.id === id)).toMatchObject({ axis: d.axis, at: d.at, centre: d.centre, width: d.width, closed: false })
    expect(windowsOf(shell)).toEqual(WINDOWS.map((w) => ({ ...w, door: w.door || undefined })))
    expect(gardenDoorOf(shell)).toMatchObject({ axis: 'x', at: 6, centre: -1.2 })
    // the kitchen's door hangs where it always did
    expect(hingedDoorOf(shell)?.hinge).toEqual(DOOR.hinge)
    expect(adjacentOf(shell)).toHaveLength(4)
    // twelve portals, the kitchen's door closing one
    expect(portalsOf(shell)).toHaveLength(12)
    expect(
      portalsOf(shell)
        .filter((p) => p.door)
        .map((p) => p.id),
    ).toEqual(['kitchenBedroom'])
  })

  it('the walls are cut where the openings are, and paint only the room’s own side', () => {
    const segs = wallSegments(defaultShell())
    // each wall piece's two faces: the inside of an outer wall its room's colour, the outside the same as it was built
    for (const s of segs.filter((q) => q.kind === 'wall')) expect(s.faces).toHaveLength(2)
    const painted = wallSegments({ ...defaultShell(), paint: { ...defaultShell().paint, living: 'sage' } })
    const living = painted.find((s) => s.key.startsWith('s-living'))!
    expect(living.faces).toEqual(['#b9cbb0', '#e0d8c9'])
    // the wall between the living room and the bedroom: the living room's side painted, the bedroom's as built
    const mid = painted.find((s) => s.key.startsWith('mid-x-s'))!
    expect(mid.faces).toEqual(['#b9cbb0', '#d6d2ca'])
  })
})

describe('where an opening may go', () => {
  it('a doorway slides along its own wall only, never round its ends', () => {
    expect(openingProblem(defaultShell(), 'livingOffice', { run: 'mid-w', centre: -5.4, closed: false })).toBeNull()
    expect(openingProblem(defaultShell(), 'livingOffice', { run: 'mid-e', centre: 3.5, closed: false })).toBe('Not on that wall')
    expect(openingProblem(defaultShell(), 'livingOffice', { run: 'mid-w', centre: -0.5, closed: false })).toBe('Too near the corner')
    const [lo, hi] = openingRange('livingOffice', runById('mid-w')!)
    expect(openingProblem(defaultShell(), 'livingOffice', { run: 'mid-w', centre: lo, closed: false })).toBeNull()
    expect(openingProblem(defaultShell(), 'livingOffice', { run: 'mid-w', centre: hi, closed: false })).toBeNull()
  })

  it('a window goes round the corner of its room, onto its other outer wall, and never over another opening', () => {
    expect(OPENINGS.find((o) => o.id === 'win-kitchen-north')!.runs.sort()).toEqual(['e-kitchen', 'n-kitchen'])
    expect(openingProblem(defaultShell(), 'win-kitchen-north', { run: 'e-kitchen', centre: -4.8, closed: false })).toBeNull()
    expect(openingProblem(defaultShell(), 'win-kitchen-north', { run: 'e-kitchen', centre: -2.6, closed: false })).toBe('On the window')
    expect(openingProblem(defaultShell(), 'win-kitchen-north', { run: 's-bedroom', centre: 4, closed: false })).toBe('Not on that wall')
    // closed, another may go where it was
    const shut = moved('win-kitchen-east', 'e-kitchen', -2.6, true)
    expect(openingProblem(shut, 'win-kitchen-north', { run: 'e-kitchen', centre: -2.6, closed: false })).toBeNull()
  })

  it('the garden door moves to the living room’s west wall too, its leaves never past the house’s corner, and never closes', () => {
    expect(openingProblem(defaultShell(), 'garden-door', { run: 'w-living', centre: 3.2, closed: false })).toBe('On the window')
    const shell = moved('win-living-west', 'w-living', 1.1)
    expect(openingProblem(shell, 'garden-door', { run: 'w-living', centre: 3.9, closed: false })).toBeNull()
    // its pocket would reach out past the corner
    expect(openingProblem(defaultShell(), 'garden-door', { run: 's-living', centre: -6.0, closed: false })).toBe('Too near the corner')
    expect(openingProblem(defaultShell(), 'garden-door', { run: 's-living', centre: -1.2, closed: true })).toBe('The way in stays open')
  })

  it('sliding snaps to 10 cm and stays in the wall’s range; the kitchen’s door goes with its doorway, and away with it', () => {
    const s = slideOnRun('win-living-west', runById('w-living')!, -6.5, 2.34)
    expect(s.centre).toBe(2.3)
    expect(slideOnRun('win-living-west', runById('w-living')!, -6.5, 99).centre).toBeLessThan(6)
    expect(hingedDoorOf(moved('kitchenBedroom', 'mid-e', 2.0))!.hinge).toEqual([1.2, 0, 0])
    expect(hingedDoorOf(moved('kitchenBedroom', 'mid-e', 3.5, true))).toBeNull()
    // a closed doorway is wall: no portal, no gap, the rooms no longer share their light
    const shut = moved('livingBedroom', 'mid-s', 3, true)
    expect(portalsOf(shut).map((p) => p.id)).not.toContain('livingBedroom')
    expect(adjacentOf(shut)).toHaveLength(3)
    expect(wallSegments(shut).filter((q) => q.key.startsWith('mid-x-s'))).toHaveLength(1)
  })
})

describe('a saved shell edited by hand', () => {
  it('garbage gives the house as built; never throws', () => {
    for (const raw of [null, 7, 'x', [], { openings: 'x', paint: [], floors: 3 }, { openings: { __proto__: { run: 'mid-w' } } }]) expect(sanitizeShell(raw)).toEqual(defaultShell())
  })

  it('an opening off its wall, on a wall it may not be on, over another or as a string stands where it was built', () => {
    const raw = {
      openings: {
        livingOffice: { run: 'mid-w', centre: 1e308, closed: false },
        officeKitchen: { run: 'n-office', centre: -3, closed: false },
        'win-office-west': { run: 'w-office', centre: 'here' },
        'win-kitchen-north': { run: 'e-kitchen', centre: -2.6, closed: false },
        livingBedroom: { run: 'mid-s', centre: 2.4, closed: true },
        'garden-door': { run: 's-living', centre: -3, closed: true },
      },
    }
    const out = sanitizeShell(raw)
    const built = defaultShell().openings
    expect(out.openings.livingOffice).toEqual(built.livingOffice)
    expect(out.openings.officeKitchen).toEqual(built.officeKitchen)
    expect(out.openings['win-office-west']).toEqual(built['win-office-west'])
    // over the east window: back where it was built
    expect(out.openings['win-kitchen-north']).toEqual(built['win-kitchen-north'])
    // what fits stays as saved; the garden door never closed
    expect(out.openings.livingBedroom).toEqual({ run: 'mid-s', centre: 2.4, closed: true })
    expect(out.openings['garden-door']).toEqual({ run: 's-living', centre: -3, closed: false })
  })

  it('an unknown paint is as built and an unknown floor the room’s own; known ones are kept', () => {
    const out = sanitizeShell({ paint: { living: 'sage', office: 'constructor', kitchen: 7, bedroom: '__proto__' }, floors: { living: 'slate-stone', office: 'lava', kitchen: null } })
    expect(out.paint).toEqual({ living: 'sage', office: null, kitchen: null, bedroom: null })
    expect(out.floors).toEqual({ living: 'slate-stone', office: 'oak', kitchen: 'pale-tile', bedroom: 'grey-carpet' })
    expect(floorOf(out, 'living').kind).toBe('stone')
  })

  it('every wall run is named once, and a changed shell saved and loaded again is the same shell', () => {
    expect(new Set(RUNS.map((r) => r.id)).size).toBe(RUNS.length)
    let shell = moved('win-living-west', 'w-living', 1.1)
    shell = withOpening(shell, 'garden-door', { run: 'w-living', centre: 3.9, closed: false })
    shell = withOpening(shell, 'officeKitchen', { run: 'mid-n', centre: -3, closed: true })
    shell = { ...shell, paint: { ...shell.paint, office: 'slate' }, floors: { ...shell.floors, office: 'walnut' } }
    expect(sanitizeShell(JSON.parse(JSON.stringify(shell)))).toEqual(shell)
  })
})
