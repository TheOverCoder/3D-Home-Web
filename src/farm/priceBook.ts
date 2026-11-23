// Every price of the game in one book, for whoever sets them (the admin dashboard to come; on a ?debug page,
// `window.__home.prices`). The prices stay in their own tables (src/farm/data.ts, decor.ts, layout.ts, skins.ts,
// carPaints.ts, machineView.ts, src/home/catalogue.ts), where the game's code reads them; the book is the one door to all
// of them: each price a row with a stable key ("decor:lamp", "goods:lettuce", "ladders:rate:step"), its group, its name
// and the price it starts at. `setPrice` changes one in its table (and in every table that copied it when the game
// began: a crop's sale price is the good's too, a field's price the upgrade's), `priceOverrides` gives what differs from
// where it started (JSON, to keep), `applyPrices` takes such a set back, `resetPrices` puts all back. A new table of
// prices is one more group here (src/farm/priceBook.test.ts fails until every price of the tables it knows is in it).
import { BOUGHT_MACHINES, CROPS, ESTATE, EXPANSIONS, LADDERS, MACHINES, MANAGER, CONTRACTOR, OFFICE_UPGRADES, PRODUCE, UPGRADES, BEDS, type LadderId } from './data'
import { DECOR, FRUIT } from './decor'
import { PARCELS } from './layout'
import { SKINS } from './skins'
import { CAR_PAINTS } from './carPaints'
import { QUEUE_PRICES } from './machineView'
import { PIECES } from '../home/catalogue'

/** One price: where it is, what it is called, what it is now and what it started at. */
export interface PriceRow {
  /** stable: the dashboard keeps it, the overrides are keyed by it */
  key: string
  /** what it is in: goods, seeds, decor… (the dashboard's tabs) */
  group: string
  name: string
  /** what it is now */
  get: () => number
  /** what it started at (the game's own) */
  base: number
}

interface Entry {
  key: string
  group: string
  name: string
  get: () => number
  set: (v: number) => void
}

/** A field of a row as a price of the book. */
const field = <T extends object>(group: string, id: string, name: string, row: T, key: keyof T, more: (v: number) => void = () => {}): Entry => ({
  key: `${group}:${id}`,
  group,
  name,
  get: () => row[key] as number,
  set: (v) => {
    ;(row as Record<keyof T, unknown>)[key] = v
    more(v)
  },
})

