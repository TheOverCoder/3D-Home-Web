import { create } from 'zustand'

// Player preferences, remembered between visits. Everything is optional: storage may be blocked
// (private windows, embedded frames), in which case the defaults simply apply for the session.
export interface Settings {
  fov: number // first-person vertical field of view, degrees
  sensitivity: number // mouse / touch look multiplier
  invertY: boolean
  headBob: boolean
  depthOfField: boolean
  filmGrain: boolean
  haze: boolean // atmospheric fog
  cinema: boolean // letterbox bars
}

export const DEFAULT_SETTINGS: Settings = {
  fov: 72,
  sensitivity: 1,
  invertY: false,
  headBob: true,
  depthOfField: true,
  filmGrain: true,
  haze: true,
  cinema: false,
}

const KEY = '3d-home:settings:v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function persist(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* storage unavailable — keep the session-only values */
  }
}

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void
  reset: () => void
}

const pick = (s: Settings): Settings => ({
  fov: s.fov,
  sensitivity: s.sensitivity,
  invertY: s.invertY,
  headBob: s.headBob,
  depthOfField: s.depthOfField,
  filmGrain: s.filmGrain,
  haze: s.haze,
  cinema: s.cinema,
})

export const useSettings = create<SettingsStore>()((set, get) => ({
  ...load(),
  update: (patch) => {
    set(patch)
    persist(pick(get()))
  },
  reset: () => {
    set(DEFAULT_SETTINGS)
    persist(DEFAULT_SETTINGS)
  },
}))
