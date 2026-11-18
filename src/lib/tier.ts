// The words of a reward (update-v1/CONTRACTS.md §1.11): how big it is (its tier) and what kind of reward it is, with the
// family that decides how it feels and sounds. This file holds only the names, with no imports, so that the sounds
// (src/audio, which loads no farm code), the effects and the farm all read the same ones. How big a reward is, from
// what it holds, is decided in src/farm/worth.ts; how it is shown, in src/fx/reward.ts (05); its sound and touch in
// src/audio/sounds.ts (06). Not yet used by the game.

/** How big a reward is, smallest first. The amount decides, never dice, a streak or a near miss. */
export const TIERS = ['small', 'medium', 'big', 'huge'] as const
export type Tier = (typeof TIERS)[number]

/** How a reward feels and sounds: coins in, a gift opened, a level, a garment, the house's keys, or goods collected. */
export type Family = 'coins' | 'gift' | 'level' | 'garment' | 'keys' | 'work'

/** Every kind of reward the game pays out, each with its family, and the least tier it is ever shown at (most have
 *  none: they are as big as what they hold). A new kind of payout is a row. */
export const REWARD_KINDS = {
  // coins in
  sale: { family: 'coins' }, // a buyer at the gate, the whole line, the manager, the contractor buying materials
  order: { family: 'coins' },
  till: { family: 'coins' },
  goal: { family: 'coins' },
  step: { family: 'coins' }, // a first step's reward
  // a level's coins: a level reached always feels like one
  level: { family: 'level', least: 'big' },
  // a gift opened
  daily: { family: 'gift' },
  back: { family: 'gift' }, // the welcome-back gift
  box: { family: 'gift' }, // a level's gift box
  surprise: { family: 'gift' },
  stop: { family: 'gift' }, // a stop on the season road
  letter: { family: 'gift' },
  chapter: { family: 'gift' },
  // a garment given: by an album page, or with a level
  page: { family: 'garment', least: 'big' },
  garment: { family: 'garment', least: 'big' },
  // the house bought: its keys
  keys: { family: 'keys', least: 'huge' },
  // goods collected: from the beds, the animals and the tree, the machines
  harvest: { family: 'work' },
  collect: { family: 'work' },
  made: { family: 'work' },
} as const satisfies Record<string, { family: Family; least?: Tier }>
export type RewardKind = keyof typeof REWARD_KINDS
export const REWARD_KIND_IDS = Object.keys(REWARD_KINDS) as RewardKind[]

/** A kind's row, with its least tier when it has one. */
export const rewardKind = (kind: RewardKind): { family: Family; least?: Tier } => REWARD_KINDS[kind]

/** A tier's place, 0 for the smallest. */
export const tierRank = (t: Tier): number => TIERS.indexOf(t)

/** A tier never under `least`. */
export const atLeast = (t: Tier, least?: Tier): Tier => (least && tierRank(least) > tierRank(t) ? least : t)
