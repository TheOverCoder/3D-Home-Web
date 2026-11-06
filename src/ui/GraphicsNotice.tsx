import { useHome } from '../store'

/**
 * When the browser drops the WebGL context (GPU driver reset, the laptop waking from sleep, too many 3D tabs)
 * the canvas goes blank or freezes. Say what happened and offer the one fix that always works.
 */
export function GraphicsNotice() {
  const graphics = useHome((s) => s.graphics)
  if (graphics === 'ok') return null
  const lost = graphics === 'lost'
  return (
    <div className="graphics-notice" role="alertdialog" aria-live="assertive" aria-label="Graphics reset">
      <p>
        <strong>{lost ? 'The browser reset the graphics.' : 'Graphics are back.'}</strong>{' '}
        {lost ? 'This happens after sleep or a driver hiccup.' : 'If anything looks wrong, reload.'}
      </p>
      <div className="graphics-notice-actions">
        {!lost && (
          <button className="ghost" onClick={() => useHome.setState({ graphics: 'ok' })}>
            Continue
          </button>
        )}
        <button className="primary small" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </div>
  )
}
