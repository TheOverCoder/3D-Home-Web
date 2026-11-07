import { useEffect, useRef, useState } from 'react'
import { PICKUPS, ROOMS } from '../data/layout'
import { coarsePointer } from '../lib/device'
import { triggerInteraction } from '../lib/interaction'
import { useSettings } from '../settings'
import { busy, useHome, type Nearby } from '../store'
import { ActionBadge, TurnHint } from './ActionGlyph'

/** Room name that fades in when you walk into a new room, like a film title. */
function RoomTitle() {
  const room = useHome((s) => s.room)
  const outdoors = useHome((s) => s.outdoors)
  const place = outdoors ? 'garden' : room
  const [shown, setShown] = useState<{ name: string; key: number } | null>(null)
  const seq = useRef(0)
  const last = useRef(place)

  useEffect(() => {
    if (!place || place === last.current) {
      last.current = place ?? last.current
      return
    }
    last.current = place
    setShown({ name: place === 'garden' ? 'Garden' : ROOMS[place].name, key: ++seq.current })
    const t = setTimeout(() => setShown(null), 3200)
    return () => clearTimeout(t)
  }, [place])

  return shown ? (
    <div className="room-title" key={shown.key} aria-live="polite">
      {shown.name}
    </div>
  ) : null
}

/** One quiet line the first time you step inside; everything else lives in the settings panel. */
function FirstHint() {
  const hintShown = useHome((s) => s.hintShown)
  const [visible, setVisible] = useState(!hintShown)
  useEffect(() => {
    if (hintShown) return
    useHome.getState().markHintShown()
    const t = setTimeout(() => setVisible(false), 7000)
    return () => clearTimeout(t)
  }, [hintShown])
  if (!visible) return null
  return coarsePointer ? (
    <div className="first-hint touch" aria-hidden="true">
      Walk with the stick · drag anywhere to look · the round button does what is near you
    </div>
  ) : (
    <div className="first-hint" aria-hidden="true">
      Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> · look with the mouse · <kbd>Esc</kbd> for settings
    </div>
  )
}

export function Hud() {
  const phase = useHome((s) => s.phase)
  const nearby = useHome((s) => s.nearby)
  const carrying = useHome((s) => s.carrying)
  const occupied = useHome(busy)
  const toast = useHome((s) => s.toast)
  const cinema = useSettings((s) => s.cinema)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useHome.setState((s) => (s.toast?.id === toast.id ? { toast: null } : s)), 2200)
    return () => clearTimeout(t)
  }, [toast])

  if (phase !== 'playing') return null

  const carried = PICKUPS.find((p) => p.id === carrying)
  const prompt: Nearby | null = occupied ? null : (nearby ?? (carried ? { id: 'drop', label: `Put down the ${carried.name}`, icon: { verb: 'drop' } } : null))
  const turn = prompt?.reach ? prompt.side : undefined

  return (
    <>
      {cinema && <div className="cinema-bars" aria-hidden="true" />}
      <RoomTitle />
      <FirstHint />

      <div className="hud-prompt" aria-live="polite">
        {prompt && (
          // on a touch screen the round action button carries the picture; the label is a second way to tap it
          <button className={`prompt${turn && turn !== 'ahead' ? ` turn-${turn}` : ''}`} onClick={() => triggerInteraction()} data-verb={prompt.icon?.verb ?? 'pick'}>
            {!coarsePointer && <kbd>E</kbd>}
            {!coarsePointer && <ActionBadge icon={prompt.icon} className="small" />}
            {turn === 'left' && <TurnHint side="left" className="prompt-turn" />}
            <span className="prompt-text">{prompt.label}</span>
            {(turn === 'right' || turn === 'back') && <TurnHint side={turn} className="prompt-turn" />}
          </button>
        )}
      </div>

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          {toast.text}
        </div>
      )}
    </>
  )
}
