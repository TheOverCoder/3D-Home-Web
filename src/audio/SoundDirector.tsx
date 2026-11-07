import { useEffect } from 'react'
import { DOOR, LAMPS } from '../data/layout'
import { debugSet } from '../lib/debug'
import { useSettings } from '../settings'
import { useHome } from '../store'
import {
  audioStatus,
  doorSound,
  dropSound,
  duckAmbient,
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
    const apply = () => {
      const s = useSettings.getState()
      setSoundPrefs(s.sound, s.volume)
    }
    apply()
    const unsubSettings = useSettings.subscribe((s, p) => {
      if (s.sound !== p.sound || s.volume !== p.volume) apply()
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
          const { pan, near } = place(lamp.position[0], lamp.position[2])
          lampSwitch(s.lamps[lamp.id], pan, near)
        }
      }
      if (s.doors[DOOR.id] !== p.doors[DOOR.id]) {
        const { pan, near } = place(DOOR.hinge[0] + DOOR.width / 2, DOOR.hinge[2])
        doorSound(s.doors[DOOR.id], pan, near)
      }
      if (s.carrying !== p.carrying) {
        if (s.carrying) pickupSound()
        else dropSound()
      }
      if (s.screen !== p.screen) screenSound(!!s.screen)
      if (s.room !== p.room) setRoomTone(s.room)
      if (s.outdoors !== p.outdoors) setOutdoors(s.outdoors)
      if (!!s.screen !== !!p.screen || s.settingsOpen !== p.settingsOpen) duckAmbient(!!s.screen || s.settingsOpen)
    })
    setRoomTone(useHome.getState().room)

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
