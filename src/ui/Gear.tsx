import { useEffect } from 'react'
import { Html } from '@react-three/drei'
import { uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { settingsOf } from '../lib/interaction'
import { busy, useHome } from '../store'
import { art } from './art'
import './Gear.css'

// The gear on the thing you look at, when it has settings (a bed: what it always grows). It turns up on the thing
// itself, a little above and to the right of where you look, spinning slowly; tap it (or press G) to open them.
// Not on the action button: that only ever does what one press does.

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

export function Gear() {
  const gear = useHome((s) => s.gear)
  const occupied = useHome(busy)
  const playing = useHome((s) => s.phase === 'playing')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyG' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const s = useHome.getState()
      if (!s.gear || busy(s)) return
      uiClick()
      settingsOf(s.gear.id)?.open()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const set = gear && playing && !occupied ? settingsOf(gear.id) : null
  if (!gear || !set) return null
  return (
    <Html key={gear.id} position={[set.at.x, set.at.y, set.at.z]} center zIndexRange={[12, 11]} wrapperClass="thing-gear-anchor">
      <button
        className="thing-gear"
        onClick={() => {
          uiClick()
          set.open()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={set.label}
        title={coarsePointer ? undefined : `${set.label} (G)`}
      >
        <img src={art('gear')} alt="" draggable={false} />
        {!coarsePointer && <kbd>G</kbd>}
      </button>
    </Html>
  )
}
