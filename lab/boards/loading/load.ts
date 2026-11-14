import { useEffect, useState } from 'react'
import { iconUrl } from '../../../src/farm/icons'
import type { LoadPhase } from '../../../src/lib/loader'
import { art } from '../../../src/ui/art'

// What the loading screen is given, as the game has it (src/lib/loader.ts's useLoader, and the scene's own count and
// attempt from src/store.ts), and what it shows from it: one overall share by LoadStatus's own formula (downloads take
// the bar to 70 %, building the house to 85 %, warming up the graphics to 100 %), a friendly line in place of the
// developer's (no MB, no decoding, no shaders), and the time left only when a slow download makes it worth saying.

export interface LoadingState {
  phase: LoadPhase
  /** bytes the first visit downloads: dist/assets-manifest.json, 232 files */
  total: number
  loaded: number
  /** bytes that came from this device's copy, not the network (a returning player) */
  fromDevice: number
  /** bytes a second, smoothed (useLoader.speed) */
  speed: number
  /** the scene's own count while it builds, 0..100 (useHome.progress) */
  scene: number
  /** the graphics warming up, 0..1 (useLoader.compile) */
  compile: number
  /** starts again after the first ran short of graphics memory (useHome.attempt): the second is in light graphics */
  attempt: number
  /** played before (slotSummary(slot).played): the press is Continue, with the farm's number */
  returning: boolean
  farm: number
}

/** The game's whole download today (dist/assets-manifest.json). */
export const TOTAL = 8_664_901

export interface LoadView {
  /** 0..1: LoadStatus's overall */
  p: number
  pct: number
  /** which part of the way it is on */
  step: 'fetch' | 'build' | 'light' | 'ready'
  line: string
  /** "about 40 s", only for a download over the network with more than 8 s to go */
  left: string | null
  ready: boolean
  /** started again in light graphics */
  again: boolean
  press: string
}

export function loadView(s: LoadingState): LoadView {
  const fromDevice = s.total > 0 && s.fromDevice >= s.total
  const p = s.phase === 'download' ? (s.total ? s.loaded / s.total : 0) * 0.7 : s.phase === 'prepare' ? 0.7 + Math.min(1, s.scene / 100) * 0.15 : s.phase === 'compile' ? 0.85 + s.compile * 0.15 : 1
  const secs = s.phase === 'download' && !fromDevice && s.speed > 0 ? (s.total - s.loaded) / s.speed : 0
  const ready = s.phase === 'ready'
  const again = s.attempt > 0 && !ready
  const step = s.phase === 'download' ? 'fetch' : s.phase === 'prepare' ? 'build' : s.phase === 'compile' ? 'light' : 'ready'
  const line = again
    ? 'Starting again, lighter'
    : s.phase === 'download'
      ? fromDevice
        ? 'Opening your farm…'
        : 'Fetching the farm…'
      : s.phase === 'prepare'
        ? 'Building the house…'
        : s.phase === 'compile'
          ? 'Lighting the lamps…'
          : s.returning
            ? 'Your farm is waiting'
            : 'Your farm is ready'
  return {
    p,
    pct: Math.round(p * 100),
    step,
    line,
    // rounded to 5 s, so it settles instead of ticking every second
    left: secs > 8 ? (secs < 60 ? `about ${Math.ceil(secs / 5) * 5} s` : `about ${Math.ceil(secs / 60)} min`) : null,
    ready,
    again,
    press: s.returning ? `Continue · Farm ${s.farm}` : 'Play',
  }
}

/** One tip or teaser of the farm while it loads: a picture, a word, one line. Proposed words; every one is true of the
 *  game today (CLAUDE.md). The game has no such table yet. */
export interface Tip {
  pic: string
  title: string
  text: string
}

export const TIPS: Tip[] = [
  { pic: iconUrl('lemon'), title: 'It grows on', text: 'Your farm keeps growing while you are away.' },
  { pic: art('people-queue'), title: 'Buyers', text: 'Buyers wait at the gate with coins in hand.' },
  { pic: iconUrl('silo'), title: 'Room for it', text: 'Crops go to the silo, eggs and milk to the barn.' },
  { pic: art('wrapped-gift'), title: 'Dress up', text: 'Every fifth level brings something new to wear.' },
  { pic: iconUrl('strawberry_cake'), title: 'Bake', text: 'The oven turns your eggs and milk into cakes.' },
  { pic: art('running-shoe'), title: 'Walk there', text: 'Tap a mark on the compass and you walk to it.' },
]

/** The tip shown now, and a way to turn it: the next one every `every` ms. */
export function useTip(every = 5200) {
  const [i, setI] = useState(0)
  // counted again from each change, so a tip turned by hand stays its full time
  useEffect(() => {
    const t = setTimeout(() => setI((n) => n + 1), every)
    return () => clearTimeout(t)
  }, [i, every])
  return [((i % TIPS.length) + TIPS.length) % TIPS.length, setI] as const
}

/**
 * The state as it goes on in the game, so the bar really moves in the lab: a download at its own speed (staying in its
 * part of the way), the house building, the graphics warming up and then ready — the moment the first press becomes
 * possible. Ready stays as it is.
 */
export function useLive(start: LoadingState): LoadingState {
  const [s, setS] = useState(start)
  useEffect(() => {
    setS(start)
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      setS((c) => step(c, dt))
    }, 100)
    return () => clearInterval(id)
  }, [start])
  return s
}

function step(c: LoadingState, dt: number): LoadingState {
  if (c.phase === 'download') {
    const fast = c.fromDevice >= c.total
    // a slow download stays in its part of the way (up to 30 % overall) while it is looked at
    return { ...c, loaded: Math.min(c.total * 0.43, c.loaded + (fast ? 4e6 : c.speed) * dt) }
  }
  if (c.phase === 'prepare') return { ...c, scene: Math.min(92, c.scene + 4 * dt) }
  if (c.phase === 'compile') {
    const compile = c.compile + 0.16 * dt
    return compile >= 1 ? { ...c, compile: 1, phase: 'ready' } : { ...c, compile }
  }
  return c
}

/** Whether the screen is wider than tall (a phone sideways), as it turns. */
export function useWide() {
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  useEffect(() => {
    const turned = () => setWide(innerWidth > innerHeight)
    addEventListener('resize', turned)
    return () => removeEventListener('resize', turned)
  }, [])
  return wide
}
