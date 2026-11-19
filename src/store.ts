import { create } from 'zustand'
import { DOOR, LAMPS, PICKUPS, type RoomId, type Vec3 } from './data/layout'
import type { ActionIcon } from './lib/interaction'
import type { LadderId, ToolKind } from './farm/data'
import type { SkinStyle } from './farm/skins'
import type { Place } from './farm/state'

/** Picture quality tier: high = full film look, medium = the look without the costliest passes, low = plain and fast. */
export type Quality = 'high' | 'medium' | 'low'

export interface ItemState {
  pos: Vec3
  rev: number // bumped on every drop so the physics body is re-created at the new spot
}

/** Something you can do right now: what you look at, or (touch, or looking at nothing) something within reach. */
export interface Nearby {
  id: string
  label: string
  icon?: ActionIcon
  reach?: boolean // offered for being within reach, not for being looked at: using it turns you towards it
  side?: 'ahead' | 'left' | 'right' | 'back' // where it is, seen from where you look (first person)
  hint?: string // a keyboard shortcut that goes with it (shown on a computer)
  needs?: { item: string; count: number }[] // a status's missing things, shown as pictures with how many
}

/** Why the 3D scene could not start: what to tell the player, and the technical detail for "Copy details". */
export interface Failure {
  kind: 'network' | 'graphics' | 'wasm' | 'other'
  message: string
  detail?: string
}

/** A small game panel over the scene (seed packets, a bed to build, what a bed always grows, the buyers, the farm
 *  shop, the silo or the barn and its next level, the order board and an office upgrade, the furniture shop and
 *  buying a piece). */
export type Panel =
  | { kind: 'seeds'; bed: number }
  | { kind: 'build'; bed: number }
  | { kind: 'bed'; bed: number }
  | { kind: 'queue' }
  | { kind: 'shop' }
  | { kind: 'store'; store: 'silo' | 'barn' } // what is inside, how full, and its next level
  | { kind: 'store-upgrade'; store: 'silo' | 'barn' } // the card that asks before the materials are used
  | { kind: 'orders' } // the order board on the office's computer
  | { kind: 'office-upgrade'; id: 'slots' | 'wait' } // the order board with the card that asks before an office upgrade is bought
  | { kind: 'furniture' } // the furniture shop (decorating)
  | { kind: 'buy-piece'; type: string } // buying one piece: what it is and its price, Cancel or Buy
  | { kind: 'decor-shop'; tab: 'decor' | 'fruit' } // the farm's edit mode's shop: decoration, or fruit trees and bushes
  | { kind: 'decor-buy'; item: string } // buying one of a kind for the farm: what it is and its next price, Cancel or Buy
  | { kind: 'away' } // welcome back: what happened on the farm while you were away
  | { kind: 'daily' } // the daily gift: today's to claim, and the week's streak (src/farm/DailyPanel.tsx)
  | { kind: 'goals' } // the goals board: what to reach next, and the rewards to claim
  | { kind: 'level' } // the level's card: the XP to the next level, what it brings, the coins to claim
  | { kind: 'wardrobe'; piece: string } // a wardrobe open: its garments, and you filmed while you choose (src/home)
  | { kind: 'manager' } // the market's manager: what he pays for your goods, his rate, buying the shop
  | { kind: 'market' } // your shop's computer: the places on the shelves, their prices, the shoppers
  | { kind: 'market-place'; place: number; from?: 'market' } // one place: its good, how many, its price (from: the panel to go back to)
  | { kind: 'market-buy' } // the card that asks before the shop is bought
  | { kind: 'contractor' } // the contractor: today's pieces, and what he pays for materials
  | { kind: 'car' } // the car: where it drives you (the house once it is yours, the farm)
  | { kind: 'estate' } // the estate agent: the house for sale, its price, or that it is yours
  | { kind: 'house-buy' } // the card that asks before the house is bought
  | { kind: 'ladder'; id: LadderId; from?: Panel } // the card that asks before a ladder's step is bought (from: the panel to go back to)
  | { kind: 'machine'; id: 'mill' | 'loom' | 'oven'; from?: Panel } // a machine: its queue of jobs, what it makes, its level and its places (from: opened from another panel, its ✕ goes back there)
  | { kind: 'tool'; tool: ToolKind; from?: Panel } // an animal's tool: each of its places and what waits there, taken a tap at a time (from: as a machine's)
  | { kind: 'skins'; tool: ToolKind; buy?: SkinStyle; from?: Panel } // a tool's skins shop (src/farm/SkinShop.tsx): its three skins, put on or bought (buy: the card that asks first; from: as a machine's)
  | { kind: 'machine-slot'; id: 'mill' | 'loom' | 'oven' } // the card that asks before a machine's next place is bought
  | { kind: 'news' } // the farm news: the week's events on now and coming, and the lucky draw (src/farm/news)
  | { kind: 'album' } // the farm album: its pages of tiles earned by deeds, a garment for each page done (src/farm/AlbumPanel.tsx)
  | { kind: 'computer'; piece: string; buy?: true } // the house's computer: its desktop and apps (src/farm/computer; buy: the card that asks before one is bought, from the desk's price tag)

