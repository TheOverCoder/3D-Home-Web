import { describe, expect, it } from 'vitest'
import { clock, readyAt, span } from './time'

// The one way the game writes a time (update-v1/CONTRACTS.md §1.1), as a table.

describe('clock', () => {
  it('writes a countdown, rounded up, never 0:00 while time is left', () => {
    const table: [number, string][] = [
      [0, '0:00'],
      [-3, '0:00'],
      [NaN, '0:00'],
      [Infinity, '0:00'],
      [0.2, '0:01'],
      [35, '0:35'],
      [59.5, '1:00'],
      [60, '1:00'],
      [245, '4:05'],
      [3599.5, '1:00:00'],
      [3725, '1:02:05'],
      [8 * 3600, '8:00:00'],
    ]
    for (const [s, words] of table) expect(clock(s), `${s}`).toBe(words)
  })

  it('never shows 60 seconds or 60 minutes', () => {
    for (let s = 0.5; s < 7300; s += 0.5) expect(clock(s), `${s}`).not.toMatch(/:60/)
  })
})

describe('span', () => {
  it('writes a length in words, rounded up to the unit shown', () => {
    const table: [number, string][] = [
      [0, '0 s'],
      [NaN, '0 s'],
      [-1, '0 s'],
      [45, '45 s'],
      [59.4, '1 min'],
      [330, '6 min'],
      [3599, '1 h'],
      [3600, '1 h'],
      [3601, '1 h 1 min'],
      [2 * 3600 + 14 * 60, '2 h 14 min'],
      [2 * 3600, '2 h'],
      [24 * 3600, '1 day'],
      [28 * 3600, '1 day 4 h'],
      [50 * 3600, '2 days 2 h'],
      [72 * 3600, '3 days'],
      [5 * 86_400 + 1, '6 days'],
    ]
    for (const [s, words] of table) expect(span(s), `${s}`).toBe(words)
  })
})

describe('readyAt', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 18, h, m).getTime()

  it('is a time of day today, tomorrow past midnight, and a weekday after that', () => {
    expect(readyAt(40 * 60, at(21), 'en-GB')).toBe('21:40')
    expect(readyAt(60 * 60, at(23, 30), 'en-GB')).toBe('tomorrow 00:30')
    expect(readyAt(10 * 3600, at(21, 10), 'en-GB')).toBe('tomorrow 07:10')
    expect(readyAt(40 * 3600, at(15, 10), 'en-GB')).toBe('Fri 07:10')
  })

  it('follows the device: 24 hours or 12', () => {
    expect(readyAt(40 * 60, at(21), 'en-GB')).toBe('21:40')
    expect(readyAt(40 * 60, at(21), 'en-US')).toMatch(/^09:40\sPM$/)
    expect(readyAt(60 * 60, at(23, 30), 'en-US')).toMatch(/^tomorrow 12:30\sAM$/)
  })

  it('reads nothing, or not a number, as now', () => {
    expect(readyAt(NaN, at(9, 5), 'en-GB')).toBe('09:05')
    expect(readyAt(-60, at(9, 5), 'en-GB')).toBe('09:05')
  })
})
