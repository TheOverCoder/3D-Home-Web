import { isNeighbour, NEIGHBOUR_IDS, personById, type NeighbourId, type PersonId } from '../../data/people'
import { isRecord, list } from '../../lib/saved'
import type { Line } from '../../talk/lines'
import { dateOf } from '../calendar'
import type { ItemId, ProduceId } from '../data'
import { savedPrize, sized, type Prize } from '../prize'
import { CHAPTER_IDS, chapterById, isChapter, type ChapterId } from './chapters'
import { MOST_HEARTS } from './friends'

// The neighbours' letters (update-v1/missions/03-characters-story.md, changes 7 and 9), as rows: a chapter's letter that
// asks (./chapters.ts), its thank-you with the chapter's gift, a letter at each heart a neighbour's friendship reaches
// with a small gift (./friends.ts), and a birthday letter with a slice of their cake — they give, never ask; it waits
// for the first visit within BIRTHDAY_WAITS days of the date, and a birthday missed costs nothing: it comes again next
// year. A letter is its id; what it says is worked out from it, so the save keeps only who wrote it and the gift that
// came with it. Pure: the mailbox's side is src/farm/state/neighbours.ts (`farm.mail`), the card src/farm/people/
// LetterCard.tsx. Never a word of guilt or hurry (src/talk/kind.ts).

/** A letter as the mailbox holds it: its id (`chapter:<chapter>`, `thanks:<chapter>`, `heart:<who>:<k>`,
 *  `birthday:<who>:<year>`), who wrote it, and the gift in it (claimed as it is read: through `give`). */
export interface Letter {
  id: string
  from: PersonId
  prize?: Prize
}

/** The mailbox: the letters waiting (oldest first: the flag is up), and those read (newest first), to read again. */
export interface Mail {
  waiting: Letter[]
  read: Letter[]
}

/** The letters read that are kept, the newest. */
export const MAIL_KEPT = 30
/** The most that wait unread (years of birthdays left in the box: the oldest go). */
export const MAIL_WAITING = 40
/** A birthday letter comes on the first day played within this many days from the date, that one counted. */
export const BIRTHDAY_WAITS = 7

export const freshMail = (): Mail => ({ waiting: [], read: [] })

export type LetterKind = 'chapter' | 'thanks' | 'heart' | 'birthday'

const said = (who: Line['who'], mood: Line['mood'], say: string): Line => ({ who, say, mood })

/** What each neighbour writes at each heart (the k-th at heart k + 1), and the building material their even hearts
 *  bring (an odd heart brings coins). */
