import { LADDERS, PRODUCERS, TOOL, fullHerd, isToolKind, toolLadder, type Ladder, type LadderId, type ProducerId, type ToolKind } from './data'

// The animals' tools (plans/animal-tools.md; TOOL, TOOLS and their LADDERS in ./data): the rules that need nothing but
// the numbers they are given. The farm keeps what is owned in `farm.ladders` (no other field) and runs the rest
// (src/farm/state.ts).

/** Each ladder's step (one left out: none bought). */
export type Steps = Partial<Record<LadderId, number>>

/** What the rules read of a farm: how many animals each herd has, and each ladder's step. */
export interface ToolFarm {
  producers: Record<ProducerId, { animals: number }>
  ladders: Steps
}

/** A ladder is at its top. */
const atTop = (ladders: Steps, id: LadderId) => (ladders[id] ?? 0) >= LADDERS[id].levels

/** What a ladder waits for is there: its herd full (every animal the shop sells), the ladder it needs at its top, and
 *  one of `anyOf` at its top. Nothing to wait for: always. */
export function needsMet(needs: Ladder['needs'], f: ToolFarm): boolean {
  if (!needs) return true
  if (needs.herd && f.producers[needs.herd].animals < fullHerd(needs.herd)) return false
  if (needs.ladder && !atTop(f.ladders, needs.ladder)) return false
  if (needs.anyOf && !needs.anyOf.some((id) => atTop(f.ladders, id))) return false
  return true
}

/** The producer's tool, when it has one the shop sells and it is yours (else null). */
export const toolOf = (id: ProducerId, ladders: Steps): ToolKind | null => (isToolKind(id) && atTop(ladders, toolLadder(id, 'tool')) ? id : null)

/** The most that waits at each of a producer's places (a nest, a cow, a sheep) before no more come: with its tool, the
 *  tool's (3, and one more for each step of its "holds" ladder); without, the producer's own. */
export function mostAt(id: ProducerId, ladders: Steps): number {
  const kind = toolOf(id, ladders)
  return kind ? TOOL.hold.from + (ladders[toolLadder(kind, 'hold')] ?? 0) : PRODUCERS[id].max
}

/** How many one tap of a tool takes: 1, and one more for each step of its "a tap" ladder. */
export const perTapOf = (kind: ToolKind, ladders: Steps) => TOOL.tap.from + (ladders[toolLadder(kind, 'tap')] ?? 0)

/** Each animal of a herd gives her own (a count and a clock for each): every herd's but a shared nest's (the hens'),
 *  and theirs too once their tool (the coop) gives each hen a nest. */
export function ownsEach(id: ProducerId, ladders: Steps): boolean {
  const herd = PRODUCERS[id].herd
  return !!herd && (!herd.shared || toolOf(id, ladders) !== null)
}

/**
 * A shared nest split into a nest for each hen, as the coop comes: every egg kept, dealt round the nests in turn; and
 * hen i's clock set so that her next egg comes when the shared nest's i-th next one would have. The shared clock `t`
 * runs `hens` times as fast, an egg each `every`: its k-th next egg comes in (every − t + k·every) / hens seconds. Hen i
 * lays every `every` seconds on her own, so her clock starts at every − (every − t + i·every) / hens, and the eggs come
 * at the same moments as before, one hen after another.
 */
export function spreadNest(eggs: number, t: number, hens: number, every: number): { stock: number[]; timer: number[] } {
  const n = Math.max(1, Math.floor(hens))
  return {
    stock: Array.from({ length: n }, (_, i) => Math.floor(eggs / n) + (i < eggs % n ? 1 : 0)),
    // (never under 0 by a rounding: the last hen's is t / n)
    timer: Array.from({ length: n }, (_, i) => Math.max(0, every - (every - t + i * every) / n)),
  }
}

/** The place a tap with none chosen takes from: the fullest (ties: the first). */
export function fullest(stock: readonly number[]): number {
  let best = 0
  stock.forEach((n, i) => {
    if (n > stock[best]) best = i
  })
  return best
}
