import { BEDS, PACE_LEVELS, PRODUCERS, QUEUE_LEVELS, UPGRADES, arrivalEvery, queuePlaces, type UpgradeId } from '../../../src/farm/data'
import { lockedAt } from '../../../src/farm/unlocks'
import { art, type ArtId } from '../../../src/ui/art'
import { HERD_UPGRADE, HOLD_STEPS, REMOTE_PRICE, REMOTES, TAP_STEPS, TOOL, TOOL_KINDS, TOOLS, holdSay, stepPrice, tapSay, type RemoteId, type ToolKind } from '../animal-tools/sample'

// What the shop-animals board shows: the farm shop (src/farm/FarmUI.tsx ShopPanel today: UPGRADES, each a row with
// its picture, level, now → next and price) with the plan's animal section (plans/animal-tools.md §3: per kind its
// herd row, its tool — locked until the herd is full — and its two ladders; then the two premium remotes). The farm's
// rows are the game's own (UPGRADES, their prices and steps, UNLOCKS' levels); the tools, their ladders and the
// remotes are SAMPLE DATA (../animal-tools/sample.ts) until the game has them.

export interface ShopState {
  level: number
  coins: number
  /** animals of each herd now */
  herds: Record<ToolKind, number>
  tools: Record<ToolKind, boolean>
  hold: Record<ToolKind, number>
  tap: Record<ToolKind, number>
  remotes: Record<RemoteId, boolean>
  /** today's farm rows: the fields, sprinklers and compost bought; the line's two ladders' steps */
  farm: { east: boolean; west: boolean; sprinkler: boolean; compost: boolean; queue: number; pace: number }
}

export const ANIMAL_ART: Record<ToolKind, ArtId> = { hens: 'chicken', cows: 'cow', sheep: 'ewe' }
export const KIND_NAME: Record<ToolKind, string> = { hens: 'Hens', cows: 'Cows', sheep: 'Sheep' }
export { TOOL_KINDS, TOOLS, REMOTES, REMOTE_PRICE, HOLD_STEPS, TAP_STEPS }
export type { ToolKind, RemoteId }

/** Each upgrade's picture in the shop (FarmUI.tsx UPGRADE_ART). */
export const UPGRADE_ART: Record<UpgradeId, ArtId> = {
  east: 'seedling',
  west: 'sheaf-of-rice',
  north: 'ear-of-corn',
  queue: 'people-queue',
  pace: 'person-running',
  cow: 'cow',
  sheep: 'ewe',
  hen: 'chicken',
  sprinkler: 'droplet',
  compost: 'fallen-leaf',
}
export const upgradeArt = (id: UpgradeId) => art(UPGRADE_ART[id])

/** A row of the shop, whatever it sells: what the variants draw. `buy`: what a press does — buy at once (today's way,
 *  the herds and the farm's rows), open the ladder card (a tool, a step, a remote), or nothing (bought, locked). */
export interface Row {
  key: string
  pic: string
  name: string
  blurb: string
  /** "Level 2", or nothing for a thing bought once */
  level?: string
  now?: string
  next?: string | null
  price: number
  state: 'buy' | 'card' | 'owned' | 'locked'
  /** why it is locked, in a few words: "Level 6", "4/6 hens", "Needs the coop", "Needs a tool" */
  why?: string
  /** which kind of lock: a level (Part B's), or something to have first */
  lock?: 'level' | 'need'
  /** how far a ladder is: steps bought of its steps */
  steps?: [number, number]
  premium?: true
}

const herdUpgrade = (k: ToolKind) => UPGRADES.find((u) => u.herd === k)!
const cap = (t: string) => t[0].toUpperCase() + t.slice(1)

/** The herd's row (today's): another animal, at its price, until the herd is full; locked by its level. */
export function herdRow(s: ShopState, k: ToolKind): Row {
  const u = herdUpgrade(k)
  const n = s.herds[k]
  const most = PRODUCERS[k].herd!.max
  const lock = lockedAt(`upgrade:${HERD_UPGRADE[k]}`, s.level)
  const full = n >= most
  return {
    key: `herd-${k}`,
    pic: upgradeArt(u.id),
    name: u.name,
    blurb: u.blurb,
    now: String(n),
    next: full ? null : String(n + 1),
    price: u.price,
    state: full ? 'owned' : lock !== null ? 'locked' : 'buy',
    why: lock !== null ? `Level ${lock}` : undefined,
    lock: lock !== null ? 'level' : undefined,
    steps: [n, most],
  }
}

