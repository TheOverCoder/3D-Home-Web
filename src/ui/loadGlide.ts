// How the loading bar moves (./Loading.tsx). It never goes back, and within a step whose own count is coarse (the house
// being built, the graphics warming up: long stretches in which the page's work holds the main thread and nothing it
// draws can change) it glides on towards that step's end by itself, fast at first and slower near it, so it is never
// seen standing still. The bar is moved there on the compositor (an animation of `translate`, which goes on while the
// main thread is held), and the number follows the same curve whenever the page can draw it.

export type LoadStep = 'fetch' | 'build' | 'light' | 'ready'

/** Each step's part of the way (0..1): the downloads to 70 %, building the house to 85 %, the graphics to the end. */
export const WINDOWS: Readonly<Record<LoadStep, readonly [number, number]>> = { fetch: [0, 0.7], build: [0.7, 0.85], light: [0.85, 1], ready: [1, 1] }

/** How long the bar takes to glide across a whole step by itself (s): long enough that a slow phone's step ends
 *  before the glide does (a fast one's ends sooner, and the bar goes on from where it is). The downloads count their
 *  bytes as they come, so they need no glide of their own. */
export const GLIDE: Readonly<Record<LoadStep, number>> = { fetch: 0, build: 10, light: 8, ready: 0 }

/** How far into its step the glide goes by itself: the rest waits for the step to end. */
export const GLIDE_MOST = 0.94

/** The curve of a glide (0..1 of its time to 0..1 of its way): CSS's `cubic-bezier(0.33, 1, 0.68, 1)`, the bar's own. */
export const easeOut = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3
export const EASE_OUT_CSS = 'cubic-bezier(0.33, 1, 0.68, 1)'

/** A glide under way: from where, to where, from when (ms) and for how long (ms). */
export interface Glide {
  step: LoadStep
  from: number
  to: number
  at: number
  ms: number
}

/** Where a glide's bar is at `now` (ms). */
export const glideAt = (g: Glide, now: number) => g.from + (g.to - g.from) * easeOut(g.ms > 0 ? (now - g.at) / g.ms : 1)

/** The glide that starts at `from` in `step` at `now`: to the step's own end by itself, at the speed of a whole step
 *  (a glide that starts part of the way across takes its share of the time). None in a step that counts its own way. */
export function glideFrom(step: LoadStep, from: number, now: number): Glide | null {
  const [lo, hi] = WINDOWS[step]
  if (!GLIDE[step]) return null
  const to = lo + (hi - lo) * GLIDE_MOST
  if (from >= to) return null
  return { step, from, to, at: now, ms: GLIDE[step] * 1000 * ((to - from) / (to - lo)) }
}

/** The bar after a tick: where it shows (never back, never past the step's own end before it is reached, 1 once ready),
 *  and the glide it is on (a new one when the step changed, or when the step's own count got ahead of the glide). */
export function nextShown(prev: number, step: LoadStep, real: number, glide: Glide | null, now: number): { shown: number; glide: Glide | null } {
  if (step === 'ready') return { shown: 1, glide: null }
  const counted = Math.max(prev, real)
  if (!glide || glide.step !== step) {
    const g = glideFrom(step, counted, now)
    return { shown: counted, glide: g }
  }
  const gliding = glideAt(glide, now)
  // the step's own count is ahead of the glide: on from there
  if (real > gliding + 0.005) return { shown: Math.max(prev, real), glide: glideFrom(step, real, now) }
  return { shown: Math.max(prev, gliding, real), glide }
}
