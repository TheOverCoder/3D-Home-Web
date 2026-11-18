import { useSyncExternalStore } from 'react'

// Less motion (update-v1/CONTRACTS.md §1.7): the one place the game asks whether things should move. A player chooses in
// Settings (06's setting: follow the device, less, or full); left to the device, it is the device's own "reduce motion".
// Under less motion nothing flies, pops, bobs or bursts, and the counts still change. Everything that moves asks here:
// code outside React `lessMotion()`, a component `useLessMotion()`, what read it once at load `onLessMotion(f)`; Motion's
// own moves follow it through `MotionRoot` (./motion.tsx, MotionConfig); and the CSS reads `<html data-motion="less">`,
// kept here, with `:where(:root[data-motion='less'])` round what stops (and `:not(…)` round what moves only when it
// may). No other file in src asks the device (`still.test.ts` reads the sources to hold it).

/** What the player chose: follow the device, less motion, or full motion whatever the device says. */
export type MotionPref = 'device' | 'less' | 'full'

/** Still: asked for in the game, or left to the device and the device asks. */
export const isStill = (pref: MotionPref, deviceAsks: boolean): boolean => pref === 'less' || (pref === 'device' && deviceAsks)

const QUERY = '(prefers-reduced-motion: reduce)'

let pref: MotionPref = 'device'
const listeners = new Set<(still: boolean) => void>()
let was: boolean | null = null

// The device's answer: one media query, asked again only when the page's matchMedia is another (a test's stand-in), so
// a reader asking every frame (the 3D scene's markers) costs a comparison.
let asked: unknown = null
let query: MediaQueryList | null = null
function device(): MediaQueryList | null {
  const ask = typeof matchMedia === 'function' ? matchMedia : null
  if (ask !== asked) {
    query?.removeEventListener?.('change', changed)
    asked = ask
    query = ask ? ask(QUERY) : null
    if (listeners.size) query?.addEventListener?.('change', changed)
  }
  return query
}

/** Less motion now, for code outside React (the effects, the 3D scene, a burst, a flight). */
export function lessMotion(): boolean {
  return isStill(pref, device()?.matches ?? false)
}

/** Tells the listeners when the answer changed (from the setting, or the device's own). */
function changed() {
  const now = lessMotion()
  if (now === was) return
  was = now
  for (const f of listeners) f(now)
}

/** The player's choice (06's setting sets it at load and on every change). */
export function setMotionPref(next: MotionPref) {
  pref = next
  changed()
}

/** Called with the answer each time it changes, for what read it once at load (the 3D scene's markers, the films).
 *  Returns the way to stop. */
export function onLessMotion(f: (still: boolean) => void): () => void {
  if (!listeners.size) {
    was = lessMotion()
    device()?.addEventListener?.('change', changed)
  }
  listeners.add(f)
  return () => {
    listeners.delete(f)
    if (!listeners.size) query?.removeEventListener?.('change', changed)
  }
}

/** Less motion, for a component: drawn again when the answer changes. */
export const useLessMotion = (): boolean => useSyncExternalStore(onLessMotion, lessMotion, lessMotion)

/** `<html data-motion="less">` while still, for the CSS: written at once, and kept for the page's life. */
function mark(still: boolean) {
  if (still) document.documentElement.dataset.motion = 'less'
  else delete document.documentElement.dataset.motion
}
if (typeof document !== 'undefined') {
  mark(lessMotion())
  onLessMotion(mark)
}
