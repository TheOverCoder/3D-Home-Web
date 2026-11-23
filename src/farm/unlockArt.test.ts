import { describe, expect, it } from 'vitest'
import { UPGRADES } from './data'
import { openFirst, UPGRADE_ART, unlockPic, whereOf } from './unlockArt'
import { UNLOCK_IDS } from './unlocks'

// How what a level opens is shown (src/farm/unlockArt.ts): every row of the table has a picture and a place it is found,
// and a shop with locks lists what is open first.

describe('how an unlock is shown', () => {
  it('every row of the table has a picture and a word for where it is found', () => {
    for (const id of UNLOCK_IDS) {
      expect(unlockPic(id), id).toMatch(/\S/)
      expect(whereOf(id), id).toMatch(/^[A-Z]/)
    }
    for (const u of UPGRADES) expect(UPGRADE_ART[u.id], u.id).toBeTruthy()
  })

  it('names the place by kind: seeds, a machine, the shop, the edit mode', () => {
    expect(whereOf('crop:wheat')).toBe('Seeds')
    expect(whereOf('recipe:mill:wheat')).toBe('Mill')
    expect(whereOf('upgrade:hen')).toBe('Shop')
    expect(whereOf('decor:path')).toBe('Decor')
    expect(whereOf('decor:apple-tree')).toBe('Fruit trees')
    expect(whereOf('machine:oven')).toBe('Machines')
    expect(whereOf('parcel:north')).toBe('Edit')
    expect(whereOf('bed')).toBe('Build')
  })

  it('a shop with locks: what is open first in its own order, then what is locked, the nearest level first', () => {
    const rows = [
      { id: 'a', lock: 6 },
      { id: 'b', lock: null },
      { id: 'c', lock: 3 },
      { id: 'd', lock: null },
      { id: 'e', lock: 3 },
    ]
    expect(openFirst(rows, (r) => r.lock).map((r) => r.id)).toEqual(['b', 'd', 'c', 'e', 'a'])
    // all open (the tests' pages): the order is the shop's own
    expect(openFirst(rows, () => null).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
