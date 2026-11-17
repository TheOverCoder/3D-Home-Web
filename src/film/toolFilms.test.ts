import { beforeAll, describe, expect, it } from 'vitest'
import { XP_FOR } from '../farm/data'
import { loadSolids } from '../lib/sculpt'
import { TOOL_LOOKS, TOOL_STYLES, toolPieces } from '../models/tools'
import { bucketFilm } from './bucket'
import { lintStage } from './checks'
import { coopFilm } from './coop'
import { lint, timeline, type Film } from './format'
import { PIECES } from './kit'
import { memberAt, propAt } from './stage'
import { markOf } from './set'
import { shearsFilm } from './shears'

// The animal tools' three films (plans/animal-tools.md §4: ./coop.ts, ./bucket.ts, ./shears.ts), in each of the tool's
// three styles: each keeps lab/FILM.md's countable rules and its set's (./checks.ts: nobody in the fence or the tool,
// nobody through anybody), runs 25–45 s (the user asked for longer films with more story: round 2), plays in the pen
// with its own herd, and ends on the tool's card with the build's XP; the walks end where they were sent, and the
// tool's pieces stand by its end.

const MAKERS: [string, (s: 'a' | 'b' | 'c') => Film][] = [
  ['coop', coopFilm],
  ['bucket', bucketFilm],
  ['shears', shearsFilm],
]

describe.each(MAKERS)('the %s film', (_, make) => {
  const film = make('a')
  const tl = timeline(film)

  it('keeps FILM.md’s rules and its set’s, in every style, and is 25–45 s of 10–18 shots', () => {
    for (const style of TOOL_STYLES) {
      const f = make(style)
      expect(f.style).toBe(style)
      expect(lint(f)).toEqual([])
      expect(lintStage(f)).toEqual([])
    }
    expect(tl.length).toBeGreaterThanOrEqual(25)
    expect(tl.length).toBeLessThanOrEqual(45)
    expect(tl.shots.length).toBeGreaterThanOrEqual(10)
    expect(tl.shots.length).toBeLessThanOrEqual(18)
  })

  it('plays in the pen with its herd, and ends on its tool with the build’s XP', () => {
    expect(film.scenes.every((s) => s.place === 'pen')).toBe(true)
    expect(film.herd).toBeTruthy()
    expect(Object.values(film.props).filter((p) => p.kind === 'tool').length).toBe(1)
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
    const tool = Object.keys(film.props).find((id) => film.props[id].kind === 'tool')!
    expect(propAt(tl, tool, end + 1).open).toBe(1)
  })
})

describe('the build’s clicks', () => {
  beforeAll(async () => {
    await loadSolids()
  })

  it('know every tool’s pieces in the order they go up, in every style (src/models/tools.ts)', () => {
    for (const look of TOOL_LOOKS) for (const style of TOOL_STYLES) expect(PIECES[look][style], `${look} ${style}`).toEqual(toolPieces(look, style).map((p) => p.id))
  })
})
