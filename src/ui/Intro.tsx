import { useEffect, useRef } from 'react'
import { useHome } from '../store'
import { assetStatus, usingPlaceholders } from '../assets/registry'
import { CREDITS } from '../data/credits'

export function Intro() {
  const phase = useHome((s) => s.phase)
  const ready = useHome((s) => s.ready.scene && s.ready.env)
  const setPhase = useHome((s) => s.setPhase)
  const progress = useHome((s) => s.progress)
  const failure = useHome((s) => s.failure)
  const enter = useRef<HTMLButtonElement>(null)
  // once the house is ready, Enter / Space on the keyboard walks in
  useEffect(() => {
    if (ready && !failure) enter.current?.focus({ preventScroll: true })
  }, [ready, failure])
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
        <button ref={enter} className="primary" disabled={loading || !!failure} onClick={() => setPhase('playing')}>
          {failure ? 'Unavailable here' : loading ? (progress > 0 && progress < 100 ? `Loading… ${Math.round(progress)}%` : 'Preparing the house…') : 'Enter the house'}
        </button>
        {loading && !failure && (
          <div className="loadbar" role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <span style={{ transform: `scaleX(${Math.max(0.04, Math.min(1, progress / 100))})` }} />
          </div>
        )}
        <p className="tip">
          Press <kbd>Esc</kbd> at any time for controls and settings. Sound on — the house has its own.
        </p>
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
