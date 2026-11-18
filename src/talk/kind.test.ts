import { describe, expect, it } from 'vitest'
import { PERSON_IDS, personById } from '../data/people'
import { unkind } from './kind'
import { TALK, voiceMood, type Line } from './lines'

// Kind words only (./kind.ts): no character says a word of guilt, hurry or loneliness to the player, and nobody sighs
// at them. Every line the game's characters say is here; a new kind of line (a letter, a chapter) checks its own
// rows with `unkind` too.

describe('kind words', () => {
  it('knows a guilt line when it sees one: the lines that went', () => {
    for (const line of [
      'Hmm. Still waiting.',
      'Oh well.',
      'I was waiting for you!',
      'We miss you.',
      'Hurry, the cake is going!',
      'Last chance today',
      'So lonely here.',
      'Come back soon!',
      'Oh. I am sad.',
    ])
      expect(unkind(line), line).not.toBeNull()
    for (const line of ['No problem!', 'Thank you!', 'Another time, then!', 'Hello again, my top farmer.', 'A calm day. Like a hive.']) expect(unkind(line), line).toBeNull()
  })

  it('every line a character says is kind, and none is said sadly', () => {
    for (const [moment, row] of Object.entries(TALK)) {
      const lines: readonly Line[] = row.lines
      for (const line of lines) {
        expect(unkind(line.say), `${moment}: "${line.say}"`).toBeNull()
        expect(voiceMood(line.mood), `${moment}: "${line.say}"`).not.toBe('sad')
      }
    }
  })

  it('nobody is written to talk in an unkind way', () => {
    for (const id of PERSON_IDS) expect(unkind(personById(id).trait ?? ''), id).toBeNull()
  })
})
