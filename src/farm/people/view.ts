import { NEIGHBOUR_IDS, personById, type NeighbourId, type PersonId } from '../../data/people'
import type { Line } from '../../talk/lines'
import type { ProduceId } from '../data'
import type { Prize } from '../prize'
import { CHAPTERS, chapterById, movesInAt, type ChapterId } from './chapters'
import { FRIENDS, heartsOf, MOST_HEARTS, type Friends } from './friends'
import { letterOf, type Letter, type LetterKind, type Mail } from './mail'
import type { Story } from './story'

// What the letter's card and the neighbours' sheet draw (./LetterCard.tsx, ./NeighboursCard.tsx), with nothing of the
// farm in them: the game makes them from the farm (./LetterPanel.tsx, ./NeighboursPanel.tsx), the design lab could from
// sample data. Pure.

/** A letter as its card shows it: who wrote it, their name, what it says line by line (a line may be another's: the
 *  farmer opens a neighbour's first), the gift on its last page, and whether it is read again (no gift then). */
export interface LetterView {
  id: string
  kind: LetterKind
  from: PersonId
  name: string
  lines: readonly Line[]
  prize?: Prize
  again: boolean
  /** the writer's hearts now (the chip in the card's head) */
  hearts: number
}

/** The letter `l`, read for the first time (`again` false: its gift is claimed on its last page) or again. */
export function letterView(l: Letter, friends: Friends, again: boolean): LetterView | null {
  const text = letterOf(l.id)
  if (!text) return null
  const f = friends[text.from as NeighbourId]
  return {
    id: l.id,
    kind: text.kind,
    from: text.from,
    name: personById(text.from).name,
    lines: text.lines,
    ...(l.prize && !again ? { prize: l.prize } : {}),
    again,
    hearts: f ? heartsOf(f.points) : 0,
  }
}

/** A neighbour as the sheet shows them: met (their portrait, name, hearts, what they like, their birthday), or not yet
 *  (a silhouette and the level they come at). */
export interface NeighbourRow {
  who: NeighbourId
  name: string
  met: boolean
  hearts: number
  /** the share of the way to their next heart (1 at the last) */
  toNext: number
  likes: readonly ProduceId[]
  birthday: { month: number; date: number } | null
  /** not met yet: the level they move in at */
  level: number | null
}

/** A chapter on the story's road: done, on now, the next (its level), or later. */
export interface ChapterRow {
  id: ChapterId
  act: number
  who: NeighbourId
  title: string
  level: number
  state: 'done' | 'on' | 'next' | 'later'
}

/** The neighbours' sheet: everyone, the story's road (the act on now, or the next), the letters read (to read again). */
export interface NeighboursView {
  people: NeighbourRow[]
  act: number
  road: ChapterRow[]
  letters: { id: string; from: PersonId; name: string; kind: LetterKind }[]
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** A birthday as words: "14 March". */
export const birthdayWords = (b: { month: number; date: number }) => `${b.date} ${MONTHS[b.month - 1]}`

/** The sheet as the farm stands: who is met (the story's), their friendships, the story, the letters read. */
export function neighboursView(met: readonly NeighbourId[], friends: Friends, story: Story, mail: Mail): NeighboursView {
  const people = NEIGHBOUR_IDS.map((who): NeighbourRow => {
    const p = personById(who)
    const points = friends[who]?.points ?? 0
    const hearts = heartsOf(points)
    const steps = [0, ...FRIENDS.hearts]
    const from = steps[hearts]
    const to = steps[Math.min(MOST_HEARTS, hearts + 1)]
    const isMet = met.includes(who)
    return {
      who,
      name: isMet ? p.name : '?',
      met: isMet,
      hearts,
      toNext: hearts >= MOST_HEARTS ? 1 : Math.max(0, Math.min(1, (points - from) / Math.max(1, to - from))),
      likes: isMet ? (p.likes ?? []) : [],
      birthday: isMet ? (p.birthday ?? null) : null,
      level: isMet ? null : movesInAt(who),
    }
  })
  const done = new Set(story.done)
  const nextId = story.on ? null : (CHAPTERS[story.done.length]?.id ?? null)
  const act = story.on ? chapterById(story.on).act : nextId ? chapterById(nextId).act : (CHAPTERS.at(-1)?.act ?? 1)
  const road = CHAPTERS.filter((c) => c.act === act).map((c): ChapterRow => ({
    id: c.id,
    act: c.act,
    who: c.who,
    title: c.title,
    level: c.level,
    state: done.has(c.id) ? 'done' : story.on === c.id ? 'on' : nextId === c.id ? 'next' : 'later',
  }))
  const letters = mail.read.flatMap((l) => {
    const text = letterOf(l.id)
    return text ? [{ id: l.id, from: text.from, name: personById(text.from).name, kind: text.kind }] : []
  })
  return { people, act, road, letters }
}
