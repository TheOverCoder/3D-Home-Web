import { describe, expect, it } from 'vitest'
import { CROPS, ESTATE, MACHINES, MANAGER, produceById } from './data'
import { LAW_MACHINES, LAW_SLACK, MILL_CROPS, SAVINGS, cropNet, cropWorth, incomeAt, jobAdds, jobWorth, nextSaving, returnWorth } from './economy'
import type { FarmData } from './state/core'

// The farm's laws of worth (./economy.ts): every crop and every recipe within its law, a minute of play that earns
// more as the levels go up, a time away's goods counted net, and the next thing to save for.

describe('the laws of worth', () => {
  it('every crop nets within its law for the time it grows (the mill’s crops are judged by what they make)', () => {
    for (const c of CROPS) {
      if (MILL_CROPS.includes(c.id)) continue
      const law = cropWorth(c.growSeconds)
      expect(Math.abs(cropNet(c) / law - 1), `${c.id}: nets ${cropNet(c)}, its law ${law.toFixed(1)}`).toBeLessThanOrEqual(LAW_SLACK)
    }
  })

  it('every recipe but the mill’s adds within its law for the time it takes', () => {
    for (const id of LAW_MACHINES)
      for (const r of MACHINES[id].recipes) {
        const law = jobWorth(r.seconds)
        expect(Math.abs(jobAdds(r) / law - 1), `${id}:${r.id}: adds ${jobAdds(r)}, its law ${law.toFixed(1)}`).toBeLessThanOrEqual(LAW_SLACK)
      }
  })

  it('a longer timer pays more a press and less a minute', () => {
    expect(cropWorth(3600)).toBeGreaterThan(cropWorth(60))
    expect(cropWorth(3600) / 3600).toBeLessThan(cropWorth(60) / 60)
    expect(jobWorth(7200) / 7200).toBeLessThan(jobWorth(30) / 30)
  })

  it('a minute of play earns more as the levels go up, and levels off', () => {
    for (let level = 1; level < 28; level++) expect(incomeAt(level + 1)).toBeGreaterThan(incomeAt(level))
    for (let level = 28; level < 500; level += 7) expect(incomeAt(level + 7)).toBeGreaterThanOrEqual(incomeAt(level))
    expect(incomeAt(1)).toBeLessThan(10)
    expect(incomeAt(30)).toBeGreaterThan(80)
    expect(incomeAt(500)).toBeLessThan(200)
    expect(incomeAt(0)).toBe(incomeAt(1))
  })

  it('counts a time away’s goods net: a harvest less its seeds, a job less what went in, an animal’s at full price', () => {
    const lettuce = CROPS.find((c) => c.id === 'lettuce')!
    expect(returnWorth([{ item: 'lettuce', count: lettuce.yield }])).toBeCloseTo(cropNet(lettuce), 6)
    const cake = MACHINES.oven.recipes[0]
    expect(returnWorth([{ item: cake.makes, count: 2 }])).toBeCloseTo(2 * jobAdds(cake), 6)
    expect(returnWorth([{ item: 'egg', count: 3 }])).toBe(3 * produceById('egg').price)
    expect(returnWorth([])).toBe(0)
  })
})

describe('the next thing to save for', () => {
  const farm = (coins: number, market: boolean, house: boolean) => ({ coins, market: { owned: market }, apartment: { owned: house } }) as unknown as FarmData

  it('is the market, then the house, then nothing; the coins towards it never past its price', () => {
    expect(nextSaving(farm(640, false, false))).toEqual({ id: 'market', name: 'Market', art: 'convenience-store', have: 640, of: MANAGER.shopPrice })
    expect(nextSaving(farm(9000, false, false))?.have).toBe(MANAGER.shopPrice)
    expect(nextSaving(farm(1200, true, false))).toMatchObject({ id: 'house', have: 1200, of: ESTATE.price })
    expect(nextSaving(farm(1200, true, true))).toBeNull()
    // (a farm that bought the house first still saves for the market)
    expect(nextSaving(farm(10, false, true))?.id).toBe('market')
    expect(SAVINGS.map((s) => s.id)).toEqual(['market', 'house'])
  })
})
