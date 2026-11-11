import { describe, expect, it } from 'vitest'
import { BROWSE_SPOTS, CONTRACTOR_SPOT, COUNTER, DESK, ISLAND, MANAGER_SPOT, MARKET_WALKIN, PAY_SPOT, SHELF_RUN } from '../data/market'
import type { Box } from '../data/buildings'
import { LANE_ENDS, SHOP, VISITOR, WALK_Z } from './data'
import { contractorComes, contractorLeaves, laneEnd, managerLeaves, payPlace, scriptSeconds, shopperIn, shopperOut, shopperPay, stepScript, walker, type Step } from './script'

// The movement scripts (src/farm/script.ts): a walker goes through its steps at its speed, the same however the
// frames fall; and the ways made from the market's row keep a body clear of what stands in the hall.

const speed = VISITOR.speed

describe('stepScript', () => {
  it('walks to each point at its speed, then waits facing the way given, in its pose, and says when it is done', () => {
    const w = walker(0, 0, 0, [{ to: { x: 3, z: 4 } }, { wait: 2, face: Math.PI, pose: 'browse' }])
    expect(stepScript(w, 2.5, 1)).toBe(false)
    expect([w.x, w.z, w.walking]).toEqual([1.5, 2, true])
    expect(stepScript(w, 3, 1)).toBe(false) // 2.5 s more to the point, then half a second of the wait
    expect([w.x, w.z, w.walking, w.pose, w.at]).toEqual([3, 4, false, 'browse', 1])
    expect(w.waited).toBeCloseTo(0.5)
    expect(stepScript(w, 1.4, 1)).toBe(false)
    expect(stepScript(w, 0.2, 1)).toBe(true)
    expect(w.heading).toBeCloseTo(Math.PI)
    expect(w.walking).toBe(false)
    // done stays done
    expect(stepScript(w, 5, 1)).toBe(true)
  })

  it('one long step ends where many short ones do (time away, a page hidden)', () => {
    const steps: Step[] = [{ to: { x: 2, z: 0 } }, { wait: 1.5, pose: 'wave' }, { to: { x: 2, z: -3 } }, { to: { x: -1, z: -3 } }, { wait: 0.7 }]
    for (const total of [0.3, 1.9, 3.6, 5, 9.2, 30]) {
      const once = walker(0, 0, 0, steps)
      const frames = walker(0, 0, 0, steps)
      const doneOnce = stepScript(once, total, speed)
      let doneFrames = false
      for (let t = 0; t < total - 1e-9; t += 0.1) doneFrames = stepScript(frames, Math.min(0.1, total - t), speed)
      expect([once.at, doneOnce], String(total)).toEqual([frames.at, doneFrames])
      expect(once.x).toBeCloseTo(frames.x, 6)
      expect(once.z).toBeCloseTo(frames.z, 6)
    }
  })

  it('nothing to do, no time, or a step to where it stands: no trouble', () => {
    expect(stepScript(walker(1, 1, 0, []), 1, speed)).toBe(true)
    const w = walker(1, 1, 0, [{ to: { x: 1, z: 1 } }, { wait: 0 }, { to: { x: 2, z: 1 } }])
    expect(stepScript(w, 0, speed)).toBe(false)
    expect(w.at).toBe(2)
    expect(stepScript(w, -1, speed)).toBe(false)
    expect(stepScript(w, NaN, speed)).toBe(false)
    expect(stepScript(w, 10, speed)).toBe(true)
    expect([w.x, w.z]).toEqual([2, 1])
  })
})

/** Every point a script's walker passes, 5 cm apart, from where it starts. */
function trail(x: number, z: number, steps: Step[]) {
  const out: { x: number; z: number }[] = []
  let at = { x, z }
  for (const s of steps) {
    if (!('to' in s)) continue
    const n = Math.max(1, Math.ceil(Math.hypot(s.to.x - at.x, s.to.z - at.z) / 0.05))
    for (let k = 0; k <= n; k++) out.push({ x: at.x + ((s.to.x - at.x) * k) / n, z: at.z + ((s.to.z - at.z) * k) / n })
    at = s.to
  }
  return out
}
/** A body's half width: a person walking keeps this clear of everything. */
const BODY = 0.2
const inside = (p: { x: number; z: number }, b: Pick<Box, 'x0' | 'x1' | 'z0' | 'z1'>, grow: number) => p.x > b.x0 - grow && p.x < b.x1 + grow && p.z > b.z0 - grow && p.z < b.z1 + grow
const FITTINGS = { counter: COUNTER, shelves: SHELF_RUN, island: ISLAND, desk: DESK }
/** What a walker bumps into on its way: a fitting or a wall within a body's width. */
function bumps(x: number, z: number, steps: Step[]) {
  const hits = new Set<string>()
  for (const p of trail(x, z, steps)) {
    for (const [name, b] of Object.entries(FITTINGS)) if (inside(p, b, BODY)) hits.add(name)
    // (a lintel over a doorway is overhead)
    MARKET_WALKIN.walls.forEach((b, k) => b.y0 <= 0 && inside(p, b, BODY) && hits.add(`wall ${k}`))
  }
  return [...hits]
}
/** Where a script leaves its walker. */
const endOf = (x: number, z: number, steps: Step[]) => {
  const w = walker(x, z, 0, steps)
  stepScript(w, 1e6, speed)
  return w
}

