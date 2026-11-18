import { describe, expect, it } from 'vitest'
import { CARD_ORDER, VISIT_MOST, nextCard, type CardId, type QueueNow } from './cardQueue'

// The cards that open by themselves (update-v1/CONTRACTS.md §1.6).

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
  it('comes in one order', () => {
    expect(CARD_ORDER).toEqual(['away', 'daily', 'unlocked', 'letter', 'counts'])
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
    expect(visit(['daily', 'letter', 'counts'])).toEqual(['daily', 'letter'])
  })

  it('opens none twice in a visit', () => {
    expect(nextCard(now({ due: ['daily'], opened: ['daily'] }))).toBeNull()
  })

  it('in the visit the first steps end in, opens only the welcome back', () => {
    expect(visit(['daily', 'letter'], true)).toEqual([])
    expect(visit(['away', 'daily', 'letter'], true)).toEqual(['away'])
  })
})
