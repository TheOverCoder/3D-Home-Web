import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { DiceFive } from '@phosphor-icons/react/dist/csr/DiceFive'
import { animate, AnimatePresence, m, useReducedMotion, type Variants } from 'motion/react'
import { Slider, Switch, Tabs, ToggleGroup } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'
import { TRACKS } from '../../../src/audio/music'
import type { Slot } from '../../../src/farm/state'
import { DEFAULT_SETTINGS, type Settings } from '../../../src/settings'
import { art, type ArtId } from '../../../src/ui/art'
import { ArrowRight, Pause, Play, SkipBack, SkipForward } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { HoldToClear } from '../saves/parts'
import { SavesBody } from '../saves/SavesC'
import '../saves/SavesC.css'
import { ago, cleared, FARM_NAMES, farmOf, NEW_NAMES, type Farm, type IntroState, type Page } from './data'
import { Backdrop, CreditsBody, Star } from './shared'
import './IntroE.css'

// E · the opening screen, round 5: one clear reference, after the user's "a page with New farm, Load farm, Settings,
// Music and more, in today's look but better, with settings the game can really have". A and D are gone.
//
// It is the game's title screen, the way today's is (the game's name and house over the farm, a paper card), made into
// a real menu. The card holds the one big button — while the game loads it is the loading bar itself, then Continue
// (your farm) or, the first time, New farm — and under it six tiles, each a picture and a word: New farm, Load farm,
// Settings, Music, How to play, Credits. A returning player's farm is a card of its own over the button: its name,
// level, coins, how long it has been, and what waits on it, in pictures.
//
// A tile opens its page inside the same card, the menu sliding away to the left and the page in from the right
// (Back, or a swipe of the edge, returns): New farm — a name (a roll of the dice gives another, and it can be typed)
// and which of the three places, Start (a place already taken asks for a hold, never a tap); Load farm — the saved
// farms, the chosen design of their own board (D: tabs, the farm's photo and numbers, Play, its file, the hold to
// start afresh), the same in both places; Settings — the game's own settings in three tabs (Picture: quality, light
// graphics, atmosphere, depth of field, film grain, cinema bars; Sound: sound, volume, music, music volume,
// vibration; Controls: first or third person, field of view, look speed, invert, walking sway, look where you walk),
// and what this device keeps; Music — the four tracks the game composes as it plays, play and pause, the one before
// and after, its volume; How to play — the touch controls, as the game's settings say them; Credits.
//
// Its moments: the letters of the name drop in and bounce as the sun behind opens; the button fills while the game
// loads and turns into Continue with a pop; pages slide; a press of Continue sends the name up and the card down while
// the scene pulls back into play. Sideways: the name and your farm on the left, the card on the right, full height.

const NAME = '3D Home'.split('')
const MOST = 4
const VERSION = 'v0.1' // package.json's version: the game does not show it yet

const letter = {
  hidden: { opacity: 0, y: -46, scale: 0.6 },
  shown: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop },
  gone: { opacity: 0, y: -30, transition: { duration: 0.18, ease: 'easeIn' } },
} as const
const POP = { hidden: { opacity: 0, scale: 0.4, y: 8 }, shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } } as const

/** A farm's name: its own (the saved farms' D gives each one), or its place's number while it is empty. */
const nameOf = (f: Farm) => (f.exists ? FARM_NAMES[f.slot] : `Place ${f.slot}`)

const TILES: { page: Exclude<Page, 'menu'>; art: ArtId; word: string }[] = [
  { page: 'new', art: 'seedling', word: 'New farm' },
  { page: 'load', art: 'floppy-disk', word: 'Load farm' },
  { page: 'settings', art: 'gear', word: 'Settings' },
  { page: 'music', art: 'musical-notes', word: 'Music' },
  { page: 'help', art: 'person-running', word: 'How to play' },
  { page: 'credits', art: 'sparkles', word: 'Credits' },
]
const TITLE: Record<Exclude<Page, 'menu'>, string> = { new: 'New farm', load: 'Load farm', settings: 'Settings', music: 'Music', help: 'How to play', credits: 'Credits' }

