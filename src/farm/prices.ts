import { MACHINES, MACHINE_IDS, produceById, type MachineId, type ProduceId } from './data'

// What a good sells for, decided here for every sale — a buyer's offer at the gate, an order's pay, what the manager
// pays, a unit on your shop's shelves: its fair price (PRODUCE in ./data), more for what a machine makes once it has
// worked its way up a level (its level's coins boost, src/farm/machineView.ts: a cake from a level-2 oven is worth a
// fifth more), and double on the lucky draw's day for the two goods drawn (src/farm/events.ts). Each sale rounds its own
// total, as it always has.

/** The machine that makes each good (the oven the cakes, the mill flour and sugar, the loom cloth). */
const MAKER = new Map<ProduceId, MachineId>(MACHINE_IDS.flatMap((id) => MACHINES[id].recipes.map((r) => [r.makes, id] as const)))

/** The machine that makes a good (null: it is grown, or given by an animal or the tree). */
export const makerOf = (good: ProduceId): MachineId | null => MAKER.get(good) ?? null

let boost: (machine: MachineId) => number = () => 0

/** The farm says how much more each machine's goods are worth now (src/farm/state.ts, from each one's level). Until it
 *  does (and in tests of the rules alone), nothing more. */
export function priceBoosts(f: (machine: MachineId) => number) {
  boost = f
}

let event: (good: ProduceId) => number = () => 1

/** The farm says what the week's events multiply each good's price by now (src/farm/state.ts: the lucky draw's goods,
 *  double on its day). Until it does, nothing. */
export function priceEvents(f: (good: ProduceId) => number) {
  event = f
}

/** What one of a good is worth: its fair price, a share more for what a machine of a higher level makes, and the
 *  events' factor (the lucky draw's). */
export function priceOf(good: ProduceId): number {
  const base = produceById(good).price
  const maker = MAKER.get(good)
  const more = maker ? boost(maker) : 0
  const price = more > 0 ? base * (1 + more) : base
  const k = event(good)
  return k !== 1 ? price * k : price
}
