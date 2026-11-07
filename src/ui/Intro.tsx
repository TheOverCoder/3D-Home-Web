import { useEffect, useRef, useState } from 'react'
import { assetStatus, usingPlaceholders } from '../assets/registry'
import { CREDITS } from '../data/credits'
import { currentSlot, slotSummary, useFarm } from '../farm/state'
import { coarsePointer } from '../lib/device'
import { collectDiagnostics } from '../lib/diagnostics'
import { mb, useLoader } from '../lib/loader'
import { deviceLabel, profile, setLightMode } from '../lib/profile'
import { restartGraphics } from '../lib/startup'
import { clearGameFiles, persistStorage, storageInfo, type StorageInfo } from '../lib/sw'
import { useSettings } from '../settings'
import { useHome, type Quality } from '../store'
import { LoadStatus } from './LoadStatus'
import { MusicPlayer } from './MusicPlayer'
import { SavesPanel } from './SavesPanel'

// The way in: what the game is, how far the loading has got (and what it is loading), which farm you are on,
// the music, and the settings that matter before you start — all on one card, each part folded away until
// asked for. When the house cannot start it says why, with the things that can be tried.

type Tab = 'saves' | 'settings' | 'music' | null

function Failure() {
  const failure = useHome((s) => s.failure)!
  const [copied, setCopied] = useState(false)
  const again = () => {
    if (failure.kind === 'graphics' && !profile.light) restartGraphics(false)
    else location.reload()
  }
  return (
    <div className="failure" role="alert">
      <strong>The house could not start.</strong>
      <p>{failure.message}</p>
      <div className="failure-actions">
        <button className="chip-btn strong" onClick={again}>
          Try again
        </button>
        {!profile.light && failure.kind !== 'network' && (
          <button
            className="chip-btn"
            onClick={() => {
              setLightMode(true)
              location.reload()
            }}
          >
            Try light graphics
          </button>
        )}
        <button
          className="chip-btn"
          onClick={() => {
            const text = `${failure.kind}: ${failure.detail ?? failure.message}\n\n${collectDiagnostics()}`
            void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))
          }}
        >
          {copied ? 'Copied' : 'Copy details'}
        </button>
      </div>
      {failure.kind === 'graphics' && <p className="failure-tip">On a phone: closing other tabs and apps frees graphics memory.</p>}
      {failure.detail && (
        <details className="failure-detail">
          <summary>Technical detail</summary>
          <code>{failure.detail}</code>
        </details>
      )}
    </div>
  )
}

const QUALITIES: { id: Quality | 'auto'; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
]

