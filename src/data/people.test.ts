import { describe, expect, it } from 'vitest'
import { HOURS } from '../farm/data'
import { lookOf } from '../film/cast'
import { VOICES } from '../film/voice'
import { DRIVER } from '../models/tractor'
import { sanitizeLook } from '../models/look'
import { AGENT, DRIVER as DRIVER_TALKER } from '../talk/speech'
import { PEOPLE, PERSON_IDS, personById, personLook, steadyLook, talkerOf } from './people'

// The people table (update-v1/CONTRACTS.md §1.13): until 03 moves the game's callers onto it, every row must be exactly
// the person the game draws and voices today, wherever that is written now.

/** The estate agent as src/farm/state.ts dresses him today (AGENT_DRESS: steadyLook(4271, ESTATE_LOOK), private there),
 *  captured on 2026-11-18. */
const AGENT_TODAY = {
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
}

describe('the people table', () => {
  it('draws the five of today as the game does', () => {
    expect(personLook('manager')).toEqual(lookOf('manager'))
    expect(personLook('contractor')).toEqual(lookOf('contractor'))
    expect(personLook('agent')).toEqual(AGENT_TODAY)
    expect(personLook('driver')).toEqual(DRIVER)
    expect(personLook('farmer')).toBeNull()
  })

  it('voices them as the game does', () => {
    expect(personById('manager').voice).toEqual(VOICES.manager)
    expect(personById('contractor').voice).toEqual(VOICES.contractor)
    expect(talkerOf('agent')).toEqual(AGENT)
    expect(talkerOf('driver')).toEqual(DRIVER_TALKER)
    expect(talkerOf('farmer')).toBeNull()
  })

  it('gives each a name of their own, a picture, a look the people engine reads back, and hours that exist', () => {
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
    }
  })

  it('rolls the same person every time, and a different one on other dice', () => {
    expect(steadyLook(77, {})).toEqual(steadyLook(77, {}))
    expect(steadyLook(77, {})).not.toEqual(steadyLook(78, {}))
    expect(steadyLook(77, { shirt: '#000000' }).shirt).toBe('#000000')
  })
})
