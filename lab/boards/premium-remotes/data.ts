import { MACHINES, PRODUCERS, type MachineId, type ProduceId } from '../../../src/farm/data'
import { REMOTE_PRICE, REMOTES, TOOLS, type RemoteId, type ToolKind } from '../animal-tools/sample'

// What the premium-remotes board shows: the "where is it made" bubble on a good's picture in a panel (the order
// board's chosen bubble, plans/animal-tools.md §3 GoodPic) with the button the plan's goFor() picks — open the machine
// (the machines' remote), open the tool (the animals' remote, a tool owned), "Show me" (on the farm), or the words
// alone — and the two remotes in the shop. Where a good comes from is the game's own (sourceOf); goFor and the
// remotes are SAMPLE (the plan's §2, src/farm/goods/go.ts) until the game has them.

export type Scene = 'shop' | 'barn' | 'line' | 'oven' | 'afar-mill' | 'afar-coop'

export interface RemoteState {
  scene: Scene
  remotes: Record<RemoteId, boolean>
  tools: Record<ToolKind, boolean>
  map: 'farm' | 'home'
  coins: number
  /** the good whose bubble is open as the scene comes in */
  open?: ProduceId
  /** a panel opened from afar goes back here */
  from?: 'barn' | 'line' | 'oven'
}

export { REMOTE_PRICE, REMOTES, TOOLS }
export type { RemoteId, ToolKind }

/** What the button under a bubble's words does (the plan's goFor): open a machine, open a tool, walk, or nothing. */
export type Go = { kind: 'machine'; id: MachineId } | { kind: 'tool'; tool: ToolKind } | { kind: 'show' } | { kind: 'none' }

const ANIMALS: ToolKind[] = ['hens', 'cows', 'sheep']

/** SAMPLE (the plan's goFor, src/farm/goods/go.ts): which button a good's bubble gets. */
export function goFor(good: ProduceId, s: Pick<RemoteState, 'remotes' | 'tools' | 'map'>): Go {
  const machine = (Object.keys(MACHINES) as MachineId[]).find((id) => MACHINES[id].recipes.some((r) => r.makes === good))
  if (machine && s.remotes['machine-remote']) return { kind: 'machine', id: machine }
  const animal = ANIMALS.find((k) => PRODUCERS[k].good === good)
  if (animal && s.remotes['animal-remote'] && s.tools[animal]) return { kind: 'tool', tool: animal }
  return s.map === 'farm' ? { kind: 'show' } : { kind: 'none' }
}

/** The words on an "open" button: "Open the mill", "Open the coop". */
export const openWords = (g: Go) => (g.kind === 'machine' ? `Open the ${MACHINES[g.id].name.toLowerCase()}` : g.kind === 'tool' ? `Open the ${TOOLS[g.tool].name.toLowerCase()}` : '')

/** What the barn holds in the board (its goods, as the barn's panel lists them). */
export const BARN: [ProduceId, number][] = [
  ['egg', 12],
  ['milk', 5],
  ['wool', 3],
  ['flour', 6],
  ['sugar', 4],
  ['cloth', 2],
  ['plank', 3],
]

const coop = { hens: true, cows: false, sheep: false }
const off = { 'machine-remote': false, 'animal-remote': false }
const machineOnly = { 'machine-remote': true, 'animal-remote': false }

export const STATES: { id: string; name: string; data: RemoteState }[] = [
  { id: 'one', name: 'שלט המכונות: הקמח – Open the mill (הביצים עוד Show me)', data: { scene: 'barn', remotes: machineOnly, tools: coop, map: 'farm', coins: 2400, open: 'flour' } },
  { id: 'afar', name: 'המטחנה נפתחה מרחוק (מהאסם), ודרך חזרה', data: { scene: 'afar-mill', remotes: machineOnly, tools: coop, map: 'farm', coins: 2400, from: 'barn' } },
  { id: 'shop', name: 'בחנות: שני השלטים למכירה (10,000) והכרטיס שלהם', data: { scene: 'shop', remotes: off, tools: coop, map: 'farm', coins: 12400 } },
]
