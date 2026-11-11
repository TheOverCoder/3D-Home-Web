import { describe, expect, it } from 'vitest'
import { Color } from 'three'
import { random } from '../lib/sculpt'
import { OLD_SAVE } from '../farm/testSaves'
import { CONTRACTOR_LOOK, LOOK_VARIETY, MANAGER_LOOK, TRAITS, rollLook, sanitizeLook } from './look'
import { EYES, HAT_BAND, PersonRig, personParts, type PersonLook } from './person'

// The people engine (src/models/look.ts): a rolled look is saved as it is and read back the same, the looks saved before
// it (buyers in line in an older save) load unchanged, and the table makes enough different people.

/** Looks as the buyers' line saved them before the people engine: four colours, three hair styles, a straw hat or none. */
const OLD_LOOKS: PersonLook[] = [
  OLD_SAVE.queue[0].look,
  { shirt: '#c9573f', trousers: '#2b3038', skin: '#704a32', hair: '#1c1c1c', hairStyle: 1, hat: true, height: 0.94 },
  { shirt: '#f2cc8f', trousers: '#283044', skin: '#f6d5bd', hair: '#d9b98a', hairStyle: 2, hat: false, height: 1.05 },
  { shirt: '#2f8f8a', trousers: '#6b6255', skin: '#c68863', hair: '#7b4b2a', hairStyle: 0, hat: true, height: 1 },
]

describe('looks', () => {
  it('every rolled look reads back from a save as it was', () => {
    const rand = random(17)
    for (let k = 0; k < 3000; k++) {
      const look = rollLook(rand)
      expect(sanitizeLook(JSON.parse(JSON.stringify(look)))).toEqual(look)
    }
    for (const fixed of [MANAGER_LOOK, CONTRACTOR_LOOK]) {
      const look = rollLook(rand, fixed)
      expect(sanitizeLook(JSON.parse(JSON.stringify(look)))).toEqual(look)
    }
  })

  it('looks saved before the people engine load unchanged', () => {
    for (const look of OLD_LOOKS) expect(sanitizeLook(JSON.parse(JSON.stringify(look)))).toEqual(look)
  })

  it('a roll is the same on the same dice, and keeps what is fixed', () => {
    expect(rollLook(random(5))).toEqual(rollLook(random(5)))
    const manager = rollLook(random(5), MANAGER_LOOK)
    expect(manager).toMatchObject(MANAGER_LOOK)
    expect(rollLook(random(9), CONTRACTOR_LOOK)).toMatchObject({ hat: 'cap', basket: false })
  })

  it('the builds stay in their ranges, and every hair style and hat comes up', () => {
    const rand = random(23)
    const styles = new Set<number>()
    const hats = new Set<unknown>()
    for (let k = 0; k < 2000; k++) {
      const look = rollLook(rand)
      const build = TRAITS.build[look.sex!]
      expect(look.shoulders).toBeGreaterThanOrEqual(build.shoulders[0])
      expect(look.shoulders).toBeLessThanOrEqual(build.shoulders[1])
      expect(look.hips).toBeGreaterThanOrEqual(build.hips[0])
      expect(look.hips).toBeLessThanOrEqual(build.hips[1])
      expect(look.height).toBeGreaterThanOrEqual(TRAITS.height[0])
      expect(look.height).toBeLessThanOrEqual(TRAITS.height[1])
      styles.add(look.hairStyle)
      hats.add(look.hat)
    }
    expect([...styles].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    expect(hats).toEqual(new Set([false, 'straw', 'cap', 'beanie']))
  })

  it('makes more than 600 thousand different people', () => {
    expect(LOOK_VARIETY).toBeGreaterThanOrEqual(600_000)
  })

  it('a broken look is no look', () => {
    expect(sanitizeLook(null)).toBeNull()
    expect(sanitizeLook({ shirt: 'red', trousers: '#000000', skin: '#000000', hair: '#000000' })).toBeNull()
    expect(sanitizeLook({ shirt: '#ffffff', trousers: '#000000', skin: '#000000', hair: '#000000', hairStyle: 9, hat: 'crown', height: 3, head: 'big' })).toEqual({
      shirt: '#ffffff',
      trousers: '#000000',
      skin: '#000000',
      hair: '#000000',
      hairStyle: 0,
      hat: false,
      height: 1.08,
      head: 1,
    })
  })

  it("the eyes are the head's second colour, a hat takes the hat colour, and both follow their person when the view leaves one out", () => {
    const parts = personParts(2)
    parts.begin()
    new PersonRig({ ...OLD_LOOKS[1], eyes: '#3f6a8f', hatBand: '#2f4a6b' }).write(parts)
    // a look saved before looks had eyes or a band colour: as every person was drawn before
    new PersonRig(OLD_LOOKS[3]).write(parts)
    parts.end()
    const second = () => parts.meshes.head.geometry.getAttribute('instanceColor2').array as Float32Array
    const near = (got: ArrayLike<number>, want: string) => new Color(want).toArray().forEach((v, i) => expect(got[i]).toBeCloseTo(v, 6))
    near(second().slice(0, 3), '#3f6a8f')
    near(second().slice(3, 6), EYES)
    near((parts.meshes.hat.instanceColor!.array as Float32Array).slice(0, 3), '#2f4a6b')
    near((parts.meshes.hat.instanceColor!.array as Float32Array).slice(3, 6), HAT_BAND)
    // only the head has a second colour
    expect(Object.entries(parts.meshes).flatMap(([k, m]) => (m.geometry.getAttribute('instanceColor2') ? [k] : []))).toEqual(['head'])
    // the first person out of view: the second's eyes are drawn first
    let k = 0
    parts.cull(() => k++ > 0)
    expect(parts.meshes.head.count).toBe(1)
    near(second().slice(0, 3), EYES)
  })
})
