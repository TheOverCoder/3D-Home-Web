import { describe, expect, it } from 'vitest'
import { XP_FOR } from '../farm/data'
import { BUCKET } from './bucket'
import { COOP } from './coop'
import { lint, timeline, type Film } from './format'
import { memberAt, propAt } from './stage'
import { markOf, PEN } from './set'
import { SHEARS } from './shears'

// The animal tools' three films (plans/animal-tools.md §4: ./coop.ts, ./bucket.ts, ./shears.ts): each keeps lab/FILM.md's
// countable rules and the plan's size (15–20 s, 6–8 shots), plays in the pen with its own herd, and ends on the tool's
// card with the build's XP; the herd's walks end where they were sent, and the tool's pieces stand by its end.

const FILMS: [string, Film][] = [
  ['coop', COOP],
  ['bucket', BUCKET],
  ['shears', SHEARS],
]

describe.each(FILMS)('the %s film', (_, film) => {
  const tl = timeline(film)

  it('keeps FILM.md’s rules, and is 15–20 s of 6–8 shots', () => {
    expect(lint(film)).toEqual([])
    expect(tl.length).toBeGreaterThanOrEqual(15)
    expect(tl.length).toBeLessThanOrEqual(20)
    expect(tl.shots.length).toBeGreaterThanOrEqual(6)
    expect(tl.shots.length).toBeLessThanOrEqual(8)
  })

  it('plays in the pen with its herd, and ends on its tool with the build’s XP', () => {
    expect(film.scenes.every((s) => s.place === 'pen')).toBe(true)
    expect(film.herd).toBeTruthy()
    expect(Object.values(film.props).filter((p) => p.kind === 'tool').length).toBeGreaterThan(0)
    expect(film.end.xp).toBe(XP_FOR.build)
    expect(film.end.next.map((n) => n.text)).toEqual([expect.stringMatching(/^3 a \w+ → 4$/), '1 a tap → 2'])
  })

  it('has the player say one line at most, and its animals none', () => {
    expect(tl.lines.filter((l) => l.item.who === 'you').length).toBeLessThanOrEqual(1)
    for (const l of tl.lines) expect(film.cast[l.item.who].look).not.toHaveProperty('herd')
  })

  it('ends with every walk where it was sent, and its tool standing', () => {
    const end = tl.world(tl.length)
    for (const { item: a } of tl.acts) {
      if (a.to === undefined) continue
      const last = [a.to].flat().at(-1)!
      const to = markOf(last)
      const now = memberAt(tl, a.who, end + 10)
      // (a later walk or put may have moved them on: the last of their own acts decides)
      const later = tl.acts.filter((x) => x.item.who === a.who && (x.item.to !== undefined || x.item.put !== undefined)).at(-1)!.item
      if (later !== a) continue
      expect(Math.hypot(now.x - to.x, now.z - to.z)).toBeLessThan(0.01)
    }
    const tool = Object.keys(film.props).find((id) => film.props[id].kind === 'tool' && film.props[id].on === 'post')!
    expect(propAt(tl, tool, end + 1).open).toBe(1)
  })

  it('keeps the herd inside the pen or outside its gate, never in its fence', () => {
    const end = tl.world(tl.length)
    for (const [id, m] of Object.entries(film.cast)) {
      if (typeof m.look !== 'object' || !('herd' in m.look)) continue
      for (let w = 0; w <= end; w += 0.02) {
        const at = memberAt(tl, id, w)
        const onFence =
          (Math.abs(at.z - PEN.z0) < 0.12 && (at.x < PEN.gate.x0 || at.x > PEN.gate.x1)) || Math.abs(at.z - PEN.z1) < 0.12 || Math.abs(at.x - PEN.x0) < 0.12 || Math.abs(at.x - PEN.x1) < 0.12
        expect(onFence, `${id} at ${w.toFixed(1)} s`).toBe(false)
      }
    }
  })
})