const HEARTS: Record<NeighbourId, { lines: readonly (readonly Line[])[]; items: readonly [ItemId, ItemId] }> = {
  baker: {
    items: ['log', 'plank'],
    lines: [
      [said('baker', 'cheerful', 'You have a friend at the bakery now. That is me.'), said('baker', 'winking', 'A few coins for your seeds. Bread starts as a seed too.')],
      [said('baker', 'laughing', 'My oven had more logs than it could eat. Now you have some.')],
      [said('baker', 'proud', 'I named a loaf after your farm. It sold out by eight.'), said('baker', 'cheerful', 'Here is your share.')],
      [said('baker', 'encouraging', 'Planks from my old bread shelf. It wants to be something new.')],
      [said('baker', 'excited', 'Five hearts! You are family now.'), said('baker', 'laughing', 'Family gets the warm rolls first. And this.')],
    ],
  },
  teacher: {
    items: ['nail', 'brick'],
    lines: [
      [said('teacher', 'cheerful', 'A little note to say you are doing very well.'), said('teacher', 'winking', 'Here is something for you. No homework, I promise.')],
      [said('teacher', 'laughing', 'The woodwork room had a box of nails too many. They are yours now.')],
      [said('teacher', 'proud', 'My class drew your farm. The cows are purple. It is art.'), said('teacher', 'cheerful', 'We sold the drawings at the fair. Here is your cut.')],
      [said('teacher', 'encouraging', 'Bricks left over from the new school wall. Build something nice.')],
      [said('teacher', 'excited', 'Five hearts! That is full marks, with a star.'), said('teacher', 'cheerful', 'A small prize for the best farmer I know.')],
    ],
  },
  knitter: {
    items: ['plank', 'nail'],
    lines: [
      [said('knitter', 'cheerful', 'Hello, dear. Your sheep wave at me every day.'), said('knitter', 'winking', 'A few coins for you. Buy them something nice.')],
      [said('knitter', 'laughing', 'Planks from my old knitting chair. It finally gave up, dear.')],
      [said('knitter', 'proud', 'I sold a scarf made from your wool. The lady wore it home.'), said('knitter', 'cheerful', 'Half of it is yours, dear.')],
      [said('knitter', 'encouraging', 'Nails, dear. I found them in my wool basket. Do not ask.')],
      [said('knitter', 'excited', 'Five hearts, dear! I am knitting you a jumper.'), said('knitter', 'laughing', 'It will be ready in about a year. Here is something for now.')],
    ],
  },
  beekeeper: {
    items: ['log', 'iron'],
    lines: [
      [said('beekeeper', 'cheerful', 'Hmm. The bees like you. So do I.'), said('beekeeper', 'encouraging', 'A few coins. Spend them slowly.')],
      [said('beekeeper', 'laughing', 'Logs from the hill. The bees did not need them. Bees never do.')],
      [said('beekeeper', 'proud', 'Your flowers made the best honey this year.'), said('beekeeper', 'cheerful', 'This is from the jars we sold.')],
      [said('beekeeper', 'encouraging', 'Iron bars from an old hive stand. Strong, like your farm.')],
      [said('beekeeper', 'excited', 'Five hearts. The queen bee says you are one of us.'), said('beekeeper', 'laughing', 'She did not say it in words. Here is a gift.')],
    ],
  },
  child: {
    items: ['bolt', 'brick'],
    lines: [
      [said('child', 'excited', 'Hi! I told my whole class you are my friend.'), said('child', 'cheerful', 'I saved some coins for you. From my own piggy bank!')],
      [said('child', 'laughing', 'I found some bolts under my bed. Mum says you can have them.')],
      [said('child', 'curious', 'Do hens dream? I think they dream about corn.'), said('child', 'proud', 'I sold lemonade at school. This is your share.')],
      [said('child', 'encouraging', 'I found some bricks. Not from a wall. I checked.')],
      [said('child', 'excited', 'Five hearts! That is the most hearts.'), said('child', 'cheerful', 'You are my best grown-up friend. This is for you.')],
    ],
  },
}

/** Each neighbour's birthday letter, and the slice of their cake that comes with it. */
const BIRTHDAYS: Record<NeighbourId, { lines: readonly Line[]; cake: ProduceId }> = {
  baker: {
    lines: [said('baker', 'excited', 'It was my birthday this week! I baked myself a cake. Then another one.'), said('baker', 'laughing', 'Here is a slice for you. A big slice.')],
    cake: 'carrot_cake',
  },
  teacher: {
    lines: [said('teacher', 'cheerful', 'My birthday is on the first day of school. The whole class sings.'), said('teacher', 'proud', 'A slice of lemon cake for you. Full marks.')],
    cake: 'lemon_cake',
  },
  knitter: {
    lines: [said('knitter', 'cheerful', 'I am a whole year older this week, dear. My needles are not.'), said('knitter', 'winking', 'A slice of strawberry cake. I did not knit it.')],
    cake: 'strawberry_cake',
  },
  beekeeper: {
    lines: [said('beekeeper', 'cheerful', 'Hmm. My birthday came this week. The bees made a fuss.'), said('beekeeper', 'encouraging', 'A slice of pumpkin pie, with a little honey on top.')],
    cake: 'pumpkin_pie',
  },
  child: {
    lines: [said('child', 'excited', 'It was my birthday! I am a whole year bigger.'), said('child', 'cheerful', 'I saved you the slice with the most strawberries.')],
    cake: 'strawberry_cake',
  },
}

/** What a letter is: its kind, who wrote it, what it says, and for a chapter's two letters, the chapter. Null: not a
 *  letter of the game's. */
export interface LetterText {
  kind: LetterKind
  from: NeighbourId
  lines: readonly Line[]
  chapter?: ChapterId
}

/** What the letter with this id says (null: no such letter). */
export function letterOf(id: unknown): LetterText | null {
  if (typeof id !== 'string') return null
  const parts = id.split(':')
  const [kind, a, b] = parts
  if (parts.length > 3) return null
  if ((kind === 'chapter' || kind === 'thanks') && b === undefined && isChapter(a)) {
    const c = chapterById(a)
    return { kind, from: c.who, lines: kind === 'chapter' ? c.intro : c.thanks, chapter: a }
  }
  if (kind === 'heart' && isNeighbour(a) && /^[1-9]$/.test(b ?? '') && Number(b) <= MOST_HEARTS) return { kind, from: a, lines: HEARTS[a].lines[Number(b) - 1] }
  if (kind === 'birthday' && isNeighbour(a) && /^\d{4}$/.test(b ?? '')) return { kind, from: a, lines: BIRTHDAYS[a].lines }
  return null
}

