import { useState, type ReactNode } from 'react'
import { appleTouch, canVibrate, coarsePointer } from '../lib/device'
import { AnimatePresence } from 'motion/react'
import { art } from './art'
import { PanelSheet } from './PanelSheet'
import { collectDiagnostics } from '../lib/diagnostics'
import { DEFAULT_SETTINGS, uiSizeOf, useSettings, type Settings, type UiSize } from '../settings'
import { useHome } from '../store'
import { MusicPlayer } from './MusicPlayer'
import { profile, setLightMode } from '../lib/profile'
import { restartGraphics } from '../lib/startup'
import { useLessMotion } from './still'
import { UI_SIZES, uiScale } from './uiSize'
import { resumeSteps, stepsResumable, useFarm } from '../farm/state'

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

function Toggle({ id, checked, onChange, label, disabled = false }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button id={id} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={checked ? 'switch on' : 'switch'} onClick={() => onChange(!checked)} />
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
  { action: 'Interact (or the nearest thing)', keys: ['E'] },
  { action: 'Change view', keys: ['V'] },
  { action: 'Settings', keys: ['Esc'] },
]

const TOUCH: { action: string; how: string }[] = [
  { action: 'Move', how: 'The stick (it comes to your thumb)' },
  { action: 'Run', how: 'Stick past its ring' },
  { action: 'Look', how: 'Drag the scene' },
  { action: 'Look where you walk', how: 'Arrow over the stick' },
  { action: 'Walk on by yourself', how: 'Walker over the stick' },
  { action: 'Turn round', how: 'U-turn over the stick' },
  { action: 'Do what is near you', how: 'Round button (or its label)' },
  { action: 'The next things near you', how: 'Small round buttons' },
  { action: 'Jump', how: 'Jump button' },
]

/** What Less motion says under its name: that it follows the device while it does, what it stills once chosen. */
/** The interface size's line: what it is on this screen, and when the screen holds it back. */
function sizeHint(pick: UiSize): string {
  const now = uiScale(pick, innerWidth, innerHeight)
  const pct = `${Math.round(now * 100)}%`
  return now < UI_SIZES[pick] ? `${pct}: as large as this screen allows` : pick === 'medium' ? `${pct}: as the game was drawn` : pct
}

const MOTION_HINT: Record<Settings['motion'], string | undefined> = { device: 'Follows your device', less: 'No flights, confetti or walking sway', full: undefined }

/** The settings (opened from the top corner's menu, src/ui/HudMode.tsx, or Esc): every control, shortcut and visual
 *  option in one place. */
