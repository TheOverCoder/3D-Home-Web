import { useEffect } from 'react'
import { PICKUPS, ROOMS } from '../data/layout'
import { triggerInteraction } from '../lib/interaction'
import { useHome } from '../store'

export function Hud() {
  const phase = useHome((s) => s.phase)
  const room = useHome((s) => s.room)
  const nearby = useHome((s) => s.nearby)
  const carrying = useHome((s) => s.carrying)
  const screen = useHome((s) => s.screen)
  const quality = useHome((s) => s.quality)
  const setQuality = useHome((s) => s.setQuality)
  const toast = useHome((s) => s.toast)
  const view = useHome((s) => s.view)
  const setView = useHome((s) => s.setView)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => useHome.setState((s) => (s.toast?.id === toast.id ? { toast: null } : s)), 2200)
    return () => clearTimeout(t)
  }, [toast])

  if (phase !== 'playing') return null

  const carried = PICKUPS.find((p) => p.id === carrying)
  const prompt = screen ? null : nearby?.label ?? (carried ? `Put down the ${carried.name}` : null)

  return (
    <>
      <div className="hud-top">
        {room && <span className="chip">{ROOMS[room].name}</span>}
        {carried && <span className="chip subtle">Carrying: {carried.name}</span>}
        <span className="spacer" />
        <button className="chip button" onClick={() => setView(view === 'first' ? 'third' : 'first')} aria-label="Switch between first and third person view (V)">
          View: {view === 'first' ? 'First person' : 'Third person'}
        </button>
        <button className="chip button" onClick={() => setQuality(quality === 'high' ? 'low' : 'high')} aria-label="Toggle graphics quality">
          Graphics: {quality === 'high' ? 'High' : 'Low'}
        </button>
      </div>

      {view === 'first' && !screen && <div className={nearby ? 'crosshair on' : 'crosshair'} aria-hidden="true" />}

      <div className="hud-prompt" aria-live="polite">
        {prompt && (
          <button className="prompt" onClick={triggerInteraction}>
            <kbd>E</kbd>
            <span>{prompt}</span>
          </button>
        )}
      </div>

      <div className="hud-help" aria-hidden="true">
        <kbd>WASD</kbd> walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> interact · <kbd>V</kbd> change view · click and move the mouse to look
      </div>

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          {toast.text}
        </div>
      )}
    </>
  )
}
