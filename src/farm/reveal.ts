// What the top of the screen holds back on a new farm while its first steps run (decision 14: a calm first screen that
// grows as things start to matter). Each part has a row: the farm's number that brings it in — the silo's and the
// barn's tanks with their first good, the line at the gate with the first planting (buyers come from then on) — or
// nothing, so it waits for the steps to end: the goals' trophy, the level's gift boxes (the chip's glow and count), the
// news's badge, the beds' gear and the three buttons over the stick. Once the steps are over (done, skipped, grown
// past) or quiet (where the game is tested), everything shows, as on any farm from before: nothing is saved, and
// nothing is lost meanwhile (the gifts and the goals build up, and are there when their part comes in). Pure: the farm's
// side (`shows`, src/farm/state/steps.ts) says whether the steps run; what a part that shows may move is the attention
// budget's (src/ui/calls.ts), never this.

import { STORE_GOODS } from './storage'
import type { FarmData } from './state'
import type { StoreId } from './data'

export type RevealPart = 'silo' | 'barn' | 'line' | 'goals' | 'gifts' | 'news' | 'gear' | 'stickTools'

/** The farm has got a good kept in this building (harvested, collected, made, found): its tank comes in. */
const firstGood = (store: StoreId) => (f: FarmData) => STORE_GOODS[store].some((g) => (f.got[g] ?? 0) > 0)
/** Held until the steps end. */
const afterSteps = () => false

/** Each part held back while a new farm's steps run, and what brings it in before they end (in the order they come in
 *  as the steps end: one after another, a beat apart). */
export const REVEAL: Readonly<Record<RevealPart, (f: FarmData) => boolean>> = {
  silo: firstGood('silo'),
  barn: firstGood('barn'),
  line: (f) => f.started,
  goals: afterSteps,
  gifts: afterSteps,
  news: afterSteps,
  gear: afterSteps,
  stickTools: afterSteps,
}
export const REVEAL_PARTS = Object.keys(REVEAL) as RevealPart[]

/** How long after the one before each part held to the steps' end comes in (ms): one at a time, not all at once. */
export const ARRIVE_GAP_MS = 120

/** When a part comes in as the steps end, after the steps' own last card (ms from the first of them): the parts held to
 *  the end, one after another in REVEAL's order. 0 for one a farm number brought in. */
export const arriveDelay = (part: RevealPart) => {
  const held = REVEAL_PARTS.filter((p) => REVEAL[p] === afterSteps)
  const k = held.indexOf(part)
  return k < 0 ? 0 : k * ARRIVE_GAP_MS
}

/** Whether a part shows: everything while the steps are not running (over, or quiet); while they run, its row. */
export const reveals = (part: RevealPart, f: FarmData, stepsRunning: boolean) => !stepsRunning || REVEAL[part](f)
