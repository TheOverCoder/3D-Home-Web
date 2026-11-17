import { PRODUCERS, storeCapacity, type ProduceId, type StoreId } from '../../../src/farm/data'
import bucketPic from './art/bucket.webp'
import crownPic from './art/crown.webp'
import nestPic from './art/nest.webp'
import scissorsPic from './art/scissors.webp'

// SAMPLE DATA for the three boards of the animal-tools update (animal-tools, shop-animals, premium-remotes): what
// plans/animal-tools.md puts into the game (§1: TOOL, TOOLS and the ladders made from them; §3: ToolView), written here
// as the plan has it, over the game's own rows (PRODUCERS: each herd, its names, its good, how often). None of it is
// in the game yet: the main agent writes it there (src/farm/data.ts, src/farm/toolView.ts) once the user chooses.
// The pictures in ./art are Fluent Emoji 3D's (Microsoft, MIT), as src/ui/art.ts has the others: nest-with-eggs,
// bucket, scissors and crown are the plan's four new ones.

export { bucketPic, crownPic, nestPic, scissorsPic }

export type ToolKind = 'hens' | 'cows' | 'sheep'
export const TOOL_KINDS: ToolKind[] = ['hens', 'cows', 'sheep']

/** SAMPLE (the plan's TOOL): what every animal's tool shares. Step k of a ladder costs price[0] + price[1]·k. */
export const TOOL = {
  price: 400,
  hold: { from: 3, to: 10, price: [150, 75] },
  tap: { from: 1, to: 10, price: [100, 50] },
} as const

/** SAMPLE (the plan's TOOLS): what differs between the tools — only how each looks. `spot`: what each place is called
 *  ("3 a nest", "3 a cow"). */
export const TOOLS: Record<ToolKind, { name: string; blurb: string; pic: string; word: string; look: 'nests' | 'pail' | 'shears'; spot: string; animal: string }> = {
  hens: { name: 'Coop', blurb: 'A nest for every hen: take the eggs with a tap.', pic: nestPic, word: 'Collect', look: 'nests', spot: 'nest', animal: 'hen' },
  cows: { name: 'Milk bucket', blurb: 'Milk the whole herd from the gate.', pic: bucketPic, word: 'Milk', look: 'pail', spot: 'cow', animal: 'cow' },
  sheep: { name: 'Shears', blurb: 'Shear the whole flock into one basket.', pic: scissorsPic, word: 'Shear', look: 'shears', spot: 'sheep', animal: 'sheep' },
}

/** How many steps a ladder has (holds 3 → 10: seven; per tap 1 → 10: nine). */
export const HOLD_STEPS = TOOL.hold.to - TOOL.hold.from
export const TAP_STEPS = TOOL.tap.to - TOOL.tap.from
export const stepPrice = (price: readonly [number, number], k: number) => price[0] + price[1] * k
/** What a tool costs in all (the plan: 400 + 2,625 + 2,700 = 5,725 for each kind). */
export const toolTotal =
  TOOL.price +
  Array.from({ length: HOLD_STEPS }, (_, k) => stepPrice(TOOL.hold.price, k)).reduce((a, b) => a + b, 0) +
  Array.from({ length: TAP_STEPS }, (_, k) => stepPrice(TOOL.tap.price, k)).reduce((a, b) => a + b, 0)

/** SAMPLE (the plan's two premium remotes): 10,000 coins each; the animals' only once a tool is owned. */
export const REMOTE_PRICE = 10_000
export type RemoteId = 'machine-remote' | 'animal-remote'
export const REMOTES: Record<RemoteId, { name: string; blurb: string; short: string }> = {
  'machine-remote': { name: "Machines' remote", blurb: 'Open any machine from a good, wherever you are.', short: 'Opens a machine from its good' },
  'animal-remote': { name: "Animals' remote", blurb: 'Open your animal tools from their goods, wherever you are.', short: 'Opens a tool from its good' },
}

/** What the herd row of the farm shop says (UPGRADES' herds: another hen, cow or sheep). */
export const HERD_UPGRADE: Record<ToolKind, 'hen' | 'cow' | 'sheep'> = { hens: 'hen', cows: 'cow', sheep: 'sheep' }

// ── the tool's panel ──

/** SAMPLE (the plan's ToolView, src/farm/toolView.ts): what the tool's panel draws. `stored` and `capacity` are the
 *  board's own additions: the barn chip in the panel's head says how full the barn is (the plan's view gives `room`
 *  only). */
export interface ToolView {
  kind: ToolKind
  name: string
  good: ProduceId
  look: 'nests' | 'pail' | 'shears'
  /** each nest, cow or sheep: what waits, the most it holds, how far to the next one (0..1), its seconds to the next */
  spots: { name: string; has: number; most: number; next: number; seconds: number }[]
  perTap: number
  room: number
  store: StoreId
  stored: number
  capacity: number
  ladders: { id: string; part: 'hold' | 'tap'; name: string; now: string; next: string | null; price: number; k: number; steps: number }[]
}

/** The board's state: one tool's place as the farm would have it. */
export interface ToolState {
  kind: ToolKind
  /** what waits at each spot, and how far each is to its next one (0..1) */
  has: number[]
  next: number[]
  /** steps bought of the two ladders (holds: 0 = 3 a spot; per tap: 0 = 1 a tap) */
  hold: number
  tap: number
  /** goods in the barn, and its level */
  stored: number
  barn: number
  coins: number
}