/** The tool's row: locked until the herd is full ("4/6 hens"), then for sale (its card), then yours. */
export function toolRow(s: ShopState, k: ToolKind): Row {
  const n = s.herds[k]
  const most = PRODUCERS[k].herd!.max
  const t = TOOLS[k]
  const words = k === 'hens' ? 'hens' : k === 'cows' ? 'cows' : 'sheep'
  return {
    key: `${k}-tool`,
    pic: t.pic,
    name: t.name,
    blurb: t.blurb,
    now: `${holdSay(k, 0)} · ${tapSay(0)}`,
    price: TOOL.price,
    state: s.tools[k] ? 'owned' : n < most ? 'locked' : 'card',
    why: n < most ? `${n}/${most} ${words}` : undefined,
    lock: n < most ? 'need' : undefined,
  }
}

/** The tool's two ladders: holds 3 → 10 a place, per tap 1 → 10; locked until the tool is bought. */
export function ladderRows(s: ShopState, k: ToolKind): Row[] {
  const owned = s.tools[k]
  const h = s.hold[k]
  const t = s.tap[k]
  return [
    {
      key: `${k}-hold`,
      pic: TOOLS[k].pic,
      name: 'Holds more',
      blurb: `More waits at each ${TOOLS[k].spot}.`,
      level: h < HOLD_STEPS ? `Level ${h + 1}` : undefined,
      now: holdSay(k, h),
      next: h < HOLD_STEPS ? holdSay(k, h + 1) : null,
      price: stepPrice(TOOL.hold.price, h),
      state: !owned ? 'locked' : h >= HOLD_STEPS ? 'owned' : 'card',
      why: owned ? undefined : `Needs the ${TOOLS[k].name.toLowerCase()}`,
      lock: owned ? undefined : 'need',
      steps: [h, HOLD_STEPS],
    },
    {
      key: `${k}-tap`,
      pic: TOOLS[k].pic,
      name: 'More a tap',
      blurb: 'Each tap takes more.',
      level: t < TAP_STEPS ? `Level ${t + 1}` : undefined,
      now: tapSay(t),
      next: t < TAP_STEPS ? tapSay(t + 1) : null,
      price: stepPrice(TOOL.tap.price, t),
      state: !owned ? 'locked' : t >= TAP_STEPS ? 'owned' : 'card',
      why: owned ? undefined : `Needs the ${TOOLS[k].name.toLowerCase()}`,
      lock: owned ? undefined : 'need',
      steps: [t, TAP_STEPS],
    },
  ]
}

/** The two remotes: 10,000 each; the animals' only once a tool is owned. */
export function remoteRows(s: ShopState): Row[] {
  const anyTool = TOOL_KINDS.some((k) => s.tools[k])
  return (['machine-remote', 'animal-remote'] as RemoteId[]).map((id) => ({
    key: id,
    pic: id === 'machine-remote' ? art('gear') : TOOLS.hens.pic,
    name: REMOTES[id].name,
    blurb: REMOTES[id].blurb,
    now: REMOTES[id].short,
    price: REMOTE_PRICE,
    state: s.remotes[id] ? 'owned' : id === 'animal-remote' && !anyTool ? 'locked' : 'card',
    why: id === 'animal-remote' && !anyTool ? 'Needs a tool' : undefined,
    lock: id === 'animal-remote' && !anyTool ? 'need' : undefined,
    premium: true,
  }))
}

