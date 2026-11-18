import type { CropDef } from '../data'
import { lockOf } from '../state'

// What the seed packets and a bed's gear share: a crop's name as a title, and whether its seeds are open yet.

export const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** A crop's seeds, as the packets show it: open, or not yet (the level it opens at). */
export const cropLock = (c: CropDef) => lockOf(`crop:${c.id}`)
