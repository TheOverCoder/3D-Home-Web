import { LADDERS, type LadderId } from '../data'
import { ladderPrice } from '../market'
import { farm } from './core'

// The upgrade ladders' steps as the farm has them (LADDERS in src/farm/data.ts): read by the panels that sell them.

/** A ladder's step bought, its next price, whether it is at its top. */
export const ladderLevel = (id: LadderId) => farm.ladders[id]
export const ladderMaxed = (id: LadderId) => farm.ladders[id] >= LADDERS[id].levels
export const ladderNextPrice = (id: LadderId) => ladderPrice(id, farm.ladders[id])
