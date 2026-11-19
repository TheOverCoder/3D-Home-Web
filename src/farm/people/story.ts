import { NEIGHBOUR_IDS, type NeighbourId } from '../../data/people'
import { isRecord, list } from '../../lib/saved'
import { CHAPTERS, chapterById, isChapter, type ChapterDef, type ChapterId } from './chapters'

// Where the story stands (./chapters.ts): the chapters done, in order, the one on now (its letter in the mailbox, its
// request pinned above the order board) and whether its request has been sent (its thank-you letter comes a frame
// later). Pure: the farm's side is src/farm/state/neighbours.ts, and the save's field is `farm.story`. A neighbour is
// met once their first chapter has begun: only they come to the gate, send orders, keep a friendship and write.

/** The story's record: the chapters done (a prefix of CHAPTERS, in order), the one on now (null: none), and whether
 *  its request was sent (the thank-you letter waits for the next frame). */
export interface Story {
  done: ChapterId[]
  on: ChapterId | null
  sent: boolean
}

export const freshStory = (): Story => ({ done: [], on: null, sent: false })

/** The chapter after those done (null: the story told to its last row). */
export const nextAfter = (done: readonly ChapterId[]): ChapterId | null => CHAPTERS[done.length]?.id ?? null

/** The next chapter to begin, once the one on is done (null: none left). */
export const nextChapter = (s: Story): ChapterDef | null => {
  const id = s.on ? null : nextAfter(s.done)
  return id ? chapterById(id) : null
}

/** The neighbours met: the writers of the chapters begun, in the people table's order. */
export function metOf(s: Story): NeighbourId[] {
  const writers = new Set<NeighbourId>([...s.done, ...(s.on ? [s.on] : [])].map((id) => chapterById(id).who))
  return NEIGHBOUR_IDS.filter((id) => writers.has(id))
}

/** What the story does next, at the farm's `level`, when it `may` begin a chapter (no new farm's first steps running,
 *  none begun yet this visit): the one on is finished once its request is sent; else the next begins once the level
 *  reaches it. Null: nothing. */
export type Beat = { begin: ChapterId } | { finish: ChapterId } | null
export function nextBeat(s: Story, level: number, may: boolean): Beat {
  if (s.on) return s.sent ? { finish: s.on } : null
  const next = nextChapter(s)
  return next && may && level >= next.level ? { begin: next.id as ChapterId } : null
}

/** A chapter begun (its letter and request are the farm's to give). */
export const begin = (s: Story, id: ChapterId): Story => ({ done: [...s.done], on: id, sent: false })
/** Its request sent: the thank-you letter is next. */
export const sentOn = (s: Story): Story => (s.on ? { ...s, sent: true } : s)
/** The chapter on, finished: done, and none on. */
export const finish = (s: Story): Story => (s.on ? { done: [...s.done, s.on], on: null, sent: false } : s)

/** The story as saved, made safe: the chapters done as far as they are the table's own, in order; the one on only the
 *  next of them; sent only with one on. A farm from before the story (any level): none done, none on — the first
 *  begins on its next frame, the rest one a visit in turn. */
export function sanitizeStory(raw: unknown): Story {
  if (!isRecord(raw)) return freshStory()
  const done: ChapterId[] = []
  for (const id of list(raw.done)) {
    if (!isChapter(id) || id !== nextAfter(done)) break
    done.push(id)
  }
  const on = isChapter(raw.on) && raw.on === nextAfter(done) ? raw.on : null
  return { done, on, sent: on !== null && raw.sent === true }
}
