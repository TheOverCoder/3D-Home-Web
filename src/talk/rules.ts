import { TALK, TALK_GAP, type Line, type TalkMoment } from './lines'

// When a character may say a line (./lines.ts), as a rule that reads only what it is given: never where speech is not
// available, never muted (the game's sound off or at nothing, or not started yet: a page speaks only after a touch),
// never over a film or the drive (or with the page hidden), only on your map and near you, never sooner than the
// moment's own wait or the gap after any line (an answer to you excepted from the gap, and from a line being said), and
// then only on the moment's chance. Which line: one their hearts have opened (a neighbour's grow with friendship), never
// the one said last time for that moment.

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

/** The line to say for `moment`: one of those open at `hearts` (a neighbour's friendship; a line with none is open
 *  from the first meeting), never the one said last time for it where more are open; kept as said now. */
export function nextLine(moment: TalkMoment, memory: TalkMemory, now: number, roll: number, hearts = 0): Line {
  const lines: readonly Line[] = TALK[moment].lines
  const open = lines.flatMap((l, k) => ((l.hearts ?? 0) <= hearts ? [k] : []))
  const before = memory.moments[moment]?.line ?? -1
  let i = Math.min(open.length - 1, Math.floor(roll * open.length))
  if (open[i] === before && open.length > 1) i = (i + 1) % open.length
  const k = open[i]
  memory.moments[moment] = { at: now, line: k }
  memory.last = now
  return lines[k]
}
