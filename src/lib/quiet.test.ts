import { describe, expect, it } from 'vitest'
import { onHere, onInPlay } from './quiet'

// Quiet in tests (update-v1/CONTRACTS.md §1.3). It must answer as the three functions it replaces do today, written
// out here as they stand in src/farm/state.ts (eventsByDefault; allOpenByDefault, which is its opposite; and
// stepsQuietByDefault, also its opposite), until 08 moves them onto it.
type Env = { test: boolean; search: string | null }
const eventsByDefault = ({ test, search }: Env) => {
  if (test) return false
  if (search === null) return true
  const q = new URLSearchParams(search)
  return !q.has('debug') || q.get('events') === 'on'
}
const allOpenByDefault = ({ test, search }: Env) => {
  if (test) return true
  if (search === null) return false
  const q = new URLSearchParams(search)
  return q.has('debug') && q.get('unlocks') !== 'on'
}
const stepsQuietByDefault = ({ test, search }: Env) => {
  if (test) return true
  if (search === null) return false
  const q = new URLSearchParams(search)
  return q.has('debug') && q.get('steps') !== 'on'
}

const PAGES = [null, '', '?', '?debug', '?debug&events=on', '?debug&steps=on&unlocks=on', '?debug&events=off', '?events=on', '?stress=10', '?debug&road=on', '?debug=1&season=on&weather=on']

describe('quiet in tests', () => {
  it('is on in play, off under Vitest, off on a ?debug page unless it asks', () => {
    expect(onInPlay('events', { test: false, search: null })).toBe(true)
    expect(onInPlay('events', { test: false, search: '' })).toBe(true)
    expect(onInPlay('events', { test: true, search: '' })).toBe(false)
    expect(onInPlay('events', { test: false, search: '?debug' })).toBe(false)
    expect(onInPlay('events', { test: false, search: '?debug&events=on' })).toBe(true)
    expect(onInPlay('road', { test: false, search: '?debug&events=on' })).toBe(false)
    expect(onInPlay('road', { test: false, search: '?debug&road=on' })).toBe(true)
  })

  it('answers as the three functions it replaces', () => {
    for (const test of [false, true])
      for (const search of PAGES) {
        const env = { test, search }
        expect(onInPlay('events', env), `${test} ${search}`).toBe(eventsByDefault(env))
        expect(onInPlay('unlocks', env), `${test} ${search}`).toBe(!allOpenByDefault(env))
        expect(onInPlay('steps', env), `${test} ${search}`).toBe(!stepsQuietByDefault(env))
      }
  })

  it('reads this page: under Vitest, off', () => {
    expect(onHere('events')).toBe(false)
  })
})
