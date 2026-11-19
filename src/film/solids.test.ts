import { describe, expect, it } from 'vitest'
import { lintStage } from './checks'
import { timeline, type Film } from './format'
import { memberAt } from './stage'
import { crosses, gap, route, solidsOf, type Solid } from './solids'
import { SUPERMARKET } from './supermarket'

// The films' sets have solids (./solids.ts): a walk goes round them, and ./checks.ts reports whoever still ends up in one
// (the user's note on the shop's film: people walked through walls and things).

const BOX: Solid = { name: 'a box', x0: -1, x1: 1, z0: -1, z1: 1 }

describe('a walk round the set', () => {
  it('goes straight where the way is clear, round the corners where it is not', () => {
    expect(route({ x: -3, z: 2 }, { x: 3, z: 2 }, [BOX], 0.2)).toEqual([{ x: 3, z: 2 }])
    const way = route({ x: -3, z: 0 }, { x: 3, z: 0 }, [BOX], 0.2)
    expect(way.length).toBeGreaterThan(1)
    expect(way.at(-1)).toEqual({ x: 3, z: 0 })
    // every leg clear of the box by the body's width
    const pts = [{ x: -3, z: 0 }, ...way]
    for (let i = 1; i < pts.length; i++) expect(crosses(pts[i - 1], pts[i], BOX, 0.19)).toBe(false)
  })

  it('walks out of a box it stands in, and into one it is sent to (a doorway, a nest)', () => {
    expect(route({ x: 0, z: 0 }, { x: 3, z: 0 }, [BOX], 0.2)).toEqual([{ x: 3, z: 0 }])
    expect(route({ x: 3, z: 0 }, { x: 0.5, z: 0 }, [BOX], 0.2)).toEqual([{ x: 0.5, z: 0 }])
  })

  it('a film’s walk across a wall goes through its doorway', () => {
    // from the shop's hall into the manager's room: the doorway in the wall between
    const film: Film = {
      ...SUPERMARKET,
      cast: { guy: { name: 'Guy', look: 'contractor', at: { x: 10.6, z: 19.2 } } },
      props: {},
      scenes: [{ place: 'market', light: 'noon', shots: [{ len: 6, cam: { on: 'guy' }, do: [{ at: 0, who: 'guy', to: { x: 12.6, z: 24.0 }, pace: 1.5 }] }] }],
    }
    const tl = timeline(film)
    const walls = solidsOf('market')
    for (let w = 0; w <= 6; w += 0.05) {
      const m = memberAt(tl, 'guy', w)
      for (const s of walls) expect(gap(m, s), `${s.name} at ${w.toFixed(2)} s`).toBeGreaterThan(0.1)
    }
    expect(memberAt(tl, 'guy', 6)).toMatchObject({ x: 12.6, z: 24.0 })
    expect(lintStage(film)).toEqual([])
  })
})

describe('the stage’s checks', () => {
  it('the shop’s film keeps them', () => {
    expect(lintStage(SUPERMARKET)).toEqual([])
  })

  it('find someone put in a wall, two walking through each other, and someone framed who is not there', () => {
    const film: Film = {
      ...SUPERMARKET,
      cast: {
        a: { name: 'A', look: 'manager', at: { x: 10, z: 22.95 } },
        b: { name: 'B', look: 'contractor', at: { x: 8, z: 18.6 } },
        c: { name: 'C', look: 'player', at: { x: 9, z: 18.6 }, off: true },
      },
      props: {},
      scenes: [{ place: 'market', light: 'noon', shots: [{ len: 3, cam: { on: 'c' }, do: [{ at: 0, who: 'b', to: { x: 10, z: 18.6 }, pace: 1 }] }] }],
    }
    const found = lintStage(film).join('\n')
    expect(found).toMatch(/A is in a wall/)
    expect(found).toMatch(/frames C, who is not on stage/)
  })
})
