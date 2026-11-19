import { describe, expect, it } from 'vitest'
import { SELLABLE } from '../data'
import { freshEvents } from '../events'
import { backWords, luckyOdds, newsView } from './view'

// The farm news's words (src/farm/news/view.ts): an event on now says until when and when it comes back — never a
// clock running out or a word of loss (update-v1/missions/02-meta-collections.md, change 3) — and the lucky draw says
// what it can pick and how likely (change 2).

/** A moment of a day in November 2026 (the 16th is a Monday), local time. */
const at = (date: number, hour: number) => new Date(2026, 10, date, hour).getTime()

describe('kind words', () => {
  it('an event on now: until when, and when it comes back (a week on: next; sooner: its day; the next day: tomorrow)', () => {
    // Wednesday's harvest festival: next Wednesday
    expect(backWords('harvest', at(18, 13))).toBe('Back next Wednesday')
    // Monday's market: back on Sunday; Sunday's: back tomorrow (Monday)
    expect(backWords('market', at(16, 10))).toBe('Back on Sunday')
    expect(backWords('market', at(22, 10))).toBe('Back tomorrow')
    const v = newsView(at(18, 13), freshEvents(), [])
    expect(v.now).toHaveLength(1)
    expect(v.now[0]).toMatchObject({ id: 'harvest', until: 'Until midnight', back: 'Back next Wednesday' })
  })

  it('no word of loss or hurry anywhere in a week’s news', () => {
    for (let date = 16; date <= 22; date++)
      for (const hour of [9, 13, 18]) {
        const words = JSON.stringify(newsView(at(date, hour), freshEvents(), ['lettuce', 'egg']))
        expect(words, `${date} at ${hour}`).not.toMatch(/\bleft\b|\blost\b|\bmiss|hurry|don.t|only \d|last chance/i)
      }
  })
})

describe('the lucky draw’s odds', () => {
  it('two of the goods a buyer asks for that the farm knows, each alike', () => {
    expect(luckyOdds(['lettuce', 'egg', 'flour', 'tomato'])).toEqual([
      { what: '2 of the 4 goods a buyer asks for', share: 1 },
      { what: 'Each good', share: 0.5 },
    ])
    // a building material is never drawn; nothing known: no odds to show
    expect(luckyOdds(['lettuce', 'brick'])).toEqual([
      { what: '1 of the 1 goods a buyer asks for', share: 1 },
      { what: 'Each good', share: 1 },
    ])
    expect(luckyOdds([])).toEqual([])
    expect(luckyOdds(SELLABLE)[1].share).toBeCloseTo(2 / SELLABLE.length, 9)
  })

  it('on its day the news carries them', () => {
    expect(newsView(at(21, 10), freshEvents(), ['lettuce', 'egg', 'flour']).lucky?.odds).toEqual(luckyOdds(['lettuce', 'egg', 'flour']))
  })
})
