import { describe, expect, it } from 'vitest'
import { LONG_WAIT, TALK, TALK_GAP, type TalkMoment } from './lines'
import { freshMemory, mayTalk, nextLine, type TalkWorld } from './rules'

// When a character may say a line (./rules.ts, the lines ./lines.ts): only where the device can speak, with the game's
// sound on and started, never over a film or the drive or with the page hidden, only on your map and near you; never
// sooner than the gap after any line or the moment's own wait (an answer to you excepted from the gap); then on the
// moment's chance. And the lines themselves: short, plain, never the same one twice in a row.

/** The farm as a moment finds it: you beside the speaker, the sound on, nothing else said. */
const world = (w: Partial<TalkWorld> = {}): TalkWorld => ({
  now: 1000,
  distance: 2,
  sameMap: true,
  film: false,
  sound: { enabled: true, volume: 0.7 },
  speech: true,
  hidden: false,
  speaking: false,
  ...w,
})

/** Says a moment as the game would (the dice always yes), kept in `memory`. */
const say = (moment: TalkMoment, memory = freshMemory(), now = 1000) => {
  expect(mayTalk(moment, world({ now }), memory, 0)).toBe(true)
  nextLine(moment, memory, now, 0)
  return memory
}

describe('when a line may be said', () => {
  it('muted, not started, unable to speak, hidden: never', () => {
    const m = freshMemory()
    expect(mayTalk('buyer-thanks', world(), m, 0)).toBe(true)
    expect(mayTalk('buyer-thanks', world({ sound: { enabled: false, volume: 0.7 } }), m, 0)).toBe(false)
    expect(mayTalk('buyer-thanks', world({ sound: { enabled: true, volume: 0 } }), m, 0)).toBe(false)
    // (no touch yet: the game's sound has not started, and a phone would not speak)
    expect(mayTalk('buyer-thanks', world({ sound: null }), m, 0)).toBe(false)
    expect(mayTalk('buyer-thanks', world({ speech: false }), m, 0)).toBe(false)
    expect(mayTalk('buyer-thanks', world({ hidden: true }), m, 0)).toBe(false)
    // an answer too
    expect(mayTalk('agent-hello', world({ sound: { enabled: false, volume: 0.7 } }), m, 0)).toBe(false)
  })

  it('never over a film or the drive, nor from another map', () => {
    const m = freshMemory()
    for (const moment of ['buyer-arrive', 'driver-go', 'agent-hello'] as const) {
      expect(mayTalk(moment, world({ film: true }), m, 0)).toBe(false)
      expect(mayTalk(moment, world({ sameMap: false }), m, 0)).toBe(false)
    }
  })

  it('only near you: each moment within its own distance', () => {
    const m = freshMemory()
    for (const moment of Object.keys(TALK) as TalkMoment[]) {
      const near = TALK[moment].near
      expect(mayTalk(moment, world({ distance: near }), m, 0), moment).toBe(true)
      expect(mayTalk(moment, world({ distance: near + 0.1 }), m, 0), moment).toBe(false)
      expect(mayTalk(moment, world({ distance: NaN }), m, 0), moment).toBe(false)
    }
  })

  it('a gap after any line, and each moment its own wait; an answer to you is held back only by its own', () => {
    const m = say('buyer-thanks')
    // another moment, too soon after a line
    expect(mayTalk('driver-go', world({ now: 1000 + TALK_GAP - 0.1 }), m, 0)).toBe(false)
    expect(mayTalk('driver-go', world({ now: 1000 + TALK_GAP }), m, 0)).toBe(true)
    // the same moment: its own wait (longer than the gap)
    expect(TALK['buyer-thanks'].again).toBeGreaterThan(TALK_GAP)
    expect(mayTalk('buyer-thanks', world({ now: 1000 + TALK['buyer-thanks'].again - 0.1 }), m, 0)).toBe(false)
    expect(mayTalk('buyer-thanks', world({ now: 1000 + TALK['buyer-thanks'].again }), m, 0)).toBe(true)
    // while a line is being said, nothing else starts
    expect(mayTalk('driver-go', world({ now: 1100, speaking: true }), m, 0)).toBe(false)
    // you talk to the agent right after a buyer spoke, while they still speak: he answers
    expect(mayTalk('agent-hello', world({ now: 1001, speaking: true }), m, 0)).toBe(true)
    say('agent-hello', m, 1001)
    // but not again and again as you open his panel
    expect(mayTalk('agent-hello', world({ now: 1002 }), m, 0)).toBe(false)
    expect(mayTalk('agent-hello', world({ now: 1001 + TALK['agent-hello'].again }), m, 0)).toBe(true)
  })

  it('rare: on its chance — not every buyer every time; an answer always', () => {
    const m = freshMemory()
    const said = (moment: TalkMoment) => Array.from({ length: 100 }, (_, i) => mayTalk(moment, world(), m, (i + 0.5) / 100)).filter(Boolean).length
    expect(said('buyer-arrive')).toBe(35)
    expect(said('buyer-thanks')).toBe(50)
    expect(said('driver-chat')).toBe(30)
    expect(said('agent-hello')).toBe(100)
    for (const row of Object.values(TALK)) if (row.who !== 'agent') expect(row.chance).toBeLessThan(1)
  })

  it('the lines: a few plain words each, never the same twice in a row, and a sigh only after a long wait', () => {
    for (const [moment, row] of Object.entries(TALK)) {
      expect(row.lines.length, moment).toBeGreaterThan(1)
      for (const line of row.lines) {
        expect(line.length, line).toBeLessThanOrEqual(38)
        expect(line, line).toMatch(/^[A-Z][A-Za-z ,.!?']*$/)
      }
    }
    const m = freshMemory()
    let last = ''
    for (let i = 0; i < 20; i++) {
      const line = nextLine('buyer-thanks', m, 1000 + i * 100, 0.1)
      expect(line).not.toBe(last)
      last = line
    }
    expect(LONG_WAIT).toBeGreaterThanOrEqual(60)
  })
})
