import { useEffect } from 'react'
import { restartGraphics } from '../lib/startup'
import { useHome } from '../store'

/**
 * When the browser drops the WebGL context (GPU driver reset, the phone waking from sleep, too many 3D tabs) the
 * scene starts again by itself on a fresh one, where you stood (src/lib/startup.ts). This says what is going on,
 * and offers to do it right away.
 */
export function GraphicsNotice() {
  const graphics = useHome((s) => s.graphics)
  const phase = useHome((s) => s.phase)
  const warm = useHome((s) => s.ready.warm)
  // the new scene is up: the notice has done its job
  useEffect(() => {
    if (graphics === 'restarting' && warm) useHome.setState({ graphics: 'ok' })
  }, [graphics, warm])
  if (graphics === 'ok' || phase !== 'playing') return null
  if (graphics === 'restarting') {
    if (warm) return null
    return (
      <div className="graphics-notice" role="status" aria-live="polite" aria-label="Graphics restarting">
        <p>
          <strong>Starting the graphics again…</strong> The browser reset them; you will be back where you were.
        </p>
      </div>
    )
  }
  const lost = graphics === 'lost'
  return (
    <div className="graphics-notice" role="alertdialog" aria-live="assertive" aria-label="Graphics reset">
      <p>
        <strong>{lost ? 'The browser reset the graphics.' : 'Graphics are back.'}</strong>{' '}
        {lost ? 'It happens after sleep, or when the phone runs short of memory — starting them again…' : 'If anything looks wrong, restart them.'}
      </p>
      <div className="graphics-notice-actions">
        {!lost && (
          <button className="ghost" onClick={() => useHome.setState({ graphics: 'ok' })}>
            Continue
          </button>
        )}
        <button className="primary small" onClick={() => restartGraphics(false)}>
          Restart graphics
        </button>
        <button className="ghost" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </div>
  )
}
