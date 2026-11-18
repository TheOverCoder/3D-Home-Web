// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { takeRewardShows } from '../fx/reward'
import { REWARD_KIND_IDS, TIERS, rewardKind, type RewardKind } from '../lib/tier'
import { setMotionPref } from '../ui/still'
import { ESTATE, ITEMS, LADDERS, cropById, toolLadder, type ProduceId } from './data'
import { goalById, goalTarget } from './goals'
import type { Prize } from './prize'
import {
  acceptOffer,
  addJob,
  buyApartment,
  buyFromContractor,
  capacity,
  claimDaily,
  claimGoal,
  claimLevel,
  collect,
  collectMachine,
  contractorOffers,
  declineOffer,
  declineOrder,
  farm,
  fillOrder,
  freezeDay,
  gainXp,
  harvestBeds,
  openGifts,
  orderAt,
  plant,
  quietDaily,
  quietSteps,
  resetFarm,
  resetRewardCounts,
  rewardCounts,
  sellAll,
  sellAllToManager,
  sellToContractor,
  sellToManager,
  sendOrder,
  setDailyClock,
  setHour,
  setRandom,
  spawnVisitor,
  takeTill,
  tick,
  toolTake,
  water,
} from './state'
import { rewardTier } from './worth'
import { levelOf, levelReward, xpAt } from './xp'
import { GARMENTS } from './outfit'

// Every payout counted once, with its tier (`rewarded`, src/farm/state/rewards.ts; update-v1/CONTRACTS.md §1.11): each
// sale, order, till, claim, level and collection is one reward — a whole line sold is one — at the tier what it holds
// gives at the level now, never under its kind's floor; nothing for a decline, a cancel, a refund, a purchase or a store
// too full to take anything. A payout at a place in the world queues its show there (none under less motion).

/** The level the farm stands at (well inside it: a small payout's XP reaches no level). */
const LEVEL = 10
const NOON = new Date(2026, 10, 2, 12).getTime()

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.5)
  setDailyClock(() => NOON)
  quietDaily(false)
  farm.xp = { points: xpAt(LEVEL) + 1, paid: LEVEL }
  resetRewardCounts()
  takeRewardShows()
})
afterEach(() => {
  setRandom(null)
  setDailyClock(null)
  freezeDay(false)
  quietSteps(true)
  setMotionPref('device')
})

/** The rewards `f` counted, one `kind:tier` for each, in the order of the kinds. */
function counted(f: () => unknown): string[] {
  const before = rewardCounts()
  f()
  const after = rewardCounts()
  return REWARD_KIND_IDS.flatMap((k) => TIERS.flatMap((t) => Array.from({ length: after[k][t] - before[k][t] }, () => `${k}:${t}`)))
}

/** One reward of this kind, at the tier these prizes give at the level now. */
const one = (kind: RewardKind, prizes: Prize[]) => [`${kind}:${rewardTier(prizes, levelOf(farm.xp.points), rewardKind(kind).least)}`]

/** The building materials `f` brought (a surprise), as prizes. */
function materials(f: () => unknown): Prize[] {
  const before = ITEMS.map((i) => farm.inv[i])
  f()
  return ITEMS.flatMap((item, k) => (farm.inv[item] > before[k] ? [{ item, n: farm.inv[item] - before[k] }] : []))
}

