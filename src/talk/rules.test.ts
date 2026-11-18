import { describe, expect, it } from 'vitest'
import { NEIGHBOUR_IDS } from '../data/people'
import { MOST_HEARTS } from '../farm/people/friends'
import { TALK, TALK_GAP, voiceMood, type Line, type TalkMoment } from './lines'
import { freshMemory, mayTalk, nextLine, type TalkWorld } from './rules'

// When a character may say a line (./rules.ts, the lines ./lines.ts): only where the device can speak, with the game's
// sound on and started, never over a film or the drive or with the page hidden, only on your map and near you; never
// sooner than the gap after any line or the moment's own wait (an answer to you excepted from the gap); then on the
// moment's chance. And the lines themselves: short, plain, never the same one twice in a row; a neighbour's opening as
// their hearts grow.

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

  it("the lines: a few plain words each, said by the moment's speaker, never the same twice in a row", () => {
    for (const [moment, row] of Object.entries(TALK)) {
      const lines: readonly Line[] = row.lines
      expect(lines.filter((l) => !l.hearts).length, moment).toBeGreaterThan(1)
      for (const line of lines) {
        expect(line.who, line.say).toBe(row.who)
        expect(line.say.length, line.say).toBeLessThanOrEqual(38)
        expect(line.say, line.say).toMatch(/^[A-Z][A-Za-z ,.!?']*$/)
      }
    }
    const m = freshMemory()
    let last = ''
    for (let i = 0; i < 20; i++) {
      const line = nextLine('buyer-thanks', m, 1000 + i * 100, 0.1).say
      expect(line).not.toBe(last)
      last = line
    }
  })

  it("a neighbour's lines open as their hearts grow: none before its heart, every one by the last", () => {
    for (const who of NEIGHBOUR_IDS)
      for (const moment of [`${who}-arrive`, `${who}-thanks`] as const) {
        const lines: readonly Line[] = TALK[moment].lines
        // a greeting and thanks from the first meeting, and a new line at each heart
        for (let h = 1; h <= MOST_HEARTS; h++) expect(lines.filter((l) => l.hearts === h).length, `${moment} at ${h}`).toBeGreaterThan(0)
        for (let hearts = 0; hearts <= MOST_HEARTS; hearts++) {
          const m = freshMemory()
          const said = new Set<string>()
          for (let i = 0; i < 400; i++) {
            const line = nextLine(moment, m, i, (i * 0.618) % 1, hearts)
            expect(line.hearts ?? 0, `${moment}: "${line.say}" at ${hearts}`).toBeLessThanOrEqual(hearts)
            said.add(line.say)
          }
          // everything open is said in time
          expect(said.size, `${moment} at ${hearts}`).toBe(lines.filter((l) => (l.hearts ?? 0) <= hearts).length)
        }
      }
  })

  it('each face read in a voice: glad warm, a question or a "go on" plainly, a surprise lifted', () => {
    expect(voiceMood('cheerful')).toBe('warm')
    expect(voiceMood('curious')).toBe('flat')
    expect(voiceMood('encouraging')).toBe('flat')
    expect(voiceMood('excited')).toBe('shock')
    // the moments of before read as they did: the agent warm, a buyer's greeting plain and thanks warm, the driver's
    // working words plain and his chat warm
    const read = (moment: TalkMoment) => [...new Set(TALK[moment].lines.map((l) => voiceMood(l.mood)))]
    expect(read('agent-hello')).toEqual(['warm'])
    expect(read('buyer-arrive')).toEqual(['flat'])
    expect(read('buyer-thanks')).toEqual(['warm'])
    expect(read('driver-load')).toEqual(['flat'])
    expect(read('driver-chat')).toEqual(['warm'])
  })
})
