// The game's one key for everything that rings, and how a sound varies from one time to the next. Every reward and cue
// sting is written in C major pentatonic (C D E G A): no two ever clash, and none clashes with the music, since these
// five notes lie in all four tracks' scales (./music.ts: C pentatonic, A minor, G major, F major). A sound that may vary
// (work, coins) comes a little higher or lower and a little louder or softer each time; a cue is always the same.
// No imports: the sounds, the music and the tests read it alike.

/** The key's notes, in semitones over C. */
export const KEY = [0, 2, 4, 7, 9] as const

/** A MIDI note's frequency (A4, note 69, is 440 Hz). */
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** The key's `step`-th note from C in `octave`, in Hz: step 0 is C, 4 is A, 5 the C above, -1 the A below; note(0, 4)
 *  is middle C. */
export function note(step: number, octave: number): number {
  const n = KEY.length
  const o = octave + Math.floor(step / n)
  return hz(12 * (o + 1) + KEY[((step % n) + n) % n])
}

/** How far `f` (Hz) lies from the nearest note of the key, in cents (a hundredth of a semitone). */
export function offKey(f: number): number {
  const pc = (((69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12
  let best = Infinity
  for (const k of KEY) for (const o of [-12, 0, 12]) best = Math.min(best, Math.abs(pc - k - o))
  return best * 100
}

/** How much a varying sound's loudness may change each time, either way (a share: 10 %). */
export const VARY_LEVEL = 0.1

/** A sound's pitch and loudness this time, as factors: up to `vary` semitones either way and ±VARY_LEVEL of its
 *  loudness; exactly as written (1, 1) for a row that may not vary (a cue, a "no"). `rand` is the dice. */
export function vary(row: { vary: number }, rand: () => number = Math.random): { pitch: number; level: number } {
  if (!row.vary) return { pitch: 1, level: 1 }
  return { pitch: 2 ** (((rand() * 2 - 1) * row.vary) / 12), level: 1 + (rand() * 2 - 1) * VARY_LEVEL }
}
