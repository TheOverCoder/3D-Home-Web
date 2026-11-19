import { isNeighbour, personById, type NeighbourId, type PersonId } from '../../data/people'
import { debugSet } from '../../lib/debug'
import { onHere } from '../../lib/quiet'
import { int, isRecord, list } from '../../lib/saved'
import type { Tier } from '../../lib/tier'
import { PEOPLE_ODDS, type ProduceId } from '../data'
import { makeRequest, orderKey, orderPay, type Order } from '../orders'
import { CHAPTERS, chapterById, type ChapterId } from '../people/chapters'
import { befriend as fonder, heartsOf, type Friends, type Why } from '../people/friends'
import { birthdayLetter, birthdayYear, chapterLetter, deliver, has, heartLetter, letterOf, open, thanksLetter, type Letter, type Mail } from '../people/mail'
import { begin, finish, metOf, nextBeat, sentOn, type Story } from '../people/story'
import { whoComes } from '../people/visits'
import { levelOf } from '../xp'
import { bump, calendarDay, calendarTime, farm, random, save, toast, type At } from './core'
import { give } from './rewards'
import { stepsBusy } from './steps'
import { newVisit } from '../../ui/cardQueue'

// The neighbours on the farm (update-v1/CONTRACTS.md §5; update-v1/missions/03-characters-story.md): their friendship as
// the farm's deeds grow it (the rules are src/farm/people/friends.ts), the story told in chapters (./people/story.ts:
// a chapter begins with a letter and a request pinned above the order board, and ends with a thank-you letter and a
// gift), the letters in the mailbox by the gate (./people/mail.ts: at each heart, on a birthday), who comes to the gate
// (./people/visits.ts) and who sends an order. Called by the sale paths (`befriend`), never calling them; the story,
// the hearts' letters and the birthdays go on a frame after the farm does what brings them (`neighboursOn`, from tick).
//
// What runs by itself here — the story, the letters, the neighbours at the gate and on the board — is quiet where the
// game is tested (src/lib/quiet.ts: under Vitest, and on a ?debug page unless it says `&neighbours=on`): a test turns it
// on with `quietNeighbours(false)` (`__home.neighbours.quiet`). What the farm has — the letters in the mailbox, the
// request on the board, the friendships — stays and works either way.

declare module './core' {
  interface FarmData {
    /** each neighbour met: their friendship's points (they only grow) and the hearts whose letter came
     *  (src/farm/people/friends.ts; not `charm`'s or `season`'s `told`) */
    friends: Friends
    /** the mailbox by the gate (src/farm/people/mail.ts): the letters waiting, and those read */
    mail: Mail
    /** the story (src/farm/people/story.ts): the chapters done, the one on, and whether its request was sent */
    story: Story
    /** the chapter's request on now, pinned above the order board (at most one; none while no chapter is on) */
    requests: Order[]
  }
}

/** What was sold or sent, and for whom: a buyer at the gate (`who`: a neighbour; none, a stranger) and the good they
 *  asked for, or an order (`from`: the neighbour it is for; `chapter`: a chapter's request). */
export type Deal = { who?: PersonId; want: ProduceId } | { from?: PersonId; chapter?: string; lines: readonly unknown[] }

/** A sale or an order sent: if it was for a neighbour, they grow fonder (a sale, more for a good they like; an order;
 *  a chapter's request). A stranger: nothing. Hearts never fall and give no XP. One line in each sale and send path,
 *  after `rewarded` and `sold` (update-v1/CONTRACTS.md E). */
export function befriend(deal: Deal) {
  const order = 'lines' in deal
  const who = order ? deal.from : deal.who
  if (!isNeighbour(who)) return
  const why: Why = order ? (deal.chapter ? 'chapter' : 'order') : personById(who).likes?.includes(deal.want) ? 'liked' : 'sale'
  farm.friends = fonder(farm.friends, who, why)
}

// ───────────────────────────── quiet where the game is tested ─────────────────────────────

let quiet = !onHere('neighbours')

/** For the tests and the simulation: the neighbours quiet (true: no story, letters or visits come by themselves), or
 *  as in play (false). */
export function quietNeighbours(on: boolean) {
  quiet = on
  bump()
}
/** Whether the neighbours are quiet now. */
export const neighboursQuiet = () => quiet

/** The neighbours met: the writers of the chapters begun (src/farm/people/story.ts). */
export const metNeighbours = (): NeighbourId[] => metOf(farm.story)

// ───────────────────────────── a visit ─────────────────────────────

/** A visit is a load, or a return after this long away (ms; AWAY_TELLS, src/farm/state/away.ts): at most one chapter
 *  begins in each (JOURNEY.md fix 6), and none in one a new farm's first steps ran in (fix 3: the first neighbour comes
 *  the visit after). */
