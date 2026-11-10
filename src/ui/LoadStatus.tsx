import { useState } from 'react'
import { mb, secondsLeft, useLoader, type LoadFile } from '../lib/loader'
import { lightModeAutomatic, profile } from '../lib/profile'
import { useHome } from '../store'

// The loading screen's progress: which step it is on, how much has arrived, how fast, how long is left, and —
// on request — every file with its size and state. Downloads take the bar to 70 %, building the house to 85 %,
// warming up the graphics to 100 %.

const STATUS: Record<LoadFile['status'], string> = {
  waiting: 'waiting',
  loading: '',
  done: 'downloaded',
  cached: 'on this device',
  failed: 'will retry',
}

function time(seconds: number) {
  if (seconds < 1) return 'less than a second'
  if (seconds < 60) return `about ${Math.ceil(seconds)} s`
  return `about ${Math.ceil(seconds / 60)} min`
}

export function LoadStatus() {
  const s = useLoader()
  const sceneProgress = useHome((st) => st.progress)
  const attempt = useHome((st) => st.attempt)
  const [open, setOpen] = useState(false)
  const allCached = s.total > 0 && s.fromDevice >= s.total
  const downloading = s.phase === 'download'
  const fraction = s.total ? s.loaded / s.total : 0
  const overall = s.phase === 'download' ? fraction * 0.7 : s.phase === 'prepare' ? 0.7 + Math.min(1, sceneProgress / 100) * 0.15 : s.phase === 'compile' ? 0.85 + s.compile * 0.15 : 1
  const left = secondsLeft(s)
  const title =
    s.phase === 'download'
      ? allCached
        ? 'Loading from this device'
        : 'Downloading the game'
      : s.phase === 'prepare'
        ? 'Building the house'
        : s.phase === 'compile'
          ? 'Preparing the graphics'
          : 'Ready'
  const took = s.readyAt ? (s.readyAt - s.startedAt) / 1000 : 0
  let line = ''
  if (downloading && s.total) {
    line = `${mb(s.loaded)} of ${mb(s.total)} MB`
    if (!allCached && s.speed > 0) line += ` · ${mb(s.speed)} MB/s`
    if (!allCached && left !== null) line += ` · ${time(left)} left`
  } else if (s.phase === 'prepare')
    line = sceneProgress > 0 && sceneProgress < 100 ? `decoding models and textures · ${Math.round(sceneProgress)}%` : 'putting the rooms, the garden and the animals in place'
  else if (s.phase === 'compile') line = `shaders and textures onto the graphics card · ${Math.round(s.compile * 100)}%`
  else if (s.phase === 'ready')
    line = `loaded in ${took.toFixed(1)} s${s.fromDevice > 0 ? ` · ${mb(s.fromDevice)} MB from this device` : ''}${s.total - s.fromDevice > 0 && s.total ? ` · ${mb(s.total - s.fromDevice)} MB downloaded` : ''}`

  return (
    <div className="load" data-phase={s.phase}>
      <div className="load-head">
        <strong>{title}</strong>
        <span>{Math.round(overall * 100)}%</span>
      </div>
      <div className="loadbar" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(overall * 100)}>
        <span style={{ transform: `scaleX(${Math.max(0.03, Math.min(1, overall))})` }} />
      </div>
      <p className="load-line">{line || ' '}</p>
      {attempt > 0 && s.phase !== 'ready' && <p className="load-note">Starting again in light graphics — the first try ran short of graphics memory.</p>}
      {s.phase === 'ready' && profile.light && lightModeAutomatic() && (
        <p className="load-note">Light graphics are on: a start ran short of graphics memory on this device. Settings → Light graphics turns them off.</p>
      )}
      {s.offline && <p className="load-note">You are offline: playing from the copy kept on this device.</p>}
      {s.files.length > 0 && (
        <details className="load-files" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary>What it loads ({s.files.length} files)</summary>
          <ul>
            {s.files.map((f) => (
              <li key={f.url} data-status={f.status}>
                <span className="load-dot" aria-hidden="true" />
                <span className="load-name">{f.label}</span>
                <span className="load-size">{mb(f.bytes)} MB</span>
                <span className="load-state">{f.status === 'loading' ? `${Math.round((f.loaded / Math.max(1, f.bytes)) * 100)}%` : STATUS[f.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
