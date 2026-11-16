import { describe, expect, it } from 'vitest'
import { SELLABLE, type ProduceId } from './data'
import {
  EVENTS,
  EVENT_IDS,
  LUCKY_GOODS,
  SEEN_KEPT,
  activeAt,
  canDraw,
  dateKey,
  drawGoods,
  freshEvents,
  luckyGoods,
  markSeen,
  newsWaiting,
  priceFactor,
  sanitizeEvents,
  speedAt,
  upcoming,
  type EventsRecord,
} from './events'

// The week's events (src/farm/events.ts): the calendar by the device's own date and hours, the lucky draw (once on its
// day, two goods on the dice, double only that day), what the news shows and what waits in it, and the record as saved.
// The week of 16 November 2026: Monday 16 … Sunday 22, local time (whatever the zone the tests run in).

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()
const ids = (ms: number) => activeAt(ms).map((o) => o.id)

describe('the calendar', () => {
  it('each event is a row: weekdays of the week, whole hours within the day, a factor, eight kinds at most', () => {
    expect(EVENT_IDS.length).toBeLessThanOrEqual(8)
    for (const id of EVENT_IDS) {
      const e = EVENTS[id]
      expect(e.days.length).toBeGreaterThan(0)
      for (const d of e.days) expect(Number.isInteger(d) && d >= 0 && d <= 6).toBe(true)
      expect(Number.isInteger(e.from) && Number.isInteger(e.to) && e.from >= 0 && e.from < e.to && e.to <= 24).toBe(true)
      expect(e.times).toBeGreaterThanOrEqual(2)
      expect(e.say.length).toBeGreaterThan(0)
    }
    // no two kinds that change the same thing on the same day (their factors would multiply)
    for (const a of EVENT_IDS)
      for (const b of EVENT_IDS) if (a < b && EVENTS[a].boost === EVENTS[b].boost) expect(EVENTS[a].days.some((d) => (EVENTS[b].days as readonly number[]).includes(d))).toBe(false)
  })

  it('falls on its weekday and hours, local time: from inclusive, to not', () => {
    expect(new Date(at(16, 12)).getDay()).toBe(1) // (a Monday)
    expect(ids(at(16, 7, 59))).toEqual([])
    expect(ids(at(16, 8))).toEqual(['market'])
    expect(ids(at(16, 19, 59))).toEqual(['market'])
    expect(ids(at(16, 20))).toEqual([])
    expect(ids(at(17, 12))).toEqual([]) // Tuesday: a quiet day
    expect(ids(at(18, 0))).toEqual(['harvest'])
    expect(ids(at(18, 23, 59))).toEqual(['harvest'])
    expect(ids(at(19, 9))).toEqual(['gifts'])
    expect(ids(at(20, 15, 59))).toEqual([])
    expect(ids(at(20, 16))).toEqual(['rush'])
    expect(ids(at(20, 23, 59))).toEqual(['rush'])
    expect(ids(at(21, 0))).toEqual(['lucky'])
    expect(ids(at(22, 10))).toEqual(['market'])
    // and the same every week
    expect(ids(at(28, 12))).toEqual(['lucky'])
  })

  it('an occurrence is keyed by its event and the date it begins, and runs from its start to its end', () => {
    const [o] = activeAt(at(20, 18))
    expect(o.key).toBe('rush@2026-11-20')
    expect(o.start).toBe(at(20, 16))
    expect(o.end).toBe(at(21, 0))
    expect(dateKey(at(21, 0))).toBe('2026-11-21')
  })

  it('coming soon: the next time of each event not on now, the soonest first, within the week', () => {
    const soon = upcoming(at(17, 12))
    expect(soon.map((o) => o.id)).toEqual(['harvest', 'gifts', 'rush', 'lucky', 'market'])
    expect(soon[0].start).toBe(at(18, 0))
    expect(soon[4].start).toBe(at(22, 8))
    // on now: its next time is a later day's (Monday's market → Sunday's)
    const monday = upcoming(at(16, 10))
    expect(monday.find((o) => o.id === 'market')!.start).toBe(at(22, 8))
    // later today counts as coming (Friday morning: the rush at 16:00)
    expect(upcoming(at(20, 9))[0]).toMatchObject({ id: 'rush', start: at(20, 16) })
  })

  it('what an event changes is multiplied only while it is on; off (null), nothing', () => {
    expect(speedAt('crops', at(18, 10))).toBe(2)
    expect(speedAt('crops', at(17, 10))).toBe(1)
    expect(speedAt('machines', at(20, 16))).toBe(2)
    expect(speedAt('machines', at(20, 15))).toBe(1)
    expect(speedAt('buyers', at(16, 9))).toBe(2)
    expect(speedAt('gifts', at(19, 9))).toBe(2)
    expect(speedAt('gifts', null)).toBe(1)
    expect(speedAt('crops', null)).toBe(1)
  })
})

