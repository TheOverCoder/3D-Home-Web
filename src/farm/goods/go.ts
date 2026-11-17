import type { Panel } from '../../store'
import { MACHINES, MACHINE_IDS, PRODUCERS, TOOL_KINDS, type MachineId, type ProduceId, type ToolKind } from '../data'

// "Where is it made" (plans/animal-tools.md): under a good's name and source (./sources.ts), one button — or none.
// One pure function picks it, from what the farm owns and where you are; the bubble that shows it is the interface's.

/** What the button under a good's words does: open a panel from afar (a premium remote: the machine that makes it, or
 *  the tool of the animals that give it), walk you to where it is made ("Show me", the compass's walk), or nothing
 *  (the words alone). */
export type Go = { kind: 'open'; panel: Panel } | { kind: 'walk'; to: string } | { kind: 'none' }

export interface GoContext {
  /** the two premium remotes, owned or not */
  machineRemote: boolean
  animalRemote: boolean
  /** the animals' tools owned */
  tools: readonly ToolKind[]
  /** the map you are on: a walk only on the farm (null: none yet) */
  map: 'farm' | 'home' | null
  /** where on this map to walk to for a good (an interactable's id; null: nowhere) */
  placeFor: (good: ProduceId) => string | null
  /** the panel the good was tapped in: what was opened from it goes back there */
  from?: Panel
}

/** The machine that makes a good (null: none does). */
export const machineOf = (good: ProduceId): MachineId | null => MACHINE_IDS.find((id) => MACHINES[id].recipes.some((r) => r.makes === good)) ?? null
/** The animals with a tool that give a good (null: none). */
export const animalsOf = (good: ProduceId): ToolKind | null => TOOL_KINDS.find((k) => PRODUCERS[k].good === good) ?? null

/**
 * The button under a good's words, the first that applies:
 * 1. the machines' remote owned and the good made at a machine: open that machine (on either map);
 * 2. the animals' remote owned and the good given by animals whose tool is owned: open that tool (only a tool owned);
 * 3. on the farm, with a place it is made: "Show me", the walk there;
 * 4. else nothing: the words alone.
 */
export function goFor(good: ProduceId, ctx: GoContext): Go {
  const back = ctx.from ? { from: ctx.from } : {}
  const machine = machineOf(good)
  if (ctx.machineRemote && machine) return { kind: 'open', panel: { kind: 'machine', id: machine, ...back } }
  const kind = animalsOf(good)
  if (ctx.animalRemote && kind && ctx.tools.includes(kind)) return { kind: 'open', panel: { kind: 'tool', tool: kind, ...back } }
  const to = ctx.map === 'farm' ? ctx.placeFor(good) : null
  return to ? { kind: 'walk', to } : { kind: 'none' }
}
