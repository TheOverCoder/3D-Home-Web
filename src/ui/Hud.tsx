import { useEffect, useRef, useState } from 'react'
import { PICKUPS, ROOMS } from '../data/layout'
import { triggerInteraction } from '../lib/interaction'
import { useSettings } from '../settings'
import { useHome } from '../store'

/** Room name that fades in when you walk into a new room, like a film title. */
function RoomTitle() {
  const room = useHome((s) => s.room)
  const [shown, setShown] = useState<{ name: string; key: number } | null>(null)
  const seq = useRef(0)
  const last = useRef(room)

  useEffect(() => {
    if (!room || room === last.current) {
      last.current = room ?? last.current
      return
    }
    last.current = room
    setShown({ name: ROOMS[room].name, key: ++seq.current })
    const t = setTimeout(() => setShown(null), 3200)
    return () => clearTimeout(t)
  }, [room])

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
  return visible ? (
    <div className="first-hint" aria-hidden="true">
      Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> · look with the mouse · <kbd>Esc</kbd> for settings
    </div>
  ) : null
}

export function Hud() {
  const phase = useHome((s) => s.phase)
  const nearby = useHome((s) => s.nearby)
  const carrying = useHome((s) => s.carrying)
  const screen = useHome((s) => s.screen)
  const settingsOpen = useHome((s) => s.settingsOpen)
  const toast = useHome((s) => s.toast)
  const cinema = useSettings((s) => s.cinema)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useHome.setState((s) => (s.toast?.id === toast.id ? { toast: null } : s)), 2200)
    return () => clearTimeout(t)
  }, [toast])

  if (phase !== 'playing') return null

  const carried = PICKUPS.find((p) => p.id === carrying)
  const prompt = screen || settingsOpen ? null : nearby?.label ?? (carried ? `Put down the ${carried.name}` : null)

  return (
    <>
      {cinema && <div className="cinema-bars" aria-hidden="true" />}
      <RoomTitle />
      <FirstHint />

      <div className="hud-prompt" aria-live="polite">
        {prompt && (
          <button className="prompt" onClick={triggerInteraction}>
            <kbd>E</kbd>
            <span>{prompt}</span>
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
