import { create } from 'zustand'
import { useSettings } from '../settings'

// Background music: the part of it the page shell holds — what is playing (`useMusic`), the tracks' names, where the
// music is heard (its mood), and play, pause, a track picked or Auto. The music itself, composed as it plays, with its
// layers and its moods (./composer.ts), comes with import() once the page is idle or the first time it is asked for,
// with the sound engine and its tables: none of them is in the shell (update-v1 decision 18, the shell at 160 KB). It
// plays into the mixer's music bus (./mix.ts), starts on the first tap or click (browsers wait for one) and follows the
// Music settings. On Auto (the default) the track follows the farm's time of day and the place (`autoTrack`); a track
// picked stays.

/** The four tracks, by name and mood, in their order (./composer.ts: how each is composed, in the same order). */
export const TRACKS = [
  { name: 'Morning on the farm', mood: 'bright, unhurried' },
  { name: 'Slow afternoon', mood: 'calm, a little wistful' },
  { name: 'Market day', mood: 'lively, folky' },
  { name: 'Evening lights', mood: 'warm, jazzy' },
] as const

/** The farm's time of day, as its clock tells it (src/farm/day.ts). */
export type Phase = 'morning' | 'noon' | 'evening' | 'night'
/** Where the music is heard: the farm's time of day, indoors or not (the house, a walk-in building), with a panel open,
 *  and at the market (inside it, or on a market day). Its layers follow it, and on Auto its track. */
export interface MusicMood {
  phase: Phase
  indoors: boolean
  panel: boolean
  market: boolean
}
/** Before the farm says (the opening menu): a morning in the open air. */
export const OPEN_AIR: MusicMood = { phase: 'morning', indoors: false, panel: false, market: false }

/** Auto's track for each time of day (mission 06 c11): *Morning on the farm* in the morning, *Slow afternoon* at noon,
 *  *Evening lights* in the evening and at night; *Market day* at the market, whatever the hour. */
export const AUTO_TRACKS: Readonly<Record<Phase | 'market', number>> = { morning: 0, noon: 1, evening: 3, night: 3, market: 2 }

/** The track Auto plays where the music is heard. */
export const autoTrack = (m: MusicMood): number => (m.market ? AUTO_TRACKS.market : AUTO_TRACKS[m.phase])

/** The track a setting asks for where the music is heard: the one picked, or Auto's. */
export function wantedTrack(pick: number | 'auto', m: MusicMood): number {
  if (pick === 'auto') return autoTrack(m)
  const n = TRACKS.length
  return Number.isFinite(pick) ? ((Math.floor(pick) % n) + n) % n : 0
}

interface MusicState {
  /** whether it plays (the Music setting on, and started by a gesture) */
  playing: boolean
  /** the track playing (on Auto, the one the day asked for last) */
  track: number
  /** where it is heard (SoundDirector tells it as the game changes) */
  mood: MusicMood
}

export const useMusic = create<MusicState>(() => ({ playing: false, track: wantedTrack(useSettings.getState().musicTrack, OPEN_AIR), mood: OPEN_AIR }))

type Composer = typeof import('./composer')
let composer: Composer | null = null
let loading: Promise<Composer> | null = null

/** The music's composer, fetched once (with the sound engine: neither is in the page shell). */
export function loadComposer(): Promise<Composer> {
  loading ??= import('./composer').then((m) => (composer = m))
  return loading
}
/** Runs `f` with the composer: at once when it is in (still inside the tap that asked: browsers start audio only in
 *  one), else as soon as it has come. */
function withComposer(f: (c: Composer) => void) {
  if (composer) f(composer)
  else void loadComposer().then(f, () => {})
}

// fetched once the page has painted and is idle, so that a first tap finds it in (the shell is not waiting for it)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const idle = (window as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (idle) idle(() => void loadComposer().catch(() => {}), { timeout: 4000 })
  else window.setTimeout(() => void loadComposer().catch(() => {}), 2500)
}

/** Starts the music (call from a tap or click the first time: browsers only allow sound after one). */
export function playMusic() {
  if (!useSettings.getState().music) useSettings.getState().update({ music: true })
  useMusic.setState({ playing: true })
  withComposer((c) => c.start())
}

/** Stops the music; `remember`: as the player's choice (the Music setting turns off). */
export function pauseMusic(remember = true) {
  useMusic.setState({ playing: false })
  if (remember && useSettings.getState().music) useSettings.getState().update({ music: false })
  composer?.stop()
}

/** The track before or after the one playing, picked: it stays (Auto is off until chosen again). */
export function nextTrack(dir: 1 | -1 = 1) {
  const track = (useMusic.getState().track + dir + TRACKS.length) % TRACKS.length
  useSettings.getState().update({ musicTrack: track })
  useMusic.setState({ track })
  composer?.pick(track)
}

/** Auto: the track follows the time of day and the place again (from the next two bars). */
export function autoMusic() {
  useSettings.getState().update({ musicTrack: 'auto' })
}

/** Tells the music where it is heard (a part of it: the rest as it was). Nothing changes if nothing did. */
export function setMusicMood(patch: Partial<MusicMood>) {
  const was = useMusic.getState().mood
  const mood = { ...was, ...patch }
  if ((Object.keys(mood) as (keyof MusicMood)[]).every((k) => mood[k] === was[k])) return
  useMusic.setState({ mood })
}

/** Follows the settings: music on starts it (once audio is unlocked), off stops it; and the first tap or click
 *  anywhere starts it, if it is on. The composer is fetched now, so the first tap finds it in. */
export function wireMusic() {
  void loadComposer().catch(() => {})
  const sync = () => {
    const { music } = useSettings.getState()
    if (!music && useMusic.getState().playing) pauseMusic(false)
    else if (music && !useMusic.getState().playing)
      withComposer((c) => {
        // (once audio is unlocked: a gesture made the engine; else the first tap starts it)
        if (c.heard() && useSettings.getState().music && !useMusic.getState().playing) playMusic()
      })
  }
  const unsub = useSettings.subscribe((s, p) => {
    if (s.music !== p.music) sync()
  })
  // the first tap or click unlocks audio: start the music then, if it is on
  const first = () => {
    window.setTimeout(() => {
      if (useSettings.getState().music && !useMusic.getState().playing) playMusic()
    }, 0)
  }
  window.addEventListener('pointerdown', first, { once: true, capture: true })
  window.addEventListener('keydown', first, { once: true, capture: true })
  return () => {
    unsub()
    window.removeEventListener('pointerdown', first, true)
    window.removeEventListener('keydown', first, true)
  }
}
