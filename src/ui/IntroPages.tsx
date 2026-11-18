import { AnimatePresence, m } from 'motion/react'
import { Slider, Switch, Tabs, ToggleGroup } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'
import { TRACKS, nextTrack, pauseMusic, playMusic, useMusic } from '../audio/music'
import { CREDITS } from '../data/credits'
import { appleTouch, canVibrate, coarsePointer } from '../lib/device'
import { mb } from '../lib/loader'
import { profile, setLightMode } from '../lib/profile'
import { restartGraphics } from '../lib/startup'
import { clearGameFiles, persistStorage, storageInfo, type StorageInfo } from '../lib/sw'
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../settings'
import { useHome } from '../store'
import { art } from './art'
import { Pause, Play, SkipBack, SkipForward } from './glyphs'
import { PRESS, SPRING } from './motion'

// Three of the opening menu's pages (./Intro.tsx): Settings, in three tabs, Music and Credits. Not part of the page
// shell (update-v1 decision 18): the menu loads them, with Radix's switches, sliders and tabs, a moment after it paints,
// long before a tile can be pressed. Their looks are the menu's (./Intro.css).

/** A row of a settings tab: its words (and a hint), and its control. */
const Row = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="intro-row">
    <span className="intro-row-words">
      {label}
      {hint && <small>{hint}</small>}
    </span>
    {children}
  </div>
)
const Toggle = ({ on, set, label, disabled = false }: { on: boolean; set: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <Switch.Root className="intro-switch" checked={on} onCheckedChange={set} aria-label={label} disabled={disabled}>
    <Switch.Thumb className="intro-thumb" />
  </Switch.Root>
)
const Range = ({ value, min, max, step, set, label, show }: { value: number; min: number; max: number; step: number; set: (v: number) => void; label: string; show: string }) => (
  <span className="intro-range">
    <Slider.Root className="intro-slider" value={[value]} min={min} max={max} step={step} onValueChange={([x]) => set(x)} aria-label={label}>
      <Slider.Track className="intro-slider-track">
        <Slider.Range className="intro-slider-range" />
      </Slider.Track>
      <Slider.Thumb className="intro-slider-thumb" aria-label={label} />
    </Slider.Root>
    <output>{show}</output>
  </span>
)
function Segs<T extends string>({ value, set, options, label }: { value: T; set: (v: T) => void; options: { v: T; word: string }[]; label: string }) {
  return (
    <ToggleGroup.Root className="intro-seg" type="single" value={value} onValueChange={(x) => x && set(x as T)} aria-label={label}>
      {options.map((o) => (
        <ToggleGroup.Item key={o.v} value={o.v} className="intro-seg-item">
          {o.word}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/** The game's own settings (src/settings.ts, the store's quality and camera), in three tabs, and what this device keeps. */
export function SettingsPage() {
  const s = useSettings()
  const update = (patch: Partial<Settings>) => s.update(patch)
  const quality = useHome((st) => st.quality)
  const auto = useHome((st) => st.qualityAuto)
  const setQuality = useHome((st) => st.setQuality)
  const view = useHome((st) => st.view)
  const setView = useHome((st) => st.setView)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [cleared, setCleared] = useState(false)
  useEffect(() => {
    void storageInfo().then(setStorage)
  }, [cleared])
  const changed = Object.entries(DEFAULT_SETTINGS).some(([k, x]) => k !== 'musicTrack' && k !== 'hudMode' && s[k as keyof Settings] !== x)
  const nowQ = `${quality[0].toUpperCase()}${quality.slice(1)}`
  return (
    <div className="intro-settings">
      <Tabs.Root defaultValue="picture" className="intro-tabs-root">
        <Tabs.List className="intro-tablist" aria-label="Settings">
          <Tabs.Trigger value="picture" className="intro-tab">
            Picture
          </Tabs.Trigger>
          <Tabs.Trigger value="sound" className="intro-tab">
            Sound
          </Tabs.Trigger>
          <Tabs.Trigger value="controls" className="intro-tab">
            Controls
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="picture" className="intro-tab-body">
          <Row label="Quality" hint={auto ? `Follows the frame rate · now ${nowQ}` : 'Fixed'}>
            <Segs
              value={auto ? 'auto' : quality}
              set={(q) => (q === 'auto' ? setQuality(quality, true) : setQuality(q))}
              label="Graphics quality"
              options={[
                { v: 'auto', word: 'Auto' },
                { v: 'high', word: 'High' },
                { v: 'medium', word: 'Med' },
                { v: 'low', word: 'Low' },
              ]}
            />
          </Row>
          <Row label="Light graphics" hint="For older phones">
            <Toggle
              on={profile.light}
              set={(on) => {
                setLightMode(on)
                restartGraphics(on)
                if (!on) location.reload() // leaving light graphics: start clean at full size
              }}
              label="Light graphics"
            />
          </Row>
          <Row label="Atmosphere" hint="Haze and light shafts">
            <Toggle on={s.haze} set={(haze) => update({ haze })} label="Atmosphere" />
          </Row>
          <Row label="Depth of field" hint={quality === 'high' ? 'Soft focus, like a lens' : 'High quality only'}>
            <Toggle on={s.depthOfField && quality === 'high'} set={(depthOfField) => update({ depthOfField })} label="Depth of field" disabled={quality !== 'high'} />
          </Row>
          <Row label="Film grain">
            <Toggle on={s.filmGrain} set={(filmGrain) => update({ filmGrain })} label="Film grain" />
          </Row>
          <Row label="Cinema bars">
            <Toggle on={s.cinema} set={(cinema) => update({ cinema })} label="Cinema bars" />
          </Row>
        </Tabs.Content>
        <Tabs.Content value="sound" className="intro-tab-body">
          <Row label="Sound" hint="Footsteps, doors, the farm">
            <Toggle on={s.sound} set={(sound) => update({ sound })} label="Sound" />
          </Row>
          <Row label="Volume" hint={appleTouch ? 'On iPhone, the ring switch silences the game' : undefined}>
            <Range
              value={Math.round(s.volume * 100)}
              min={0}
              max={100}
              step={5}
              set={(x) => update({ volume: x / 100, sound: x > 0 ? true : s.sound })}
              label="Volume"
              show={`${Math.round(s.volume * 100)}`}
            />
          </Row>
          <Row label="Effects" hint="Work, coins, the animals, footsteps">
            <Range
              value={Math.round(s.effectsVolume * 100)}
              min={0}
              max={100}
              step={5}
              set={(x) => update({ effectsVolume: x / 100 })}
              label="Effects volume"
              show={`${Math.round(s.effectsVolume * 100)}`}
            />
          </Row>
          <Row label="Ambience" hint="Wind, birds and the rooms">
            <Range
              value={Math.round(s.ambienceVolume * 100)}
              min={0}
              max={100}
              step={5}
              set={(x) => update({ ambienceVolume: x / 100 })}
              label="Ambience volume"
              show={`${Math.round(s.ambienceVolume * 100)}`}
            />
          </Row>
          <Row label="Music" hint="Composed as it plays">
            <Toggle on={s.music} set={(music) => update({ music })} label="Music" />
          </Row>
          <Row label="Music volume">
            <Range value={Math.round(s.musicVolume * 100)} min={0} max={100} step={5} set={(x) => update({ musicVolume: x / 100 })} label="Music volume" show={`${Math.round(s.musicVolume * 100)}`} />
          </Row>
          {coarsePointer && canVibrate && (
            <Row label="Vibration" hint="A buzz as you collect, sell, buy, open a gift or reach a level">
              <Toggle on={s.vibration} set={(vibration) => update({ vibration })} label="Vibration" />
            </Row>
          )}
        </Tabs.Content>
        <Tabs.Content value="controls" className="intro-tab-body">
          <Row label="Camera">
            <Segs
              value={view}
              set={setView}
              label="Camera"
              options={[
                { v: 'first', word: 'First person' },
                { v: 'third', word: 'Third' },
              ]}
            />
          </Row>
          <Row label="Field of view">
            <Range value={s.fov} min={60} max={100} step={1} set={(fov) => update({ fov })} label="Field of view" show={`${s.fov}°`} />
          </Row>
          <Row label="Look speed">
            <Range value={s.sensitivity} min={0.4} max={2.5} step={0.1} set={(sensitivity) => update({ sensitivity })} label="Look speed" show={s.sensitivity.toFixed(1)} />
          </Row>
          <Row label="Invert vertical look">
            <Toggle on={s.invertY} set={(invertY) => update({ invertY })} label="Invert vertical look" />
          </Row>
          <Row label="Walking sway">
            <Toggle on={s.headBob} set={(headBob) => update({ headBob })} label="Walking sway" />
          </Row>
          {coarsePointer && (
            <Row label="Look where you walk" hint="The view turns with the stick">
              <Toggle on={s.followMove} set={(followMove) => update({ followMove })} label="Look where you walk" />
            </Row>
          )}
        </Tabs.Content>
      </Tabs.Root>
      <div className="intro-keep">
        <span className="intro-row-words">
          Kept on this device
          <small>{storage ? `${mb(storage.usage)} MB · the game and your farms${storage.persisted ? ' · kept safe' : ''}` : 'The game and your farms'}</small>
        </span>
        {storage && !storage.persisted ? (
          <m.button className="btn soft small" onClick={() => void persistStorage().then(() => storageInfo().then(setStorage))} {...PRESS}>
            Keep it
          </m.button>
        ) : (
          <m.button className="btn soft small" onClick={() => void clearGameFiles().then(() => setCleared(true))} disabled={cleared} {...PRESS}>
            {cleared ? 'Freed' : 'Free up space'}
          </m.button>
        )}
      </div>
      <m.button className="btn soft small intro-reset" disabled={!changed} onClick={() => s.reset()} {...PRESS}>
        Reset to defaults
      </m.button>
    </div>
  )
}

/** The music: the tracks the game composes as it plays (src/audio/music.ts), play and pause, the one before and after,
 *  its volume; the tile on the menu dances while it plays. */
export function MusicPage() {
  const { playing, track } = useMusic()
  const volume = useSettings((s) => s.musicVolume)
  const update = useSettings((s) => s.update)
  const t = TRACKS[track]
  const to = (i: number) => {
    const d = (i - track + TRACKS.length) % TRACKS.length
    for (let k = 0; k < d; k++) nextTrack(1)
  }
  return (
    <div className="intro-music music">
      <div className={`intro-now${playing ? ' on' : ''}`}>
        <span className="intro-disc" aria-hidden="true">
          <img className="art" src={art('musical-notes')} alt="" />
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={track}
            className="intro-now-words music-title"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.12 } }}
            transition={SPRING.pop}
          >
            <strong>{t.name}</strong>
            <small>{playing ? t.mood : 'paused'}</small>
          </m.span>
        </AnimatePresence>
      </div>
      <div className="intro-controls">
        <m.button className="intro-round music-btn" onClick={() => nextTrack(-1)} aria-label="Previous track" {...PRESS}>
          <SkipBack weight="fill" />
        </m.button>
        <m.button className="intro-round big music-btn play" onClick={() => (playing ? pauseMusic() : playMusic())} aria-label={playing ? 'Pause the music' : 'Play the music'} {...PRESS}>
          {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
        </m.button>
        <m.button className="intro-round music-btn" onClick={() => nextTrack(1)} aria-label="Next track" {...PRESS}>
          <SkipForward weight="fill" />
        </m.button>
      </div>
      <ul className="intro-tracks">
        {TRACKS.map((x, i) => (
          <li key={x.name}>
            <m.button className={`intro-track${i === track ? ' on' : ''}`} onClick={() => to(i)} aria-pressed={i === track} {...PRESS}>
              <b>{x.name}</b>
              <small>{x.mood}</small>
            </m.button>
          </li>
        ))}
      </ul>
      <Row label="Music volume">
        <Range value={Math.round(volume * 100)} min={0} max={100} step={5} set={(x) => update({ musicVolume: x / 100 })} label="Music volume" show={`${Math.round(volume * 100)}`} />
      </Row>
    </div>
  )
}

/** Who made what the game is built from (src/data/credits.ts), each with its licence. */
export function CreditsPage() {
  return (
    <div className="intro-credit-list credits">
      <p className="intro-credit-lead">Made with love, and with the work of these people:</p>
      <ul>
        {CREDITS.map((c) => (
          <li key={c.what}>
            <b>
              {c.url ? (
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.what}
                </a>
              ) : (
                c.what
              )}
            </b>
            <span>
              {c.by} · {c.license}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