const VISIT_GAP = 120_000
let visit = 0
let seenAt = -Infinity
let stepsInVisit = false
/** whether the first steps were over at the last frame (they end in the frame `tick` passes their last, before this) */
let stepsWereOver: boolean | null = null
let chapterIn = -1

/** The visit as this frame finds it: a new one after a gap on the calendar's clock (a page hidden or closed that long;
 *  in the simulation, the time between visits), or with the clock moved back; and whether a new farm's first steps ran
 *  in it (running now, or ended since the last frame). */
function visitOn() {
  const now = calendarTime()
  if (now - seenAt >= VISIT_GAP || now < seenAt) {
    visit++
    stepsInVisit = false
  }
  seenAt = now
  const over = farm.firstSteps.over
  if (stepsBusy() || (stepsWereOver === false && over)) stepsInVisit = true
  stepsWereOver = over
}

/** For the tests: a new visit begins now. */
export function newNeighbourVisit() {
  seenAt = -Infinity
  bump()
}

// ───────────────────────────── the story, the hearts, the birthdays ─────────────────────────────

/** A letter into the mailbox, with a word at the top. */
function post(letter: Letter, words: string, pic: string) {
  if (has(farm.mail, letter.id)) return
  farm.mail = deliver(farm.mail, letter)
  toast(words, pic)
}

/** The chapter on is finished (its thank-you letter, with its gift), or the next begins (its letter and its request,
 *  pinned above the board): one beat a frame. */
function storyOn(force = false): boolean {
  const s = farm.story
  const beat = nextBeat(s, force ? Infinity : levelOf(farm.xp.points), force || (!stepsBusy() && !stepsInVisit && chapterIn !== visit))
  if (!beat) return false
  if ('begin' in beat) {
    const c = chapterById(beat.begin)
    farm.story = begin(s, beat.begin)
    farm.requests = [makeRequest({ id: beat.begin, who: c.who, ask: c.ask })]
    chapterIn = visit
    post(chapterLetter(beat.begin), `A letter from ${personById(c.who).name}`, 'love-letter')
  } else {
    post(thanksLetter(beat.finish), `${personById(chapterById(beat.finish).who).name} says thank you`, 'love-letter')
    farm.story = finish(s)
  }
  return true
}

/** A heart a neighbour's friendship reached, and its letter not come yet: the letter, with its gift (one a frame). */
function heartsOn(): boolean {
  for (const who of metOf(farm.story)) {
    const f = farm.friends[who]
    if (!f || f.told >= heartsOf(f.points)) continue
    const k = f.told + 1
    post(heartLetter(who, k, levelOf(farm.xp.points)), `A new heart from ${personById(who).name}`, 'red-heart')
    farm.friends = { ...farm.friends, [who]: { points: f.points, told: k } }
    return true
  }
  return false
}

/** The day and the neighbours the birthdays were last looked at for (a day looks once). */
let birthdaysFor = ''
/** A neighbour's birthday today or in the days before (BIRTHDAY_WAITS), its letter not come yet: the letter, with a
 *  slice of their cake. */
function birthdaysOn(): boolean {
  const today = calendarDay()
  const met = metOf(farm.story)
  const key = `${today}|${met.join()}`
  if (key === birthdaysFor) return false
  birthdaysFor = key
  let any = false
  for (const who of met) {
    const year = birthdayYear(who, today)
    if (year === null) continue
    const l = birthdayLetter(who, year)
    if (has(farm.mail, l.id)) continue
    post(l, `${personById(who).name} has a birthday`, 'birthday-cake')
    any = true
  }
  return any
}

/** The neighbours go on, a frame after the farm (from `tick`): the story's next beat, a heart's letter, a birthday's.
 *  Quiet where the game is tested. */
export function neighboursOn() {
  hook()
  if (quiet) return
  visitOn()
  if (storyOn() || heartsOn() || birthdaysOn()) {
    bump()
    save()
  }
}

// ───────────────────────────── the mailbox ─────────────────────────────

/** The letters waiting in the mailbox, the oldest first (its flag is up while there is one). */
export const lettersWaiting = (): readonly Letter[] => farm.mail.waiting

/** The first letter the farm ever has, waiting: the one letter that opens by itself (src/ui/cardQueue.ts, 'letter'). */
export const firstLetterDue = () => !quiet && farm.mail.read.length === 0 && farm.mail.waiting.length > 0

/** Reads a letter waiting: it goes with those read (to read again), and its gift comes in through `give` — into the
 *  farm, past full; no XP — counted as a chapter's or a letter's reward, shown at `at`. Its tier, or null (no gift, or
 *  no such letter waiting). */
