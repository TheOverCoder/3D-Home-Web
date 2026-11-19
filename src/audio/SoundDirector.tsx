import { useEffect } from 'react'
import { insideWalkIn } from '../data/buildings'
import { DOOR, LAMPS } from '../data/layout'
import { dayNow, eventsNow, farm } from '../farm/state'
import { hingedDoorOf } from '../home/shell'
import { HOSTED, onHost } from '../home/layout'
import { debugSet } from '../lib/debug'
import { playerState } from '../lib/playerState'
import type { RewardKind, Tier } from '../lib/tier'
import { useSettings } from '../settings'
import { useHome } from '../store'
import {
  audioStatus,
  doorSound,
  dropSound,
  duckAmbient,
  hearPhase,
  hearWalkIns,
  lampSwitch,
  pickupSound,
  placeSound as place,
  screenSound,
  setOutdoors,
  setRoomTone,
  setSoundPrefs,
  suspendForHidden,
  uiClick,
  unlockAudio,
  type FarmSound,
  type PlayOpts,
} from './sound'
import { setMusicMood, wireMusic, type MusicMood } from './music'

/** How often where the music is heard is looked at (ms): the time of day, a walk-in walked into, a market day. */
const MOOD_EVERY = 500

/** Where the music is heard now: the farm's time of day; indoors (in the house, or in a walk-in building on the farm);
 *  with a panel or a screen open (not the settings: its volume is set there, as it sounds); at the market (inside it,
 *  or on a market day). */
function moodNow(s: ReturnType<typeof useHome.getState>): MusicMood {
  const at = playerState.position
  const walkIn = s.map !== 'home' && s.outdoors ? insideWalkIn(at.x, at.z) : null
  return {
    phase: dayNow().phase,
    indoors: !s.outdoors || walkIn !== null,
    panel: !!(s.panel || s.screen),
    market: walkIn?.id === 'market' || eventsNow().some((o) => o.id === 'market'),
  }
}

/**
 * Wires the procedural sound to the app: unlocks audio on the first gesture, follows the Sound settings,
 * and turns state changes (lamps, the door, pickups, screens, rooms) and interface clicks into sounds.
 * Footsteps and landings come from the player's own frame loop.
 */
export function SoundDirector() {
  useEffect(() => wireMusic(), [])
  // the music and the birds follow the farm: its time of day, indoors or out, a panel open, the market (mission 06 c10)
  useEffect(() => {
    hearPhase(() => dayNow().phase)
    const follow = () => setMusicMood(moodNow(useHome.getState()))
    follow()
    const t = window.setInterval(follow, MOOD_EVERY)
    const unsub = useHome.subscribe((s, p) => {
      if (s.panel !== p.panel || s.screen !== p.screen || s.outdoors !== p.outdoors || s.map !== p.map) follow()
    })
    return () => {
      window.clearInterval(t)
      unsub()
    }
  }, [])
  useEffect(() => {
    // ?debug: the engine's state (`__home.audio()`), and the phone mix measured offline (./measure.ts, loaded only when
    // asked): one sound (`render(kind)`), a reward's sting (`sting(kind, tier)`), every sound the player causes and
    // every sting (`measure()`), and a demo to listen to
    debugSet(
      'audio',
      Object.assign(() => audioStatus(), {
        render: (kind: FarmSound, o?: PlayOpts) => import('./measure').then(async (m) => m.measureSamples(await m.renderSound(kind, o))),
        sting: (kind: RewardKind, tier: Tier) => import('./measure').then(async (m) => m.measureSamples(await m.renderSting(kind, tier))),
        measure: () => import('./measure').then((m) => m.measureSounds()),
        demo: () => import('./measure').then((m) => m.demo()),
      }),
    )
    const unlock = () => unlockAudio()
    // the switch and the four volumes (the main one, effects, ambience, music) into the mixer
    const apply = () => setSoundPrefs(useSettings.getState())
    apply()
    const unsubSettings = useSettings.subscribe((s, p) => {
      if (s.sound !== p.sound || s.volume !== p.volume || s.effectsVolume !== p.effectsVolume || s.ambienceVolume !== p.ambienceVolume || s.musicVolume !== p.musicVolume) apply()
    })
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    window.addEventListener('touchend', unlock, true)

    const onVisibility = () => suspendForHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)

    // soft clicks for the interface (the in-world prompt has its own sounds through the interaction)
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('button, summary, [role="tab"]')
      if (!el || el.classList.contains('prompt') || (el as HTMLButtonElement).disabled) return
      uiClick(el.getAttribute('role') !== 'switch' || el.getAttribute('aria-checked') !== 'true')
    }
    let lastTick = 0
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | null
      if (t?.type !== 'range' || performance.now() - lastTick < 70) return
      lastTick = performance.now()
      uiClick(true)
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('input', onInput, true)

    const unsubHome = useHome.subscribe((s, p) => {
      if (s.lamps !== p.lamps) {
        for (const lamp of LAMPS) {
          if (s.lamps[lamp.id] === p.lamps[lamp.id]) continue
          // where the lamp is now (one on a piece, or the standing lamp, goes where its piece goes)
          const host = HOSTED[lamp.id]
          const [lx, lz] = (host && onHost(farm.home, host, lamp.position[0], lamp.position[2])) || [lamp.position[0], lamp.position[2]]
          const { pan, near } = place(lx, lz)
          lampSwitch(s.lamps[lamp.id], pan, near)
        }
      }
      // the kitchen's door where its doorway is now (none while that doorway is closed)
      const door = hingedDoorOf(farm.home.shell)
      if (door && s.doors[DOOR.id] !== p.doors[DOOR.id]) {
        const { pan, near } = place(door.hinge[0] + door.width / 2, door.hinge[2])
        doorSound(s.doors[DOOR.id], pan, near)
      }
      if (s.carrying !== p.carrying) {
        if (s.carrying) pickupSound()
        else dropSound()
      }
      if (s.screen !== p.screen) screenSound(!!s.screen)
      if (s.room !== p.room) setRoomTone(s.room)
      if (s.map !== p.map) hearWalkIns(s.map !== 'home')
      if (s.outdoors !== p.outdoors) setOutdoors(s.outdoors)
      if (!!s.screen !== !!p.screen || s.settingsOpen !== p.settingsOpen) duckAmbient(!!s.screen || s.settingsOpen)
    })
    setRoomTone(useHome.getState().room)
    hearWalkIns(useHome.getState().map !== 'home')

    return () => {
      unsubSettings()
      unsubHome()
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      window.removeEventListener('touchend', unlock, true)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('input', onInput, true)
    }
  }, [])
  return null
}