export const isLetter = (id: unknown): id is string => letterOf(id) !== null

/** A chapter's letter that asks, and its thank-you with the chapter's gift. */
export const chapterLetter = (id: ChapterId): Letter => ({ id: `chapter:${id}`, from: chapterById(id).who })
export const thanksLetter = (id: ChapterId): Letter => ({ id: `thanks:${id}`, from: chapterById(id).who, prize: chapterById(id).reward })

/** The letter at heart `k` of `who`, at the farm's `level`: coins at an odd heart (a share of the next level's coins
 *  that grows with the heart), a few of their building material at an even one. */
export function heartLetter(who: NeighbourId, k: number, level: number): Letter {
  const prize: Prize = k % 2 ? { coins: sized(0.15 + 0.05 * k, level, 5) } : { item: HEARTS[who].items[k / 2 - 1], n: 2 + k / 2 }
  return { id: `heart:${who}:${k}`, from: who, prize }
}

/** `who`'s birthday letter of `year`, with a slice of their cake. */
export const birthdayLetter = (who: NeighbourId, year: number): Letter => ({ id: `birthday:${who}:${year}`, from: who, prize: { item: BIRTHDAYS[who].cake, n: 1 } })

/** The year of `who`'s birthday whose letter may come on calendar day `today` (src/farm/calendar.ts): their date is
 *  today or one of the BIRTHDAY_WAITS − 1 days before; else null. */
export function birthdayYear(who: NeighbourId, today: number): number | null {
  const b = personById(who).birthday
  if (!b) return null
  for (let d = 0; d < BIRTHDAY_WAITS; d++) {
    const on = dateOf(today - d)
    if (on.month === b.month && on.date === b.date) return on.year
  }
  return null
}

/** Whether the mailbox has had this letter (waiting, or read and kept). */
export const has = (m: Mail, id: string) => m.waiting.some((l) => l.id === id) || m.read.some((l) => l.id === id)

/** A letter into the mailbox (never one it has had: the same mailbox back). */
export function deliver(m: Mail, letter: Letter): Mail {
  if (has(m, letter.id)) return m
  return { waiting: [...m.waiting, letter].slice(-MAIL_WAITING), read: m.read }
}

/** A letter read: out of the waiting ones into those read, the newest first, the last MAIL_KEPT kept (one not waiting:
 *  the same mailbox back). */
export function open(m: Mail, id: string): Mail {
  const letter = m.waiting.find((l) => l.id === id)
  if (!letter) return m
  return { waiting: m.waiting.filter((l) => l !== letter), read: [letter, ...m.read].slice(0, MAIL_KEPT) }
}

/** A letter as saved, made safe: a letter of the game's, from its own writer, with a gift a save can hold (none:
 *  none). */
function savedLetter(raw: unknown): Letter | null {
  if (!isRecord(raw)) return null
  const text = letterOf(raw.id)
  if (!text) return null
  const prize = 'prize' in raw ? savedPrize(raw.prize) : null
  return prize ? { id: raw.id as string, from: text.from, prize } : { id: raw.id as string, from: text.from }
}

/** The mailbox as saved, made safe: letters of the game's, each once across both lists (waiting first), at most
 *  MAIL_WAITING waiting and MAIL_KEPT read. A farm from before the letters: an empty mailbox. */
export function sanitizeMail(raw: unknown): Mail {
  const seen = new Set<string>()
  const read = (v: unknown, most: number) => {
    const out: Letter[] = []
    for (const r of list(v)) {
      const l = savedLetter(r)
      if (!l || seen.has(l.id) || out.length >= most) continue
      seen.add(l.id)
      out.push(l)
    }
    return out
  }
  const field = (k: string) => (isRecord(raw) ? raw[k] : undefined)
  return { waiting: read(field('waiting'), MAIL_WAITING), read: read(field('read'), MAIL_KEPT) }
}

/** Every letter the game can write (a birthday's of one year), for the tests: every chapter's two, every heart's, every
 *  birthday's. */
export const ALL_LETTERS = [
  ...CHAPTER_IDS.flatMap((id) => [`chapter:${id}`, `thanks:${id}`]),
  ...NEIGHBOUR_IDS.flatMap((who) => Array.from({ length: MOST_HEARTS }, (_, k) => `heart:${who}:${k + 1}`)),
  ...NEIGHBOUR_IDS.map((who) => `birthday:${who}:2026`),
]
