// How the loading bar moves (./Loading.tsx): at one even pace from nothing to full over the time this load will take, as
// this device's last loads took (each step's time kept: the downloads, building the house, warming up the graphics).
// When a step ends sooner or later than it did, the bar's speed changes so it arrives when the load does — it never
// jumps or goes back, never runs faster than a whole bar in FASTEST_MS nor slower than SLOWEST; past the planned end it
// creeps on, slower and slower, short of full, until the game is ready, and then fills in a moment. On the page the bar
// is one animation the compositor runs (`Pace`), so it keeps its pace while the main thread is busy building the house.

export type LoadStep = 'fetch' | 'build' | 'light' | 'ready'
/** Each step's time on this device (ms). */
export interface StepTimes {
  fetch: number
  build: number
  light: number
}

/** Where the even pace ends: the rest of the bar is the creep's and the last moment's. */
export const EVEN = 0.96
/** How far the bar creeps past its plan while the game is not ready yet. */
export const LAST = 0.99
/** How long that creep takes to get most of the way (ms). */
export const CREEP_MS = 8000
/** The bar never moves faster than a whole one in this long (ms): a step that ends early makes it hurry, not leap. */
export const FASTEST_MS = 3500
/** Once ready, the rest of the bar fills in this long (ms). */
export const FINISH_MS = 450

/** A first load's guess, before this device has a time of its own: from the device's own copy (the files kept by the
 *  service worker), or over the network. */
export const FIRST_TIMES: Readonly<Record<'device' | 'network', StepTimes>> = {
  device: { fetch: 600, build: 4500, light: 2500 },
  network: { fetch: 7000, build: 5000, light: 3000 },
}

const STEPS: readonly (keyof StepTimes)[] = ['fetch', 'build', 'light']

/** When the bar should reach EVEN (ms from the load's start): what the steps before this one took, plus this step's own
 *  time (at least what it has taken so far and a beat more; from its own count, `share` of it done, when it has one),
 *  plus what the steps after it took last time. */
export function finishAt(step: LoadStep, stepStart: number, now: number, past: StepTimes, share: number | null = null): number {
  if (step === 'ready') return now
  const i = STEPS.indexOf(step)
  const spent = now - stepStart
  // a step that counts its own way (the downloads' bytes) says how long it will take once it is some way in
  const own = share !== null && share >= 0.15 ? spent / share : past[step]
  const here = Math.max(own, spent + 400)
  return stepStart + here + STEPS.slice(i + 1).reduce((n, s) => n + past[s], 0)
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** The creep's curve: fast at first, slower and slower. */
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3
export const EASE_OUT_CSS = 'cubic-bezier(0.33, 1, 0.68, 1)'

/** The bar's own clock: one run of `d0` ms from nothing to EVEN (planned when the load begins), then the creep, played
 *  at `rate`. A new plan only changes the rate, never the run: so on the page the bar is ONE animation from start to end,
 *  started while the page is still free, and the compositor keeps it going at its last rate through the long stretches
 *  the main thread is held (a new animation would wait for the next frame to begin). */
export interface Pace {
  d0: number
  /** where it is on its run (ms) */
  c: number
  rate: number
}

/** A rate is changed on the page only when it differs this much from the one it runs at (a change holds the animation
 *  until the next frame, so changing it at every tick would stop it), and no oftener than RATE_EVERY_MS. */
export const RATE_STEP = 0.12
export const RATE_EVERY_MS = 500
/** Whether a new rate is worth putting on the page. */
export const worthChanging = (running: number, next: number) => Math.abs(next - running) > RATE_STEP * running

/** The slowest the bar goes: even a step far later than planned keeps it moving. */
export const SLOWEST = 0.15

/** Where the bar is at `c` ms of a run of `d0`: even to EVEN, then the creep. */
export function shareAt(c: number, d0: number): number {
  if (c <= d0) return d0 > 0 ? (EVEN * Math.max(0, c)) / d0 : EVEN
  return EVEN + (LAST - EVEN) * easeOut((c - d0) / CREEP_MS)
}

/** A run planned to reach EVEN at `until`, from `now`. */
export const paceFrom = (now: number, until: number): Pace => ({ d0: Math.max(1, until - now), c: 0, rate: 1 })

/** The rate that brings the bar to EVEN at `until`: what is left of the run over the time left, never faster than a whole
 *  bar in FASTEST_MS nor slower than SLOWEST; once at EVEN, the creep's own pace. */
export function rateFor(p: Pace, now: number, until: number): number {
  if (p.c >= p.d0) return 1
  const fastest = p.d0 / (EVEN * FASTEST_MS)
  return Math.min(Math.max(fastest, SLOWEST), Math.max(SLOWEST, (p.d0 - p.c) / Math.max(1, until - now)))
}

/** The bar after `dt` ms at its rate, aimed again at `until`. */
export function tick(p: Pace, dt: number, now: number, until: number): Pace {
  const c = p.c + Math.max(0, dt) * p.rate
  const next = { ...p, c }
  return { ...next, rate: rateFor(next, now, until) }
}

/** The time each step took, from the loader's marks (ms since the page began): none for a step with no mark. */
export function tookTimes(m: { startedAt: number; downloadedAt: number; compileAt: number; readyAt: number }): StepTimes | null {
  if (!(m.downloadedAt > 0 && m.compileAt >= m.downloadedAt && m.readyAt >= m.compileAt)) return null
  return { fetch: Math.max(0, m.downloadedAt - m.startedAt), build: m.compileAt - m.downloadedAt, light: m.readyAt - m.compileAt }
}

/** The times kept for the next load: half the last kept and half this one (a slow load once does not make every next
 *  one slow), each within reason. */
export function blend(kept: StepTimes | null, now: StepTimes): StepTimes {
  const out = { ...now }
  for (const s of STEPS) {
    const v = kept ? (kept[s] + now[s]) / 2 : now[s]
    out[s] = Math.round(Math.min(60_000, Math.max(100, v)))
  }
  return out
}

const KEY = '3d-home:load-times:v1'

/** This device's kept times for a load from its own copy or over the network (the first load's guess when none). */
export function pastTimes(from: 'device' | 'network'): StepTimes {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<'device' | 'network', StepTimes>>
    const t = all[from]
    if (t && STEPS.every((s) => Number.isFinite(t[s]) && t[s] > 0)) return t
  } catch {
    /* private mode, or something else there: the first load's guess */
  }
  return FIRST_TIMES[from]
}

/** Keeps this load's times for the next one. */
export function keepTimes(from: 'device' | 'network', took: StepTimes) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<'device' | 'network', StepTimes>>
    const kept = all[from] && STEPS.every((s) => Number.isFinite(all[from]![s])) ? all[from]! : null
    all[from] = blend(kept, took)
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* nothing kept: the next load guesses again */
  }
}
