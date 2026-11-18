// The game's people, one row each (update-v1/CONTRACTS.md §1.13): who they are, how they look (a roll of the people
// engine on dice of their own, so they look the same every time), how they sound, their picture, the hours they keep.
// Today the five who are always the same — the farmer, the market's manager, the contractor, the estate agent, the
// tractor's driver — are written in four places (src/farm/state.ts, src/film/cast.ts, src/film/voice.ts,
// src/talk/speech.ts, src/models/tractor.ts); this is their one home once 03's first commit moves those callers here.
// Then come the five neighbours (03) and the car dealer's seller (11), each a row. Ids are by role, so a name can
// change. people.test.ts holds the rows to today's looks and voices. Not yet used by the game.

import type { Keeper, ProduceId } from '../farm/data'
import { VOICES, type Voice } from '../film/voice'
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
  /** their portrait: src/assets/people/<id>.webp, drawn from their own model (03); the farmer's are his faces
   *  (src/ui/art.ts, farmer-<mood>) */
  pic: string
  /** the hours they keep (a row of HOURS in src/farm/data.ts) */
  hours?: Keeper
  /** a neighbour's: the two goods they ask for, their birthday, a word for how they talk */
  likes?: readonly [ProduceId, ProduceId]
  birthday?: { month: number; date: number }
  trait?: string
}

/** The estate agent's and the driver's voices, as src/talk/speech.ts has them (AGENT, DRIVER), until 03 moves speech.ts
 *  onto this table. */
const AGENT_VOICE: Voice = { pitch: 122, speed: 4.7, size: 1, bright: 0.7, swing: 0.8 }
const DRIVER_VOICE: Voice = { pitch: 96, speed: 4.1, size: 1.08, bright: 0.45, swing: 0.4 }
/** The tractor's driver, as src/models/tractor.ts has him (DRIVER), until 03 moves tractor.ts onto this table. */
const DRIVER_LOOK: PersonLook = { shirt: '#3f6fa3', trousers: '#3d4a5c', skin: '#e0ac87', hair: '#5a3a22', hairStyle: 0, hat: true, height: 1, basket: false, seated: true }

export const PEOPLE = {
  farmer: { name: 'The farmer', role: 'farmer', pic: 'farmer' },
  manager: { name: 'The manager', role: 'staff', look: { seed: 1723, over: MANAGER_LOOK }, voice: VOICES.manager, pic: 'people/manager' },
  contractor: { name: 'The contractor', role: 'staff', look: { seed: 9157, over: CONTRACTOR_LOOK }, voice: VOICES.contractor, pic: 'people/contractor', hours: 'contractor' },
  agent: { name: 'The estate agent', role: 'staff', look: { seed: 4271, over: ESTATE_LOOK }, voice: AGENT_VOICE, pic: 'people/agent', hours: 'estate' },
  driver: { name: 'The driver', role: 'staff', look: { whole: DRIVER_LOOK }, voice: DRIVER_VOICE, pic: 'people/driver' },
} as const satisfies Record<string, PersonDef>
export type PersonId = keyof typeof PEOPLE
export const PERSON_IDS = Object.keys(PEOPLE) as PersonId[]

/** The five neighbours, by role (03's rows; their names are a decision still to make). */
export type NeighbourId = 'baker' | 'teacher' | 'knitter' | 'beekeeper' | 'child'

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
