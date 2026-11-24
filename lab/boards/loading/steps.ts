import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FIRST_TIMES } from '../../../src/ui/loadPace'
import type { LoadView } from './load'

// What the three loading proposals of round 6 share (boards loading-farmer, loading-almanac, loading-today): the way is
// shown as its three real steps — the farm's files coming, the house built, the graphics warmed up ("the lamps") — each
// a station of its own, never one bar that sits full while the last step runs. A station's fill runs on the compositor as
// one Web Animation started when its step begins (so it goes on while the page builds the house and warms the graphics up,
// the main thread held for seconds): fast at first, then slower and slower, toward its end but never to it — a step
// slower than expected still moves, and never says it is done — and once the step really ends, the rest fills in a
// moment and the next one starts. What the game would need for it: the loader's steps as they are (useLoader's phase)
// and this device's kept times of each (src/ui/loadPace.ts, pastTimes).

export type Step = LoadView['step']
export const STEPS = ['fetch', 'build', 'light'] as const
export type Station = (typeof STEPS)[number]
/** Which station is running: 3 once ready. */
export const stationOf = (step: Step) => (step === 'ready' ? 3 : STEPS.indexOf(step))

/** A first load's time for each step (src/ui/loadPace.ts, FIRST_TIMES over the network). */
const EXPECT: Record<Station, number> = FIRST_TIMES.network

/** Where a running station reaches by its expected time, and where it creeps on to (never 1 until its step ends). */
const BY_EXPECTED = 0.82
const CREEP_TO = 0.96

/** Keyframes of a station's fill: `val(v)` the CSS value for a share v of it, on property `prop` (a transform's part:
 *  translate, rotate or scale). */
export interface Fill {
  prop: 'translate' | 'rotate' | 'scale'
  val: (v: number) => string
}

const frame = (f: Fill, v: number): Keyframe => ({ [f.prop]: f.val(v) })

/** Runs each station's fill as its step goes: `ref(i)` gives station i's element. A station before the running one is
 *  full, after it empty; the running one goes on by itself (see above). `share`: how far the running step is already
 *  (the downloads' bytes), where it starts from. */
export function useStations(step: Step, fill: Fill | ((i: number) => Fill), share = 0, again = false) {
  const els = useRef<(HTMLElement | null)[]>([])
  const fillOf = (i: number) => (typeof fill === 'function' ? fill(i) : fill)
  const cur = stationOf(step)
  useLayoutEffect(() => {
    els.current.forEach((el, i) => {
      if (!el || typeof el.animate !== 'function') return
      const f = fillOf(i)
      const now = (getComputedStyle(el) as unknown as Record<string, string>)[f.prop] || f.val(0)
      for (const a of el.getAnimations()) a.cancel()
      if (i < cur) el.animate([{ [f.prop]: now }, frame(f, 1)], { duration: 420, delay: cur === 3 ? i * 90 : 0, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'both' })
      else if (i > cur) el.animate([frame(f, 0), frame(f, 0)], { duration: 1, fill: 'forwards' })
      else {
        const start = i === 0 ? Math.min(share, BY_EXPECTED - 0.05) : 0
        const ms = EXPECT[STEPS[i]] * (1 - start)
        el.animate([{ ...frame(f, start), easing: 'cubic-bezier(0.25, 0.7, 0.4, 1)' }, { ...frame(f, BY_EXPECTED), offset: 0.25, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' }, frame(f, CREEP_TO)], {
          duration: ms * 4,
          fill: 'forwards',
        })
      }
    })
    // (a step's change starts the next run; a share read once, as the step begins)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, again])
  return (i: number) => (el: HTMLElement | null) => {
    els.current[i] = el
  }
}

/** Seconds the running step has gone on (counted when the page is free: what is said after a while, never a number). */
export function useStepAge(step: Step) {
  const [age, setAge] = useState(0)
  useEffect(() => {
    setAge(0)
    const t0 = performance.now()
    const id = setInterval(() => setAge((performance.now() - t0) / 1000), 1000)
    return () => clearInterval(id)
  }, [step])
  return age
}

/** Longer than this step usually takes here (×1.6 of its time): what a proposal says about it, kindly. */
export const slowerThanUsual = (step: Step, age: number) => step !== 'ready' && age * 1000 > EXPECT[step] * 1.6

/** Once ready, a tap anywhere goes on (as in the game: the opening menu takes its place). */
export function useTapOn(ready: boolean, go: () => void) {
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => addEventListener('click', go, { once: true }), 300)
    return () => {
      clearTimeout(t)
      removeEventListener('click', go)
    }
  }, [ready, go])
}
