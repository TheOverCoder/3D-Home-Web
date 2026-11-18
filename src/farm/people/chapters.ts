import type { NeighbourId } from '../../data/people'
import type { Line } from '../../talk/lines'
import type { ProduceId } from '../data'
import type { Prize } from '../prize'

// The story (update-v1/missions/03-characters-story.md, change 8; decisions 11 and 12; JOURNEY.md fix 6): a light tale in
// chapters, one row each. A chapter is a letter from a neighbour (two to four lines) and their request, pinned above the
// order board with no clock and no ×; once it is sent, a thank-you letter with a gift (a piece of decoration into the
// farm's store). Act 1 meets the five neighbours at levels 5, 8, 13, 17 and 23 — days 1, 1, 3, 5 and 9 for a daily
// player (JOURNEY.md's 12 moved to 13: level 12 opens six things already, as many as its reveal holds on a phone on its
// side, src/farm/Unlocked.tsx) — and act 2 goes on from 27 to 45. One chapter a visit at most, never while a new farm's
// first steps run
// (src/farm/people/story.ts; the farm's side is src/farm/state/neighbours.ts). Warm and gently funny, in the films'
// plain English: one idea a line, no idioms, never a word of guilt or hurry (src/talk/kind.ts). No choices, nothing
// to fail: a request waits as long as it takes.

/** A chapter: who writes it, the level it comes at, a few words for the story's road, the letter that asks, what it
 *  asks for (one to three goods), the letter that thanks, and the gift that comes with it. */
export interface ChapterDef {
  id: string
  act: 1 | 2
  who: NeighbourId
  level: number
  title: string
  intro: readonly Line[]
  ask: readonly { good: ProduceId; n: number }[]
  thanks: readonly Line[]
  reward: Prize
}

const said = (who: Line['who'], mood: Line['mood'], say: string): Line => ({ who, say, mood })