describe('sales: each one reward, a whole line sold one', () => {
  it('a buyer at the gate: one sale at the tier its coins give; with a surprise, still one, the material in it', () => {
    farm.inv.lettuce = 40
    const v = spawnVisitor({ want: 'lettuce', qty: 2, offer: 9, queued: true, gift: false })
    expect(counted(() => expect(acceptOffer(v.id)).toBe(true))).toEqual(one('sale', [{ coins: 9 }]))
    const w = spawnVisitor({ want: 'lettuce', qty: 2, offer: 9, queued: true, gift: true })
    let got: Prize[] = []
    const c = counted(() => (got = materials(() => expect(acceptOffer(w.id)).toBe(true))))
    expect(got.length).toBe(1)
    expect(c).toEqual(one('sale', [{ coins: 9 }, ...got]))
  })

  it('the whole line: one sale for all of them; a decline, or nothing to sell: none', () => {
    farm.inv.lettuce = 40
    for (const offer of [10, 20, 30]) spawnVisitor({ want: 'lettuce', qty: 2, offer, queued: true, gift: false })
    expect(counted(() => expect(sellAll()).toBe(3))).toEqual(one('sale', [{ coins: 60 }]))
    const v = spawnVisitor({ want: 'lettuce', qty: 2, offer: 9, queued: true, gift: false })
    farm.inv.lettuce = 0
    expect(counted(() => [acceptOffer(v.id), sellAll(), declineOffer(v.id)])).toEqual([])
  })

  it('the manager: one for a stack, one for everything sold to him at once; nothing to sell: none', () => {
    farm.inv.lettuce = 3
    let coins = 0
    expect(counted(() => (coins = sellToManager('lettuce')))).toEqual(one('sale', [{ coins }]))
    expect(coins).toBeGreaterThan(0)
    Object.assign(farm.inv, { lettuce: 3, egg: 4, milk: 2 })
    expect(counted(() => (coins = sellAllToManager()))).toEqual(one('sale', [{ coins }]))
    expect(counted(() => [sellToManager('lettuce'), sellAllToManager()])).toEqual([])
  })

  it('the till: one; empty: none', () => {
    farm.market.owned = true
    farm.market.till = { coins: 50, goods: 5 }
    expect(counted(() => expect(takeTill()).toBe(50))).toEqual(one('till', [{ coins: 50 }]))
    expect(counted(() => takeTill())).toEqual([])
  })

  it('the contractor: a stack sold to him is one sale; a piece bought from him (a purchase) none', () => {
    setHour(13)
    farm.inv.brick = 7
    let coins = 0
    expect(counted(() => (coins = sellToContractor('brick')))).toEqual(one('sale', [{ coins }]))
    expect(coins).toBeGreaterThan(0)
    farm.coins = 10_000
    contractorOffers()
    expect(counted(() => expect(buyFromContractor(0)).toBe(true))).toEqual([])
  })

  it('an order sent: one, with its surprise in it; declined: none', () => {
    tick(0.1)
    const fill = (k: number) => {
      const o = orderAt(k)!
      for (const l of o.lines) farm.inv[l.good] += l.want - l.have
      fillOrder(k)
      return o
    }
    const o = fill(0)
    o.surprise = false
    expect(counted(() => expect(sendOrder(0)).toBe(true))).toEqual(one('order', [{ coins: o.coins }]))
    const p = fill(0)
    p.surprise = true
    let got: Prize[] = []
    const c = counted(() => (got = materials(() => expect(sendOrder(0)).toBe(true))))
    expect(got.length).toBe(1)
    expect(c).toEqual(one('order', [{ coins: p.coins }, ...got]))
    fill(1)
    expect(counted(() => expect(declineOrder(1)).toBe(true))).toEqual([])
  })

  it('a sale is as big as it is: five coins at level 10 is small, three of the next level’s coins huge', () => {
    farm.inv.lettuce = 40
    const small = spawnVisitor({ want: 'lettuce', qty: 1, offer: 5, queued: true, gift: false })
    expect(counted(() => acceptOffer(small.id))).toEqual(['sale:small'])
    // (its XP may reach the next level: that level's own reward is counted beside it)
    const huge = spawnVisitor({ want: 'lettuce', qty: 1, offer: 3 * levelReward(LEVEL + 1), queued: true, gift: false })
    expect(counted(() => acceptOffer(huge.id)).filter((r) => r.startsWith('sale'))).toEqual(['sale:huge'])
  })
})

describe('claims: each one reward', () => {
  it('the daily gift: one; the same day again: none', () => {
    let prizes: Prize[] = []
    expect(counted(() => (prizes = claimDaily()!))).toEqual(one('daily', prizes))
    expect(counted(() => expect(claimDaily()).toBeNull())).toEqual([])
  })

  it('gift boxes: one for each open, however many it opens; opened already: none', () => {
    let prizes: Prize[] = []
    expect(counted(() => (prizes = openGifts([1, 5]).map((o) => o.prize)))).toEqual(one('box', prizes))
    expect(prizes.length).toBe(2)
    expect(counted(() => (prizes = openGifts().map((o) => o.prize)))).toEqual(one('box', prizes))
    expect(prizes.length).toBeGreaterThan(2)
    expect(counted(() => openGifts([1]))).toEqual([])
  })

  it('a goal: one, its coins and its material; not reached: none', () => {
    const def = goalById('eggs')
    expect(counted(() => claimGoal('eggs'))).toEqual([])
    farm.got.egg = goalTarget(def, 0)
    let reward = { coins: 0, item: 'brick' as ProduceId, count: 0 }
    const c = counted(() => (reward = claimGoal('eggs')!))
    expect(c).toEqual(one('goal', [{ coins: reward.coins }, { item: reward.item, n: reward.count }]))
  })

  it('a first step: one for each step passed, a frame later', () => {
    resetFarm()
    resetRewardCounts()
    quietSteps(false)
    farm.sprinkler = true
    tick(0.1)
    expect(plant(0, 'lettuce')).toBe(true)
    expect(counted(() => tick(0.1)).filter((r) => r.startsWith('step'))).toHaveLength(1)
    expect(counted(() => tick(0.1))).toEqual([])
  })
})

