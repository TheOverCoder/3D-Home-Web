// Less motion (update-v1/CONTRACTS.md §1.7): the one place the game asks whether things should move. A player chooses in
// Settings (06's setting: follow the device, less, or full); left to the device, it is the device's own "reduce motion".
// Under less motion nothing flies, pops, bobs or bursts, and the counts still change. 07 adds the React hook and
// <html data-motion="less">, and moves today's fourteen readers onto this one. Not yet used by the game.

/** What the player chose: follow the device, less motion, or full motion whatever the device says. */
export type MotionPref = 'device' | 'less' | 'full'

/** Still: asked for in the game, or left to the device and the device asks. */
export const isStill = (pref: MotionPref, deviceAsks: boolean): boolean => pref === 'less' || (pref === 'device' && deviceAsks)

const QUERY = '(prefers-reduced-motion: reduce)'
const media = () => (typeof matchMedia === 'function' ? matchMedia(QUERY) : null)

let pref: MotionPref = 'device'
const listeners = new Set<(still: boolean) => void>()
let was: boolean | null = null
let watching: MediaQueryList | null = null

/** Less motion now, for code outside React (the effects, the 3D scene, a burst, a flight). */
export function lessMotion(): boolean {
  return isStill(pref, media()?.matches ?? false)
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
    watching = media()
    watching?.addEventListener?.('change', changed)
  }
  listeners.add(f)
  return () => {
    listeners.delete(f)
    if (!listeners.size) {
      watching?.removeEventListener?.('change', changed)
      watching = null
    }
  }
}