/** Every kind of panel, as one that opens on a farm with plenty of everything (tests/e2e/39-panels opens each, upright
 *  and sideways, and measures what can be read and pressed). The type holds every kind of `Panel` once: a new panel
 *  is one line here, appended, and it is measured by being here. */
export const PANEL_KINDS: { readonly [K in Panel['kind']]: Extract<Panel, { kind: K }> } = {
  seeds: { kind: 'seeds', bed: 0 },
  build: { kind: 'build', bed: 4 },
  bed: { kind: 'bed', bed: 0 },
  queue: { kind: 'queue' },
  shop: { kind: 'shop' },
  store: { kind: 'store', store: 'silo' },
  'store-upgrade': { kind: 'store-upgrade', store: 'barn' },
  orders: { kind: 'orders' },
  'office-upgrade': { kind: 'office-upgrade', id: 'slots' },
  furniture: { kind: 'furniture' },
  'buy-piece': { kind: 'buy-piece', type: 'sofa' },
  'decor-shop': { kind: 'decor-shop', tab: 'decor' },
  'decor-buy': { kind: 'decor-buy', item: 'lamp' },
  away: { kind: 'away' },
  daily: { kind: 'daily' },
  goals: { kind: 'goals' },
  level: { kind: 'level' },
  wardrobe: { kind: 'wardrobe', piece: 'wardrobe' },
  manager: { kind: 'manager' },
  market: { kind: 'market' },
  'market-place': { kind: 'market-place', place: 0 },
  'market-buy': { kind: 'market-buy' },
  contractor: { kind: 'contractor' },
  car: { kind: 'car' },
  estate: { kind: 'estate' },
  'house-buy': { kind: 'house-buy' },
  ladder: { kind: 'ladder', id: 'rate' },
  machine: { kind: 'machine', id: 'mill' },
  tool: { kind: 'tool', tool: 'hens' },
  skins: { kind: 'skins', tool: 'hens' },
  'machine-slot': { kind: 'machine-slot', id: 'mill' },
  news: { kind: 'news' },
  album: { kind: 'album' },
  computer: { kind: 'computer', piece: 'computer' },
}

/** The thing you look at carries a tag (src/ui/ThingTag.tsx): a gear for what can be set about it, or a price tag for
 *  what it costs to build or buy; tapped (or G), it opens its card. */
export interface ThingTag {
  id: string
  kind: 'gear' | 'price'
  label: string
  price?: number
}

/** A machine about to take ingredients — the oven a cake's, the mill a load of wheat: a small card over the action
 *  button names them and asks first (a second press by mistake never uses them up). */
