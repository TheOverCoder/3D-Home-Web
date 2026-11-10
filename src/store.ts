import { create } from 'zustand'
import { DOOR, LAMPS, PICKUPS, type RoomId, type Vec3 } from './data/layout'
import type { ActionIcon } from './lib/interaction'

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
 *  shop, the basket, the furniture shop and buying a piece). */
export type Panel =
  | { kind: 'seeds'; bed: number }
  | { kind: 'build'; bed: number }
  | { kind: 'bed'; bed: number }
  | { kind: 'queue' }
  | { kind: 'shop' }
  | { kind: 'basket' }
  | { kind: 'furniture' } // the furniture shop (decorating)
  | { kind: 'buy-piece'; type: string } // buying one piece: what it is and its price, Cancel or Buy

/** The thing you look at has settings: a gear on it opens them (src/ui/Gear.tsx). */
export interface Gear {
  id: string
  label: string
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
  nearby: Nearby | null // the action E (or the big touch button) runs
  actions: Nearby[] // everything on offer, `nearby` first
  status: Nearby | null // nothing to do here: what is on its way (a growing bed, the oven baking) — shown, not pressed
  guide: { id: string; at: number } | null // a compass mark tapped: marked in the world until you get there
  compass: CompassMark[] // what is ready to take out of reach, nearest first (outdoors)
  gear: Gear | null // the thing looked at has settings (a bed): its gear
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
  setGear: (gear: Gear | null) => void
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
  nearby: null,
  actions: [],
  status: null,
  guide: null,
  compass: [],
  gear: null,
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
  setGear: (gear) => set({ gear }),
  setConfirm: (confirm) => set({ confirm }),
  openScreen: (screen) => set({ screen, nearby: null, actions: [], status: null, confirm: null, gear: null }),
  closeScreen: () => set({ screen: null }),
  openPanel: (panel) => set({ panel, nearby: null, actions: [], status: null, confirm: null, gear: null }),
  closePanel: () => set({ panel: null }),
  setEditing: (editing) => set(editing ? { editing, decorating: false, panel: null, nearby: null, actions: [], status: null, confirm: null, compass: [], gear: null } : { editing }),
  setDecorating: (decorating) =>
    set(decorating ? { decorating, editing: false, panel: null, nearby: null, actions: [], status: null, confirm: null, compass: [], gear: null } : { decorating }),
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
