// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LADDERS, MANAGER, PRODUCERS, TOOL_KINDS, XP_FOR, mostAnimals, toolLadder } from '../farm/data'
import { buyLadder, buyMarket, farm, resetFarm, setRandom } from '../farm/state'
import { levelPay, savedNow, startFrom } from '../farm/testSaves'
import { buyShop, buyWithFilm, filmAsked, onFilmAsked, storyStep, takeFilm, type StoryEvent, type StoryStep } from './films'
import { FILMS } from './story'
import { FilmRun } from './run'
import { SUPERMARKET } from './supermarket'
import type { FrameInfo } from './stage3d'

// When a moment's film plays (./films.ts): buying the shop from its card asks for its film once, after the purchase;
// nothing else asks for it (the farm's own rule, a reload, another farm); a skip, or a failure, lands on the end card
// and never plays it again; and its clock (./run.ts) starts with its first frame, a skip taking it to its end.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  setRandom(() => 0.99)
  takeFilm()
})
afterEach(() => setRandom(null))

/** The manager's rate to its top: the shop for sale. */
function forSale() {
  farm.coins = 100_000
  for (let k = 0; k < LADDERS.rate.levels; k++) expect(buyLadder('rate')).toBe(true)
}

describe('the shop’s film', () => {
  it('plays once, after the shop is bought from its card: the purchase first, its XP on the end card', () => {
    let heard = 0
    const off = onFilmAsked(() => heard++)
    // not for sale yet: nothing bought, no film
    farm.coins = 100_000
    expect(buyShop()).toBe(false)
    expect([filmAsked(), heard]).toEqual([null, 0])
    forSale()
    const xp = farm.xp.points
    const coins = farm.coins
    const paid = farm.xp.paid
    expect(buyShop()).toBe(true)
    // the purchase is done before the film (the coins, the shop, the XP), and the film asked for once (the shop's XP can
    // reach a level, whose coins come in by themselves: left out of its price)
    expect([farm.market.owned, coins - (farm.coins - levelPay(paid)), farm.xp.points - xp]).toEqual([true, MANAGER.shopPrice, XP_FOR.shop])
    expect(heard).toBe(1)
    expect(takeFilm()).toEqual({ id: 'shop', xp: [xp, xp + XP_FOR.shop] })
    // taken to play, it is gone: it plays once
    expect(takeFilm()).toBe(null)
    // the shop is yours: no second purchase, no second film
    expect(buyShop()).toBe(false)
    expect([filmAsked(), heard]).toEqual([null, 1])
    off()
  })

  it('nothing else asks for it: the farm’s own rule (tests, the console), a reload, another farm', () => {
    forSale()
    expect(buyMarket()).toBe(true)
    expect(filmAsked()).toBe(null)
    // bought from its card, and the page reloaded before it played: the save holds no film
    resetFarm()
    forSale()
    expect(buyShop()).toBe(true)
    const save = savedNow()
    takeFilm()
    startFrom(save)
    expect(farm.market.owned).toBe(true)
    expect(filmAsked()).toBe(null)
    expect(JSON.stringify(save)).not.toMatch(/film/i)
  })

  it('a skip or a failure lands on the end card, and it never plays again by itself', () => {
    const run = (events: StoryEvent[], from: StoryStep = 'dark') => {
      const steps: (StoryStep | null)[] = []
      let s: StoryStep | null = from
      for (const e of events) {
        s = s === null ? null : storyStep(s, e)
        steps.push(s)
      }
      return steps
    }
    // played through: made, its end, dark again, the card, Continue
    expect(run(['ready', 'end', 'dark', 'close'])).toEqual(['film', 'out', 'card', null])
    // skipped while playing: dark, then the card
    expect(run(['ready', 'skip', 'dark'])).toEqual(['film', 'out', 'card'])
    // skipped while it is still being made: straight to the card
    expect(run(['skip'])).toEqual(['card'])
    // a failure, whenever: the card
    for (const s of ['dark', 'film', 'out'] as const) expect(storyStep(s, 'fail')).toBe('card')
    // on the card, a skip, an end or a frame do nothing: only Watch again plays it, only Continue closes it
    for (const e of ['skip', 'end', 'ready', 'dark'] as const) expect(storyStep('card', e)).toBe('card')
    expect(run(['again', 'ready', 'skip', 'dark'], 'card')).toEqual(['dark', 'film', 'out', 'card'])
  })

  it('its clock starts with its first frame; a skip takes it to its end; Watch again from its start', () => {
    let now = 1000
    const run = new FilmRun(SUPERMARKET, 0, () => now)
    const info: FrameInfo = { shot: 0, portrait: 0, speaker: null, focus: null, light: 'night', farm: false, blocked: null }
    expect(run.length).toBeGreaterThan(15)
    expect(run.length).toBeLessThanOrEqual(45)
    expect(run.problems()).toEqual([])
    // made, not drawn yet: it waits at its start
    now += 3000
    expect([run.now(), run.started, run.ended]).toEqual([0, false, false])
    run.frame(0, info)
    now += 2500
    expect(run.now()).toBeCloseTo(2.5)
    // skipped: at its end at once (the end card)
    const heard: number[] = []
    run.onRestart((t) => heard.push(t))
    run.skip()
    expect([run.now(), run.ended]).toEqual([run.length, true])
    now += 5000
    expect(run.now()).toBe(run.length)
    // again: from its start
    run.again()
    now += 1000
    expect(run.now()).toBeCloseTo(1)
    expect(heard).toEqual([run.length, 0])
    // held at a moment (a picture of it)
    run.restart(12, true)
    now += 4000
    expect(run.now()).toBe(12)
  })
})

describe('the tools’ films', () => {
  /** A herd full (the tool's need), and coins for anything. */
  const fullHerd = (kind: (typeof TOOL_KINDS)[number]) => {
    farm.coins = 100_000
    farm.producers[kind].animals = mostAnimals(kind)
    farm.producers[kind].stock = PRODUCERS[kind].herd?.shared ? [0] : Array.from({ length: mostAnimals(kind) }, () => 0)
    farm.producers[kind].timer = farm.producers[kind].stock.map(() => 0)
  }

  it('each tool bought from its card asks for its own build film once, after the purchase; its upgrades and buyLadder ask for none', () => {
    const film = { hens: 'coop', cows: 'bucket', sheep: 'shears' } as const
    for (const kind of TOOL_KINDS) {
      fullHerd(kind)
      const xp = farm.xp.points
      expect(buyWithFilm(toolLadder(kind, 'tool'))).toBe(true)
      expect(farm.ladders[toolLadder(kind, 'tool')]).toBe(1)
      expect(takeFilm()).toEqual({ id: film[kind], xp: [xp, xp + XP_FOR.build] })
      expect(takeFilm()).toBe(null)
      // owned: no second purchase, no second film; a step of its upgrades plays none
      expect(buyWithFilm(toolLadder(kind, 'tool'))).toBe(false)
      expect(buyWithFilm(toolLadder(kind, 'hold'))).toBe(true)
      expect(filmAsked()).toBe(null)
      // each has its film to play, in the style the user chose at purchase
      expect(FILMS[film[kind]].style ?? 'a').toBe('a')
    }
    // the farm's own buy (tests, the simulation): no film
    resetFarm()
    fullHerd('hens')
    expect(buyLadder('hens-tool')).toBe(true)
    expect(filmAsked()).toBe(null)
  })
})
