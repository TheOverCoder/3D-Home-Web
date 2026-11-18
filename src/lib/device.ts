import { useSettings } from '../settings'

/** A touch screen is the main input (phones, tablets): on-screen controls, drag to look. */
export const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** The phone can buzz (Android browsers; iPhones cannot from a web page). */
export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

/** An iPhone or iPad (an iPad says it is a Mac, but has a touch screen): its ring switch, or silent mode, silences the
 *  game's sound, as the settings say (the page leaves `navigator.audioSession` at its default, so the switch is kept). */
export const appleTouch = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1))

/** The game's touches: one for each kind of thing that happens under the player's hand (update-v1/CONTRACTS.md §1.12's
 *  map: one pattern, one meaning; a reward's size changes only how strong, never which). */
export type Haptic = 'tick' | 'sale' | 'sale+' | 'buy' | 'gift' | 'level' | 'lift' | 'drop'

/** Each touch as the phone plays it (ms on, off, on…): short, and told apart by rhythm and strength. */
export const HAPTICS: Record<Haptic, number | number[]> = {
  /** work done (planted, watered, picked, collected, a tap, a job added, put in, a shelf filled), declined, a claim
   *  pressed: one short tick */
  tick: 12,
  /** coins in (a sale, a claim): a double */
  sale: [10, 60, 14],
  /** coins in, a big or huge sum: the same double and a stronger third (src/audio/sounds.ts, rewardFeel) */
  'sale+': [10, 60, 14, 70, 22],
  /** coins out (a thing bought or built, paid for, a queue's place): one firmer */
  buy: 26,
  /** a gift opened (or a surprise found): a little roll */
  gift: [8, 40, 8, 40, 22],
  /** a level reached, the house's keys: the strongest */
  level: [30, 70, 50],
  /** something lifted under the finger (a job in a machine's queue, decoration, furniture), and put down where it
   *  fits (none where it does not: a "no" is never felt) */
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
