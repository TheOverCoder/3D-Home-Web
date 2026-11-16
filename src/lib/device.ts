import { useSettings } from '../settings'

/** A touch screen is the main input (phones, tablets): on-screen controls, drag to look. */
export const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** The phone can buzz (Android browsers; iPhones cannot from a web page). */
export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

/** The game's touches: one for each kind of thing that happens under the player's hand. */
export type Haptic = 'tick' | 'sale' | 'buy' | 'gift' | 'level' | 'lift' | 'drop'

/** Each touch as the phone plays it (ms on, off, on…): short, and told apart by rhythm and strength. */
export const HAPTICS: Record<Haptic, number | number[]> = {
  /** something taken, planted, watered, put in: one short tick */
  tick: 12,
  /** coins in (a sale, a claim): a double */
  sale: [10, 60, 14],
  /** a thing bought or built: one firmer */
  buy: 26,
  /** a gift opened (or a surprise found): a little roll */
  gift: [8, 40, 8, 40, 22],
  /** a level reached, the house's keys: the strongest */
  level: [30, 70, 50],
  /** something lifted under the finger (a job in a machine's queue), and put down */
  lift: 8,
  drop: 16,
}

/** The one way the game buzzes: a touch where the phone can and the player has not turned Vibration off (Settings). */
export function haptic(kind: Haptic | null | undefined) {
  if (!kind || !coarsePointer || !canVibrate || !useSettings.getState().vibration) return
  try {
    navigator.vibrate(HAPTICS[kind])
  } catch {
    /* refused (no tap on the page yet): nothing */
  }
}