export interface Confirm {
  /** the action that asked (the card goes when it is no longer on offer: walked away, or the oven got busy) */
  id: string
  /** what comes out, and how many */
  item: string
  count: number
  title: string
  seconds: number
  /** what goes in */
  inputs: { item: string; count: number }[]
  /** the word on the button that goes ahead (Bake, Mill, Weave) */
  word: string
  go: () => void
}

/** A job for the compass at the top of the screen: what is ready to take out of reach (see findFar). */
export interface CompassMark {
  id: string
  item: string
  count: number
  /** a building that needs you (the barn full, goods waiting for room): drawn with a red ring */
  alert?: boolean
}

interface HomeState {
  phase: 'intro' | 'playing'
  ready: { scene: boolean; env: boolean; warm: boolean } // the world is built · its lighting is in · shaders and textures are on the GPU
  progress: number
  failure: Failure | null
  attempt: number // bumped to start the 3D scene again (after the graphics were lost, or in light mode)
  view: 'first' | 'third'
  settingsOpen: boolean
  hintShown: boolean
  room: RoomId | null
  outdoors: boolean // in the garden
  /** the map in the scene, the farm or the house (src/scene/Maps.tsx: it follows the save's `place`); null until the
   *  scene has started */
  map: Place | null
  /** the map is in the scene and you stand in it: false while it changes, behind the curtain */
  mapReady: boolean
  /** the screen gone dark: a drive, or the map changing as another farm loads (src/ui/Curtain.tsx) */
  curtain: boolean
  nearby: Nearby | null // the action E (or the big touch button) runs
  actions: Nearby[] // everything on offer, `nearby` first
  status: Nearby | null // nothing to do here: what is on its way (a growing bed, the oven baking) — shown, not pressed
  guide: { id: string; at: number } | null // a compass mark tapped: marked in the world until you get there
  compass: CompassMark[] // what is ready to take out of reach, nearest first (outdoors)
  tag: ThingTag | null // the thing looked at carries a gear (a bed) or a price tag (a plot to build, a field to buy)
  confirm: Confirm | null // a machine asking before it takes its ingredients
  screen: string | null
  panel: Panel | null
  editing: boolean // the farm's edit mode: the view from above, moving things, buying land
  decorating: boolean // the house's: the view over a room, moving, turning and putting away its furniture (src/home/)
  lamps: Record<string, boolean>
  doors: Record<string, boolean>
  items: Record<string, ItemState>
  carrying: string | null
  quality: Quality
  qualityAuto: boolean // true while the frame-rate monitor may move `quality` up or down
  toast: { text: string; id: number; item?: string } | null // a few words, with a picture of the thing (farm icon id)
  graphics: 'ok' | 'lost' | 'restored' | 'restarting' // the browser can reset the GPU context (driver crash, sleep, too many tabs)

  setPhase: (phase: HomeState['phase']) => void
  markReady: (key: 'scene' | 'env' | 'warm') => void
  setFailure: (failure: Failure | null) => void
  setView: (view: 'first' | 'third') => void
  setSettingsOpen: (open: boolean) => void
  markHintShown: () => void
  setRoom: (room: RoomId | null) => void
  setOutdoors: (outdoors: boolean) => void
  setActions: (actions: Nearby[], status?: Nearby | null) => void
  setGuide: (id: string | null) => void
  setCompass: (marks: CompassMark[]) => void
  setTag: (tag: ThingTag | null) => void
  setConfirm: (confirm: Confirm | null) => void
  openScreen: (id: string) => void
  closeScreen: () => void
  openPanel: (panel: Panel) => void
  closePanel: () => void
  setEditing: (on: boolean) => void
  setDecorating: (on: boolean) => void
  toggleLamp: (id: string) => void
  toggleDoor: (id: string) => void
  pickUp: (id: string) => void
  drop: (pos: Vec3) => void
  /** Puts a thing to pick up somewhere else (it goes with the furniture it stands on). */
  placeItem: (id: string, pos: Vec3) => void
  setQuality: (quality: Quality, auto?: boolean) => void // a pick without `auto` pins it
  showToast: (text: string, item?: string) => void
}

