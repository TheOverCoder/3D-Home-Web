// Reading a save safely (update-v1/CONTRACTS.md §1.2): every sanitizer reads what a save holds with these, so that a
// hand-edited or broken save can never break the game, and each name means one thing everywhere. The same few
// readers were written again in ten sanitizers, and `whole` alone meant four different things there; these replaced
// them all, with no change in what any save loads to. Pure, no imports.

/** The biggest count that still counts: past it, one more is the same number. */
export const MOST = Number.MAX_SAFE_INTEGER

/** An object, lists too (a list is read by index). */
export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
/** An object that is not a list: a record of named parts. */
export const isRecord = (v: unknown): v is Record<string, unknown> => isObject(v) && !Array.isArray(v)
/** A part of an object as saved (a field, or a list's item); anything else: undefined. */
export const field = (v: unknown, k: string | number): unknown => (isObject(v) ? v[k] : undefined)
/** A list as saved; anything else: none. */
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** A finite number; anything else: `d`. */
export const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
/** A whole number, rounded, from `lo` to `hi`; not a number: `d` (clamped too). */
export const int = (v: unknown, d: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(num(v, d))))
/** A count (coins, goods, stats): a whole number, rounded, from 0 to MOST; not a number: `d`. */
export const amount = (v: unknown, d: number): number => int(v, d, 0, MOST)
/** A count that keeps only what was really there: the whole part of a finite number above 0, up to MOST; anything
 *  else (0, below, a fraction under 1, not a number): 0. */
export const floorCount = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(MOST, Math.floor(v)) : 0)
/** Already a whole number from `lo` to `hi`, taken as it is (a check: nothing is converted). */
export const intIn = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
/** Seconds, from 0 up to `most`: what a crop has grown, the water in its soil, a machine's job done. */
export const seconds = (v: unknown, most: number): number => Math.min(most, Math.max(0, num(v, 0)))
/** A clock counting to its next turn: from 0 to under `every`, as the game leaves it; anything else starts again at 0.
 *  (Counting down takes `every` off until it is under it: from 1e20, minus 40 is 1e20, never.) */
export const cycle = (v: unknown, every: number): number => {
  const t = num(v, 0)
  return t > 0 && t < every ? t : 0
}

/** One of the names given; anything else: null. */
export const oneOf = <T extends string>(v: unknown, names: readonly T[]): T | null => (typeof v === 'string' && (names as readonly string[]).includes(v) ? (v as T) : null)
/** The names given that a saved list holds, each once, in the order saved. */
export const namesOf = <T extends string>(v: unknown, names: readonly T[]): T[] => [
  ...new Set(
    list(v)
      .map((x) => oneOf(x, names))
      .filter((x): x is T => x !== null),
  ),
]
