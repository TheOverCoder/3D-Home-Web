// @vitest-environment happy-dom
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { SLOTS, currentSlot, deleteSlot, exportSlot, resetFarm, saveFarm, slotSummary, switchSlot } from '../farm/state'
import { FARM_SLOTS, lightSlot, lightSummary } from './Intro'

// The opening screen reads the farms kept on this device lightly until the farm itself is in (it is not part of the
// page shell: ./Intro.tsx): which place was played last, whether each holds a farm and whether that farm has been
// played. Held here to what the farm's own save tells (src/farm/state/save.ts: `SLOTS`, `currentSlot`, `slotSummary`),
// on the saves it writes, the brand-new and the played, and on what it keeps when a save cannot be read.

const light = (n: number) => lightSummary(n)
const farms = (n: (typeof SLOTS)[number]) => {
  const s = slotSummary(n)
  return { slot: s.slot, exists: s.exists, played: s.played }
}

beforeEach(() => {
  switchSlot(1)
  for (const n of SLOTS) if (n !== 1) deleteSlot(n)
  resetFarm()
})
afterAll(() => {
  switchSlot(1)
  resetFarm()
})

describe('the farms read lightly', () => {
  it('are kept in the same places as the farm keeps them', () => {
    expect([...FARM_SLOTS]).toEqual([...SLOTS])
  })

  it('tell the place played last as the farm does', () => {
    expect(lightSlot()).toBe(currentSlot())
    switchSlot(3)
    expect(lightSlot()).toBe(3)
    switchSlot(1)
    expect(lightSlot()).toBe(1)
  })

  it('tell an empty place, a brand-new farm and a played one as the farm does', () => {
    saveFarm()
    for (const n of SLOTS) expect(light(n), `farm ${n}`).toEqual(farms(n))
    // a brand-new farm is kept, not played
    expect(light(1)).toEqual({ slot: 1, exists: true, played: false })
    // played: a file of a played farm loaded into another place
    const file = JSON.parse(exportSlot(1).text) as { save: { stats: { sold: number } } }
    file.save.stats.sold = 3
    localStorage.setItem('3d-home:farm:v1:slot2', JSON.stringify(file.save))
    expect(light(2)).toEqual(farms(2))
    expect(light(2).played).toBe(true)
  })

  it('tell a place whose save cannot be read as kept and not played, as the farm does', () => {
    for (const text of ['{', '"a farm"', 'null', '[1, 2]']) {
      localStorage.setItem('3d-home:farm:v1:slot3', text)
      expect(light(3), text).toEqual(farms(3))
    }
    deleteSlot(3)
    expect(light(3)).toEqual({ slot: 3, exists: false, played: false })
  })
})