const titled = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Every price, as the tables have them. */
function entries(): Entry[] {
  const out: Entry[] = []
  // what the farm sells, and the seeds it buys (a crop's price is copied into its good's row: both move together)
  for (const p of PRODUCE)
    out.push(
      field('goods', p.id, titled(p.name), p, 'price', (v) => {
        const crop = CROPS.find((c) => c.id === p.id)
        if (crop) crop.price = v
      }),
    )
  for (const c of CROPS) out.push(field('seeds', c.id, `${titled(c.name)} seeds`, c, 'seedCost'))
  // the upgrades of the farm shop: a field's price is the field's (EXPANSIONS) and its upgrade's alike
  for (const u of UPGRADES) {
    const exp = (EXPANSIONS as Record<string, { price: number }>)[u.id]
    out.push(field('upgrades', u.id, u.name, u, 'price', (v) => exp && (exp.price = v)))
    if (u.priceStep !== undefined) out.push({ ...field('upgrades', u.id, `${u.name}: each step more`, u, 'priceStep'), key: `upgrades:${u.id}:step` })
  }
  for (const [id, o] of Object.entries(OFFICE_UPGRADES)) {
    out.push(field('office', id, o.name, o, 'price'))
    out.push({ ...field('office', id, `${o.name}: each step more`, o, 'priceStep'), key: `office:${id}:step` })
  }
  // the upgrades bought a step at a time: the first step's price and how much more each next one costs
  for (const [id, l] of Object.entries(LADDERS) as [LadderId, (typeof LADDERS)[LadderId]][]) {
    const price = l.price as unknown as number[]
    out.push({ key: `ladders:${id}`, group: 'ladders', name: l.name, get: () => price[0], set: (v) => (price[0] = v) })
    out.push({ key: `ladders:${id}:step`, group: 'ladders', name: `${l.name}: each step more`, get: () => price[1], set: (v) => (price[1] = v) })
  }
  // the machines bought in the edit mode's shop (the loom is every farm's: no price)
  for (const id of BOUGHT_MACHINES) out.push(field('machines', id, MACHINES[id].name, MACHINES[id] as { price: number }, 'price'))
  // a machine's places in its queue, by the place
  for (const k of Object.keys(QUEUE_PRICES)) {
    const n = Number(k)
    out.push({ key: `queue:${n}`, group: 'queue', name: `A machine's place ${n}`, get: () => QUEUE_PRICES[n], set: (v) => (QUEUE_PRICES[n] = v) })
  }
  // the beds built one at a time
  BEDS.forEach((b, i) => {
    if (b.price !== undefined) out.push(field('beds', String(i), `Bed ${i + 1}`, b, 'price'))
  })
  // the edit mode's shop (each next one dearer: decor.ts, nextPrice, from this first price), the land, the tools' looks
  for (const [id, d] of Object.entries({ ...DECOR, ...FRUIT })) if (!d.given) out.push(field('decor', id, d.name, d, 'price'))
  for (const [id, p] of Object.entries(PARCELS)) out.push(field('land', id, p.name, p, 'price'))
  for (const [tool, looks] of Object.entries(SKINS)) for (const [style, s] of Object.entries(looks)) if (s.price > 0) out.push(field('skins', `${tool}:${style}`, s.name, s, 'price'))
  // the house: its furniture, the house itself, your car's paints
  for (const [id, p] of Object.entries(PIECES)) out.push(field('furniture', id, p.name, p, 'price'))
  out.push(field('house', 'estate', 'The house', ESTATE as { price: number }, 'price'))
  for (const [id, p] of Object.entries(CAR_PAINTS)) if (p.price > 0) out.push(field('paints', id, `${p.name} paint`, p as { price: number }, 'price'))
  // the people who buy and sell: the manager's shop, the contractor's pieces
  out.push(field('manager', 'shop', "The manager's shop", MANAGER as { shopPrice: number }, 'shopPrice'))
  out.push(field('contractor', 'buys', 'The contractor pays a piece', CONTRACTOR as { buys: number }, 'buys'))
  out.push(field('contractor', 'sells', 'The contractor sells a piece', CONTRACTOR as { sells: number }, 'sells'))
  return out
}

let book: (Entry & { base: number })[] | null = null
/** The book, read from the tables the first time (each price's start kept). */
function theBook() {
  if (!book) book = entries().map((e) => ({ ...e, base: e.get() }))
  return book
}

/** Every price, in the book's order (by group, as the tables have them). */
export const allPrices = (): PriceRow[] => theBook().map(({ key, group, name, get, base }) => ({ key, group, name, get, base }))

/** Sets one price (a whole number of coins, none below 0): whether there is such a price. */
export function setPrice(key: string, value: number): boolean {
  const e = theBook().find((r) => r.key === key)
  if (!e || !Number.isFinite(value)) return false
  e.set(Math.max(0, Math.round(value)))
  return true
}

/** What differs from where the prices started: key → price. */
export const priceOverrides = (): Record<string, number> =>
  Object.fromEntries(
    theBook()
      .filter((e) => e.get() !== e.base)
      .map((e) => [e.key, e.get()]),
  )

/** A set of prices (from `priceOverrides`, a file, the dashboard) put in: how many were set (an unknown key or a price
 *  that is not a number is passed over). */
export function applyPrices(prices: Record<string, unknown>): number {
  let n = 0
  for (const [key, v] of Object.entries(prices)) if (typeof v === 'number' && setPrice(key, v)) n++
  return n
}

/** Every price back to where it started. */
export function resetPrices() {
  for (const e of theBook()) e.set(e.base)
}
