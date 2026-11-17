import type { ArtId } from '../../ui/art'
import { BEDS, LADDERS, PACE_LEVELS, QUEUE_LEVELS, TOOLS, TOOL_KINDS, UPGRADES, arrivalEvery, mostAnimals, queuePlaces, toolLadder, type LadderId, type ToolKind, type UpgradeId } from '../data'
import { ladderPrice } from '../market'
import { animals, arrivalSeconds, clockText, farm, ladderMaxed, ladderOpen, lockOf, owned, placesInLine, upgradeLevel, upgradePrice } from '../state'
import { openFirst, UPGRADE_ART } from '../unlockArt'

// What the farm shop shows (./ShopCard.tsx draws it; ./ShopPanel.tsx feeds it the farm's; the design lab's
// shop-animals board, C): a card for each animal — its herd (another animal, at its price, until it is full), and its
// tool, locked until the herd is full ("4/6 hens"), then for sale, then yours (it opens the tool's panel, where its two
// upgrades are) —; the farm's own upgrades, as rows; and the two premium remotes, as tiles.

/** What one of the farm's upgrades changes, as its row's chip shows it: a picture or glyph, now → after its next step. */
export interface FarmRow {
  id: UpgradeId
  pic: ArtId
  name: string
  blurb: string
  /** the level it opens at (null: open) */
  lock: number | null
  /** all of it bought */
  owned: boolean
  price: number
  /** steps bought, of how many (1 for a thing bought once) */
  level: number
  levels: number
  icon: ArtId | 'users' | 'clock'
  now: string
  next: string | null
}

export interface AnimalCard {
  kind: ToolKind
  /** "Hens" */
  title: string
  pic: ArtId
  herd: {
    upgrade: UpgradeId
    /** "Another hen" */
    name: string
    n: number
    most: number
    price: number
    /** the level another one opens at (null: open) */
    lock: number | null
  }
  tool: {
    id: LadderId
    name: string
    pic: ArtId
    state: 'locked' | 'sale' | 'owned'
    price: number
    /** what the herd still lacks: "4/6 hens" */
    why: string
    /** what it holds and takes at first: "3 a nest · 1 a tap" */
    says: string
  }
}

export interface RemoteTile {
  id: 'machine-remote' | 'animal-remote'
  name: string
  blurb: string
  pic: ArtId
  state: 'locked' | 'sale' | 'owned'
  price: number
}

export interface UpgradesView {
  coins: number
  animals: AnimalCard[]
  farm: FarmRow[]
  remotes: RemoteTile[]
}

const TITLE: Record<ToolKind, string> = { hens: 'Hens', cows: 'Cows', sheep: 'Sheep' }
/** What a remote does, in a few words for its tile (its card says it whole: LADDERS' blurb). */
const REMOTE_WORDS = { 'machine-remote': 'Opens a machine from its good', 'animal-remote': 'Opens a tool from its good' } as const
const bedsIn = (e: 'east' | 'west') => BEDS.filter((b) => b.expansion === e).length

/** A farm upgrade's row: which step is next and what it changes, "5 → 6" places in the line. */
function farmRow(id: UpgradeId): FarmRow {
  const u = UPGRADES.find((x) => x.id === id)!
  const base = { id, pic: UPGRADE_ART[id], name: u.name, blurb: u.blurb, lock: lockOf(`upgrade:${id}`), owned: owned(id), price: upgradePrice(id) }
  switch (id) {
    case 'queue': {
      const l = upgradeLevel('queue')
      return { ...base, level: l, levels: QUEUE_LEVELS, icon: 'users', now: String(placesInLine()), next: l < QUEUE_LEVELS ? String(queuePlaces(l + 1)) : null }
    }
    case 'pace': {
      const l = upgradeLevel('pace')
      return { ...base, level: l, levels: PACE_LEVELS, icon: 'clock', now: clockText(arrivalSeconds()), next: l < PACE_LEVELS ? clockText(arrivalEvery(l + 1)) : null }
    }
    case 'east':
    case 'west':
      return { ...base, level: base.owned ? 1 : 0, levels: 1, icon: 'seedling', now: `+${bedsIn(id)} beds`, next: null }
    case 'sprinkler':
      return { ...base, level: base.owned ? 1 : 0, levels: 1, icon: 'droplet', now: 'Waters every bed', next: null }
    default:
      return { ...base, level: base.owned ? 1 : 0, levels: 1, icon: 'basket', now: '×1.5 every harvest', next: null }
  }
}

/** A ladder bought once (a tool, a remote): locked (what it waits for is not there), for sale, or yours. */
const onceState = (id: LadderId): 'locked' | 'sale' | 'owned' => (ladderMaxed(id) ? 'owned' : ladderOpen(id) ? 'sale' : 'locked')

/** The shop as the farm has it now. */
export function upgradesView(): UpgradesView {
  return {
    coins: farm.coins,
    animals: TOOL_KINDS.map((kind): AnimalCard => {
      const u = UPGRADES.find((x) => x.herd === kind)!
      const n = animals(kind)
      const most = mostAnimals(kind)
      const id = toolLadder(kind, 'tool')
      const t = TOOLS[kind]
      return {
        kind,
        title: TITLE[kind],
        pic: UPGRADE_ART[u.id],
        herd: { upgrade: u.id, name: u.name, n, most, price: upgradePrice(u.id), lock: lockOf(`upgrade:${u.id}`) },
        tool: {
          id,
          name: t.name,
          pic: t.art,
          state: onceState(id),
          price: ladderPrice(id, 0),
          why: `${n}/${most} ${TITLE[kind].toLowerCase()}`,
          says: `${LADDERS[toolLadder(kind, 'hold')].say(0)} · ${LADDERS[toolLadder(kind, 'tap')].say(0)}`,
        },
      }
    }),
    farm: openFirst(
      UPGRADES.filter((u) => !u.herd),
      (u) => lockOf(`upgrade:${u.id}`),
    ).map((u) => farmRow(u.id)),
    remotes: (['machine-remote', 'animal-remote'] as const).map((id): RemoteTile => ({
      id,
      name: LADDERS[id].name,
      blurb: REMOTE_WORDS[id],
      pic: id === 'machine-remote' ? 'gear' : 'nest-with-eggs',
      state: onceState(id),
      price: ladderPrice(id, 0),
    })),
  }
}
