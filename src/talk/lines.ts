import type { Mood } from '../film/format'

// What the game's characters say out loud, as data: who says it, at which moment, how likely, how near you must be,
// how long before that moment is said again, and the lines (clear, simple English, a few words each). Read aloud in
// the device's own speech voices (./speech.ts), each character in a voice of their own; when a line may be said at all
// is ./rules.ts. Rare on purpose: a buyer greets now and then, not every buyer every time.

/** Who talks: the estate agent, a buyer in the line at the gate, the man on the tractor. */
export type Speaker = 'agent' | 'buyer' | 'driver'

export interface TalkRow {
  who: Speaker
  /** said in answer to you (you talked to them): no other line's gap holds it back, and it cuts in */
  answer?: boolean
  /** how likely the moment is said when it comes (0..1) */
  chance: number
  /** seconds before this moment is said again, by anyone */
  again: number
  /** said only within this many metres of you */
  near: number
  /** how it is said (the speech voice's pitch and pace move with it: src/film/voice.ts, readingOf) */
  mood: Mood
  lines: readonly string[]
}

export const TALK = {
  // the estate agent, when you talk to him (src/farm/Estate.tsx) and when the house is bought from him
  'agent-hello': {
    who: 'agent',
    answer: true,
    chance: 1,
    again: 8,
    near: 6,
    mood: 'warm',
    lines: ['Hello! Looking for a house?', 'Good day! A house of your own?', 'Welcome! The house is still for sale.'],
  },
  'agent-yours': { who: 'agent', answer: true, chance: 1, again: 8, near: 6, mood: 'warm', lines: ['Hello again! How is the house?', 'Your car is in the parking lot.', 'Enjoy your new house!'] },
  'agent-sold': { who: 'agent', answer: true, chance: 1, again: 0, near: 6, mood: 'warm', lines: ['Here are your keys. Enjoy!', 'Congratulations! The house is yours.'] },
  // a buyer in the line at the gate (src/farm/Visitors.tsx): a greeting at their place, thanks when served, a word
  // when turned away, a sigh after a long wait
  'buyer-arrive': { who: 'buyer', chance: 0.35, again: 30, near: 12, mood: 'flat', lines: ['Hello!', 'Hi there!', 'Hello, farmer!', 'Hi! Anything fresh today?'] },
  'buyer-thanks': { who: 'buyer', chance: 0.5, again: 12, near: 10, mood: 'warm', lines: ['Thank you!', 'Thanks a lot!', 'Lovely, thank you!', 'Perfect, thanks!'] },
  'buyer-no': { who: 'buyer', chance: 0.6, again: 12, near: 10, mood: 'sad', lines: ['Oh well.', 'Maybe next time.', 'Oh. Okay.'] },
  'buyer-wait': { who: 'buyer', chance: 0.5, again: 60, near: 12, mood: 'sad', lines: ['Hmm. Still waiting.', 'Oh, this line is long.', 'I can wait. I think.'] },
  // the man on the tractor (src/farm/OrderYard.tsx): a few words as he works, a short sentence now and then
  'driver-load': { who: 'driver', chance: 0.6, again: 45, near: 14, mood: 'flat', lines: ['Up you go.', 'One more crate.', 'Load it up.'] },
  'driver-go': { who: 'driver', chance: 0.5, again: 45, near: 16, mood: 'flat', lines: ['Off we go!', 'To town!'] },
  'driver-back': { who: 'driver', chance: 0.5, again: 45, near: 16, mood: 'flat', lines: ['Back again.', 'Easy does it.'] },
  'driver-chat': {
    who: 'driver',
    chance: 0.3,
    again: 150,
    near: 14,
    mood: 'warm',
    lines: ['The town loves your vegetables.', 'Another order, another trip!', 'A nice day for a drive.', 'I will be back soon.'],
  },
} as const satisfies Record<string, TalkRow>

export type TalkMoment = keyof typeof TALK

/** At least this many seconds between any two lines (but an answer). */
export const TALK_GAP = 10

/** A buyer who has stood this long in line (s of the farm's clock) sighs (once, maybe). */
export const LONG_WAIT = 90