function SettingsPanel() {
  const quality = useHome((s) => s.quality)
  const auto = useHome((s) => s.qualityAuto)
  const setQuality = useHome((s) => s.setQuality)
  const sound = useSettings((s) => s.sound)
  const volume = useSettings((s) => s.volume)
  const music = useSettings((s) => s.music)
  const update = useSettings((s) => s.update)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [cleared, setCleared] = useState(false)
  useEffect(() => {
    void storageInfo().then(setStorage)
  }, [cleared])
  return (
    <div className="intro-settings">
      <div className="row">
        <span className="row-label">Graphics</span>
        <div className="seg" role="radiogroup" aria-label="Graphics quality">
          {QUALITIES.map((q) => {
            const on = q.id === 'auto' ? auto : !auto && quality === q.id
            return (
              <button key={q.id} role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => (q.id === 'auto' ? setQuality(quality, true) : setQuality(q.id))}>
                {q.label}
              </button>
            )
          })}
        </div>
      </div>
      <label className="row">
        <span className="row-label">
          Light graphics
          <small>for older phones: smaller textures, no extra effects</small>
        </span>
        <input
          type="checkbox"
          checked={profile.light}
          onChange={(e) => {
            setLightMode(e.target.checked)
            restartGraphics(e.target.checked)
            if (!e.target.checked) location.reload() // leaving light graphics: start clean at full size
          }}
        />
      </label>
      <label className="row">
        <span className="row-label">Sound</span>
        <input type="checkbox" checked={sound} onChange={(e) => update({ sound: e.target.checked })} />
      </label>
      <label className="row">
        <span className="row-label">Volume</span>
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => update({ volume: Number(e.target.value) })} />
      </label>
      <label className="row">
        <span className="row-label">Music</span>
        <input type="checkbox" checked={music} onChange={(e) => update({ music: e.target.checked })} />
      </label>
      <div className="row">
        <span className="row-label">
          Kept on this device
          <small>
            {storage ? `${mb(storage.usage)} MB — the game files and your farms${storage.persisted ? ' · protected from clean-ups' : ''}` : 'game files and your farms'}
          </small>
        </span>
        <div className="row-actions">
          {storage && !storage.persisted && (
            <button className="chip-btn" onClick={() => void persistStorage().then(() => storageInfo().then(setStorage))}>
              Keep it
            </button>
          )}
          <button
            className="chip-btn"
            onClick={() => {
              void clearGameFiles().then(() => setCleared(true))
            }}
          >
            {cleared ? 'Cleared' : 'Free up space'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Intro() {
  const phase = useHome((s) => s.phase)
  const ready = useHome((s) => s.ready.scene && s.ready.env && s.ready.warm)
  const setPhase = useHome((s) => s.setPhase)
  const failure = useHome((s) => s.failure)
  const loadPhase = useLoader((s) => s.phase)
  const quality = useHome((s) => s.quality)
  const qualityAuto = useHome((s) => s.qualityAuto)
  useFarm((s) => s.rev)
  const [tab, setTab] = useState<Tab>(null)
  const enter = useRef<HTMLButtonElement>(null)
  // once the house is ready, Enter / Space on the keyboard walks in
  useEffect(() => {
    if (ready && !failure && !tab) enter.current?.focus({ preventScroll: true })
  }, [ready, failure, tab])
  if (phase !== 'intro') return null

  const slot = currentSlot()
  const summary = slotSummary(slot)
  const loading = !ready
  const go = () => {
    void persistStorage(true)
    setPhase('playing')
  }
  const label = failure
    ? 'Unavailable here'
    : loading
      ? loadPhase === 'download'
        ? 'Downloading…'
        : loadPhase === 'compile'
          ? 'Preparing the graphics…'
          : 'Building the house…'
      : summary.played
        ? `Continue · Farm ${slot}`
        : 'Enter the house'
  const toggle = (t: Exclude<Tab, null>) => setTab((cur) => (cur === t ? null : t))

  return (
    <div className="intro">
      <div className="intro-card">
        <p className="eyebrow">Interactive 3D tour</p>
        <h1>3D Home</h1>
        <p className="lede">
          Walk through the house room by room, then step out through the glass door onto the farm: grow vegetables, milk the
          cows, shear the sheep, bake cakes and sell to the line of neighbours at the gate.
        </p>
        {failure ? <Failure /> : <LoadStatus />}
        <button ref={enter} className="primary" disabled={loading || !!failure} onClick={go}>
          {label}
        </button>
        {summary.played && !failure && (
          <p className="intro-farm">
            Farm {slot}: {summary.coins} coins · {summary.sold} sold · {summary.growing} beds growing
          </p>
        )}
        <div className="intro-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'saves'} className={tab === 'saves' ? 'on' : ''} onClick={() => toggle('saves')}>
            Saves
          </button>
          <button role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? 'on' : ''} onClick={() => toggle('settings')}>
            Settings
          </button>
          <button role="tab" aria-selected={tab === 'music'} className={tab === 'music' ? 'on' : ''} onClick={() => toggle('music')}>
            Music
          </button>
        </div>
        {tab === 'saves' && <SavesPanel />}
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'music' && <MusicPlayer />}
        {coarsePointer ? (
          <p className="tip">
            Walk with the stick on the left, drag anywhere to look, and the round button on the right does what is near you — it
            turns you to it, too. Upright or on its side, the controls fit the screen.
          </p>
        ) : (
          <p className="tip">
            Press <kbd>Esc</kbd> at any time for controls and settings. Sound on — the house has its own, and music.
          </p>
        )}
        <p className="intro-device">
          {deviceLabel()} · graphics {qualityAuto ? 'auto' : quality}
          {profile.device !== 'desktop' && !profile.light ? ' · tuned for phones' : ''}
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