export function IntroE({ s, act }: { s: IntroState; act: Act<IntroState> }) {
  const f = farmOf(s)
  const back = f.played
  const still = useReducedMotion()
  const [page, setPage] = useState<Page>(s.page ?? 'menu')
  const [going, setGoing] = useState(false)
  const [load, setLoad] = useState(s.load ?? 1)
  const [musicOn, setMusicOn] = useState(true)
  // the lab's loading goes on to the end by itself, as the game's would
  useEffect(() => {
    if ((s.load ?? 1) >= 1) return
    if (still) {
      const t = setTimeout(() => setLoad(1), 2600)
      return () => clearTimeout(t)
    }
    const run = animate(s.load ?? 1, 1, { duration: 3.2, ease: 'linear', delay: 0.6, onUpdate: setLoad })
    return () => run.stop()
  }, [s.load, still])
  const go = () => {
    if (going || load < 1) return
    setGoing(true)
    setTimeout(act.close, 150)
  }
  const play = (slot: Slot) => {
    act.set({ ...s, slot })
    go()
  }
  const paged = page !== 'menu'
  return (
    <div className={`v-intro-e${paged ? ' paged' : ''}`}>
      <Backdrop />
      <m.span
        className="ie-sun"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={{ delay: 0.25, duration: 0.8, ease: EASE.out }}
      >
        <i />
      </m.span>
      <div className="ie-side">
        <m.div
          className="ie-logo"
          initial="hidden"
          animate="shown"
          exit="gone"
          variants={{ shown: { transition: { staggerChildren: 0.04, delayChildren: 0.16 } }, gone: { transition: { staggerChildren: 0.02 } } }}
        >
          <m.div
            className="ie-house"
            variants={{
              hidden: { opacity: 0, scale: 0.3, y: 30 },
              shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.soft },
              gone: { opacity: 0, y: -60, scale: 0.8, transition: { duration: 0.22, ease: 'easeIn' } },
            }}
          >
            <img className="art" src={art('house-with-garden')} alt="" />
          </m.div>
          <h1 aria-label="3D Home">
            {NAME.map((c, i) => (
              <m.span key={i} variants={letter} aria-hidden="true">
                {c}
              </m.span>
            ))}
          </h1>
          <m.p variants={{ hidden: { opacity: 0, y: 6 }, shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE.out } }, gone: { opacity: 0, transition: { duration: 0.12 } } }}>
            {back ? `Welcome back to ${nameOf(f)}` : 'A cosy house and farm'}
          </m.p>
        </m.div>
        {back && (
          <m.div
            className="ie-farm-wrap"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40, transition: { duration: 0.2 } }}
            transition={{ ...SPRING.sheet, delay: 0.2 }}
          >
            <FarmCard f={f} farms={s.farms.filter((x) => x.exists).length} onLoad={() => setPage('load')} />
          </m.div>
        )}
      </div>
      <div className="ie-bottom">
        <m.div
          className="ie-card paper"
          layout
          style={{ borderRadius: 30 }}
          initial={{ opacity: 0, y: 70 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 90, transition: { duration: 0.24, ease: 'easeIn' } }}
          transition={{ ...SPRING.sheet, delay: 0.1, layout: SPRING.sheet }}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={paged}>
            {page === 'menu' ? (
              <m.div key="menu" className="ie-menu" layout="position" custom={paged} variants={SLIDE} initial="enter" animate="center" exit="leave">
                <GoButton back={back} f={f} load={load} going={going} onGo={back ? go : () => setPage('new')} />
                <m.div className="ie-tiles" role="group" aria-label="Menu" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.035, delayChildren: 0.25 } } }}>
                  {TILES.filter((t) => back || t.page !== 'new').map((t) => (
                    <m.button key={t.page} className={`ie-tile${t.page === 'music' && musicOn ? ' on' : ''}`} variants={POP} onClick={() => setPage(t.page)} {...PRESS}>
                      <img className="art" src={art(t.art)} alt="" />
                      <span>{t.word}</span>
                      {t.page === 'music' && (
                        <span className="ie-eq" aria-label={musicOn ? 'playing' : 'off'}>
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                      {t.page === 'load' && s.farms.filter((x) => x.exists).length > 1 && <b className="ie-tile-n">{s.farms.filter((x) => x.exists).length}</b>}
                    </m.button>
                  ))}
                </m.div>
              </m.div>
            ) : (
              <m.section key={page} className={`ie-page ie-page-${page}`} layout="position" custom={paged} variants={SLIDE} initial="enter" animate="center" exit="leave" aria-label={TITLE[page]}>
                <header className="ie-page-head">
                  <m.button className="ie-back" onClick={() => setPage('menu')} aria-label="Back to the menu" {...PRESS}>
                    <CaretLeft weight="bold" />
                  </m.button>
                  <img className="art" src={art(TILES.find((t) => t.page === page)!.art)} alt="" />
                  <h2>{TITLE[page]}</h2>
                </header>
                <div className="ie-page-body">
                  {page === 'new' && <NewFarm s={s} onStart={(slot) => play(slot)} onReplace={(slot) => act.set(cleared(s, slot))} />}
                  {page === 'load' && (
                    <div className="v-saves-c v-saves-d ie-saves">
                      <SavesBody s={{ playing: s.slot, farms: s.farms }} extras onPlay={play} onClear={(slot) => act.set(cleared(s, slot))} />
                    </div>
                  )}
                  {page === 'settings' && <SettingsPage />}
                  {page === 'music' && <MusicPage on={musicOn} setOn={setMusicOn} />}
                  {page === 'help' && <HelpPage />}
                  {page === 'credits' && <CreditsBody />}
                </div>
              </m.section>
            )}
          </AnimatePresence>
        </m.div>
        <m.p className="ie-foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.5, duration: 0.3 }}>
          Phone · graphics auto · {VERSION}
        </m.p>
      </div>
    </div>
  )
}