const SPOT_NAMES: Record<ToolKind, (i: number) => string> = {
  hens: (i) => `Nest ${i + 1}`,
  cows: (i) => PRODUCERS.cows.herd!.names![i],
  sheep: (i) => PRODUCERS.sheep.herd!.names![i],
}

/** A herd full (the tool's need): how many places it has. */
export const placesOf = (kind: ToolKind) => PRODUCERS[kind].herd!.max
export const mostOf = (s: Pick<ToolState, 'hold'>) => TOOL.hold.from + s.hold
export const perTapOf = (s: Pick<ToolState, 'tap'>) => TOOL.tap.from + s.tap

export const holdSay = (kind: ToolKind, k: number) => `${TOOL.hold.from + k} a ${TOOLS[kind].spot}`
export const tapSay = (k: number) => `${TOOL.tap.from + k} a tap`

/** The tool's view, as the game's toolView() would make it from the farm. */
export function viewOf(s: ToolState): ToolView {
  const p = PRODUCERS[s.kind]
  const most = mostOf(s)
  const capacity = storeCapacity(s.barn)
  return {
    kind: s.kind,
    name: TOOLS[s.kind].name,
    good: p.good,
    look: TOOLS[s.kind].look,
    spots: s.has.map((has, i) => ({ name: SPOT_NAMES[s.kind](i), has, most, next: has >= most ? 1 : s.next[i], seconds: has >= most ? 0 : Math.ceil((1 - s.next[i]) * p.every) })),
    perTap: perTapOf(s),
    room: Math.max(0, capacity - s.stored),
    store: 'barn',
    stored: s.stored,
    capacity,
    ladders: [
      {
        id: `${s.kind}-hold`,
        part: 'hold',
        name: 'Holds more',
        now: holdSay(s.kind, s.hold),
        next: s.hold < HOLD_STEPS ? holdSay(s.kind, s.hold + 1) : null,
        price: stepPrice(TOOL.hold.price, s.hold),
        k: s.hold,
        steps: HOLD_STEPS,
      },
      {
        id: `${s.kind}-tap`,
        part: 'tap',
        name: 'More a tap',
        now: tapSay(s.tap),
        next: s.tap < TAP_STEPS ? tapSay(s.tap + 1) : null,
        price: stepPrice(TOOL.tap.price, s.tap),
        k: s.tap,
        steps: TAP_STEPS,
      },
    ],
  }
}

/** The fullest spot (ties: the first), or -1 when nothing waits: where a tap on the tool itself takes from. */
export function fullest(has: number[]): number {
  let best = -1
  has.forEach((n, i) => {
    if (n > 0 && (best < 0 || n > has[best])) best = i
  })
  return best
}

/** SAMPLE (the plan's toolTake): one tap takes the tool's per tap from the spot tapped (or the fullest), as much as the
 *  barn has room for. Gives the state after and how many were taken (0: nothing there, or no room). */
export function take(s: ToolState, spot?: number): [ToolState, number, number] {
  const i = spot ?? fullest(s.has)
  if (i < 0 || !s.has[i]) return [s, 0, i]
  const room = storeCapacity(s.barn) - s.stored
  const n = Math.min(perTapOf(s), s.has[i], Math.max(0, room))
  if (!n) return [s, 0, i]
  const has = s.has.map((h, k) => (k === i ? h - n : h))
  // an animal emptied starts her wait again (the hens lay on: their clock keeps running)
  const next = s.next.map((x, k) => (k === i && s.kind !== 'hens' && s.has[i] >= mostOf(s) ? 0 : x))
  return [{ ...s, has, next, stored: s.stored + n }, n, i]
}

/** SAMPLE: the farm goes on — each spot's clock runs (`every` seconds a good), up to the most it holds; a sheep full
 *  holds her clock. Used by the boards so a ring fills under the eye. */
export function grow(s: ToolState, dt: number): ToolState {
  const p = PRODUCERS[s.kind]
  const most = mostOf(s)
  let changed = false
  const has = [...s.has]
  const next = s.next.map((x, i) => {
    if (has[i] >= most) return x
    let k = x + dt / p.every
    while (k >= 1 && has[i] < most) {
      has[i] += 1
      k -= 1
    }
    changed = true
    return has[i] >= most ? 0 : k
  })
  return changed ? { ...s, has, next } : s
}

/** A ladder's step bought (the board's own: the game's is buyLadder). */
export function climb(s: ToolState, part: 'hold' | 'tap'): ToolState {
  const v = viewOf(s)
  const l = v.ladders.find((x) => x.part === part)!
  if (!l.next || s.coins < l.price) return s
  return part === 'hold' ? { ...s, hold: s.hold + 1, coins: s.coins - l.price } : { ...s, tap: s.tap + 1, coins: s.coins - l.price }
}

/** A tool's place at a point of the game: the herd full, the barn at a level with some in it. */
export function toolAt(kind: ToolKind, o: Partial<ToolState> & { has: number[] }): ToolState {
  return { kind, next: o.has.map((_, i) => [0.35, 0.8, 0.15, 0.6, 0.5, 0.9][i % 6]), hold: 0, tap: 0, stored: 64, barn: 3, coins: 1240, ...o }
}
