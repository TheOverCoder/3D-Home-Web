import { describe, expect, it } from 'vitest'
import { NEIGHBOUR_IDS, PERSON_IDS } from '../../data/people'
import { unkind } from '../../talk/kind'
import { dayNumber } from '../calendar'
import { savedPrize } from '../prize'
import { CHAPTER_IDS } from './chapters'
import { MOST_HEARTS } from './friends'
import { ALL_LETTERS, BIRTHDAY_WAITS, MAIL_KEPT, birthdayLetter, birthdayYear, chapterLetter, deliver, freshMail, has, heartLetter, isLetter, letterOf, open, sanitizeMail, thanksLetter } from './mail'

// The neighbours' letters (src/farm/people/mail.ts): a letter is its id, its words the game's; delivered once, read
// once, the last read kept; a birthday's comes within a week of the date; every word kind.

describe('the letters', () => {
  it('every letter the game writes: its writer a neighbour, one to four lines of their people, each kind', () => {
    // every chapter's two, every heart's of every neighbour, every birthday's
    expect(ALL_LETTERS.length).toBe(CHAPTER_IDS.length * 2 + NEIGHBOUR_IDS.length * (MOST_HEARTS + 1))
    for (const id of ALL_LETTERS) {
      const l = letterOf(id)!
      expect(l, id).not.toBeNull()
      expect(NEIGHBOUR_IDS, id).toContain(l.from)
      expect(l.lines.length >= 1 && l.lines.length <= 4, id).toBe(true)
      for (const line of l.lines) {
        expect(PERSON_IDS, `${id}: ${line.who}`).toContain(line.who)
        expect(unkind(line.say), `${id}: "${line.say}"`).toBeNull()
        expect(line.say.length, `${id}: "${line.say}"`).toBeLessThanOrEqual(100)
      }
    }
    // the heart letters differ from one another
    const hearts = ALL_LETTERS.filter((id) => id.startsWith('heart:')).map((id) => letterOf(id)!.lines[0].say)
    expect(new Set(hearts).size).toBe(hearts.length)
  })

  it('an id that is no letter is none', () => {
    for (const id of [
      'chapter:nope',
      'heart:baker:1:2',
      'chapter:bread:',
      'heart:baker:0',
      'heart:baker:6',
      'heart:manager:1',
      'birthday:baker:26',
      'birthday:teacher',
      'thanks:bread:x',
      7,
      null,
      '__proto__',
    ])
      expect(isLetter(id), String(id)).toBe(false)
    expect(isLetter('chapter:bread') && isLetter('thanks:picnic') && isLetter('heart:child:5') && isLetter('birthday:knitter:2031')).toBe(true)
  })

  it('a heart brings coins at an odd heart (more at each), building materials at an even one; a birthday a slice of cake; a chapter its piece', () => {
    const one = heartLetter('baker', 1, 10)
    const three = heartLetter('baker', 3, 10)
    expect('coins' in one.prize! && 'coins' in three.prize! && three.prize.coins > one.prize.coins).toBe(true)
    expect(heartLetter('baker', 2, 10).prize).toEqual({ item: 'log', n: 3 })
    expect(heartLetter('teacher', 4, 10).prize).toEqual({ item: 'brick', n: 4 })
    // more coins at a higher level, the same heart
    expect((heartLetter('baker', 1, 30).prize as { coins: number }).coins).toBeGreaterThan((one.prize as { coins: number }).coins)
    expect(birthdayLetter('teacher', 2026)).toEqual({ id: 'birthday:teacher:2026', from: 'teacher', prize: { item: 'lemon_cake', n: 1 } })
    expect(thanksLetter('bread')).toEqual({ id: 'thanks:bread', from: 'baker', prize: { decor: 'bench' } })
    expect(chapterLetter('class')).toEqual({ id: 'chapter:class', from: 'teacher' })
    // every gift a save can hold
    for (const who of NEIGHBOUR_IDS) for (let k = 1; k <= MOST_HEARTS; k++) expect(savedPrize(heartLetter(who, k, 7).prize), `${who} ${k}`).toEqual(heartLetter(who, k, 7).prize)
    for (const who of NEIGHBOUR_IDS) expect(savedPrize(birthdayLetter(who, 2026).prize)).toEqual(birthdayLetter(who, 2026).prize)
    for (const id of CHAPTER_IDS) expect(savedPrize(thanksLetter(id).prize)).toEqual(thanksLetter(id).prize)
  })

  it('delivered once, read once: waiting oldest first, the read newest first, the last MAIL_KEPT kept', () => {
    let m = freshMail()
    m = deliver(m, chapterLetter('bread'))
    m = deliver(m, heartLetter('baker', 1, 5))
    expect(deliver(m, chapterLetter('bread'))).toBe(m)
    expect(m.waiting.map((l) => l.id)).toEqual(['chapter:bread', 'heart:baker:1'])
    m = open(m, 'chapter:bread')
    expect(m.waiting.map((l) => l.id)).toEqual(['heart:baker:1'])
    expect(m.read.map((l) => l.id)).toEqual(['chapter:bread'])
    expect(open(m, 'chapter:bread')).toBe(m)
    // read is never delivered again
    expect(deliver(m, chapterLetter('bread'))).toBe(m)
    expect(has(m, 'chapter:bread') && has(m, 'heart:baker:1') && !has(m, 'thanks:bread')).toBe(true)
    for (let y = 2000; y < 2000 + MAIL_KEPT + 5; y++) m = open(deliver(m, birthdayLetter('child', y)), `birthday:child:${y}`)
    expect(m.read.length).toBe(MAIL_KEPT)
    expect(m.read[0].id).toBe(`birthday:child:${2000 + MAIL_KEPT + 4}`)
  })

  it(`a birthday's letter may come on the date and the ${BIRTHDAY_WAITS - 1} days after it, of that year`, () => {
    // the baker's birthday is 14 March
    const day = (y: number, m: number, d: number) => dayNumber(new Date(y, m - 1, d, 12).getTime())
    expect(birthdayYear('baker', day(2027, 3, 13))).toBeNull()
    expect(birthdayYear('baker', day(2027, 3, 14))).toBe(2027)
    expect(birthdayYear('baker', day(2027, 3, 20))).toBe(2027)
    expect(birthdayYear('baker', day(2027, 3, 21))).toBeNull()
    // the teacher's (1 September), across a month's end
    expect(birthdayYear('teacher', day(2026, 9, 7))).toBe(2026)
    // the knitter's (12 December), a year later: that year's
    expect(birthdayYear('knitter', day(2027, 12, 18))).toBe(2027)
  })

  it('as saved: letters of the game, each once, from their own writer, with a gift a save can hold; made safe', () => {
    const m = sanitizeMail({
      waiting: [
        { id: 'heart:baker:1', from: 'child', prize: { coins: 12 } },
        { id: 'heart:baker:1' },
        { id: 'chapter:nope' },
        { id: 'thanks:bread', prize: { decor: 'castle' } },
        'heart:baker:2',
        { id: 'birthday:baker:2026', prize: { item: 'carrot_cake', n: 1 } },
      ],
      read: [{ id: 'birthday:baker:2026' }, { id: 'chapter:bread' }, ...Array.from({ length: 40 }, (_, k) => ({ id: `birthday:child:${2000 + k}` }))],
    })
    expect(m.waiting).toEqual([
      { id: 'heart:baker:1', from: 'baker', prize: { coins: 12 } },
      { id: 'thanks:bread', from: 'baker' },
      { id: 'birthday:baker:2026', from: 'baker', prize: { item: 'carrot_cake', n: 1 } },
    ])
    expect(m.read[0]).toEqual({ id: 'chapter:bread', from: 'baker' })
    expect(m.read.length).toBe(MAIL_KEPT)
    for (const raw of [null, 7, 'mail', [], { waiting: 'x', read: {} }]) expect(sanitizeMail(raw), JSON.stringify(raw)).toEqual(freshMail())
  })
})
