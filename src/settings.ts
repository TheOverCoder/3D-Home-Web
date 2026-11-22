import { create } from 'zustand'
import { lessMotion, setMotionPref, type MotionPref } from './ui/still'

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
  effectsVolume: number // 0..1, under the sound volume: work, coins, the animals, footsteps, the interface (src/audio/mix.ts)
  ambienceVolume: number // 0..1, under the sound volume: the room tone, the open air, birds and crickets
  musicTrack: number | 'auto' // the track picked, or Auto: it follows the farm's time of day and the place (src/audio/music.ts)
  vibration: boolean // a touch as an action is done (phones that can: Android; src/lib/device.ts, haptic)
  hudMode: 'all' | 'compass' | 'clean' // the top of the screen: everything, only the compass, or nothing (the button in the corner, or H)
  followMove: boolean // touch: the view turns towards where you walk with the stick (the button beside it)
  motion: MotionPref // less motion: left to the device, less whatever it says, or full (src/ui/still.ts reads it)
  learnt: Learnt // what this player has done once with the controls on this device: each is taught until then
  frameRate: 60 | 30 // frames a second: the screen's own pace, or a steady 30 that saves the battery (src/scene/frameRate.ts)
}

/** What a player has done once with the controls, on this device (taught in context until then, src/ui/TouchControls.tsx
 *  and src/ui/Hud.tsx): walked with the stick (or the keys), and turned the view with a drag (or the mouse). A record of
 *  what was done, not a preference: Reset to defaults keeps it. */
export interface Learnt {
  stick: boolean
  look: boolean
}

// People who ask their system for less motion get a still camera by default (they can still turn sway on): the
// device's own answer, read before the stored choice is handed to src/ui/still.ts below
const reducedMotion = lessMotion()

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
  effectsVolume: 1,
  ambienceVolume: 1,
  musicTrack: 'auto',
  vibration: true,
  hudMode: 'all',
  followMove: false,
  motion: 'device',
  learnt: { stick: false, look: false },
  frameRate: 60,
}

const KEY = '3d-home:settings:v1'

/** The controls' record as kept: each true only if it was (an older stored object has none: nothing learnt yet). */
const learntOf = (x: unknown): Learnt => {
  const l = (typeof x === 'object' && x !== null ? x : {}) as Partial<Record<keyof Learnt, unknown>>
  return { stick: l.stick === true, look: l.look === true }
}

/** A music track as kept: Auto, or the number of the track picked (anything else is Auto, as it starts). */
const trackOf = (x: unknown): number | 'auto' => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : 'auto')

/** A motion choice as kept: one of the three (anything else is the device's, as it starts). */
const motionOf = (x: unknown): MotionPref => (x === 'less' || x === 'full' ? x : 'device')

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
    return { ...s, motion: motionOf(s.motion), musicTrack: trackOf(s.musicTrack), learnt: learntOf(s.learnt), frameRate: s.frameRate === 30 ? 30 : 60 }
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

/** A volume as kept: 0..1 (anything else is full, as it starts). */
const level = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 1)

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
  effectsVolume: level(s.effectsVolume),
  ambienceVolume: level(s.ambienceVolume),
  musicTrack: trackOf(s.musicTrack),
  vibration: s.vibration,
  hudMode: s.hudMode === 'compass' || s.hudMode === 'clean' ? s.hudMode : 'all',
  followMove: s.followMove === true,
  motion: motionOf(s.motion),
  learnt: learntOf(s.learnt),
  frameRate: s.frameRate === 30 ? 30 : 60,
})

export const useSettings = create<SettingsStore>()((set, get) => ({
  ...load(),
  update: (patch) => {
    // less motion chosen: walking sway follows it (off when still), unless the same change sets it too; it can be
    // turned on again after
    if (patch.motion !== undefined && patch.motion !== get().motion && patch.headBob === undefined) {
      setMotionPref(motionOf(patch.motion))
      patch = { ...patch, headBob: !lessMotion() }
    }
    set(patch)
    persist(pick(get()))
  },
  reset: () => {
    // (what the player has learnt stays learnt)
    const kept = { ...DEFAULT_SETTINGS, learnt: get().learnt }
    set(kept)
    persist(kept)
  },
}))

/** The player has done this with the controls once on this device: it is no longer taught. Kept at once. */
export function learn(what: keyof Learnt) {
  const { learnt, update } = useSettings.getState()
  if (!learnt[what]) update({ learnt: { ...learnt, [what]: true } })
}

// The motion choice drives the one reader (src/ui/still.ts) as the page loads and on every change, however made (a
// row of Settings, Reset to defaults, a test)
setMotionPref(useSettings.getState().motion)
useSettings.subscribe((s, p) => {
  if (s.motion !== p.motion) setMotionPref(motionOf(s.motion))
})
