import { useEffect } from 'react'
import { DOOR, LAMPS } from '../data/layout'
import { farm } from '../farm/state'
import { hingedDoorOf } from '../home/shell'
import { HOSTED, onHost } from '../home/layout'
import { debugSet } from '../lib/debug'
import { useSettings } from '../settings'
import { useHome } from '../store'
import {
  audioStatus,
  doorSound,
  dropSound,
  duckAmbient,
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
} from './sound'
import { wireMusic } from './music'

/**
 * Wires the procedural sound to the app: unlocks audio on the first gesture, follows the Sound settings,
 * and turns state changes (lamps, the door, pickups, screens, rooms) and interface clicks into sounds.
 * Footsteps and landings come from the player's own frame loop.
 */
export function SoundDirector() {
  useEffect(() => wireMusic(), [])
  useEffect(() => {
    debugSet('audio', audioStatus)
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
