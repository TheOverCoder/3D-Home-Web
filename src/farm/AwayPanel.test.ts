// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { AWAY_ROWS, awayRows, awayText } from './AwayPanel'
import type { AwayReport } from './state'

// The welcome back's pictures (src/farm/AwayPanel.tsx): at most AWAY_ROWS of what waited, the most worth first, and a
// building too full for what waits always among them (its one press makes room).

const report = (o: Partial<AwayReport>): AwayReport => ({
  seconds: 3600,
  counted: 3600,
  goods: [],
  buyers: 0,
  orders: 0,
  tractor: false,
  thirsty: 0,
  full: [],
  shop: null,
  pieces: false,
  ...o,
})

describe('the welcome back', () => {
  it('shows at most AWAY_ROWS pictures, the most worth first', () => {
    const r = report({
      goods: [
        { item: 'egg', count: 5 },
        { item: 'cloth', count: 2 },
        { item: 'milk', count: 4 },
        { item: 'lettuce', count: 4 },
      ],
      buyers: 2,
      orders: 1,
      tractor: true,
      pieces: true,
      thirsty: 3,
    })
    const rows = awayRows(r)
    expect(rows.length).toBe(AWAY_ROWS)
    for (let k = 1; k < rows.length; k++) expect(rows[k - 1].worth).toBeGreaterThanOrEqual(rows[k].worth)
    // the smallest things wait for a card with room for them
    expect(rows.map((x) => x.key)).not.toContain('tractor')
  })

  it('a building too full for what waits is always shown, first', () => {
    const r = report({ goods: Array.from({ length: 6 }, (_, k) => ({ item: (['egg', 'milk', 'wool', 'cloth', 'flour', 'sugar'] as const)[k], count: 9 })), full: ['barn'] })
    const rows = awayRows(r)
    expect(rows[0]).toMatchObject({ key: 'full:barn', needs: true })
    expect(rows.length).toBe(AWAY_ROWS)
  })

  it('says how long in the clock’s words, never less than a minute', () => {
    expect(awayText(130)).toBe('3 min')
    expect(awayText(20)).toBe('1 min')
    expect(awayText(3 * 3600 + 60 * 14)).toBe('3 h 14 min')
  })
})
