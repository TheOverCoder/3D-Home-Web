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
  sound: boolean
  volume: number // 0..1
  music: boolean // background music (generated in the browser, nothing is downloaded)
  musicVolume: number // 0..1, under the sound volume
  musicTrack: number
  vibration: boolean // a short buzz as an action is done (phones that can: Android)
  hudMode: 'all' | 'compass' | 'clean' // the top of the screen: everything, only the compass, or nothing (the button in the corner, or H)
  followMove: boolean // touch: the view turns towards where you walk with the stick (the button beside it)
}

// People who ask their system for less motion get a still camera by default (they can still turn sway on)
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const DEFAULT_SETTINGS: Settings = {
  fov: 72,
  sensitivity: 1,
  invertY: false,
  headBob: !reducedMotion,
  depthOfField: true,
  filmGrain: true,
  haze: true,
  cinema: false,
  sound: true,
  volume: 0.7,
  music: true,
  musicVolume: 0.5,
  musicTrack: 0,
  vibration: true,
  hudMode: 'all',
  followMove: false,
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
  sound: s.sound,
  volume: s.volume,
  music: s.music,
  musicVolume: s.musicVolume,
  musicTrack: s.musicTrack,
  vibration: s.vibration,
  hudMode: s.hudMode === 'compass' || s.hudMode === 'clean' ? s.hudMode : 'all',
  followMove: s.followMove === true,
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