/** The menu and a page trade places: the one going out slides away on the side it came from, the other comes in. */
const SLIDE: Variants = {
  enter: (paged: boolean) => ({ opacity: 0, x: paged ? 60 : -60 }),
  center: { opacity: 1, x: 0, transition: { ...SPRING.sheet, opacity: { duration: 0.18 } } },
  leave: (paged: boolean) => ({ opacity: 0, x: paged ? -60 : 60, transition: { duration: 0.16, ease: 'easeIn' } }),
}

/** A returning player's farm: its name and level, its coins, how long it has been, and what waits on it. */
function FarmCard({ f, farms, onLoad }: { f: Farm; farms: number; onLoad: () => void }) {
  const w = f.waiting
  const goods = w?.goods ?? []
  const more = goods.length - MOST
  return (
    <div className="ie-farm paper">
      <m.button className="ie-farm-name" onClick={onLoad} aria-label={`${nameOf(f)}: load another farm`} {...PRESS}>
        <Star level={f.level} />
        <span>
          <strong>{nameOf(f)}</strong>
          <small className={w ? 'ie-away' : ''}>{w ? `${ago(w.seconds)} away` : `${farms} farm${farms === 1 ? '' : 's'}`}</small>
        </span>
      </m.button>
      <span className="tag ie-coins">
        <img src={art('coin')} alt="" />
        {f.coins.toLocaleString('en-US')}
      </span>
      {w && (
        <m.div className="ie-ready" aria-label="Waiting on your farm" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.045, delayChildren: 0.42 } } }}>
          {goods.slice(0, MOST).map((g) => (
            <m.span key={g.item} variants={POP}>
              <ItemPic id={g.item} count={g.count} />
            </m.span>
          ))}
          {more > 0 && (
            <m.span className="ie-more" variants={POP}>
              +{more}
            </m.span>
          )}
          {w.buyers > 0 && (
            <m.span className="item-pic ie-buyers" variants={POP} aria-label={`${w.buyers} buyers at the gate`}>
              <img className="art" src={art('people-queue')} alt="" />
              <b className="qty">{w.buyers}</b>
            </m.span>
          )}
        </m.div>
      )}
    </div>
  )
}

