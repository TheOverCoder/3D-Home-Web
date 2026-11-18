import { describe, expect, it } from 'vitest'
import { HOURS, NAMES, PRODUCE, PRODUCERS } from '../farm/data'
import { steadyLook as coreSteadyLook } from '../farm/state/core'
import { MANAGER_LOOK, sanitizeLook } from '../models/look'
import { NEIGHBOUR_IDS, PEOPLE, PERSON_IDS, isNeighbour, personById, personLook, steadyLook, talkerOf } from './people'

// The people table (update-v1/CONTRACTS.md §1.13): everything that draws or voices one of the game's people reads its
// row, so the five of before must stay exactly the people the game drew and voiced before it (captured on 2026-11-18,
// before the callers moved here); the neighbours are new rows of the same engine.

/** The four with a body, as the game drew them before the table: the market's manager and the contractor
 *  (src/farm/state.ts and src/film/cast.ts, each steadyLook over its overrides), the estate agent (state.ts's
 *  AGENT_DRESS) and the tractor's driver (src/models/tractor.ts, DRIVER). */
const LOOKS_BEFORE = {
  manager: {
    sex: 'm',
    shirt: '#f2eee8',
    trousers: '#2f3a4f',
    skin: '#f6d5bd',
    hair: '#9a9894',
    hairStyle: 0,
    hat: false,
    hatBand: '#8a4b3a',
    height: 1.02,
    shoulders: 1.0427707256482779,
    hips: 0.9475859706045995,
    head: 1.0274079515027852,
    eyes: '#6d7680',
    extra: 'tie',
    basket: false,
  },
  contractor: {
    sex: 'm',
    shirt: '#e8742c',
    trousers: '#3d4a5c',
    skin: '#f1c7a5',
    hair: '#b9b2a8',
    hairStyle: 3,
    hat: 'cap',
    hatBand: '#f2c230',
    height: 1.04,
    shoulders: 1.031718824585769,
    hips: 0.9982848130158544,
    head: 1.022852357464308,
    eyes: '#2a1c14',
    basket: false,
  },
  agent: {
    sex: 'm',
    shirt: '#2f4a6b',
    trousers: '#2b3038',
    skin: '#e0ac87',
    hair: '#2b2017',
    hairStyle: 0,
    hat: false,
    hatBand: '#d9a441',
    height: 1,
    shoulders: 1.02749493281706,
    hips: 0.9073358563274778,
    head: 1.0437372959189757,
    eyes: '#6b5a2a',
    extra: 'tie',
    basket: false,
    seated: true,
  },
  driver: { shirt: '#3f6fa3', trousers: '#3d4a5c', skin: '#e0ac87', hair: '#5a3a22', hairStyle: 0, hat: true, height: 1, basket: false, seated: true },
}

/** Their voices before the table: the films' (src/film/voice.ts, VOICES) and the speech's (src/talk/speech.ts, AGENT
 *  and DRIVER). */
const VOICES_BEFORE = {
  manager: { pitch: 128, speed: 4.8, size: 0.97, bright: 0.85, rasp: 0.04, swing: 0.9 },
  contractor: { pitch: 84, speed: 3.9, size: 1.16, bright: 0.38, rasp: 0.32, swing: 0.3 },
}
const TALKERS_BEFORE = {
  agent: { key: 'agent', female: false, voice: { pitch: 122, speed: 4.7, size: 1, bright: 0.7, swing: 0.8 }, fixed: true },
  driver: { key: 'driver', female: false, voice: { pitch: 96, speed: 4.1, size: 1.08, bright: 0.45, swing: 0.4 }, fixed: true },
}

