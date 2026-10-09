import { useEffect, useRef, useState, type ReactNode } from 'react'
import { collectDiagnostics } from '../lib/diagnostics'
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../settings'
import { useHome } from '../store'

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <span className="row-label">{label}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button id={id} role="switch" aria-checked={checked} aria-label={label} className={checked ? 'switch on' : 'switch'} onClick={() => onChange(!checked)} />
}

function Slider({ id, value, min, max, step, onChange, label }: { id: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="slider">
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id}>{Number.isInteger(step) ? value : value.toFixed(1)}</output>
    </div>
  )
}

const KEYS: { action: string; keys: string[] }[] = [
  { action: 'Move', keys: ['W', 'A', 'S', 'D'] },
  { action: 'Look', keys: ['Mouse'] },
  { action: 'Run', keys: ['Shift'] },
  { action: 'Jump', keys: ['Space'] },
  { action: 'Interact', keys: ['E'] },
  { action: 'Change view', keys: ['V'] },
  { action: 'Settings', keys: ['Esc'] },
]

/** The gear in the corner and the panel behind it: every control, shortcut and visual option in one place. */
export function SettingsPanel() {
  const open = useHome((s) => s.settingsOpen)
  const setOpen = useHome((s) => s.setSettingsOpen)
  const phase = useHome((s) => s.phase)
  const view = useHome((s) => s.view)
  const setView = useHome((s) => s.setView)
  const quality = useHome((s) => s.quality)
  const setQuality = useHome((s) => s.setQuality)
  const settings = useSettings()
  const update = (patch: Partial<Settings>) => settings.update(patch)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle')
  const copyReport = async () => {
    const text = collectDiagnostics()
    try {
      await navigator.clipboard.writeText(text)
      setCopied('ok')
    } catch {
      // clipboard blocked (embedded frame, insecure origin): show the text so it can be copied by hand
      window.prompt('Copy this report:', text)
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 2500)
  }

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  if (phase !== 'playing') return null

  return (
    <>
      <button className={open ? 'gear hidden' : 'gear'} onClick={() => setOpen(true)} aria-label="Settings and controls (Esc)" title="Settings (Esc)">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>

      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Settings</h2>
              <button ref={closeRef} className="close" onClick={() => setOpen(false)} aria-label="Close (Esc)">
                ✕
              </button>
            </header>

            <section>
              <h3>Controls</h3>
              <ul className="keylist">
                {KEYS.map((k) => (
                  <li key={k.action}>
                    <span>{k.action}</span>
                    <span className="caps">
                      {k.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="muted">On a touch screen, use the left joystick to walk and drag the scene to look.</p>
            </section>

            <section>
              <h3>View</h3>
              <Row label="Camera">
                <Segmented
                  label="Camera"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'first', label: 'First person' },
                    { value: 'third', label: 'Third person' },
                  ]}
                />
              </Row>
              <Row label="Field of view">
                <Slider id="set-fov" label="Field of view" value={settings.fov} min={60} max={100} step={1} onChange={(fov) => update({ fov })} />
              </Row>
              <Row label="Look speed">
                <Slider id="set-sens" label="Look speed" value={settings.sensitivity} min={0.4} max={2.5} step={0.1} onChange={(sensitivity) => update({ sensitivity })} />
              </Row>
              <Row label="Invert vertical look">
                <Toggle id="set-invert" label="Invert vertical look" checked={settings.invertY} onChange={(invertY) => update({ invertY })} />
              </Row>
              <Row label="Walking sway">
                <Toggle id="set-bob" label="Walking sway" checked={settings.headBob} onChange={(headBob) => update({ headBob })} />
              </Row>
            </section>

            <section>
              <h3>Picture</h3>
              <Row label="Quality">
                <Segmented
                  label="Quality"
                  value={quality}
                  onChange={setQuality}
                  options={[
                    { value: 'high', label: 'High' },
                    { value: 'low', label: 'Low' },
                  ]}
                />
              </Row>
              <Row label="Depth of field" hint="Soft focus, like a lens">
                <Toggle id="set-dof" label="Depth of field" checked={settings.depthOfField} onChange={(depthOfField) => update({ depthOfField })} />
              </Row>
              <Row label="Atmosphere" hint="Haze and light shafts">
                <Toggle id="set-haze" label="Atmosphere" checked={settings.haze} onChange={(haze) => update({ haze })} />
              </Row>
              <Row label="Film grain">
                <Toggle id="set-grain" label="Film grain" checked={settings.filmGrain} onChange={(filmGrain) => update({ filmGrain })} />
              </Row>
              <Row label="Cinema bars">
                <Toggle id="set-cinema" label="Cinema bars" checked={settings.cinema} onChange={(cinema) => update({ cinema })} />
              </Row>
            </section>

            <section>
              <h3>Something looks wrong?</h3>
              <Row label="Copy a report" hint="GPU, browser, where you stand, recent errors — paste it in the chat">
                <button id="copy-report" className="ghost" onClick={copyReport}>
                  {copied === 'ok' ? 'Copied ✓' : copied === 'failed' ? 'Shown above' : 'Copy diagnostics'}
                </button>
              </Row>
            </section>

            <footer>
              <button className="ghost" onClick={() => settings.reset()} disabled={Object.entries(DEFAULT_SETTINGS).every(([k, v]) => settings[k as keyof Settings] === v)}>
                Reset to defaults
              </button>
              <button className="primary small" onClick={() => setOpen(false)}>
                Back to the house
              </button>
            </footer>
          </aside>
        </div>
      )}
    </>
  )
}
