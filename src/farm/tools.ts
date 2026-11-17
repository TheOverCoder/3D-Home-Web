import { LADDERS, mostAnimals, type Ladder, type LadderId, type ProducerId } from './data'

// The animals' tools (plans/animal-tools.md; TOOL, TOOLS and their LADDERS in ./data): the rules that need nothing but
// the numbers they are given. The farm keeps what is owned in `farm.ladders` and runs the rest (src/farm/state.ts).

/** What the rules read of a farm: how many animals each herd has, and each ladder's step. */
export interface ToolFarm {
  producers: Record<ProducerId, { animals: number }>
  ladders: Record<LadderId, number>
}

/** A ladder is at its top. */
const atTop = (f: ToolFarm, id: LadderId) => f.ladders[id] >= LADDERS[id].levels

/** What a ladder waits for is there: its herd full (every animal the shop sells), the ladder it needs at its top, and
 *  one of `anyOf` at its top. Nothing to wait for: always. */
export function needsMet(needs: Ladder['needs'], f: ToolFarm): boolean {
  if (!needs) return true
  if (needs.herd && f.producers[needs.herd].animals < mostAnimals(needs.herd)) return false
  if (needs.ladder && !atTop(f, needs.ladder)) return false
  if (needs.anyOf && !needs.anyOf.some((id) => atTop(f, id))) return false
  return true
}
