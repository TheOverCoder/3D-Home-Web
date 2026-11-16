import { TALK, TALK_GAP, type TalkMoment } from './lines'

// When a character may say a line (./lines.ts), as a rule that reads only what it is given: never where speech is not
// available, never muted (the game's sound off or at nothing, or not started yet: a page speaks only after a touch),
// never over a film or the drive (or with the page hidden), only on your map and near you, never sooner than the
// moment's own wait or the gap after any line (an answer to you excepted from the gap, and from a line being said), and
// then only on the moment's chance.

/** What the game is like when a moment comes. */
export interface TalkWorld {
  /** seconds (any clock that runs on) */
  now: number
  /** metres from you to the one who would speak */
  distance: number
  /** they are on the map you are on */
  sameMap: boolean
  /** a film or the drive is up (or the screen dark between maps) */
  film: boolean
  /** the game's sound: on or off and its volume (null: not started yet — no touch yet) */
  sound: { enabled: boolean; volume: number } | null
  /** the device can speak in English */
  speech: boolean
  /** the page is hidden */
  hidden: boolean
  /** a line is being said now */
  speaking: boolean
}

/** What has been said: when the last line was, and each moment's last time and line. */
export interface TalkMemory {
  last: number
  moments: Partial<Record<TalkMoment, { at: number; line: number }>>
}

export const freshMemory = (): TalkMemory => ({ last: -Infinity, moments: {} })

/** Whether `moment` may be said now; `roll` is a throw of the dice (0..1) against its chance. */
export function mayTalk(moment: TalkMoment, w: TalkWorld, memory: TalkMemory, roll: number): boolean {
  const row = TALK[moment]
  const answer = 'answer' in row && row.answer
  if (!w.speech || w.hidden || w.film || !w.sameMap) return false
  if (!w.sound || !w.sound.enabled || !(w.sound.volume > 0)) return false
  if (!(w.distance <= row.near)) return false
  const last = memory.moments[moment]
  if (last && w.now - last.at < row.again) return false
  if (!answer && (w.speaking || w.now - memory.last < TALK_GAP)) return false
  return roll < row.chance
}

/** The line to say for `moment` (never the one said last time for it, where it has more), and kept as said now. */
export function nextLine(moment: TalkMoment, memory: TalkMemory, now: number, roll: number): string {
  const lines = TALK[moment].lines
  const before = memory.moments[moment]?.line ?? -1
  let k = Math.min(lines.length - 1, Math.floor(roll * lines.length))
  if (k === before && lines.length > 1) k = (k + 1) % lines.length
  memory.moments[moment] = { at: now, line: k }
  memory.last = now
  return lines[k]
}