export function SettingsPanel() {
  const open = useHome((s) => s.settingsOpen)
  const setOpen = useHome((s) => s.setSettingsOpen)
  const phase = useHome((s) => s.phase)
  const view = useHome((s) => s.view)
  const setView = useHome((s) => s.setView)
  const quality = useHome((s) => s.quality)
  const qualityAuto = useHome((s) => s.qualityAuto)
  const setQuality = useHome((s) => s.setQuality)
  const settings = useSettings()
  const update = (patch: Partial<Settings>) => settings.update(patch)
  const still = useLessMotion()
  // the first steps' tips, skipped on a farm still young enough for them: they can come back (src/farm/state/steps.ts)
  const tips = useFarm(() => stepsResumable())
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

  if (phase !== 'playing') return null

  // the game's one sheet (src/ui/PanelSheet.tsx): on the right sideways and on a computer, from the bottom upright; its
  // ✕, a swipe, the shade and Esc close it
  return (
    <AnimatePresence>
      {open && (
        <PanelSheet key="settings" label="Settings" title="Settings" pic={art('gear')} side className="settings-sheet" onClose={() => setOpen(false)}>
          <div className="drawer-body">
            <section>
              <h3>Controls</h3>
              {coarsePointer ? (
                <ul className="keylist">
                  {TOUCH.map((k) => (
                    <li key={k.action}>
                      <span>{k.action}</span>
                      <span className="how">{k.how}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
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
                </>
              )}
              {tips && (
                <Row label="Show the tips again" hint="The farmer's hints, from where you skipped them">
                  <button
                    id="set-tips"
                    className="ghost"
                    onClick={() => {
                      if (resumeSteps()) setOpen(false)
                    }}
                  >
                    Show
                  </button>
                </Row>
              )}
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
              {coarsePointer && (
                <Row label="Look where you walk" hint="The view turns with the stick (the arrow over it)">
                  <Toggle id="set-follow" label="Look where you walk" checked={settings.followMove} onChange={(followMove) => update({ followMove })} />
                </Row>
              )}
              <Row label="Less motion" hint={MOTION_HINT[settings.motion]}>
                <Toggle id="set-motion" label="Less motion" checked={still} onChange={(less) => update({ motion: less ? 'less' : 'full' })} />
              </Row>
            </section>

            <section>
              <h3>Sound</h3>
              <Row label="Sound" hint="Footsteps, switches, doors and the room">
                <Toggle id="set-sound" label="Sound" checked={settings.sound} onChange={(sound) => update({ sound })} />
              </Row>
              <Row label="Volume" hint={appleTouch ? 'On iPhone, the ring switch silences the game' : undefined}>
                <Slider
                  id="set-volume"
                  label="Volume"
                  value={Math.round(settings.volume * 100)}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => update({ volume: v / 100, sound: v > 0 ? true : settings.sound })}
                />
              </Row>
              <Row label="Effects" hint="Work, coins, the animals, footsteps">
                <Slider id="set-effects" label="Effects volume" value={Math.round(settings.effectsVolume * 100)} min={0} max={100} step={5} onChange={(v) => update({ effectsVolume: v / 100 })} />
              </Row>
              <Row label="Ambience" hint="Wind, birds and the rooms">
                <Slider id="set-ambience" label="Ambience volume" value={Math.round(settings.ambienceVolume * 100)} min={0} max={100} step={5} onChange={(v) => update({ ambienceVolume: v / 100 })} />
              </Row>
              <Row label="Music" hint="Composed as it plays · four moods">
                <Toggle id="set-music" label="Music" checked={settings.music} onChange={(music) => update({ music })} />
              </Row>
              <MusicPlayer compact />
              {coarsePointer && canVibrate && (
                <Row label="Vibration" hint="A buzz as you collect, sell, buy, open a gift or reach a level">
                  <Toggle id="set-vibration" label="Vibration" checked={settings.vibration} onChange={(vibration) => update({ vibration })} />
                </Row>
              )}
            </section>

            <section>
              <h3>Picture</h3>
              <Row label="Quality" hint={qualityAuto ? `Follows the frame rate · now ${quality[0].toUpperCase()}${quality.slice(1)}` : 'Fixed'}>
                <Segmented
                  label="Quality"
                  value={qualityAuto ? 'auto' : quality}
                  onChange={(q) => (q === 'auto' ? setQuality(quality, true) : setQuality(q))}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'high', label: 'High' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'low', label: 'Low' },
                  ]}
                />
              </Row>
              <Row label="Interface size" hint={sizeHint(settings.uiSize)}>
                <Segmented
                  label="Interface size"
                  value={settings.uiSize}
                  onChange={(v) => update({ uiSize: uiSizeOf(v) })}
                  options={[
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' },
                    { value: 'larger', label: 'Larger' },
                  ]}
                />
              </Row>
              <Row label="Frame rate" hint={settings.frameRate === 30 ? 'A steady 30 a second: saves the battery, and steadier on older phones' : 'As smooth as the screen can draw'}>
                <Segmented
                  label="Frame rate"
                  value={settings.frameRate === 30 ? '30' : '60'}
                  onChange={(r) => update({ frameRate: r === '30' ? 30 : 60 })}
                  options={[
                    { value: '60', label: '60' },
                    { value: '30', label: '30' },
                  ]}
                />
              </Row>
              <Row label="Light graphics" hint="For older phones: smaller textures, no extra effects · restarts the graphics where you stand">
                <Toggle
                  id="set-light"
                  label="Light graphics"
                  checked={profile.light}
                  onChange={(on) => {
                    setLightMode(on)
                    if (on) restartGraphics(true)
                    else location.reload() // back to full size: start clean
                  }}
                />
              </Row>
              {/* the lens blur only exists on High: say so instead of offering a switch that does nothing */}
              <Row label="Depth of field" hint={quality === 'high' ? 'Soft focus, like a lens' : 'Soft focus, like a lens · High quality only'}>
                <Toggle id="set-dof" label="Depth of field" checked={settings.depthOfField} disabled={quality !== 'high'} onChange={(depthOfField) => update({ depthOfField })} />
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
                Done
              </button>
            </footer>
          </div>
        </PanelSheet>
      )}
    </AnimatePresence>
  )
}