export function readLetter(id: string, at?: At): Tier | null {
  const letter = farm.mail.waiting.find((l) => l.id === id)
  if (!letter) return null
  farm.mail = open(farm.mail, id)
  const tier = letter.prize ? give([letter.prize], letterOf(id)?.kind === 'thanks' ? 'chapter' : 'letter', at) : null
  bump()
  save()
  return tier
}

/** For the tests: a letter of the game's into the mailbox now, with its gift (a heart's at the farm's level, a
 *  birthday's slice, a chapter's thanks). Whether it went in. */
export function postLetter(id: string): boolean {
  const text = letterOf(id)
  if (!text || has(farm.mail, id)) return false
  const [, a, b] = id.split(':')
  const letter: Letter =
    text.kind === 'heart'
      ? heartLetter(text.from, Number(b), levelOf(farm.xp.points))
      : text.kind === 'birthday'
        ? birthdayLetter(text.from, Number(b))
        : text.kind === 'thanks'
          ? thanksLetter(a as ChapterId)
          : chapterLetter(a as ChapterId)
  farm.mail = deliver(farm.mail, letter)
  bump()
  save()
  return true
}

// ───────────────────────────── the request, the board, the gate ─────────────────────────────

/** The chapter's request was sent (src/farm/state/orders.ts, sendRequest): off the board, and the thank-you letter
 *  comes a frame later. */
export function requestSent() {
  farm.story = sentOn(farm.story)
  farm.requests = []
}

/** A neighbour met to send a new order, or none (a stranger's): now and then (PEOPLE_ODDS.order) one who likes a good
 *  it asks for, on the farm's dice. Quiet where the game is tested. */
export function orderFrom(o: Order): NeighbourId | undefined {
  if (quiet) return undefined
  const fans = metOf(farm.story).filter((who) => o.lines.some((l) => personById(who).likes?.includes(l.good)))
  if (!fans.length || random() >= PEOPLE_ODDS.order) return undefined
  return fans[Math.min(fans.length - 1, Math.floor(random() * fans.length))]
}

/** A neighbour met to come to the gate instead of a stranger, or none: in their hours, not on the lane already, now
 *  and then (PEOPLE_ODDS.visit). Quiet where the game is tested. */
export function neighbourComes(): NeighbourId | null {
  if (quiet) return null
  return whoComes(
    metOf(farm.story),
    farm.day.t,
    farm.visitors.map((v) => v.who),
    Math.random,
  )
}

/** The chapter's request as saved, made safe against the story: one while a chapter is on and its request not sent,
 *  asking for what the chapter asks (what was put in kept, never more than it wants), paid as saved; none otherwise. A
 *  chapter on with no request saved gets its request again, empty. */
export function savedRequests(raw: unknown, s: Story): Order[] {
  if (!s.on || s.sent) return []
  const c = chapterById(s.on)
  const saved = list(raw).find(isRecord)
  const lines = c.ask.map((a) => {
    const l = list(saved?.lines).find((x) => isRecord(x) && x.good === a.good)
    return { good: a.good, want: a.n, have: isRecord(l) ? int(l.have, 0, 0, a.n) : 0 }
  })
  const coins = saved && Number.isInteger(saved.coins) && (saved.coins as number) >= 1 && (saved.coins as number) <= 99_999 ? (saved.coins as number) : orderPay(lines)
  return [{ id: orderKey(), lines, coins, surprise: false, from: c.who, chapter: s.on }]
}

// ───────────────────────────── the tests' hooks ─────────────────────────────

/** For the tests: the next chapter begins now, whatever the level and the visit (none left: nothing). Whether it did. */
export function nextChapterNow(): boolean {
  const did = !farm.story.on && storyOn(true)
  if (did) {
    bump()
    save()
  }
  return did
}

/** For the tests: a neighbour a little fonder, as a deed of theirs would make them. */
export function befriendNow(who: NeighbourId, why: Why) {
  farm.friends = fonder(farm.friends, who, why)
  bump()
}

/** ?debug: `window.__home.neighbours` — the story, the mailbox, the requests and the tests' switches. Made on the
 *  farm's first frame: the page's hooks are made after this module loads. */
let hooked = false
function hook() {
  if (hooked || typeof window === 'undefined' || !('__home' in window)) return
  hooked = true
  debugSet('neighbours', {
    quiet: quietNeighbours,
    met: metNeighbours,
    story: () => farm.story,
    mail: () => farm.mail,
    friends: () => farm.friends,
    requests: () => farm.requests,
    chapters: CHAPTERS,
    next: nextChapterNow,
    // the chapter's request as if sent (its thank-you comes a frame later): for a test about something else
    sent: () => {
      requestSent()
      bump()
    },
    // a new visit, for the neighbours and for the cards that open by themselves (src/ui/cardQueue.ts)
    visit: () => {
      newNeighbourVisit()
      newVisit()
    },
    post: postLetter,
    read: readLetter,
    befriend: befriendNow,
  })
}
