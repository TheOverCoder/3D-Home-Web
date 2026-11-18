import { describe, expect, it } from 'vitest'
import { CALLS, callingNow, calling, onCalling, restCalls, wantCall, type CallId } from './calls'

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

describe('the calls in the game', () => {
  it('move one at a time: the highest that some part wants, while it wants it', () => {
    expect(callingNow()).toBeNull()
    let heard = 0
    const stop = onCalling(() => heard++)
    const tag = wantCall('tag')
    expect(callingNow()).toBe('tag')
    const news = wantCall('news')
    expect(callingNow()).toBe('news')
    // two parts saying the same call: it stays until both stop
    const goalA = wantCall('goal')
    const goalB = wantCall('goal')
    expect(callingNow()).toBe('goal')
    goalA()
    goalA()
    expect(callingNow()).toBe('goal')
    goalB()
    expect(callingNow()).toBe('news')
    news()
    tag()
    expect(callingNow()).toBeNull()
    // (told once a change: tag, news, goal, news, tag, none)
    expect(heard).toBe(6)
    stop()
  })

  it('rest while the busy card shows', () => {
    const daily = wantCall('daily')
    const rest = restCalls()
    expect(callingNow()).toBeNull()
    rest()
    rest()
    expect(callingNow()).toBe('daily')
    daily()
    expect(callingNow()).toBeNull()
  })
})
