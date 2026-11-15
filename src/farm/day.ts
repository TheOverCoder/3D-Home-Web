// The farm's day (DAY and HOURS in ./data): 24 farm hours in DAY.length real seconds — morning, noon, evening, night —
// counted from the seconds since the farm began (farm.day.t, src/farm/state.ts). Who keeps hours is a row in HOURS:
// in some of the day's phases (the contractor), or from one hour to another (the estate office, 8:00 to 16:00). The
// light follows the phase (src/scene/Lighting.tsx, moodAt). Pure.

import { DAY, HOURS, type DayPhase, type Hours, type Keeper } from './data'

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

const inPhases = (h: Hours): h is readonly DayPhase[] => Array.isArray(h)
/** Is the hour within from–to (from inclusive, to not; `to` before `from` runs past midnight)? */
const within = (h: number, from: number, to: number) => (from <= to ? h >= from && h < to : h >= from || h < to)

/** Is someone who keeps hours there now? */
export function isOpen(who: Keeper, t: number): boolean {
  const h: Hours = HOURS[who]
  return inPhases(h) ? h.includes(phaseOf(t)) : within(hourOf(t), h.from, h.to)
}

/** The farm hour someone's hours begin: the first of their phases, or their first hour. */
export function opensAt(who: Keeper): number {
  const h: Hours = HOURS[who]
  return inPhases(h) ? phaseDef(h[0]).from : h.from
}

/** The farm hour their hours end (the next phase's, after the last of theirs; or their last hour). */
export function closesAt(who: Keeper): number {
  const h: Hours = HOURS[who]
  if (!inPhases(h)) return h.to
  const last = DAY.phases.findIndex((p) => p.id === h[h.length - 1])
  return DAY.phases[(last + 1) % DAY.phases.length].from
}

/** Real seconds until an hour of the day next comes (0 if it is now). */
export function untilHour(t: number, hour: number): number {
  const hours = (((hour - hourOf(t)) % 24) + 24) % 24
  return hours * HOUR
}

/** Real seconds until someone opens again: 0 while they are open. */
export const untilOpen = (who: Keeper, t: number) => (isOpen(who, t) ? 0 : untilHour(t, opensAt(who)))

/** Real seconds since they last opened (while open), or since they last closed (while closed). */
export function sinceTurned(who: Keeper, t: number): number {
  const at = isOpen(who, t) ? opensAt(who) : closesAt(who)
  return ((((hourOf(t) - at) % 24) + 24) % 24) * HOUR
}

/** An hour of the day as a clock says it (8 → "8:00", 16.5 → "16:30"). */
export function clockOf(hour: number): string {
  const m = Math.round((((hour % 24) + 24) % 24) * 60)
  return `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, '0')}`
}

/** The hour as the farm's clocks show it (the day chip, the car's dashboard: src/film), to the farm's ten minutes: a
 *  farm day is DAY.length real seconds, so it moves on every few seconds, never a flicker of digits. 8.0 → "08:00",
 *  17.55 → "17:30". */
export function clockFace(hour: number): string {
  const tens = ((Math.floor(hour * 6 + 1e-6) % 144) + 144) % 144 // (a hair over: a clock set to 12 reads 12:00, never 11:50)
  const h = Math.floor(tens / 6)
  return `${String(h).padStart(2, '0')}:${(tens % 6) * 10 || '00'}`
}

/** Someone's hours as words: "8:00 – 16:00". */
export const hoursText = (who: Keeper) => `${clockOf(opensAt(who))} – ${clockOf(closesAt(who))}`
