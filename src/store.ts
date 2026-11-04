import { create } from 'zustand'
import { DOOR, LAMPS, PICKUPS, type RoomId, type Vec3 } from './data/layout'

/** Picture quality tier: high = full film look, medium = the look without the costliest passes, low = plain and fast. */
export type Quality = 'high' | 'medium' | 'low'

export interface ItemState {
  pos: Vec3
  rev: number // bumped on every drop so the physics body is re-created at the new spot
}

export interface Nearby {
  id: string
  label: string
}

interface HomeState {
  phase: 'intro' | 'playing'
  ready: { scene: boolean; env: boolean }
  progress: number
  failure: string | null
  view: 'first' | 'third'
  settingsOpen: boolean
  hintShown: boolean
  room: RoomId | null
  nearby: Nearby | null
  screen: string | null
  lamps: Record<string, boolean>
  doors: Record<string, boolean>
  items: Record<string, ItemState>
  carrying: string | null
  quality: Quality
  qualityAuto: boolean // true while the frame-rate monitor may move `quality` up or down
  toast: { text: string; id: number } | null

  setPhase: (phase: HomeState['phase']) => void
  markReady: (key: 'scene' | 'env') => void
  setFailure: (failure: string | null) => void
  setView: (view: 'first' | 'third') => void
  setSettingsOpen: (open: boolean) => void
  markHintShown: () => void
  setRoom: (room: RoomId | null) => void
  setNearby: (nearby: Nearby | null) => void
  openScreen: (id: string) => void
  closeScreen: () => void
  toggleLamp: (id: string) => void
  toggleDoor: (id: string) => void
  pickUp: (id: string) => void
  drop: (pos: Vec3) => void
  setQuality: (quality: Quality, auto?: boolean) => void // a pick without `auto` pins it
  showToast: (text: string) => void
}

let toastId = 0

export const useHome = create<HomeState>()((set, get) => ({
  phase: 'intro',
  ready: { scene: false, env: false },
  progress: 0,
  failure: null,
  view: 'first',
  settingsOpen: false,
  hintShown: false,
  room: null,
  nearby: null,
  screen: null,
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
  setSettingsOpen: (settingsOpen) => set({ settingsOpen, nearby: settingsOpen ? null : get().nearby }),
  markHintShown: () => set({ hintShown: true }),
  setRoom: (room) => set({ room }),
  setNearby: (nearby) => set({ nearby }),
  openScreen: (screen) => set({ screen, nearby: null }),
  closeScreen: () => set({ screen: null }),
  toggleLamp: (id) => set((s) => ({ lamps: { ...s.lamps, [id]: !s.lamps[id] } })),
  toggleDoor: (id) => set((s) => ({ doors: { ...s.doors, [id]: !s.doors[id] } })),
  pickUp: (id) => set({ carrying: id }),
  drop: (pos) => {
    const id = get().carrying
    if (!id) return
    set((s) => ({
      carrying: null,
      items: { ...s.items, [id]: { pos, rev: s.items[id].rev + 1 } },
    }))
  },
  setQuality: (quality, auto = false) => set({ quality, qualityAuto: auto }),
  showToast: (text) => set({ toast: { text, id: ++toastId } }),
}))
