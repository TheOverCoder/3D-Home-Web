import { describe, expect, it } from 'vitest'
import { NEIGHBOUR_IDS, PERSON_IDS } from '../../data/people'
import { unkind } from '../../talk/kind'
import { CROPS, MACHINES, MACHINE_IDS, PRODUCERS, SELLABLE, type ProduceId } from '../data'
import { SHOP } from '../decor'
import { recipeUnlock, unlockLevel, type UnlockId } from '../unlocks'
import { CHAPTERS, CHAPTER_IDS, chapterById, isChapter, movesInAt } from './chapters'

// The story's chapters (src/farm/people/chapters.ts): each a neighbour's, in rising levels, asking for a few goods the
// farm can make by then, in kind words (src/talk/kind.ts), with a gift the save can hold.

/** The level a good can first be had at (as the unlocks' own test reads it). */
function goodOpensAt(good: ProduceId): number {
  if (CROPS.some((c) => c.id === good)) return unlockLevel(`crop:${good}` as UnlockId)
  const made = MACHINE_IDS.flatMap((m) => MACHINES[m].recipes.filter((r) => r.makes === good).map((r) => unlockLevel(recipeUnlock(m, r.id))))
  if (made.length) return Math.min(...made)
  if (Object.values(PRODUCERS).some((p) => p.good === good && !p.plant)) return 1
  throw new Error(`${good}: nowhere to get it`)
}

describe('the chapters', () => {
  it('ids unique; act 1 meets the five neighbours at levels 5, 8, 13, 17 and 23, act 2 goes on from 27 to 45', () => {
    expect(new Set(CHAPTER_IDS).size).toBe(CHAPTERS.length)
    const act1 = CHAPTERS.filter((c) => c.act === 1)
    expect(act1.map((c) => c.level)).toEqual([5, 8, 13, 17, 23])
    expect(new Set(act1.map((c) => c.who))).toEqual(new Set(NEIGHBOUR_IDS))
    const act2 = CHAPTERS.filter((c) => c.act === 2)
    expect(act2.length).toBe(5)
    for (const c of act2) expect(c.level >= 27 && c.level <= 45, c.id).toBe(true)
    // levels rising, the acts in order
    for (let k = 1; k < CHAPTERS.length; k++) {
      expect(CHAPTERS[k].level, CHAPTERS[k].id).toBeGreaterThan(CHAPTERS[k - 1].level)
      expect(CHAPTERS[k].act, CHAPTERS[k].id).toBeGreaterThanOrEqual(CHAPTERS[k - 1].act)
    }
    expect(isChapter('bread') && !isChapter('nope')).toBe(true)
    expect(chapterById('picnic').who).toBe('child')
    expect(movesInAt('beekeeper')).toBe(17)
  })

  it("each asks for one to three goods buyers buy, each open by its level, a few of each; its writer and speakers are the game's people", () => {
    for (const c of CHAPTERS) {
      expect(c.ask.length >= 1 && c.ask.length <= 3, c.id).toBe(true)
      expect(new Set(c.ask.map((a) => a.good)).size, c.id).toBe(c.ask.length)
      for (const a of c.ask) {
        expect(SELLABLE, `${c.id}: ${a.good}`).toContain(a.good)
        expect(goodOpensAt(a.good), `${c.id}: ${a.good} open by level ${c.level}`).toBeLessThanOrEqual(c.level)
        expect(Number.isInteger(a.n) && a.n >= 1 && a.n <= 12, `${c.id}: ${a.good}`).toBe(true)
      }
      for (const l of [...c.intro, ...c.thanks]) expect(PERSON_IDS, `${c.id}: ${l.who}`).toContain(l.who)
      // the letter is the writer's: the farmer may open it, the rest is theirs
      expect(c.intro.some((l) => l.who === c.who) && c.thanks.every((l) => l.who === c.who), c.id).toBe(true)
    }
  })

  it('two to four lines a letter, short, in kind words; the gift a piece of the shop', () => {
    for (const c of CHAPTERS) {
      for (const lines of [c.intro, c.thanks]) {
        expect(lines.length >= 2 && lines.length <= 4, c.id).toBe(true)
        for (const l of lines) {
          expect(unkind(l.say), `${c.id}: "${l.say}"`).toBeNull()
          expect(l.say.length, `${c.id}: "${l.say}"`).toBeLessThanOrEqual(100)
        }
      }
      expect('decor' in c.reward && Object.hasOwn(SHOP, c.reward.decor), c.id).toBe(true)
    }
  })
})