let toastId = 0

export const useHome = create<HomeState>()((set, get) => ({
  phase: 'intro',
  graphics: 'ok',
  ready: { scene: false, env: false, warm: false },
  progress: 0,
  failure: null,
  attempt: 0,
  view: 'first',
  settingsOpen: false,
  hintShown: false,
  room: null,
  outdoors: false,
  map: null,
  mapReady: false,
  curtain: false,
  nearby: null,
  actions: [],
  status: null,
  guide: null,
  compass: [],
  tag: null,
  confirm: null,
  screen: null,
  panel: null,
  editing: false,
  decorating: false,
  lamps: Object.fromEntries(LAMPS.map((l) => [l.id, true])),
  doors: { [DOOR.id]: false },
  items: Object.fromEntries(PICKUPS.map((p) => [p.id, { pos: p.position, rev: 0 }])),
  carrying: null,
  quality: 'high',
  qualityAuto: true,
  toast: null,

  setPhase: (phase) => set({ phase }),
  markReady: (key) => set((s) => (s.ready[key] ? s : { ready: { ...s.ready, [key]: true } })),
  setFailure: (failure) => set({ failure }),
  setView: (view) => set({ view }),
  setSettingsOpen: (settingsOpen) => set(settingsOpen ? { settingsOpen, nearby: null, actions: [], status: null, confirm: null } : { settingsOpen }),
  markHintShown: () => set({ hintShown: true }),
  setRoom: (room) => set({ room }),
  setOutdoors: (outdoors) => set({ outdoors }),
  setActions: (actions, status = null) => set({ actions, nearby: actions[0] ?? null, status }),
  setGuide: (id) => set({ guide: id ? { id, at: performance.now() } : null }),
  setCompass: (compass) => set({ compass }),
  setTag: (tag) => set({ tag }),
  setConfirm: (confirm) => set({ confirm }),
  openScreen: (screen) => set({ screen, nearby: null, actions: [], status: null, confirm: null, tag: null }),
  closeScreen: () => set({ screen: null }),
  openPanel: (panel) => set({ panel, nearby: null, actions: [], status: null, confirm: null, tag: null }),
  closePanel: () => set({ panel: null }),
  setEditing: (editing) => set(editing ? { editing, decorating: false, panel: null, nearby: null, actions: [], status: null, confirm: null, compass: [], tag: null } : { editing }),
  setDecorating: (decorating) => set(decorating ? { decorating, editing: false, panel: null, nearby: null, actions: [], status: null, confirm: null, compass: [], tag: null } : { decorating }),
  toggleLamp: (id) => set((s) => ({ lamps: { ...s.lamps, [id]: !s.lamps[id] } })),
  toggleDoor: (id) => set((s) => ({ doors: { ...s.doors, [id]: !s.doors[id] } })),
  // the item leaves the registry with its body: forget it as the aimed thing right away, so E drops it next
  pickUp: (id) => set({ carrying: id, nearby: null, actions: [], status: null, confirm: null }),
  drop: (pos) => {
    const id = get().carrying
    if (!id) return
    set((s) => ({
      carrying: null,
      items: { ...s.items, [id]: { pos, rev: s.items[id].rev + 1 } },
    }))
  },
  placeItem: (id, pos) => set((s) => (s.items[id] ? { items: { ...s.items, [id]: { pos, rev: s.items[id].rev + 1 } } } : {})),
  setQuality: (quality, auto = false) => set({ quality, qualityAuto: auto }),
  showToast: (text, item) => set({ toast: { text, id: ++toastId, item } }),
}))

/** Something has the player's attention (a screen, the settings, a garden panel, the edit mode): no walking,
 *  looking or interacting. */
export const busy = (s: Pick<HomeState, 'screen' | 'settingsOpen' | 'panel' | 'editing' | 'decorating'>) => !!(s.screen || s.settingsOpen || s.panel || s.editing || s.decorating)
