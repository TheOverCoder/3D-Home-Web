// The table of the farm's sounds (update-v1/CONTRACTS.md §1.12): one row for each, saying what family it is, the touch
// that goes with it, how much its pitch may vary from one time to the next, the streak it climbs in, and what tells the
// same news without sound (nothing is told by sound alone). A new sound is a name, a row and a synth (./farmSounds.ts,
// which plays each by its row: `farmSound` gives its touch and varies it by `vary`). And a reward's touch: its family
// picks the pattern, its tier only how strong (one pattern, one meaning).

import type { Haptic } from '../lib/device'
import { rewardKind, tierRank, type RewardKind, type Tier } from '../lib/tier'
import type { FarmSound } from './farmSounds'

/** work done; coins in; a reward; a "no"; the farm's own (animals, machines); a cue that tells news; the interface; the
 *  quiet tinks of a count landing on its chip, many in a row after the press's own sound (the crystals). */
export type SoundFamily = 'work' | 'coins' | 'reward' | 'no' | 'world' | 'cue' | 'ui' | 'landing'
/** What tells the same news for a player with the sound off: a toast, the compass's mark, a chip, a count, a move on
 *  screen; none only for ambience. */
export type Twin = 'toast' | 'compass' | 'chip' | 'count' | 'motion' | 'none'
/** A touch: one of the phone's patterns (src/lib/device.ts), the stronger "coins in" for a big reward ('sale+',
 *  10·60·14·70·22 ms) among them. */
export type Feel = Haptic

export interface SoundRow {
  family: SoundFamily
  /** the touch with it (null: none): one of the phone's patterns (a reward's stronger double is rewardFeel's alone) */
  feel: Feel | null
  /** semitones of random pitch each time (0: always the same, as a cue must be) */
  vary: number
  /** the streak it climbs in, a step each quick press */
  climb?: 'work' | 'xp'
  twin: Twin
  /** the phone mix's trim (dB, none by default): how much louder or softer it plays than its synth writes it, so its
   *  family sounds even (./measure.ts holds each to its family's loudness) */
  mix?: number
}

const work = (twin: Twin = 'motion'): SoundRow => ({ family: 'work', feel: 'tick', vary: 1, climb: 'work', twin })
const world = (twin: Twin): SoundRow => ({ family: 'world', feel: null, vary: 0, twin })
/** One of the farm's own sounds that a press can make too (the hens' nest collected, a job put into a machine): it
 *  climbs the work's streak only when it comes with the work's touch. */
const pressed = (twin: Twin): SoundRow => ({ ...world(twin), climb: 'work' })
const ui = (feel: Feel): SoundRow => ({ family: 'ui', feel, vary: 1, twin: 'motion' })
const cue = (twin: Twin, feel: Haptic | null = null): SoundRow => ({ family: 'cue', feel, vary: 0, twin })

export const SOUNDS: Readonly<Record<FarmSound, SoundRow>> = {
  // (the phone mix's trims, dB: each to its family's loudness, ./measure.ts)
  plant: { ...work(), mix: 2 },
  water: { ...work(), mix: -7 },
  harvest: work(),
  milk: { ...work(), mix: 8 },
  shear: { ...work(), mix: 2 },
  build: { family: 'work', feel: 'buy', vary: 1, twin: 'motion' },
  coins: { family: 'coins', feel: 'sale', vary: 1, twin: 'chip' },
  till: { family: 'coins', feel: 'sale', vary: 1, twin: 'chip' },
  decline: { family: 'no', feel: 'tick', vary: 0, twin: 'motion' },
  cluck: { ...pressed('compass'), mix: 7 },
  moo: world('motion'),
  baa: world('motion'),
  crow: world('none'),
  creak: { ...pressed('motion'), mix: -3 },
  oven: { ...pressed('motion'), mix: -2 },
  loom: { ...pressed('motion'), mix: 3 },
  chug: world('motion'),
  bell: cue('count'),
  ding: cue('compass'),
  chime: cue('toast'),
  level: cue('motion', 'level'),
  keys: cue('motion', 'level'),
  surprise: { family: 'reward', feel: 'gift', vary: 0, twin: 'toast' },
  garment: { family: 'reward', feel: null, vary: 0, twin: 'motion' },
  xp: { family: 'landing', feel: null, vary: 0, climb: 'xp', twin: 'chip' },
  dress: { family: 'ui', feel: 'tick', vary: 0, twin: 'motion', mix: 2 },
  // each action its own (mission 06 c5): fruit picked, a machine's goods taken out (the mill's, the loom's, the oven's),
  // goods put into an order and up on a shelf, coins paid out, a "no", decoration lifted and put down
  pick: work(),
  sack: work('toast'),
  bolt: work('toast'),
  tray: work('toast'),
  crate: work('count'),
  shelf: work('count'),
  pay: { family: 'coins', feel: 'buy', vary: 1, twin: 'chip' },
  nope: { family: 'no', feel: null, vary: 0, twin: 'motion' },
  lift: ui('lift'),
  thud: ui('drop'),
}

/** Every sound the player causes: a press, a sale, a reward, a "no", the interface, and the farm's own when pressed (a
 *  touch with it, a streak, a reward's or a no's family). The phone mix holds each to its band, its peak and its
 *  family's loudness (./measure.ts). Not the farm's news (the gate's bell, a machine's ding, the chime) nor what it
 *  does by itself (the cows, the sheep, the cock, the tractor). */
export const PLAYER_SOUNDS: readonly FarmSound[] = (Object.keys(SOUNDS) as FarmSound[]).filter((k) => {
  const r = SOUNDS[k]
  return r.feel !== null || r.climb !== undefined || r.family === 'reward' || r.family === 'no'
})

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
