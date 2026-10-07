import { useHome } from '../store'
import { assetStatus, usingPlaceholders } from '../assets/registry'
import { CREDITS } from '../data/credits'

export function Intro() {
  const phase = useHome((s) => s.phase)
  const ready = useHome((s) => s.ready.scene && s.ready.env)
  const setPhase = useHome((s) => s.setPhase)
  const progress = useHome((s) => s.progress)
  const failure = useHome((s) => s.failure)
  if (phase !== 'intro') return null

  const loading = !ready
  return (
    <div className="intro">
      <div className="intro-card">
        <p className="eyebrow">Interactive 3D tour</p>
        <h1>3D Home</h1>
        <p className="lede">
          Walk through the house room by room. Every room has a screen with information you can open and explore.
        </p>
        {failure && (
          <p className="failure" role="alert">
            {failure}
          </p>
        )}
        <button className="primary" disabled={loading || !!failure} onClick={() => setPhase('playing')}>
          {failure ? 'Unavailable here' : loading ? (progress > 0 && progress < 100 ? `Loading… ${Math.round(progress)}%` : 'Preparing the house…') : 'Enter the house'}
        </button>
        <ul className="keys touch" aria-label="Touch controls">
          <li>left joystick to walk · drag the scene to look</li>
          <li>tap <kbd>E</kbd> to interact</li>
        </ul>
        <ul className="keys desktop" aria-label="Controls">
          <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk</li>
          <li><kbd>Shift</kbd> run · <kbd>Space</kbd> jump</li>
          <li>mouse to look (click the scene first)</li>
          <li><kbd>E</kbd> interact · <kbd>V</kbd> change view</li>
        </ul>
        <details className="credits">
          <summary>Credits</summary>
          <ul>
            {CREDITS.map((c) => (
              <li key={c.what}>
                {c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.what}</a> : c.what} — {c.by} ({c.license})
              </li>
            ))}
          </ul>
        </details>
        {usingPlaceholders && (
          <p className="note">
            Placeholder assets in use
            {!assetStatus.house && ' · house'}
            {!assetStatus.character && ' · character'}
            {!assetStatus.hdri && ' · HDRI'}
          </p>
        )}
      </div>
    </div>
  )
}
