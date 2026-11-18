// The game's people, one row each (update-v1/CONTRACTS.md §1.13): who they are, how they look (a roll of the people
// engine on dice of their own, so they look the same every time), how they sound, their picture, the hours they keep.
// The five who are always the same — the farmer, the market's manager, the contractor, the estate agent, the
// tractor's driver — and the five neighbours, each a row; the car dealer's seller (11) comes as one more. Ids are by
// role, so a name can change. Everything that draws or voices one of them reads it here: the market's and the
// contractor's dresses (src/farm/state/market.ts, contractor.ts), the films' cast (src/film/cast.ts), the speech voices
// (src/talk/speech.ts), the tractor's driver (src/models/tractor.ts) and the portraits (src/ui/Portrait.tsx).
// people.test.ts holds the five of before to the looks and voices they always had.

import type { Keeper, ProduceId } from '../farm/data'
import type { Voice } from '../film/voice'
import { CONTRACTOR_LOOK, ESTATE_LOOK, MANAGER_LOOK, rollLook } from '../models/look'
import type { PersonLook } from '../models/person'
import type { Talker } from '../talk/speech'

export interface PersonDef {
  /** what the game calls them */
  name: string
  role: 'farmer' | 'staff' | 'neighbour' | 'seller'
  /** a roll of the people engine on dice of their own over a few fixed traits (`steadyLook`), or a whole look; none:
   *  no body in the world (the farmer, who is his faces) */
  look?: { seed: number; over: Partial<PersonLook> } | { whole: PersonLook }
  /** how they sound; none: read, never heard */
  voice?: Voice
  /** their portrait, under src/assets (`people/<id>`: a .webp drawn from their own model by scripts/render-item-art.mjs
   *  --people); the farmer's are his faces (src/ui/art.ts, farmer-<mood>) */
  pic: string
  /** the hours they keep (a row of HOURS in src/farm/data.ts) */
  hours?: Keeper
  /** a neighbour's: the two goods they ask for (a sale of one is worth more to their friendship), their birthday
   *  (month 1–12, date), a word for how they talk (their lines, src/talk/lines.ts, are written to it) */
  likes?: readonly [ProduceId, ProduceId]
  birthday?: { month: number; date: number }
  trait?: string
}

/** The tractor's driver: a farmer in a straw hat, both hands on the wheel (no basket), seated. */
const DRIVER_LOOK: PersonLook = { shirt: '#3f6fa3', trousers: '#3d4a5c', skin: '#e0ac87', hair: '#5a3a22', hairStyle: 0, hat: true, height: 1, basket: false, seated: true }

