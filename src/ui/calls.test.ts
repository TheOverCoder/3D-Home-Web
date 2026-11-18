import { describe, expect, it } from 'vitest'
import { CALLS, calling, type CallId } from './calls'

// The top's attention budget (update-v1/CONTRACTS.md §1.8).

describe('the calls at the top', () => {
  it('rank each once', () => {
    const ranks = CALLS.map((c) => c.rank)
    expect(new Set(ranks).size).toBe(ranks.length)
    expect(new Set(CALLS.map((c) => c.id)).size).toBe(CALLS.length)
  })

  it('let only the highest that applies move', () => {
    expect(calling(new Set<CallId>(['tag', 'news', 'boxes']))).toBe('boxes')
    expect(calling(new Set<CallId>(['tag', 'compass']))).toBe('compass')
    expect(calling(new Set<CallId>(['daily', 'goal', 'almost']))).toBe('daily')
    for (const c of CALLS) expect(calling(new Set<CallId>([c.id]))).toBe(c.id)
  })

  it('let none move when none applies, or while the busy card shows', () => {
    expect(calling(new Set())).toBeNull()
    expect(calling(new Set<CallId>(['daily', 'almost']), true)).toBeNull()
  })
})
