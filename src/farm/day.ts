// The farm's day (DAY and HOURS in ./data): 24 farm hours in DAY.length real seconds — morning, noon, evening, night —
// counted from the seconds since the farm began (farm.day.t, src/farm/state.ts). Who keeps hours is a row in HOURS
// (the contractor). The light follows the phase (src/scene/Lighting.tsx, moodAt). Pure.

import { DAY, HOURS, type DayPhase, type Keeper } from './data'

type Phase = (typeof DAY.phases)[number]
const HOUR = DAY.length / 24

/** A time read as seconds (not a number: the farm's first second). */
const secs = (t: number) => (Number.isFinite(t) ? t : 0)

/** The farm hour, 0 to 24 (a new farm starts at DAY.start). */
export const hourOf = (t: number) => (((DAY.start + secs(t) / HOUR) % 24) + 24) % 24

/** The phase at an hour: the last whose hour has come (night runs past midnight into the small hours). */
function phaseAtHour(h: number): Phase {
  let at: Phase = DAY.phases[DAY.phases.length - 1]
  for (const p of DAY.phases) if (h >= p.from) at = p
  return at
}
export const phaseOf = (t: number): DayPhase => phaseAtHour(hourOf(t)).id
export const phaseDef = (id: DayPhase) => DAY.phases.find((p) => p.id === id)!

/** The day's number: a new day begins at the start of the morning. */
export const dayOf = (t: number) => Math.floor((DAY.start + secs(t) / HOUR - DAY.phases[0].from) / 24)

/** Real seconds until a phase next begins (0 if it begins now). */
export function untilPhase(t: number, id: DayPhase): number {
  const h = hourOf(t)
  const hours = (((phaseDef(id).from - h) % 24) + 24) % 24
  return hours * HOUR
}

/** The light now: the phase's mood, blended in from the phase before over the first half hour of its time. */
export function moodAt(t: number): { sun: number; warm: number; sky: number } {
  const h = hourOf(t)
  const now = phaseAtHour(h)
  const k = DAY.phases.indexOf(now)
  const before = DAY.phases[(k + DAY.phases.length - 1) % DAY.phases.length]
  const into = (((h - now.from) % 24) + 24) % 24
  const s = Math.min(1, into / 0.5)
  const mix = (a: number, b: number) => a + (b - a) * s
  return {
    sun: Math.max(DAY.minLight, mix(before.mood.sun, now.mood.sun)),
    warm: mix(before.mood.warm, now.mood.warm),
    sky: Math.max(DAY.minLight, mix(before.mood.sky, now.mood.sky)),
  }
}

/** Is someone who keeps hours there now? */
export const isOpen = (who: Keeper, t: number) => (HOURS[who] as readonly DayPhase[]).includes(phaseOf(t))