describe('the lucky draw', () => {
  const drawn = (day: string, goods: ProduceId[]): EventsRecord => ({ draw: { day, goods }, seen: [] })

  it('can be drawn on its day only, once', () => {
    expect(canDraw(freshEvents(), at(21, 10))).toBe(true)
    expect(canDraw(freshEvents(), at(20, 23, 59))).toBe(false)
    expect(canDraw(freshEvents(), null)).toBe(false)
    expect(canDraw(drawn('2026-11-21', ['tomato', 'egg']), at(21, 22))).toBe(false)
    // a draw from last week's lucky day does not count for this one's
    expect(canDraw(drawn('2026-11-14', ['tomato', 'egg']), at(21, 10))).toBe(true)
  })

  it('two different goods a buyer could ask for, on the dice: the same dice, the same goods', () => {
    const pool: ProduceId[] = ['milk', 'tomato', 'egg', 'brick', 'lemon']
    const a = drawGoods(pool, () => 0.5)
    expect(a).toHaveLength(LUCKY_GOODS)
    expect(new Set(a).size).toBe(LUCKY_GOODS)
    for (const g of a) expect(SELLABLE).toContain(g)
    expect(a).not.toContain('brick')
    expect(drawGoods(pool, () => 0.5)).toEqual(a)
    // the dice's lowest and highest
    expect(drawGoods(pool, () => 0).length).toBe(2)
    expect(drawGoods(pool, () => 0.999999).length).toBe(2)
    // a pool of one gives one; none, none
    expect(drawGoods(['egg'], () => 0.3)).toEqual(['egg'])
    expect(drawGoods([], () => 0.3)).toEqual([])
  })

  it('doubles the drawn goods while its day lasts, and nothing else', () => {
    const rec = drawn('2026-11-21', ['tomato', 'egg'])
    expect(priceFactor('tomato', rec, at(21, 10))).toBe(2)
    expect(priceFactor('egg', rec, at(21, 23, 59))).toBe(2)
    expect(priceFactor('milk', rec, at(21, 10))).toBe(1)
    // the day after, and the next lucky day (its own draw not made), the goods are back to their price
    expect(priceFactor('tomato', rec, at(22, 0))).toBe(1)
    expect(priceFactor('tomato', rec, at(28, 10))).toBe(1)
    expect(luckyGoods(rec, at(21, 10))).toEqual(['tomato', 'egg'])
    expect(luckyGoods(rec, null)).toEqual([])
    expect(priceFactor('tomato', rec, null)).toBe(1)
  })
})

describe('what waits in the news', () => {
  it('each event on that it has not shown, and the draw not made, once', () => {
    let rec = freshEvents()
    expect(newsWaiting(rec, at(21, 10))).toBe(1)
    rec = { ...rec, seen: markSeen(rec, at(21, 10)) }
    expect(rec.seen).toEqual(['lucky@2026-11-21'])
    // seen, the draw still waits
    expect(newsWaiting(rec, at(21, 10))).toBe(1)
    rec = { ...rec, draw: { day: '2026-11-21', goods: ['egg', 'milk'] } }
    expect(newsWaiting(rec, at(21, 10))).toBe(0)
    // Monday's market: new, then shown
    expect(newsWaiting(rec, at(16, 10))).toBe(1)
    expect(newsWaiting({ ...rec, seen: markSeen(rec, at(16, 10)) }, at(16, 10))).toBe(0)
    // nothing on, nothing waits; off, nothing
    expect(newsWaiting(freshEvents(), at(17, 10))).toBe(0)
    expect(newsWaiting(freshEvents(), null)).toBe(0)
  })

  it('remembers the last few events shown', () => {
    let rec = freshEvents()
    for (let w = 0; w < 6; w++) for (const d of [16, 18, 19, 20, 21, 22]) rec = { ...rec, seen: markSeen(rec, at(d + 7 * w, 18)) }
    expect(rec.seen.length).toBe(SEEN_KEPT)
    expect(rec.seen.at(-1)).toBe('market@2026-12-27')
    // the same again adds nothing (and keeps the same list)
    expect(markSeen(rec, at(22 + 35, 18))).toBe(rec.seen)
  })
})

describe('the record as saved', () => {
  it('a farm from before the events, or anything unreadable: nothing drawn, nothing shown', () => {
    for (const raw of [undefined, null, 3, 'x', [], { draw: 'egg', seen: 'x' }]) expect(sanitizeEvents(raw)).toEqual(freshEvents())
  })

  it('a draw keeps one or two different goods a buyer could ask for, on a date; the events shown, each once', () => {
    expect(sanitizeEvents({ draw: { day: '2026-11-21', goods: ['tomato', 'egg'] }, seen: ['lucky@2026-11-21'] })).toEqual({
      draw: { day: '2026-11-21', goods: ['tomato', 'egg'] },
      seen: ['lucky@2026-11-21'],
    })
    expect(sanitizeEvents({ draw: { day: '2026-11-21', goods: ['tomato', 'tomato', 'brick', 'gold', 7, 'egg', 'milk'] } }).draw).toEqual({ day: '2026-11-21', goods: ['tomato', 'egg'] })
    expect(sanitizeEvents({ draw: { day: 'Saturday', goods: ['tomato'] } }).draw).toBeNull()
    expect(sanitizeEvents({ draw: { day: '2026-11-21', goods: ['brick'] } }).draw).toBeNull()
    expect(sanitizeEvents({ seen: ['lucky@2026-11-21', 'lucky@2026-11-21', 'party@2026-11-21', 'gifts@x', 5, 'gifts@2026-11-19'] }).seen).toEqual(['lucky@2026-11-21', 'gifts@2026-11-19'])
    expect(sanitizeEvents({ seen: Array.from({ length: 40 }, (_, k) => `market@2026-01-${String(k + 1).padStart(2, '0')}`) }).seen.length).toBe(SEEN_KEPT)
  })
})