export const CHAPTERS = [
  // ── act 1: the neighbours ──
  {
    id: 'bread',
    act: 1,
    who: 'baker',
    level: 5,
    title: 'Bread for the lane',
    intro: [
      said('farmer', 'excited', 'A letter! From the bakery down the lane.'),
      said('baker', 'cheerful', 'Hello, new farmer! I am Moshe, the baker.'),
      said('baker', 'laughing', 'I am up at four every day. My oven is up at five.'),
      said('baker', 'curious', 'Could you send me some flour and eggs? My oven is hungry.'),
    ],
    ask: [
      { good: 'flour', n: 4 },
      { good: 'egg', n: 6 },
    ],
    thanks: [said('baker', 'proud', 'The bread came out golden. The whole lane smelled of it!'), said('baker', 'winking', 'Here is a bench for your garden. For eating bread on, of course.')],
    reward: { decor: 'bench' },
  },
  {
    id: 'class',
    act: 1,
    who: 'teacher',
    level: 8,
    title: 'A class trip, on paper',
    intro: [
      said('teacher', 'cheerful', 'Hello! I am Dalia. I teach at the school by the market.'),
      said('teacher', 'curious', 'My class is learning about farms. They have many questions.'),
      said('teacher', 'encouraging', 'Could you send lemons and strawberries? We will taste our way through it.'),
    ],
    ask: [
      { good: 'lemon', n: 6 },
      { good: 'strawberry', n: 10 },
    ],
    thanks: [
      said('teacher', 'proud', 'The class made lemonade and a very pink cake.'),
      said('teacher', 'laughing', 'Your farm got a gold star. So did the strawberries.'),
      said('teacher', 'cheerful', 'The children planted these flowers for you.'),
    ],
    reward: { decor: 'flowers' },
  },
  {
    id: 'scarves',
    act: 1,
    who: 'knitter',
    level: 13,
    title: 'A scarf for everyone',
    intro: [
      said('farmer', 'curious', 'This one smells of wool. And peppermints.'),
      said('knitter', 'cheerful', 'Hello, dear. I am Rina. I knit.'),
      said('knitter', 'winking', 'I knit for everyone. My cat has seven hats.'),
      said('knitter', 'encouraging', 'Could you send me fleece and cloth, dear? Winter will want scarves.'),
    ],
    ask: [
      { good: 'wool', n: 4 },
      { good: 'cloth', n: 2 },
    ],
    thanks: [said('knitter', 'laughing', 'I knitted a scarf for every one of your sheep. They are thinking about it.'), said('knitter', 'cheerful', 'Your scarecrow has one too. Ribbons and all.')],
    reward: { decor: 'scarecrow-ribbons' },
  },
  {
    id: 'honey',
    act: 1,
    who: 'beekeeper',
    level: 17,
    title: 'Sweet for the bees',
    intro: [
      said('beekeeper', 'encouraging', 'Hello. I am Uri. I keep the bees on the hill.'),
      said('beekeeper', 'cheerful', 'Hmm. My bees work hard all summer.'),
      said('beekeeper', 'curious', 'Some sugar for their winter, and a lemon cake for me? Slowly is fine.'),
    ],
    ask: [
      { good: 'sugar', n: 6 },
      { good: 'lemon_cake', n: 1 },
    ],
    thanks: [
      said('beekeeper', 'proud', 'The bees hummed all night. That means thank you.'),
      said('beekeeper', 'laughing', 'The cake hummed too. Then I ate it.'),
      said('beekeeper', 'cheerful', 'These roses are for your garden. The bees will visit.'),
    ],
    reward: { decor: 'roses' },
  },
  {
    id: 'picnic',
    act: 1,
    who: 'child',
    level: 23,
    title: 'A picnic by the gate',
    intro: [
      said('child', 'excited', 'Hi! I am Tali. I live next to the bakery.'),
      said('child', 'curious', 'Why do cows have four stomachs? Mum says ask you.'),
      said('child', 'excited', 'Everyone is coming to a picnic by your gate! Moshe, Dalia, Rina, Uri. Me!'),
      said('child', 'encouraging', 'Can you send milk, eggs and a carrot cake? Please?'),
    ],
    ask: [
      { good: 'milk', n: 6 },
      { good: 'egg', n: 10 },
      { good: 'carrot_cake', n: 1 },
    ],
    thanks: [
      said('child', 'laughing', 'Best picnic ever! Uri fell asleep in the sun.'),
      said('child', 'proud', 'Moshe said your farm is the heart of the lane. I said I knew first.'),
      said('child', 'cheerful', 'Here is a lantern, for picnics that go on after dark.'),
    ],
    reward: { decor: 'lantern' },
  },
  // ── act 2: the lane's year ──
  {
    id: 'birthday-cake',
    act: 2,
    who: 'baker',
    level: 27,
    title: "The bakery's birthday",
    intro: [
      said('baker', 'excited', 'The bakery turns thirty this month!'),
      said('baker', 'laughing', 'I want to bake a cake as tall as me. Maybe a little taller.'),
      said('baker', 'curious', 'Flour, sugar and many eggs, please. A cake that tall is hungry.'),
    ],
    ask: [
      { good: 'flour', n: 8 },
      { good: 'sugar', n: 6 },
      { good: 'egg', n: 12 },
    ],
    thanks: [said('baker', 'proud', 'The cake stood up all by itself. Everyone clapped.'), said('baker', 'cheerful', 'A lamp for your yard. It is warm, like an oven, but safer.')],
    reward: { decor: 'lamp' },
  },
  {
    id: 'school-garden',
    act: 2,
    who: 'teacher',
    level: 31,
    title: 'The school garden',
    intro: [
      said('teacher', 'cheerful', 'Good news! The school has a garden now.'),
      said('teacher', 'curious', 'The class wants to know what a real harvest looks like.'),
      said('teacher', 'encouraging', 'Tomatoes and corn would make a fine lesson. Top marks in advance!'),
    ],
    ask: [
      { good: 'tomato', n: 12 },
      { good: 'corn', n: 8 },
    ],
    thanks: [said('teacher', 'laughing', 'We counted every corn cob. Then we counted them again.'), said('teacher', 'proud', 'The class sends you an apple tree. They chose it themselves.')],
    reward: { decor: 'apple-tree' },
  },
  {
    id: 'long-scarf',
    act: 2,
    who: 'knitter',
    level: 35,
    title: 'The longest scarf',
    intro: [
      said('knitter', 'excited', 'Dear, I have a plan. The longest scarf in the whole town.'),
      said('knitter', 'winking', 'Long enough to go round the market. Twice.'),
      said('knitter', 'encouraging', 'Could you send fleece and cloth? As much as the sheep can spare.'),
    ],
    ask: [
      { good: 'wool', n: 8 },
      { good: 'cloth', n: 5 },
    ],
    thanks: [said('knitter', 'laughing', 'It went round the market twice. Then round Uri once.'), said('knitter', 'cheerful', 'This scarecrow jingles when the wind blows. Like my needles.')],
    reward: { decor: 'scarecrow-jingle' },
  },
  {
    id: 'honey-fair',
    act: 2,
    who: 'beekeeper',
    level: 40,
    title: 'The honey fair',
    intro: [
      said('beekeeper', 'cheerful', 'Hmm. The honey fair is coming to the lane.'),
      said('beekeeper', 'curious', 'I need sugar for the bees, and cakes for the visitors.'),
      said('beekeeper', 'encouraging', 'Strawberry cake goes well with honey. So do lemons. So do most things.'),
    ],
    ask: [
      { good: 'sugar', n: 8 },
      { good: 'strawberry_cake', n: 2 },
      { good: 'lemon', n: 10 },
    ],
    thanks: [said('beekeeper', 'proud', 'The fair was sweet from end to end.'), said('beekeeper', 'cheerful', 'A cherry tree for you. My bees like the blossom very much.')],
    reward: { decor: 'cherry-tree' },
  },
  {
    id: 'little-farm',
    act: 2,
    who: 'child',
    level: 45,
    title: "Tali's little farm",
    intro: [
      said('child', 'excited', 'Guess what! Mum gave me a corner of our garden.'),
      said('child', 'curious', 'I want a farm like yours. A very small one.'),
      said('child', 'encouraging', 'Can you send lettuce, carrots and pumpkins? To show me how they look when they are done.'),
    ],
    ask: [
      { good: 'lettuce', n: 12 },
      { good: 'carrot', n: 12 },
      { good: 'pumpkin', n: 4 },
    ],
    thanks: [
      said('child', 'proud', 'My farm has one bed and one snail. The snail is called Moshe.'),
      said('child', 'laughing', 'Moshe the baker laughed for a whole minute.'),
      said('child', 'cheerful', 'Here is a wishing well. I wished for more farms like yours.'),
    ],
    reward: { decor: 'well' },
  },
] as const satisfies readonly ChapterDef[]

export type ChapterId = (typeof CHAPTERS)[number]['id']
export const CHAPTER_IDS = CHAPTERS.map((c) => c.id) as ChapterId[]
export const isChapter = (v: unknown): v is ChapterId => CHAPTER_IDS.includes(v as ChapterId)
/** A chapter's row. */
export const chapterById = (id: ChapterId): ChapterDef => CHAPTERS.find((c) => c.id === id)!

/** The level a neighbour moves in: the level of the first chapter they write (null: none writes one). */
export function movesInAt(who: NeighbourId): number | null {
  return CHAPTERS.find((c) => c.who === who)?.level ?? null
}