describe('the people table', () => {
  it('draws the five of before exactly as the game drew them', () => {
    for (const [id, look] of Object.entries(LOOKS_BEFORE)) expect(personLook(id as keyof typeof LOOKS_BEFORE), id).toEqual(look)
    expect(personLook('farmer')).toBeNull()
  })

  it('voices them exactly as the game voiced them', () => {
    expect(personById('manager').voice).toEqual(VOICES_BEFORE.manager)
    expect(personById('contractor').voice).toEqual(VOICES_BEFORE.contractor)
    expect(talkerOf('agent')).toEqual(TALKERS_BEFORE.agent)
    expect(talkerOf('driver')).toEqual(TALKERS_BEFORE.driver)
    expect(talkerOf('farmer')).toBeNull()
  })

  it("rolls as the farm's core did (its copy goes once nothing reads it), the same person every time", () => {
    for (const seed of [1, 1723, 9157, 4271, 3307, 6029]) expect(steadyLook(seed, MANAGER_LOOK)).toEqual(coreSteadyLook(seed, MANAGER_LOOK))
    expect(steadyLook(77, {})).toEqual(steadyLook(77, {}))
    expect(steadyLook(77, {})).not.toEqual(steadyLook(78, {}))
    expect(steadyLook(77, { shirt: '#000000' }).shirt).toBe('#000000')
  })

  it('gives each a name of their own, a picture, a look the people engine reads back, a voice and hours that exist', () => {
    const names = PERSON_IDS.map((id) => PEOPLE[id].name)
    expect(new Set(names).size).toBe(names.length)
    for (const id of PERSON_IDS) {
      const p = personById(id)
      expect(p.pic, id).toBeTruthy()
      const look = personLook(id)
      // (read back as a saved look is: `seated` is not kept there, as nobody in a save sits)
      if (look) expect(sanitizeLook(look), id).toMatchObject({ shirt: look.shirt, trousers: look.trousers, skin: look.skin, hair: look.hair })
      if (p.hours) expect(Object.keys(HOURS), id).toContain(p.hours)
      if (p.voice) expect(p.voice.pitch > 50 && p.voice.pitch < 400 && p.voice.speed > 2 && p.voice.speed < 7, id).toBe(true)
      // everyone with a body can be heard
      expect(!!p.look, id).toBe(!!p.voice)
    }
  })

  it('five neighbours, each a name no buyer or animal has, a look a saved line keeps whole, two goods they like and a birthday', () => {
    expect(NEIGHBOUR_IDS).toEqual(['baker', 'teacher', 'knitter', 'beekeeper', 'child'])
    expect(isNeighbour('baker')).toBe(true)
    expect(isNeighbour('manager')).toBe(false)
    expect(isNeighbour(undefined)).toBe(false)
    const herd = Object.values(PRODUCERS).flatMap((p) => ('herd' in p && p.herd ? p.herd.names : []))
    const goods = PRODUCE.map((p) => p.id as string)
    for (const id of NEIGHBOUR_IDS) {
      const p = personById(id)
      expect(NAMES, id).not.toContain(p.name)
      expect(herd, id).not.toContain(p.name)
      expect(p.name, id).toMatch(/^[A-Z][a-z]+$/)
      // a neighbour in the line at the gate is saved with their look: it reads back as the same person
      const look = personLook(id)!
      expect(sanitizeLook(look), id).toEqual(look)
      expect(p.likes?.length, id).toBe(2)
      expect(new Set(p.likes).size, id).toBe(2)
      for (const g of p.likes ?? []) expect(goods, `${id} likes ${g}`).toContain(g)
      const b = p.birthday!
      expect(Number.isInteger(b.month) && b.month >= 1 && b.month <= 12, id).toBe(true)
      expect(new Date(2023, b.month - 1, b.date).getDate(), id).toBe(b.date)
      expect(p.trait, id).toMatch(/\S/)
      expect(talkerOf(id)?.female, id).toBe(look.sex === 'f')
    }
    // the five do not look alike: no two share a shirt
    expect(new Set(NEIGHBOUR_IDS.map((id) => personLook(id)!.shirt)).size).toBe(NEIGHBOUR_IDS.length)
  })
})
