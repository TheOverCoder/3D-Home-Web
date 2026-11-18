import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PERSON_IDS, personById, personLook } from '../data/people'
import { FARMER_MOODS } from '../farm/firstSteps'
import { MOOD_MOVES } from '../farm/FarmerFace'
import { pictureOf } from './Portrait'

// Anyone's portrait (./Portrait.tsx): every person of the table has a picture — the farmer a face in each mood, anyone
// else their own, drawn from their own model (scripts/render-item-art.mjs --people) — and moves with every mood.

describe('portraits', () => {
  it('every person of the table has a picture: the farmer a face in each mood, everyone else their own', () => {
    for (const mood of FARMER_MOODS) expect(pictureOf('farmer', mood), mood).toContain(`farmer-${mood}`)
    for (const id of PERSON_IDS) {
      if (id === 'farmer') continue
      // drawn from their own model: whoever has a picture has a body
      expect(personLook(id), id).not.toBeNull()
      const pic = personById(id).pic
      expect(pic, id).toBe(`people/${id}`)
      expect(existsSync(new URL(`../assets/${pic}.webp`, import.meta.url)), `src/assets/${pic}.webp`).toBe(true)
      expect(pictureOf(id), id).toMatch(new RegExp(`${id}\\.webp`))
      // the same picture in every mood (only the move changes)
      expect(pictureOf(id, 'surprised')).toBe(pictureOf(id))
    }
  })

  it('a move for every mood', () => {
    for (const mood of FARMER_MOODS) expect(MOOD_MOVES[mood], mood).toBeDefined()
  })
})
