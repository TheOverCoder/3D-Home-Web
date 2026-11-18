import type { Prize } from '../gifts'
import { farm, putBack } from './core'

// A reward into the farm: coins, or goods into their building even past full.

/** A prize into the farm: coins, or goods into their building even past full (as surprises go: refused, they would
 *  be lost). */
export function give(p: Prize) {
  if ('coins' in p) farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + p.coins)
  else putBack(p.item, p.n)
}
