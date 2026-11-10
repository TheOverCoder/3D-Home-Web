import { useEffect } from 'react'
import { useSettings, type Settings } from '../settings'
import { busy, useHome } from '../store'
import { CompassRose, EyeSlash, SquaresFour } from './glyphs'
import './Compass.css'

type Mode = Settings['hudMode']

const NEXT: Record<Mode, Mode> = { all: 'compass', compass: 'clean', clean: 'all' }
const SAYS: Record<Mode, string> = { all: 'Top of the screen: everything', compass: 'Top of the screen: only the compass', clean: 'Top of the screen: clear' }

/** Whether the keys typed are going into a text field (then H is a letter, not a shortcut). */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/**
 * The button in the top corner that changes what the top of the screen shows, one press at a time: everything
 * (coins and basket, the compass, the edit and settings buttons), only the compass, or nothing at all — a clear
 * view of the farm. H does the same on a keyboard. The choice is remembered; styles.css and Compass.css read it
 * from <html data-hud>.
 */
export function HudMode() {
  const phase = useHome((s) => s.phase)
  const occupied = useHome(busy)
  const mode = useSettings((s) => s.hudMode)

  useEffect(() => {
    document.documentElement.dataset.hud = mode
  }, [mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyH' || e.repeat || typing(e.target)) return
      const s = useHome.getState()
      if (s.phase !== 'playing' || busy(s)) return
      const { hudMode, update } = useSettings.getState()
      update({ hudMode: NEXT[hudMode] })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (phase !== 'playing' || occupied) return null
  const Icon = mode === 'all' ? SquaresFour : mode === 'compass' ? CompassRose : EyeSlash
  return (
    <button className="gear hud-mode" data-mode={mode} onClick={() => useSettings.getState().update({ hudMode: NEXT[mode] })} aria-label={`${SAYS[mode]} — tap to change`} title={`${SAYS[mode]} (H)`}>
      <Icon weight="bold" />
    </button>
  )
}