describe('the ways through the market', () => {
  it('a shopper comes in from either end of the lane to their browse spot and browses there, facing the shelves', () => {
    BROWSE_SPOTS.forEach((spot, k) => {
      for (const side of [0, 1] as const) {
        const start = laneEnd(side)
        expect(start).toEqual({ x: LANE_ENDS[side], z: WALK_Z })
        const steps = shopperIn(k)
        expect(bumps(start.x, start.z, steps), `spot ${k}`).toEqual([])
        const w = endOf(start.x, start.z, steps)
        expect([w.x, w.z]).toEqual([spot.x, spot.z])
        expect(w.heading).toBeCloseTo(spot.heading)
        expect(steps[steps.length - 1]).toEqual({ wait: SHOP.browse, face: spot.heading, pose: 'browse' })
      }
    })
  })

  it('to pay: to their place in the line, a wait for each ahead, then at the counter; and out to the lane', () => {
    BROWSE_SPOTS.forEach((spot, k) => {
      for (let ahead = 0; ahead < 4; ahead++) {
        const pay = shopperPay(k, ahead)
        expect(bumps(spot.x, spot.z, pay), `spot ${k}, ${ahead} ahead`).toEqual([])
        const w = endOf(spot.x, spot.z, pay)
        expect([w.x, w.z, w.pose]).toEqual([PAY_SPOT.x, PAY_SPOT.z, 'pay'])
        expect(scriptSeconds(spot.x, spot.z, pay, speed)).toBeGreaterThanOrEqual((ahead + 1) * SHOP.pay)
      }
      for (const side of [0, 1] as const) {
        const paid = shopperOut(k, true, side)
        expect(bumps(PAY_SPOT.x, PAY_SPOT.z, paid)).toEqual([])
        expect(endOf(PAY_SPOT.x, PAY_SPOT.z, paid)).toMatchObject(laneEnd(side))
        const none = shopperOut(k, false, side)
        expect(bumps(spot.x, spot.z, none)).toEqual([])
        expect(endOf(spot.x, spot.z, none)).toMatchObject(laneEnd(side))
      }
    })
    // the line goes east behind the one paying, each looking up it
    expect(payPlace(0)).toEqual({ x: PAY_SPOT.x, z: PAY_SPOT.z, heading: PAY_SPOT.heading })
    expect(payPlace(2).x).toBeGreaterThan(payPlace(1).x)
    expect(payPlace(2).heading).toBeCloseTo(-Math.PI / 2)
  })

  it('the manager waves, then goes through the doorway and out of the front door to the lane', () => {
    const steps = managerLeaves()
    expect(steps[0]).toEqual({ wait: 2, face: MANAGER_SPOT.heading, pose: 'wave' })
    expect(bumps(MANAGER_SPOT.x, MANAGER_SPOT.z, steps)).toEqual([])
    expect(endOf(MANAGER_SPOT.x, MANAGER_SPOT.z, steps)).toMatchObject(laneEnd(1))
  })

  it('the contractor walks off within the first minute of the night, and back to his window within the first of the morning', () => {
    const away = contractorLeaves()
    expect(away[0]).toMatchObject({ pose: 'wave' })
    expect(endOf(CONTRACTOR_SPOT.x, CONTRACTOR_SPOT.z, away)).toMatchObject(laneEnd(1))
    expect(scriptSeconds(CONTRACTOR_SPOT.x, CONTRACTOR_SPOT.z, away, speed)).toBeLessThan(60)
    const end = laneEnd(1)
    const back = contractorComes()
    const w = endOf(end.x, end.z, back)
    expect([w.x, w.z]).toEqual([CONTRACTOR_SPOT.x, CONTRACTOR_SPOT.z])
    expect(w.heading).toBeCloseTo(CONTRACTOR_SPOT.heading)
    expect(scriptSeconds(end.x, end.z, back, speed)).toBeLessThan(60)
    // outside the market's walls all the way
    expect(bumps(CONTRACTOR_SPOT.x, CONTRACTOR_SPOT.z, away).filter((h) => h.startsWith('wall'))).toEqual([])
  })
})
