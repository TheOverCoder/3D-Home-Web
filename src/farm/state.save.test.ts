// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { START_COINS } from './data'
import {
  currentSlot,
  deleteSlot,
  exportSlot,
  farm,
  freeUpSpace,
  importSlot,
  lookAgain,
  mayWrite,
  nextStamp,
  resetFarm,
  restoreCopy,
  sameStamp,
  saveFarm,
  saveState,
  saveWords,
  savedStamp,
  slotSummary,
  switchSlot,
  type Stamp,
} from './state'
import { justSaved, playedSave, savedNow, startFrom } from './testSaves'

// No farm is ever wiped by its own save, nor by a second tab (src/farm/state/save.ts, update-v1 mission 08 c7, c8): a
// save that cannot be read is kept as it was (and aside, `:broken`) and never written over until the player chooses;
// the save as a visit began is kept (`:prev`) and loads again; a storage that is full is told once; and a tab writes only
// over the stamp it last saw (`:stamp`): left behind by another tab, it stops saving, and looked at again it loads the
// newest farm.

// a reader that throws on a save it should have made safe (none does: save.property.test.ts), switched on by a test
const flags = vi.hoisted(() => ({ throwing: false }))
vi.mock('./events', async (original) => {
  const real = await original<typeof import('./events')>()
  return {
    ...real,
    sanitizeEvents: (v: unknown) => {
      if (flags.throwing) throw new Error('[test] a reader that throws')
      return real.sanitizeEvents(v)
    },
  }
})

const NOW = Date.UTC(2026, 10, 18, 12)
const keyOf = (n: number) => (n === 1 ? '3d-home:farm:v1' : `3d-home:farm:v1:slot${n}`)
const stored = (n: number, beside = '') => localStorage.getItem(keyOf(n) + beside)
const stampOf = (n: number) => savedStamp(stored(n, ':stamp'))
/** A farm played for a while with these coins, saved just now. */
const savedWith = (coins: number) => justSaved({ ...played, coins })
let played: Record<string, unknown>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  flags.throwing = false
  localStorage.clear()
  switchSlot(1)
  resetFarm()
  played ??= playedSave()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('a save that cannot be read', () => {
  const cut = () => JSON.stringify(savedWith(321)).slice(0, 900)
  const cases: [string, () => string][] = [
    ['not JSON', () => '{'],
    ['cut short', cut],
    ['not a farm', () => '7'],
    ['a reader throws on it', () => JSON.stringify(savedWith(321))],
  ]
  for (const [what, text] of cases)
    it(`is kept as it was, never written over until the player chooses (${what})`, () => {
      const t = text()
      flags.throwing = what === 'a reader throws on it'
      startFrom(t)
      const n = currentSlot()
      // a new farm is played meanwhile, and not saved
      expect(saveState().held).toBe(true)
      expect(farm.coins).toBe(START_COINS)
      farm.coins = 999
      saveFarm()
      expect(stored(n)).toBe(t)
      // kept aside too, and shown as it is in the saves list
      expect(stored(n, ':broken')).toBe(t)
      expect(slotSummary(n)).toMatchObject({ exists: true, broken: true, copy: null })
      // as a file: the text as it was stored when it is not JSON, else the save as it is
      const file = exportSlot(n)
      if (what === 'not JSON' || what === 'cut short') expect(file).toMatchObject({ text: t, name: expect.stringMatching(/\.txt$/) })
      else expect(JSON.parse(file.text).save).toEqual(JSON.parse(t))
      // played again later: still kept
      switchSlot(1)
      switchSlot(n as 2 | 3)
      saveFarm()
      expect(stored(n)).toBe(t)
      // told once a visit, as the game is played (each place once: the first case tells it for its place)
      const told = [saveWords(), saveWords()]
      if (what === 'not JSON') expect(told[0]).toBe(`Farm ${n} could not be read: it is kept as it was`)
      expect(told[1]).toBeNull()
    })

  it('started afresh, or loaded from a file, by the player: it goes, and the farm is saved again', () => {
    startFrom('{"coins": 12')
    const n = currentSlot()
    deleteSlot(n)
    expect(saveState().held).toBe(false)
    expect(stored(n, ':broken')).toBeNull()
    expect(JSON.parse(stored(n)!).coins).toBe(START_COINS)
    startFrom('[1, 2')
    const m = currentSlot()
    const file = JSON.stringify({ kind: '3d-home-farm-save', version: 1, slot: m, save: savedWith(4321) })
    expect(importSlot(m, file)).toEqual({ ok: true })
    expect(saveState().held).toBe(false)
    expect(stored(m, ':broken')).toBeNull()
    expect(farm.coins).toBe(4321)
    expect(savedNow().coins).toBe(4321)
  })
})

