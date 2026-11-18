// The table of the farm's sounds (update-v1/CONTRACTS.md §1.12): one row for each, saying what family it is, the touch
// that goes with it, how much its pitch may vary from one time to the next, the streak it climbs in, and what tells the
// same news without sound (nothing is told by sound alone). A new sound is a name, a row and a synth. And a reward's
// touch: its family picks the pattern, its tier only how strong (one pattern, one meaning). 06 moves sound.ts onto it:
// until then sound.ts keeps today's FEEL, which these rows' `feel` must equal (sounds.test.ts). Not yet used by the game.

import type { Haptic } from '../lib/device'
import { rewardKind, tierRank, type RewardKind, type Tier } from '../lib/tier'
import type { FarmSound } from './sound'

/** work done; coins in; a reward; a "no"; the farm's own (animals, machines); a cue that tells news; the interface. */
export type SoundFamily = 'work' | 'coins' | 'reward' | 'no' | 'world' | 'cue' | 'ui'
/** What tells the same news for a player with the sound off: a toast, the compass's mark, a chip, a count, a move on
 *  screen; none only for ambience. */
export type Twin = 'toast' | 'compass' | 'chip' | 'count' | 'motion' | 'none'
/** A touch: today's, and 06's stronger "coins in" for a big reward ('sale+', 10·60·14·70·22 ms), which joins
 *  src/lib/device.ts's Haptic with 06's commit. */
export type Feel = Haptic | 'sale+'

export interface SoundRow {
  family: SoundFamily
  /** the touch with it (null: none) */
  feel: Feel | null
  /** semitones of random pitch each time (0: always the same, as a cue must be) */
  vary: number
  /** the streak it climbs in, a step each quick press */
  climb?: 'work' | 'xp'
  twin: Twin
}

const work = (twin: Twin = 'motion'): SoundRow => ({ family: 'work', feel: 'tick', vary: 1, climb: 'work', twin })
const world = (twin: Twin): SoundRow => ({ family: 'world', feel: null, vary: 0, twin })
const cue = (twin: Twin, feel: Feel | null = null): SoundRow => ({ family: 'cue', feel, vary: 0, twin })

export const SOUNDS: Readonly<Record<FarmSound, SoundRow>> = {
  plant: work(),
  water: work(),
  harvest: work(),
  milk: work(),
  shear: work(),
  build: { family: 'work', feel: 'buy', vary: 1, twin: 'motion' },
  coins: { family: 'coins', feel: 'sale', vary: 1, twin: 'chip' },
  till: { family: 'coins', feel: 'sale', vary: 1, twin: 'chip' },
  decline: { family: 'no', feel: 'tick', vary: 0, twin: 'motion' },
  cluck: world('compass'),
  moo: world('motion'),
  baa: world('motion'),
  crow: world('none'),
  creak: world('motion'),
  oven: world('motion'),
  loom: world('motion'),
  chug: world('motion'),
  bell: cue('count'),
  ding: cue('compass'),
  chime: cue('toast'),
  level: cue('motion', 'level'),
  keys: cue('motion', 'level'),
  surprise: { family: 'reward', feel: 'gift', vary: 0, twin: 'toast' },
  garment: { family: 'reward', feel: null, vary: 0, twin: 'motion' },
  xp: { family: 'reward', feel: null, vary: 0, climb: 'xp', twin: 'chip' },
  dress: { family: 'ui', feel: 'tick', vary: 0, twin: 'motion' },
}

/** A reward's touch: its family picks the pattern (coins in a double, a gift a roll, a level the strongest, goods
 *  collected a tick), its tier only how strong: a big or huge sum of coins is the stronger double. */
export function rewardFeel(kind: RewardKind, tier: Tier): Feel {
  switch (rewardKind(kind).family) {
    case 'coins':
      return tierRank(tier) >= tierRank('big') ? 'sale+' : 'sale'
    case 'gift':
    case 'garment':
      return 'gift'
    case 'level':
    case 'keys':
      return 'level'
    case 'work':
      return 'tick'
  }
}
