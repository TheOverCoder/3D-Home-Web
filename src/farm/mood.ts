import { debugSet } from '../lib/debug'
import { onHere } from '../lib/quiet'
import { CROPS, isItem, type CropId, type ProduceId } from './data'
import { priceOf } from './prices'

// The town's market mood (update-v1 decision 09): every good the farm sells is worth a little more or a little less
// from one day to the next — at most a tenth either way, half of it a wave the whole market rides (about two weeks
// long) and half each good's own (a week to eleven days) — the same on every farm for a date, and never because you
// sold. Nothing is saved: any day, past or tomorrow, is worked out from the date and the good, so the house's computer
// can show a week back and tomorrow (src/farm/computer/marketView.ts). The building materials never move (the
// contractor keeps his own prices). Every sale's price takes it through the day's factor, beside the lucky draw
// (src/farm/state/day.ts). Quiet where the game is tested (src/lib/quiet.ts: under Vitest, and on a ?debug page unless
// it says `&mood=on`); a test turns it on with `setMood` (`window.__home.mood` on a ?debug page).

/** How the mood moves: at most `amount` either way, `shared` of it the whole market's wave of `waves.shared` days, the
 *  rest each good's own wave, from `waves.own[0]` to `waves.own[1]` days long. */
export const MOOD = { amount: 0.1, shared: 0.5, waves: { shared: 13, own: [7, 11] } } as const

const TAU = Math.PI * 2

/** A good's own number, the same on every device for its id (FNV-1a over its letters). */
function hashOf(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0
  return h
}

/** Each good's own wave: how many days it lasts (whole days, from the least to the most) and where it starts. */
const OWN = new Map<string, { days: number; phase: number }>()
function ownWave(good: string) {
  let w = OWN.get(good)
  if (!w) {
    const h = hashOf(good)
    const [least, most] = MOOD.waves.own
    w = { days: least + (h % (most - least + 1)), phase: (TAU * ((h >>> 8) % 1000)) / 1000 }
    OWN.set(good, w)
  }
  return w
}

/** What the market's mood multiplies a good's price by on a calendar day (a day number of src/farm/calendar.ts):
 *  1 ± MOOD.amount; a building material's, and a day that is not one, 1. Pure: the same good and day, the same mood. */
export function moodOf(good: ProduceId, day: number): number {
  if (isItem(good) || !Number.isFinite(day)) return 1
  const own = ownWave(good)
  const shared = Math.sin((TAU * day) / MOOD.waves.shared)
  const mine = Math.sin((TAU * day) / own.days + own.phase)
  return 1 + MOOD.amount * (MOOD.shared * shared + (1 - MOOD.shared) * mine)
}

/** The crops the vegetable index is made of. */
export const BASKET: readonly CropId[] = CROPS.map((c) => c.id)

/** The vegetable index on a day: the mood of every crop, the mean, ×100 (100: as fair). */
export const vegIndex = (day: number, mood: (good: ProduceId, day: number) => number = moodOf) => (100 * BASKET.reduce((n, c) => n + mood(c, day), 0)) / BASKET.length

/** A good's mood on the `n` days up to `today`, the oldest first and today last. */
export const moodDays = (good: ProduceId, today: number, n: number) => Array.from({ length: Math.max(0, n) }, (_, k) => moodOf(good, today - (n - 1) + k))

// ───────────────────────────── on or quiet ─────────────────────────────

let on = onHere('mood')

/** Whether prices follow the mood now (in play; quiet where the game is tested, until a test turns it on). Asked by
 *  every price (src/farm/state/day.ts), so the first one makes the page's hook. */
export function moodOn() {
  hook()
  return on
}

/** For the tests (and a ?debug page's console): prices follow the mood (true), or not (false: every good at 1). Not
 *  kept: a page loaded again has it as its address says. */
export function setMood(v: boolean) {
  on = v
}

/** What the mood multiplies a good's price by on a day, as the game has it now: 1 while it is quiet. */
export const moodToday = (good: ProduceId, day: number): number => (moodOn() ? moodOf(good, day) : 1)

/** ?debug: `window.__home.mood` — the tests' switch (`on`, and `quiet` as the other quiet switches), whether it is on,
 *  a good's mood on a day, the vegetable index, and what a good is worth now (priceOf: every sale's price). Made the
 *  first time a price asks for it (the page's hooks are made after this module loads), or by `moodHook`. */
let hooked = false
function hook() {
  if (hooked || typeof window === 'undefined' || !('__home' in window)) return
  hooked = true
  debugSet('mood', { on: setMood, quiet: (q: boolean) => setMood(!q), now: () => on, of: moodOf, index: vegIndex, price: priceOf })
}
/** Makes `window.__home.mood` now, on a ?debug page (the house's computer, as it mounts). */
export const moodHook = hook