const bedsIn = (e: 'east' | 'west') => BEDS.filter((b) => b.expansion === e).length
const clockText = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`)

/** Today's farm rows (not the herds): the fields, the line's two ladders, sprinklers, compost — as the shop says them. */
export function farmRows(s: ShopState): Row[] {
  const one = (id: UpgradeId, has: boolean, now: string): Row => {
    const u = UPGRADES.find((x) => x.id === id)!
    const lock = lockedAt(`upgrade:${id}`, s.level)
    return {
      key: id,
      pic: upgradeArt(id),
      name: u.name,
      blurb: u.blurb,
      now,
      price: u.price,
      state: has ? 'owned' : lock !== null ? 'locked' : 'buy',
      why: lock !== null ? `Level ${lock}` : undefined,
      lock: lock !== null ? 'level' : undefined,
    }
  }
  const step = (id: 'queue' | 'pace', k: number, levels: number, say: (k: number) => string): Row => {
    const u = UPGRADES.find((x) => x.id === id)!
    const lock = lockedAt(`upgrade:${id}`, s.level)
    return {
      key: id,
      pic: upgradeArt(id),
      name: u.name,
      blurb: u.blurb,
      level: k < levels ? `Level ${k + 1}` : undefined,
      now: say(k),
      next: k < levels ? say(k + 1) : null,
      price: u.price + (u.priceStep ?? 0) * k,
      state: k >= levels ? 'owned' : lock !== null ? 'locked' : 'buy',
      why: lock !== null ? `Level ${lock}` : undefined,
      lock: lock !== null ? 'level' : undefined,
      steps: [k, levels],
    }
  }
  return [
    one('east', s.farm.east, `+${bedsIn('east')} beds`),
    one('west', s.farm.west, `+${bedsIn('west')} beds`),
    step('queue', s.farm.queue, QUEUE_LEVELS, (k) => `${queuePlaces(k)} in line`),
    step('pace', s.farm.pace, PACE_LEVELS, (k) => `Every ${clockText(arrivalEvery(k))}`),
    one('sprinkler', s.farm.sprinkler, 'Waters every bed'),
    one('compost', s.farm.compost, '×1.5 every harvest'),
  ]
}

/** Bought last: what is the player's goes to the end of a list (the map's note on today's shop). */
export const ownedLast = (rows: Row[]) => [...rows.filter((r) => r.state !== 'owned'), ...rows.filter((r) => r.state === 'owned')]

/** What a press does to the board's state: a herd's animal, a farm row's step, a tool, a ladder's step, a remote. */
export function bought(s: ShopState, key: string, price: number): ShopState {
  if (s.coins < price) return s
  const coins = s.coins - price
  const [a, b] = key.split('-') as [string, string]
  if (a === 'herd') return { ...s, coins, herds: { ...s.herds, [b]: s.herds[b as ToolKind] + 1 } }
  if (key === 'machine-remote' || key === 'animal-remote') return { ...s, coins, remotes: { ...s.remotes, [key]: true } }
  if (b === 'tool') return { ...s, coins, tools: { ...s.tools, [a]: true } }
  if (b === 'hold') return { ...s, coins, hold: { ...s.hold, [a]: s.hold[a as ToolKind] + 1 } }
  if (b === 'tap') return { ...s, coins, tap: { ...s.tap, [a]: s.tap[a as ToolKind] + 1 } }
  if (key === 'queue' || key === 'pace') return { ...s, coins, farm: { ...s.farm, [key]: s.farm[key] + 1 } }
  return { ...s, coins, farm: { ...s.farm, [key]: true } }
}

const none = { hens: false, cows: false, sheep: false }
const zero = { hens: 0, cows: 0, sheep: 0 }
const MID = { east: true, west: false, sprinkler: true, compost: true, queue: 3, pace: 1 }

/** The board's states: a farm at a point of play. */
export const STATES: Record<'locked' | 'sale' | 'owned' | 'top' | 'new', ShopState> = {
  locked: { level: 7, coins: 620, herds: { hens: 4, cows: 2, sheep: 2 }, tools: none, hold: zero, tap: zero, remotes: { 'machine-remote': false, 'animal-remote': false }, farm: MID },
  sale: { level: 8, coins: 1450, herds: { hens: 6, cows: 3, sheep: 3 }, tools: none, hold: zero, tap: zero, remotes: { 'machine-remote': false, 'animal-remote': false }, farm: MID },
  owned: {
    level: 10,
    coins: 2300,
    herds: { hens: 6, cows: 3, sheep: 4 },
    tools: { hens: true, cows: true, sheep: false },
    hold: { hens: 2, cows: 0, sheep: 0 },
    tap: { hens: 1, cows: 0, sheep: 0 },
    remotes: { 'machine-remote': false, 'animal-remote': false },
    farm: { ...MID, west: true },
  },
  top: {
    level: 24,
    coins: 4800,
    herds: { hens: 6, cows: 3, sheep: 4 },
    tools: { hens: true, cows: true, sheep: true },
    hold: { hens: HOLD_STEPS, cows: HOLD_STEPS, sheep: HOLD_STEPS },
    tap: { hens: TAP_STEPS, cows: TAP_STEPS, sheep: TAP_STEPS },
    remotes: { 'machine-remote': true, 'animal-remote': true },
    farm: { east: true, west: true, sprinkler: true, compost: true, queue: QUEUE_LEVELS, pace: PACE_LEVELS },
  },
  new: {
    level: 1,
    coins: 20,
    herds: { hens: PRODUCERS.hens.herd!.start, cows: PRODUCERS.cows.herd!.start, sheep: PRODUCERS.sheep.herd!.start },
    tools: none,
    hold: zero,
    tap: zero,
    remotes: { 'machine-remote': false, 'animal-remote': false },
    farm: { east: false, west: false, sprinkler: false, compost: false, queue: 0, pace: 0 },
  },
}

export { cap }