describe('levels: each one reward, at least big', () => {
  it('a level reached by play: one for its coins and its gift, however many levels at once', () => {
    farm.xp = { points: xpAt(LEVEL + 1) - 1, paid: LEVEL }
    const c = counted(() => gainXp('harvest', 1))
    expect(levelOf(farm.xp.points)).toBe(LEVEL + 1)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatch(/^level:(big|huge)$/)
    // two at once (12 and 13): still one
    farm.xp = { points: xpAt(LEVEL + 2) - 1, paid: LEVEL + 1 }
    const two = counted(() => gainXp('harvest', Math.ceil(xpAt(LEVEL + 3) - xpAt(LEVEL + 2) + 1)))
    expect(levelOf(farm.xp.points)).toBe(LEVEL + 3)
    expect(two).toHaveLength(1)
    expect(two[0]).toMatch(/^level:/)
  })

  it('a level that comes with a garment: the garment one reward of its own, big', () => {
    const g = GARMENTS.find((x) => x.level > LEVEL)!
    farm.xp = { points: xpAt(g.level) - 1, paid: g.level - 1 }
    const c = counted(() => gainXp('harvest', 1))
    expect(c.filter((r) => r.startsWith('garment'))).toEqual(['garment:big'])
    expect(c.filter((r) => r.startsWith('level'))).toHaveLength(1)
  })

  it('coins of levels left unpaid, claimed: one; none waiting: none', () => {
    farm.xp = { points: xpAt(LEVEL + 2) + 1, paid: LEVEL }
    const c = counted(() => expect(claimLevel()).toBeGreaterThan(0))
    expect(c).toHaveLength(1)
    expect(c[0]).toMatch(/^level:(big|huge)$/)
    expect(counted(() => claimLevel())).toEqual([])
  })

  it('the house’s keys: one, huge', () => {
    setHour(12)
    farm.coins = ESTATE.price
    expect(counted(() => expect(buyApartment()).toBe(true)).filter((r) => r.startsWith('keys'))).toEqual(['keys:huge'])
  })
})

describe('goods collected: each press one reward', () => {
  it('a harvest of two beds: one; the silo too full for any: none', () => {
    farm.sprinkler = true
    for (const i of [0, 1]) Object.assign(farm.beds[i], { built: true, crop: 'lettuce', growth: cropById('lettuce').growSeconds, water: 1 })
    let n = 0
    let got: Prize[] = []
    const c = counted(() => (got = materials(() => (n = harvestBeds([0, 1])))))
    expect(n).toBeGreaterThan(0)
    expect(c).toEqual(one('harvest', [{ item: 'lettuce', n }, ...got]))
    for (const i of [0, 1]) Object.assign(farm.beds[i], { crop: 'lettuce', growth: cropById('lettuce').growSeconds })
    farm.inv.wheat = capacity('silo')
    expect(counted(() => expect(harvestBeds([0, 1])).toBe(0))).toEqual([])
  })

  it('an animal collected from, by the button or a tap of its tool: one each; the barn full: none', () => {
    farm.producers.cows.stock[0] = 2
    let got: Prize[] = []
    const c = counted(() => (got = materials(() => expect(collect('cows', 0)).toBe(2))))
    expect(c).toEqual(one('collect', [{ item: 'milk', n: 2 }, ...got]))
    const tool = toolLadder('cows', 'tool')
    farm.ladders[tool] = LADDERS[tool].levels
    farm.producers.cows.stock[0] = 2
    expect(counted(() => expect(toolTake('cows', 0)).toBe(1))).toHaveLength(1)
    farm.inv.egg = capacity('barn')
    farm.producers.cows.stock[0] = 2
    expect(counted(() => [collect('cows', 0), toolTake('cows', 0)])).toEqual([])
  })

  it('a machine’s goods taken out: one for all of them; the barn full: none', () => {
    farm.inv.wheat = 2
    expect([addJob('mill', 'wheat'), addJob('mill', 'wheat')]).toEqual([true, true])
    tick(60)
    expect(counted(() => expect(collectMachine('mill')).toBe(2))).toEqual(one('made', [{ item: 'flour', n: 2 }]))
    farm.inv.wheat = 1
    addJob('mill', 'wheat')
    tick(60)
    farm.inv.egg = capacity('barn')
    expect(counted(() => expect(collectMachine('mill')).toBe(0))).toEqual([])
  })
})

describe('what is not a reward', () => {
  it('planting, watering, buying: nothing counted', () => {
    farm.coins = 1000
    expect(
      counted(() => {
        plant(0, 'lettuce')
        water(0)
      }),
    ).toEqual([])
  })
})

describe('the show of a reward paid in the world', () => {
  it('a sale queues its show over the buyer; a claim none; under less motion none, and the count still changes', () => {
    farm.inv.lettuce = 40
    const v = spawnVisitor({ want: 'lettuce', qty: 2, offer: 9, queued: true, gift: false })
    acceptOffer(v.id)
    expect(takeRewardShows()).toEqual([expect.objectContaining({ kind: 'sale', tier: 'small', x: v.x, z: v.z })])
    claimDaily()
    expect(takeRewardShows()).toEqual([])
    setMotionPref('less')
    const w = spawnVisitor({ want: 'lettuce', qty: 2, offer: 9, queued: true, gift: false })
    expect(counted(() => acceptOffer(w.id))).toEqual(['sale:small'])
    expect(takeRewardShows()).toEqual([])
  })
})
