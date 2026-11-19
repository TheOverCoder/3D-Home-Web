import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  AFTER_STEPS,
  AGAIN,
  CARD_ORDER,
  VISIT_MOST,
  cardShowing,
  cardTurn,
  mayOpen,
  newVisit,
  nextCard,
  registerCard,
  spent,
  stepsEndedThisVisit,
  subscribeCards,
  visitNow,
  type CardDef,
  type CardId,
  type QueueNow,
} from './cardQueue'

// The cards that open by themselves (update-v1/CONTRACTS.md §1.6): the order and the budget, then the runtime the game
// registers its cards with.

const now = (o: Partial<QueueNow> = {}): QueueNow => ({ due: [], opened: [], free: true, showing: null, stepsEndedThisVisit: false, ...o })

/** A visit played out: each card due opens in turn, as long as the queue lets it. */
function visit(due: CardId[], stepsEndedThisVisit = false): CardId[] {
  const opened: CardId[] = []
  for (;;) {
    const id = nextCard(now({ due, opened, stepsEndedThisVisit }))
    if (!id) return opened
    opened.push(id)
  }
}

describe('the card queue', () => {
  it('comes in one order, with no question about counts (decision 20)', () => {
    expect(CARD_ORDER).toEqual(['away', 'daily', 'season', 'unlocked', 'letter'])
    expect(nextCard(now({ due: ['letter', 'daily', 'away'] }))).toBe('away')
    expect(nextCard(now({ due: ['letter', 'daily'] }))).toBe('daily')
  })

  it('opens nothing while a card shows, or anything is over the game', () => {
    expect(nextCard(now({ due: ['daily'], showing: 'away' }))).toBeNull()
    expect(nextCard(now({ due: ['daily'], free: false }))).toBeNull()
    expect(nextCard(now())).toBeNull()
  })

  it('opens at most two a visit, the welcome back counted; the rest wait', () => {
    expect(VISIT_MOST).toBe(2)
    expect(visit(['away', 'daily', 'unlocked', 'letter'])).toEqual(['away', 'daily'])
    expect(visit(['daily', 'letter'])).toEqual(['daily', 'letter'])
  })

  it('opens none twice in a visit, but each level’s reveal is its own (within the budget)', () => {
    expect(AGAIN).toEqual(['unlocked'])
    expect(nextCard(now({ due: ['daily'], opened: ['daily'] }))).toBeNull()
    expect(nextCard(now({ due: ['unlocked'], opened: ['unlocked'] }))).toBe('unlocked')
    expect(visit(['unlocked'])).toEqual(['unlocked', 'unlocked'])
  })

  it('in the visit the first steps end in, opens only the welcome back', () => {
    expect(AFTER_STEPS).toEqual(['away'])
    expect(visit(['daily', 'letter'], true)).toEqual([])
    expect(visit(['away', 'daily', 'letter'], true)).toEqual(['away'])
  })

  it('says which cards this visit can no longer open: past the budget, twice, or after the steps', () => {
    expect(spent('daily', { opened: [], stepsEndedThisVisit: false })).toBe(false)
    expect(spent('daily', { opened: ['away', 'unlocked'], stepsEndedThisVisit: false })).toBe(true)
    expect(spent('daily', { opened: ['daily'], stepsEndedThisVisit: false })).toBe(true)
    expect(spent('unlocked', { opened: ['unlocked'], stepsEndedThisVisit: false })).toBe(false)
    expect(spent('unlocked', { opened: [], stepsEndedThisVisit: true })).toBe(true)
    expect(spent('away', { opened: [], stepsEndedThisVisit: true })).toBe(false)
  })
})

describe('the cards the game registers', () => {
  /** A card as the game's: due while `due`, open from `open()` until `close()`; `passed` counts its letting go. */
  function card(id: CardId, due = true) {
    const c = { due, open: false, opened: 0, passed: 0 }
    const def: CardDef = {
      due: () => c.due && !c.open,
      open: () => {
        c.open = true
        c.opened++
      },
      showing: () => c.open,
      pass: () => {
        c.passed++
        c.due = false
      },
    }
    const off = registerCard(id, def)
    return Object.assign(c, { off, close: () => ((c.open = false), (c.due = false)) })
  }
  let offs: (() => void)[] = []
  const take = <T extends { off: () => void }>(c: T) => (offs.push(c.off), c)
  beforeEach(() => newVisit())
  afterEach(() => {
    offs.forEach((o) => o())
    offs = []
  })

  it('opens the next due in order, one at a time, each counted in the visit', () => {
    const daily = take(card('daily'))
    const away = take(card('away'))
    expect(cardTurn(true)).toBe('away')
    expect(away.opened).toBe(1)
    expect(cardShowing()).toBe('away')
    // nothing over it while it shows
    expect(cardTurn(true)).toBeNull()
    away.close()
    expect(cardShowing()).toBeNull()
    expect(cardTurn(true)).toBe('daily')
    expect(visitNow().opened).toEqual(['away', 'daily'])
    expect(daily.opened).toBe(1)
  })

  it('opens nothing while the game is not free', () => {
    const away = take(card('away'))
    expect(cardTurn(false)).toBeNull()
    expect(away.opened).toBe(0)
  })

  it('past the budget, lets a card due pass (it waits where it lives); a new visit opens again', () => {
    const away = take(card('away'))
    expect(cardTurn(true)).toBe('away')
    away.close()
    const daily = take(card('daily'))
    expect(cardTurn(true)).toBe('daily')
    daily.close()
    const reveal = take(card('unlocked'))
    expect(mayOpen('unlocked')).toBe(false)
    expect(cardTurn(true)).toBeNull()
    expect(reveal).toMatchObject({ opened: 0, passed: 1 })
    expect(visitNow()).toMatchObject({ opened: ['away', 'daily'], passed: ['unlocked'] })
    newVisit()
    const next = take(card('unlocked'))
    expect(mayOpen('unlocked')).toBe(true)
    expect(cardTurn(true)).toBe('unlocked')
    expect(next.opened).toBe(1)
  })

  it('once the first steps end in a visit, opens only the welcome back in it', () => {
    take(card('daily'))
    stepsEndedThisVisit()
    expect(visitNow().stepsEnded).toBe(true)
    expect(cardTurn(true)).toBeNull()
    const away = take(card('away'))
    expect(cardTurn(true)).toBe('away')
    expect(away.opened).toBe(1)
    newVisit()
    expect(visitNow()).toEqual({ opened: [], passed: [], stepsEnded: false })
  })

  it('takes back only its own registration, and tells its followers of each change', () => {
    let told = 0
    const stop = subscribeCards(() => told++)
    const first = card('daily')
    const second = take(card('daily'))
    first.off()
    expect(cardTurn(true)).toBe('daily')
    expect(second.opened).toBe(1)
    expect(told).toBeGreaterThanOrEqual(3)
    stop()
    const was = told
    newVisit()
    expect(told).toBe(was)
  })
})