/** The big button: while the game loads, the loading bar itself; then Continue (your farm) or New farm (the first time). */
function GoButton({ back, f, load, going, onGo }: { back: boolean; f: Farm; load: number; going: boolean; onGo: () => void }) {
  const ready = load >= 1
  return (
    <m.button
      className={`btn primary ie-go${going ? ' going' : ''}${ready || !back ? '' : ' loading'}`}
      onClick={ready || !back ? onGo : undefined}
      aria-disabled={!ready && back}
      aria-label={!ready && back ? `Loading ${Math.round(load * 100)}%` : back ? `Continue · ${nameOf(f)}` : 'New farm'}
      whileTap={ready || !back ? { scale: 0.95, y: 3 } : undefined}
      animate={going ? { scale: [0.95, 1.06, 1], transition: { duration: 0.3, ease: EASE.out } } : undefined}
      transition={SPRING.pop}
    >
      {!ready && back && <span className="ie-go-fill" style={{ width: `${load * 100}%` }} aria-hidden="true" />}
      <AnimatePresence mode="popLayout" initial={false}>
        {ready || !back ? (
          <m.span key="go" className="ie-go-words" initial={{ opacity: 0, scale: 0.5, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING.pop}>
            {back ? 'Continue' : 'New farm'}
            <ArrowRight weight="bold" />
          </m.span>
        ) : (
          <m.span key="load" className="ie-go-words" exit={{ opacity: 0, scale: 1.3, transition: { duration: 0.15 } }}>
            Loading <b>{Math.round(load * 100)}%</b>
          </m.span>
        )}
      </AnimatePresence>
    </m.button>
  )
}

/** New farm: its name (a roll of the dice gives another; it can be typed), its place, and Start. A place already taken
 *  is never started over by a tap: its button is a hold. The game goes on loading meanwhile. */
function NewFarm({ s, onStart, onReplace }: { s: IntroState; onStart: (slot: Slot) => void; onReplace: (slot: Slot) => void }) {
  const firstEmpty = s.farms.find((x) => !x.exists)?.slot ?? s.slot
  const [slot, setSlot] = useState<Slot>(firstEmpty)
  const [i, setI] = useState(0)
  const [name, setName] = useState(NEW_NAMES[0])
  const [spin, setSpin] = useState(0)
  const place = s.farms.find((x) => x.slot === slot)!
  const roll = () => {
    const n = (i + 1) % NEW_NAMES.length
    setI(n)
    setName(NEW_NAMES[n])
    setSpin((x) => x + 1)
  }
  return (
    <div className="ie-new">
      <label className="ie-sign">
        <small>Its name</small>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.input
            key={spin}
            className="ie-sign-name"
            value={name}
            maxLength={18}
            onChange={(e) => setName(e.target.value)}
            aria-label="Your farm's name"
            initial={{ opacity: 0, rotateX: -80 }}
            animate={{ opacity: 1, rotateX: 0 }}
            exit={{ opacity: 0, rotateX: 80, transition: { duration: 0.12 } }}
            transition={SPRING.pop}
          />
        </AnimatePresence>
        <m.button type="button" className="ie-dice" onClick={roll} aria-label="Another name" whileTap={{ scale: 0.85, rotate: 90 }} transition={SPRING.pop}>
          <DiceFive weight="fill" />
        </m.button>
      </label>
      <div className="ie-places-wrap">
        <small>Its place</small>
        <ToggleGroup.Root className="ie-places" type="single" value={String(slot)} onValueChange={(v) => v && setSlot(Number(v) as Slot)} aria-label="Its place">
          {s.farms.map((x) => (
            <ToggleGroup.Item key={x.slot} value={String(x.slot)} className="ie-place" aria-label={x.exists ? `Place ${x.slot}: ${nameOf(x)}` : `Place ${x.slot}: empty`}>
              {x.slot === slot && <m.span className="ie-place-on" layoutId="ie-place-on" transition={SPRING.pop} />}
              {x.exists ? <Star level={x.level} /> : <img className="art" src={art('seedling')} alt="" />}
              <b>{x.exists ? nameOf(x).split(' ')[0] : 'Empty'}</b>
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>
      <p className="ie-new-gives">
        <span className="tag">
          <img src={art('coin')} alt="" />
          20 to start
        </span>
        <span className="tag">
          <img src={art('seedling')} alt="" />3 beds
        </span>
        <span className="tag">
          <img src={art('chicken')} alt="" />
          hens
        </span>
      </p>
      {place.exists ? (
        <HoldToClear label={`Hold to start ${name} in the place of ${nameOf(place)}`} onDone={() => onReplace(slot)}>
          Hold to replace {nameOf(place)}
        </HoldToClear>
      ) : (
        <m.button className="btn primary ie-start" onClick={() => onStart(slot)} whileTap={{ scale: 0.95, y: 3 }} transition={SPRING.pop}>
          Start {name || 'your farm'} <ArrowRight weight="bold" />
        </m.button>
      )}
    </div>
  )
}

/** A row of a settings tab: its words (and a hint), and its control. */
const Row = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="ie-row">
    <span className="ie-row-words">
      {label}
      {hint && <small>{hint}</small>}
    </span>
    {children}
  </div>
)
const Toggle = ({ on, set, label, disabled = false }: { on: boolean; set: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <Switch.Root className="ie-switch" checked={on} onCheckedChange={set} aria-label={label} disabled={disabled}>
    <Switch.Thumb className="ie-thumb" />
  </Switch.Root>
)
const Range = ({ value, min, max, step, set, label, show }: { value: number; min: number; max: number; step: number; set: (v: number) => void; label: string; show: string }) => (
  <span className="ie-range">
    <Slider.Root className="ie-slider" value={[value]} min={min} max={max} step={step} onValueChange={([v]) => set(v)} aria-label={label}>
      <Slider.Track className="ie-slider-track">
        <Slider.Range className="ie-slider-range" />
      </Slider.Track>
      <Slider.Thumb className="ie-slider-thumb" aria-label={label} />
    </Slider.Root>
    <output>{show}</output>
  </span>
)
function Segs<T extends string>({ value, set, options, label }: { value: T; set: (v: T) => void; options: { v: T; word: string }[]; label: string }) {
  return (
    <ToggleGroup.Root className="ie-seg" type="single" value={value} onValueChange={(v) => v && set(v as T)} aria-label={label}>
      {options.map((o) => (
        <ToggleGroup.Item key={o.v} value={o.v} className="ie-seg-item">
          {o.word}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/** The game's own settings (src/settings.ts, the store's quality and view): every one a control the game has. */
function SettingsPage() {
  const [set, setSet] = useState<Settings>(DEFAULT_SETTINGS)
  const [quality, setQuality] = useState<'auto' | 'high' | 'medium' | 'low'>('auto')
  const [light, setLight] = useState(false)
  const [view, setView] = useState<'first' | 'third'>('first')
  const [freed, setFreed] = useState(false)
  const up = (patch: Partial<Settings>) => setSet((x) => ({ ...x, ...patch }))
  const changed = quality !== 'auto' || light || view !== 'first' || Object.entries(DEFAULT_SETTINGS).some(([k, v]) => set[k as keyof Settings] !== v)
  return (
    <div className="ie-settings">
      <Tabs.Root defaultValue="picture" className="ie-tabs">
        <Tabs.List className="ie-tablist" aria-label="Settings">
          <Tabs.Trigger value="picture" className="ie-tab">
            Picture
          </Tabs.Trigger>
          <Tabs.Trigger value="sound" className="ie-tab">
            Sound
          </Tabs.Trigger>
          <Tabs.Trigger value="controls" className="ie-tab">
            Controls
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="picture" className="ie-tab-body">
          <Row label="Quality" hint={quality === 'auto' ? 'Follows the frame rate · now Medium' : 'Fixed'}>
            <Segs
              value={quality}
              set={setQuality}
              label="Quality"
              options={[
                { v: 'auto', word: 'Auto' },
                { v: 'high', word: 'High' },
                { v: 'medium', word: 'Med' },
                { v: 'low', word: 'Low' },
              ]}
            />
          </Row>
          <Row label="Light graphics" hint="For older phones">
            <Toggle on={light} set={setLight} label="Light graphics" />
          </Row>
          <Row label="Atmosphere" hint="Haze and light shafts">
            <Toggle on={set.haze} set={(haze) => up({ haze })} label="Atmosphere" />
          </Row>
          <Row label="Depth of field" hint={quality === 'high' ? 'Soft focus, like a lens' : 'High quality only'}>
            <Toggle on={set.depthOfField && quality === 'high'} set={(depthOfField) => up({ depthOfField })} label="Depth of field" disabled={quality !== 'high'} />
          </Row>
          <Row label="Film grain">
            <Toggle on={set.filmGrain} set={(filmGrain) => up({ filmGrain })} label="Film grain" />
          </Row>
          <Row label="Cinema bars">
            <Toggle on={set.cinema} set={(cinema) => up({ cinema })} label="Cinema bars" />
          </Row>
        </Tabs.Content>
        <Tabs.Content value="sound" className="ie-tab-body">
          <Row label="Sound" hint="Footsteps, doors, the farm">
            <Toggle on={set.sound} set={(sound) => up({ sound })} label="Sound" />
          </Row>
          <Row label="Volume">
            <Range value={Math.round(set.volume * 100)} min={0} max={100} step={5} set={(v) => up({ volume: v / 100 })} label="Volume" show={`${Math.round(set.volume * 100)}`} />
          </Row>
          <Row label="Music" hint="Composed as it plays">
            <Toggle on={set.music} set={(music) => up({ music })} label="Music" />
          </Row>
          <Row label="Music volume">
            <Range value={Math.round(set.musicVolume * 100)} min={0} max={100} step={5} set={(v) => up({ musicVolume: v / 100 })} label="Music volume" show={`${Math.round(set.musicVolume * 100)}`} />
          </Row>
          <Row label="Vibration" hint="A short buzz as you harvest">
            <Toggle on={set.vibration} set={(vibration) => up({ vibration })} label="Vibration" />
          </Row>
        </Tabs.Content>
        <Tabs.Content value="controls" className="ie-tab-body">
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
            <Range value={set.fov} min={60} max={100} step={1} set={(fov) => up({ fov })} label="Field of view" show={`${set.fov}°`} />
          </Row>
          <Row label="Look speed">
            <Range value={set.sensitivity} min={0.4} max={2.5} step={0.1} set={(sensitivity) => up({ sensitivity })} label="Look speed" show={set.sensitivity.toFixed(1)} />
          </Row>
          <Row label="Invert vertical look">
            <Toggle on={set.invertY} set={(invertY) => up({ invertY })} label="Invert vertical look" />
          </Row>
          <Row label="Walking sway">
            <Toggle on={set.headBob} set={(headBob) => up({ headBob })} label="Walking sway" />
          </Row>
          <Row label="Look where you walk" hint="The view turns with the stick">
            <Toggle on={set.followMove} set={(followMove) => up({ followMove })} label="Look where you walk" />
          </Row>
        </Tabs.Content>
      </Tabs.Root>
      <div className="ie-keep">
        <span className="ie-row-words">
          Kept on this device
          <small>182 MB · the game and your farms</small>
        </span>
        <m.button className="btn soft small" onClick={() => setFreed(true)} disabled={freed} {...PRESS}>
          {freed ? 'Freed' : 'Free up space'}
        </m.button>
      </div>
      <m.button
        className="btn soft small ie-reset"
        disabled={!changed}
        onClick={() => {
          setSet(DEFAULT_SETTINGS)
          setQuality('auto')
          setLight(false)
          setView('first')
        }}
        {...PRESS}
      >
        Reset to defaults
      </m.button>
    </div>
  )
}

/** The music: the four tracks the game composes as it plays (src/audio/music.ts), play and pause, the one before and
 *  after, its volume; the tile on the menu dances while it plays. */
function MusicPage({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  const [track, setTrack] = useState(0)
  const [volume, setVolume] = useState(50)
  const t = TRACKS[track]
  const step = (d: number) => setTrack((n) => (n + d + TRACKS.length) % TRACKS.length)
  return (
    <div className="ie-music">
      <div className={`ie-now${on ? ' on' : ''}`}>
        <span className="ie-disc" aria-hidden="true">
          <img className="art" src={art('musical-notes')} alt="" />
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={track}
            className="ie-now-words"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.12 } }}
            transition={SPRING.pop}
          >
            <b>{t.name}</b>
            <small>{on ? t.mood : 'paused'}</small>
          </m.span>
        </AnimatePresence>
      </div>
      <div className="ie-controls">
        <m.button className="ie-round" onClick={() => step(-1)} aria-label="Previous track" {...PRESS}>
          <SkipBack weight="fill" />
        </m.button>
        <m.button className="ie-round big" onClick={() => setOn(!on)} aria-label={on ? 'Pause the music' : 'Play the music'} {...PRESS}>
          {on ? <Pause weight="fill" /> : <Play weight="fill" />}
        </m.button>
        <m.button className="ie-round" onClick={() => step(1)} aria-label="Next track" {...PRESS}>
          <SkipForward weight="fill" />
        </m.button>
      </div>
      <ul className="ie-tracks">
        {TRACKS.map((x, i) => (
          <li key={x.name}>
            <m.button className={`ie-track${i === track ? ' on' : ''}`} onClick={() => setTrack(i)} aria-pressed={i === track} {...PRESS}>
              <b>{x.name}</b>
              <small>{x.mood}</small>
            </m.button>
          </li>
        ))}
      </ul>
      <Row label="Music volume">
        <Range value={volume} min={0} max={100} step={5} set={setVolume} label="Music volume" show={`${volume}`} />
      </Row>
    </div>
  )
}

/** How to play on a touch screen, in the game's own words (its settings' controls list). */
const TOUCH: { art: ArtId; what: string; how: string }[] = [
  { art: 'running-shoe', what: 'Move', how: 'The stick comes to your thumb' },
  { art: 'person-running', what: 'Run', how: 'Push the stick past its ring' },
  { art: 'sparkles', what: 'Look', how: 'Drag the scene' },
  { art: 'basket', what: 'Do what is near you', how: 'The round button' },
  { art: 'house', what: 'Change the view', how: 'The button in the corner' },
]
function HelpPage() {
  return (
    <ul className="ie-help">
      {TOUCH.map((t) => (
        <li key={t.what}>
          <img className="art" src={art(t.art)} alt="" />
          <span>
            <b>{t.what}</b>
            {t.how}
          </span>
        </li>
      ))}
    </ul>
  )
}