describe('the copy kept as a visit began', () => {
  it('loads a farm that could not be read again as it was then', () => {
    startFrom(savedWith(4321))
    const n = currentSlot()
    expect(saveState().held).toBe(false)
    expect(JSON.parse(stored(n, ':prev')!).coins).toBe(4321)
    // played on and saved: the copy stays as the visit began
    farm.coins = 50
    saveFarm()
    expect(JSON.parse(stored(n)!).coins).toBe(50)
    expect(JSON.parse(stored(n, ':prev')!).coins).toBe(4321)
    // the save is broken (a write cut short) while another farm is played: the copy is offered, with when it was saved
    switchSlot(1)
    localStorage.setItem(keyOf(n), stored(n)!.slice(0, 500))
    expect(slotSummary(n)).toMatchObject({ broken: true, copy: { savedAt: NOW } })
    switchSlot(n as 2 | 3)
    expect(saveState().held).toBe(true)
    expect(restoreCopy(n)).toEqual({ ok: true })
    expect(farm.coins).toBe(4321)
    expect(saveState().held).toBe(false)
    expect(stored(n, ':broken')).toBeNull()
    expect(savedNow().coins).toBe(4321)
  })

  it('is never one that cannot be read, nor there for a place with none', () => {
    expect(restoreCopy(3)).toEqual({ ok: false, error: 'There is no copy of this farm to load.' })
    localStorage.setItem(keyOf(3), '{')
    localStorage.setItem(keyOf(3) + ':prev', '{"coins"')
    expect(slotSummary(3)).toMatchObject({ broken: true, copy: null })
    expect(restoreCopy(3).ok).toBe(false)
    expect(stored(3)).toBe('{')
  })
})

describe('a storage that is full', () => {
  it('is told once, the farm plays on, and freeing up space saves it again', () => {
    startFrom(savedWith(800))
    const n = currentSlot()
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    farm.coins = 801
    saveFarm()
    farm.coins = 802
    saveFarm()
    expect(saveState().full).toBe(true)
    expect(saveWords()).toBe('The storage is full: the farm is not being saved')
    expect(saveWords()).toBeNull()
    expect(JSON.parse(stored(n)!).coins).toBe(800)
    // the space comes back (the copies kept beside the farms go): saved again, and told no more
    set.mockRestore()
    expect(stored(n, ':prev')).not.toBeNull()
    expect(freeUpSpace()).toBe(true)
    expect(stored(n, ':prev')).toBeNull()
    expect(saveState().full).toBe(false)
    expect(JSON.parse(stored(n)!).coins).toBe(802)
    expect(saveWords()).toBeNull()
  })
})

describe('one farm, one tab', () => {
  const by = (who: string, n: number, t = NOW): Stamp => ({ by: who, n, t })

  it('the rule: a tab writes only over the stamp it last saw (or none), counted, never timed', () => {
    expect(mayWrite(null, null)).toBe(true)
    expect(mayWrite(null, by('me', 4))).toBe(true)
    expect(mayWrite(by('me', 4), by('me', 4))).toBe(true)
    expect(mayWrite(by('other', 5), by('me', 4))).toBe(false)
    // another tab's clock behind this one's: still newer by its count
    expect(mayWrite(by('other', 5, NOW - 3_600_000), by('me', 4))).toBe(false)
    expect(mayWrite(by('other', 4), by('me', 4))).toBe(false)
    expect(nextStamp(by('other', 9), 'me', NOW)).toEqual(by('me', 10))
    expect(nextStamp(null, 'me', NOW)).toEqual(by('me', 1))
    expect(sameStamp(by('a', 2, 1), by('a', 2, 9))).toBe(true)
    for (const text of [null, '', '{', '7', '{"by":3,"n":1}', '{"by":"x","n":-1}', '{"by":"x","n":1.5}']) expect(savedStamp(text), String(text)).toBeNull()
    expect(savedStamp('{"by":"x","n":3,"t":"later"}')).toEqual({ by: 'x', n: 3, t: 0 })
  })

  it('left behind by another tab, a tab stops saving; looked at again, it loads the newest farm and saves on', async () => {
    startFrom(savedWith(100))
    const n = currentSlot()
    farm.coins = 200
    saveFarm()
    const mine = stampOf(n)!
    expect(JSON.parse(stored(n)!).coins).toBe(200)
    // another tab saves the farm (its clock an hour behind this one's)
    localStorage.setItem(keyOf(n), JSON.stringify(savedWith(777)))
    localStorage.setItem(keyOf(n) + ':stamp', JSON.stringify(by('another tab', mine.n + 1, NOW - 3_600_000)))
    // this one, not looked at, does not write over it
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    window.dispatchEvent(Object.assign(new Event('storage'), { key: keyOf(n) + ':stamp' }))
    expect(saveState().behind).toBe(true)
    farm.coins = 300
    saveFarm()
    expect(JSON.parse(stored(n)!).coins).toBe(777)
    expect(stampOf(n)?.by).toBe('another tab')
    // looked at again: the newest farm, and this tab takes it (the other one now stops)
    lookAgain()
    await vi.waitFor(() => expect(farm.coins).toBe(777))
    expect(saveState().behind).toBe(false)
    expect(stampOf(n)).toMatchObject({ n: mine.n + 2 })
    expect(stampOf(n)?.by).not.toBe('another tab')
    farm.coins = 778
    saveFarm()
    expect(JSON.parse(stored(n)!).coins).toBe(778)
  })

  it('a tab that is looked at takes the farm: the other one, left behind, stops writing', () => {
    startFrom(savedWith(100))
    const n = currentSlot()
    // another tab had saved before this one was looked at again
    const before = stampOf(n)!
    lookAgain()
    expect(stampOf(n)!.n).toBe(before.n + 1)
    expect(sameStamp(stampOf(n), nextStamp(before, stampOf(n)!.by, NOW))).toBe(true)
    // a farm cleared by another tab is stamped too: this one does not bring it back
    localStorage.removeItem(keyOf(n))
    localStorage.setItem(keyOf(n) + ':stamp', JSON.stringify(by('another tab', stampOf(n)!.n + 1)))
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    saveFarm()
    expect(stored(n)).toBeNull()
  })
})