export const PEOPLE = {
  farmer: { name: 'The farmer', role: 'farmer', pic: 'farmer' },
  /** a salesman: quick, a little high and nasal, up and down */
  manager: {
    name: 'The manager',
    role: 'staff',
    look: { seed: 1723, over: MANAGER_LOOK },
    voice: { pitch: 128, speed: 4.8, size: 0.97, bright: 0.85, rasp: 0.04, swing: 0.9 },
    pic: 'people/manager',
  },
  /** a big man of few words: slow, deep, a rough edge */
  contractor: {
    name: 'The contractor',
    role: 'staff',
    look: { seed: 9157, over: CONTRACTOR_LOOK },
    voice: { pitch: 84, speed: 3.9, size: 1.16, bright: 0.38, rasp: 0.32, swing: 0.3 },
    pic: 'people/contractor',
    hours: 'contractor',
  },
  /** the estate agent, a salesman: lively, a little bright */
  agent: {
    name: 'The estate agent',
    role: 'staff',
    look: { seed: 4271, over: ESTATE_LOOK },
    voice: { pitch: 122, speed: 4.7, size: 1, bright: 0.7, swing: 0.8 },
    pic: 'people/agent',
    hours: 'estate',
  },
  /** the man on the tractor: calm, low, unhurried */
  driver: { name: 'The driver', role: 'staff', look: { whole: DRIVER_LOOK }, voice: { pitch: 96, speed: 4.1, size: 1.08, bright: 0.45, swing: 0.4 }, pic: 'people/driver' },

  // The neighbours (decisions 11 and 12): names in the game's own style, none a buyer's (NAMES in src/farm/data.ts) or
  // an animal's; each looks like their trade and sounds like their age. They come to the gate with a basket, as
  // buyers do. When they keep their hours (a HOURS row each) is 03's next part.
  /** the baker: broad, in white, his cap a white beanie (over brown skin, so they read as his clothes); a warm, round
   *  voice */
  baker: {
    name: 'Moshe',
    role: 'neighbour',
    look: {
      seed: 3307,
      over: { sex: 'm', shirt: '#f6f0e4', trousers: '#5a4636', skin: '#c68863', hair: '#5a3a22', hairStyle: 0, hat: 'beanie', hatBand: '#f6f0e4', height: 1, shoulders: 1.1, hips: 1 },
    },
    voice: { pitch: 104, speed: 4.2, size: 1.12, bright: 0.42, rasp: 0.1, swing: 0.6 },
    pic: 'people/baker',
    likes: ['flour', 'egg'],
    birthday: { month: 3, date: 14 },
    trait: 'up since four; everything is about bread',
  },
  /** the teacher: a purple blouse, long auburn hair; a clear voice that rises and falls */
  teacher: {
    name: 'Dalia',
    role: 'neighbour',
    look: { seed: 5113, over: { sex: 'f', shirt: '#7b5aa6', trousers: '#283044', skin: '#f1c7a5', hair: '#7b4b2a', hairStyle: 1, hat: false, height: 1.02 } },
    voice: { pitch: 212, speed: 4.3, size: 0.86, bright: 0.62, rasp: 0.03, swing: 0.75 },
    pic: 'people/teacher',
    likes: ['lemon', 'strawberry'],
    birthday: { month: 9, date: 1 },
    trait: 'gives top marks for everything',
  },
  /** the knitter: grey curls, small, in a red cardigan of her own making; slower, a little rasp */
  knitter: {
    name: 'Rina',
    role: 'neighbour',
    look: { seed: 7741, over: { sex: 'f', shirt: '#b23a48', trousers: '#6b6255', skin: '#f6d5bd', hair: '#b9b2a8', hairStyle: 3, hat: false, height: 0.92 } },
    voice: { pitch: 190, speed: 3.8, size: 0.9, bright: 0.48, rasp: 0.2, swing: 0.65 },
    pic: 'people/knitter',
    likes: ['wool', 'cloth'],
    birthday: { month: 12, date: 12 },
    trait: 'knits for everyone, even the cows',
  },
  /** the beekeeper: tall, in honey yellow and a straw hat; calm, low and level, like his hives */
  beekeeper: {
    name: 'Uri',
    role: 'neighbour',
    look: { seed: 2203, over: { sex: 'm', shirt: '#f2cc8f', trousers: '#1f2a24', skin: '#e0ac87', hair: '#a8743f', hairStyle: 3, hat: 'straw', hatBand: '#d9a441', height: 1.06 } },
    voice: { pitch: 98, speed: 3.7, size: 1.06, bright: 0.32, rasp: 0.08, swing: 0.3 },
    pic: 'people/beekeeper',
    likes: ['sugar', 'lemon_cake'],
    birthday: { month: 5, date: 20 },
    trait: 'calm and slow; hums like his bees',
  },
  /** the child: small, a big head and dark curls, in teal; high and quick */
  child: {
    name: 'Tali',
    role: 'neighbour',
    look: { seed: 6029, over: { sex: 'f', shirt: '#2f8f8a', trousers: '#3d4a5c', skin: '#9a6646', hair: '#1c1c1c', hairStyle: 3, hat: false, height: 0.9, head: 1.1, shoulders: 0.88, hips: 1 } },
    voice: { pitch: 290, speed: 5.2, size: 0.72, bright: 0.82, rasp: 0, swing: 1 },
    pic: 'people/child',
    likes: ['milk', 'egg'],
    birthday: { month: 7, date: 7 },
    trait: 'loves every animal; asks why',
  },
} as const satisfies Record<string, PersonDef>
export type PersonId = keyof typeof PEOPLE
export const PERSON_IDS = Object.keys(PEOPLE) as PersonId[]

/** The neighbours (the rows whose role is one), by role. */
export type NeighbourId = { [K in PersonId]: (typeof PEOPLE)[K]['role'] extends 'neighbour' ? K : never }[PersonId]
export const NEIGHBOUR_IDS = PERSON_IDS.filter((id) => PEOPLE[id].role === 'neighbour') as NeighbourId[]
export const isNeighbour = (v: unknown): v is NeighbourId => NEIGHBOUR_IDS.includes(v as NeighbourId)

/** A person's row. */
export const personById = (id: PersonId): PersonDef => PEOPLE[id]

/** The same person every time: their traits rolled on dice of their own (never the farm's), over the traits fixed. */
export function steadyLook(seed: number, over: Partial<PersonLook>): PersonLook {
  let a = seed
  const dice = () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
  return rollLook(dice, over)
}

/** How a person looks (null: no body in the world). */
export function personLook(id: PersonId): PersonLook | null {
  const look = personById(id).look
  if (!look) return null
  return 'whole' in look ? { ...look.whole } : steadyLook(look.seed, look.over)
}

/** How a person speaks aloud (src/talk/speech.ts): their own voice, kept as one of the game's fixed characters'
 *  (null: never heard). */
export function talkerOf(id: PersonId): Talker | null {
  const voice = personById(id).voice
  return voice ? { key: id, female: personLook(id)?.sex === 'f', voice, fixed: true } : null
}
