import { describe, expect, it } from 'vitest'
import { CHAPTERS } from './chapters'
import { begin, finish, freshStory, metOf, nextAfter, nextBeat, nextChapter, sanitizeStory, sentOn } from './story'

// Where the story stands (src/farm/people/story.ts): one chapter at a time, in order, each at its level and only when it
// may; a farm from any level starts at the first; the saved record made safe.

describe('the story', () => {
  it('a new farm: nothing done, nothing on, nobody met; the first chapter next', () => {
    const s = freshStory()
    expect(s).toEqual({ done: [], on: null, sent: false })
    expect(metOf(s)).toEqual([])
    expect(nextChapter(s)?.id).toBe('bread')
    expect(nextAfter([])).toBe('bread')
  })

  it('one chapter at a time: it begins at its level when it may, waits for its request, then finishes', () => {
    let s = freshStory()
    // under its level, or when it may not (the first steps running, a chapter begun this visit): nothing
    expect(nextBeat(s, 4, true)).toBeNull()
    expect(nextBeat(s, 5, false)).toBeNull()
    expect(nextBeat(s, 5, true)).toEqual({ begin: 'bread' })
    s = begin(s, 'bread')
    expect(metOf(s)).toEqual(['baker'])
    // on: nothing until its request is sent, whatever the level
    expect(nextBeat(s, 99, true)).toBeNull()
    s = sentOn(s)
    expect(s.sent).toBe(true)
    expect(nextBeat(s, 5, false)).toEqual({ finish: 'bread' })
    s = finish(s)
    expect(s).toEqual({ done: ['bread'], on: null, sent: false })
    expect(metOf(s)).toEqual(['baker'])
    // the next at its own level
    expect(nextBeat(s, 7, true)).toBeNull()
    expect(nextBeat(s, 8, true)).toEqual({ begin: 'class' })
  })

  it('a farm of any level (one from before the story) gets the first chapter, then the rest in turn', () => {
    let s = freshStory()
    const seen: string[] = []
    for (let k = 0; k < CHAPTERS.length + 2; k++) {
      const b = nextBeat(s, 30, true)
      if (!b || !('begin' in b)) break
      seen.push(b.begin)
      s = finish(sentOn(begin(s, b.begin)))
    }
    // every chapter of level 30 or less, in the table's order, and none beyond
    expect(seen).toEqual(CHAPTERS.filter((c) => c.level <= 30).map((c) => c.id))
    expect(nextBeat(s, 30, true)).toBeNull()
    // the story told to its last row: nothing more, at any level
    s = { done: CHAPTERS.map((c) => c.id), on: null, sent: false }
    expect(nextBeat(s, 500, true)).toBeNull()
    expect(nextChapter(s)).toBeNull()
    expect(metOf(s).length).toBe(5)
  })

  it('as saved: the chapters done kept as far as they are in order; the one on only the next; sent only with one on', () => {
    expect(sanitizeStory({ done: ['bread', 'class'], on: 'scarves', sent: true })).toEqual({ done: ['bread', 'class'], on: 'scarves', sent: true })
    expect(sanitizeStory({ done: ['bread', 'scarves', 'class'], on: 'class', sent: false })).toEqual({ done: ['bread'], on: 'class', sent: false })
    expect(sanitizeStory({ done: ['class'], on: 'bread', sent: true })).toEqual({ done: [], on: 'bread', sent: true })
    expect(sanitizeStory({ done: 'bread', on: 'picnic', sent: true })).toEqual({ done: [], on: null, sent: false })
    expect(sanitizeStory({ done: ['bread'], on: null, sent: true })).toEqual({ done: ['bread'], on: null, sent: false })
    for (const raw of [null, undefined, 7, 'story', [], { done: [{}], on: {}, sent: 'yes' }]) expect(sanitizeStory(raw), JSON.stringify(raw)).toEqual(freshStory())
  })
})
