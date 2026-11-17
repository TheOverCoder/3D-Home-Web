import { AnimatePresence, m, type Variants } from 'motion/react'
import { Slider, Switch, Tabs, ToggleGroup } from 'radix-ui'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { assetStatus, usingPlaceholders } from '../assets/registry'
import { TRACKS, nextTrack, pauseMusic, playMusic, useMusic } from '../audio/music'
import { CREDITS } from '../data/credits'
import { PRODUCERS, START_COINS } from '../farm/data'
import { SLOTS, awaySummary, currentSlot, slotSummary, switchSlot, useFarm } from '../farm/state'
import { canVibrate, coarsePointer } from '../lib/device'
import { collectDiagnostics } from '../lib/diagnostics'
import { deviceLabel, lightModeAutomatic, profile, setLightMode } from '../lib/profile'
import { restartGraphics } from '../lib/startup'
import { clearGameFiles, persistStorage, storageInfo, type StorageInfo } from '../lib/sw'
import { mb } from '../lib/loader'
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../settings'
import { useHome } from '../store'
import { art, type ArtId } from './art'
import { ArrowRight, CaretLeft, Pause, Play, SkipBack, SkipForward, SpeakerSimpleHigh, SpeakerSimpleSlash } from './glyphs'
import { ItemPic } from './ItemPic'
import { GameName, Loading, useLoadView, type LoadView } from './Loading'
import { EASE, MotionRoot, PRESS, SPRING } from './motion'
import { LevelStar, SavesPanel } from './SavesPanel'
import './Intro.css'

// The way in (the design lab's boards "loading", B, and "intro", E). From the moment the page opens the loading screen
// (./Loading.tsx) tells how far the game has come; once it can take its first press, its moment plays and the opening
// menu takes its place over the farm itself: the game's name over a sun, a returning player's farm (its level, its
// coins, how long it has been and what waits on it, in pictures), and one paper card — the one big button (Continue,
// or New farm the first time; while the game loads again, the loading bar itself) and under it six tiles, each a
// picture and a word: New farm, Load farm, Settings, Music, How to play, Credits. A tile opens its page inside the same
// card, the menu sliding away to the left and the page in from the right (Back returns): New farm — a fresh farm in an
// empty place; Load farm — the saved farms (./SavesPanel.tsx); Settings — the game's own, in three tabs (picture,
// sound, controls) and what this device keeps; Music — the tracks the game composes as it plays; How to play;
// Credits. Continue sends the name up and the card down as the game comes in. Sideways: the name and your farm on the
// left, the card on the right, the whole height. When the house cannot start, the card says why, with what can be tried.
//
// What research on opening screens asks of it (the report of 2026-11-17): the one way in is the biggest thing on the
// card and stands apart from the rest (Apple, WWDC17 "Getting players into the game"); nothing makes a player wait
// who has seen it before — a tap or a key skips the loading screen's moment; the music, which starts with the first
// tap (browsers allow sound only after one), can be turned off in one press from the corner, where it says beforehand
// whether it will play; a page steps back with the phone's own Back, the browser's or Esc, never out of the game; and
// a returning player sees what waits on the farm on any ordinary phone, upright too.

type Page = 'menu' | 'new' | 'load' | 'settings' | 'music' | 'help' | 'credits'

/** How long the loading screen's moment plays (its house rolling in, the confetti) before the menu takes its place. */
const HANDOVER_MS = 1500

export function Intro() {
  const phase = useHome((s) => s.phase)
  return (
    <MotionRoot>
      <AnimatePresence>{phase === 'intro' && <Opening key="opening" />}</AnimatePresence>
    </MotionRoot>
  )
}

/** The loading screen until the game is ready (and a moment after), then the menu. */
function Opening() {
  const ready = useHome((s) => s.ready.scene && s.ready.env && s.ready.warm)
  const failure = useHome((s) => s.failure)
  // (read again only when the farm changes: reading the playing farm's summary saves it first)
  const rev = useFarm((s) => s.rev)
  const returning = useMemo(() => (void rev, slotSummary(currentSlot()).played), [rev])
  const v = useLoadView(ready, returning)
  // the menu, once shown, stays (a restart of the graphics from its settings loads again on its big button)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    if (menu || !ready) return
    const now = () => setMenu(true)
    const t = setTimeout(now, matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : HANDOVER_MS)
    // a tap, a click, Enter, Space or Esc skips the moment: whoever has seen it before goes straight on to the menu (on
    // the click, after the finger is up, so the menu coming in under it is never pressed by the same tap)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') now()
    }
    addEventListener('click', now)
    addEventListener('keydown', key)
    return () => {
      clearTimeout(t)
      removeEventListener('click', now)
      removeEventListener('keydown', key)
    }
  }, [ready, menu])
  const showMenu = menu || !!failure
  return (
    <m.div className="intro" exit={{ pointerEvents: 'none', transition: { duration: 0.6 } }}>
      <AnimatePresence>{showMenu ? <Menu key="menu" v={v} /> : <Loading key="loading" v={v} />}</AnimatePresence>
    </m.div>
  )
}

const TILES: { page: Exclude<Page, 'menu'>; art: ArtId; word: string }[] = [
  { page: 'new', art: 'seedling', word: 'New farm' },
  { page: 'load', art: 'floppy-disk', word: 'Load farm' },
  { page: 'settings', art: 'gear', word: 'Settings' },
  { page: 'music', art: 'musical-notes', word: 'Music' },
  { page: 'help', art: 'person-running', word: 'How to play' },
  { page: 'credits', art: 'sparkles', word: 'Credits' },
]
const TITLE: Record<Exclude<Page, 'menu'>, string> = { new: 'New farm', load: 'Load farm', settings: 'Settings', music: 'Music', help: 'How to play', credits: 'Credits' }
const MOST = 4

const POP = { hidden: { opacity: 0, scale: 0.4, y: 8 }, shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } } as const

/** The menu and a page trade places: the one going out slides away on the side it came from, the other comes in. */
const SLIDE: Variants = {
  enter: (paged: boolean) => ({ opacity: 0, x: paged ? 60 : -60 }),
  center: { opacity: 1, x: 0, transition: { ...SPRING.sheet, opacity: { duration: 0.18 } } },
  leave: (paged: boolean) => ({ opacity: 0, x: paged ? -60 : 60, transition: { duration: 0.16, ease: 'easeIn' } }),
}

/** The opening menu, over the farm. */
function Menu({ v }: { v: LoadView }) {
  const failure = useHome((s) => s.failure)
  const quality = useHome((s) => s.quality)
  const qualityAuto = useHome((s) => s.qualityAuto)
  const setPhase = useHome((s) => s.setPhase)
  const playing = useMusic((s) => s.playing)
  const rev = useFarm((s) => s.rev)
  const [page, setPage] = useState<Page>('menu')
  const [going, setGoing] = useState(false)
  const enter = useRef<HTMLButtonElement>(null)
  const slot = currentSlot()
  const all = useMemo(() => (void rev, SLOTS.map((n) => slotSummary(n))), [rev])
  const f = all.find((x) => x.slot === slot) ?? all[0]
  const back = f.played
  const farms = all.filter((x) => x.exists).length
  const paged = page !== 'menu'
  // once the house is ready, Enter / Space on a keyboard walks in (a touch screen has none: no focus ring round it there)
  useEffect(() => {
    if (v.ready && !failure && !paged && !coarsePointer) enter.current?.focus({ preventScroll: true })
  }, [v.ready, failure, paged])
  // a page is a step in the browser's history: the phone's Back (its button, or a swipe from the edge), the browser's
  // and Esc return to the menu, as the page's own Back does, instead of leaving the game
  useEffect(() => {
    if (!paged) return
    history.pushState({ intro: 'page' }, '')
    const pop = () => setPage('menu')
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') history.back()
    }
    addEventListener('popstate', pop)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('popstate', pop)
      removeEventListener('keydown', esc)
    }
  }, [paged])
  const toMenu = () => (history.state?.intro === 'page' ? history.back() : setPage('menu'))
  const go = () => {
    if (going || !v.ready || failure) return
    setGoing(true)
    void persistStorage(true)
    setPhase('playing')
  }
  // a farm chosen on a page: in, once the game can take it; until then back to the menu, whose button is the bar
  const playChosen = () => {
    if (v.ready && !failure) go()
    else setPage('menu')
  }
  return (
    <m.div
      className={`intro-menu${paged ? ' paged' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { delay: 0.3, duration: 0.25 } }}
      transition={{ duration: 0.3 }}
    >
      <span className="intro-wash" aria-hidden="true" />
      <div className="intro-motes" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} style={{ left: `${8 + i * 13}%`, animationDelay: `${-i * 1.9}s`, animationDuration: `${11 + (i % 3) * 3}s` }} />
        ))}
      </div>
      <m.span
        className="intro-sun"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={{ delay: 0.25, duration: 0.8, ease: EASE.out }}
      >
        <i />
      </m.span>
      <MusicToggle />
      <div className="intro-side">
        <m.div
          className="intro-logo"
          initial="hidden"
          animate="shown"
          exit="gone"
          variants={{ shown: { transition: { staggerChildren: 0.04, delayChildren: 0.16 } }, gone: { transition: { staggerChildren: 0.02 } } }}
        >
          <m.div
            className="intro-house"
            variants={{
              hidden: { opacity: 0, scale: 0.3, y: 30 },
              shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.soft },
              gone: { opacity: 0, y: -60, scale: 0.8, transition: { duration: 0.22, ease: 'easeIn' } },
            }}
          >
            <img className="art" src={art('house-with-garden')} alt="" width={116} height={116} />
          </m.div>
          <GameName line={back ? `Welcome back to Farm ${slot}` : 'A cosy house and farm'} />
        </m.div>
        {back && !failure && (
          <m.div
            className="intro-farm-wrap"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40, transition: { duration: 0.2 } }}
            transition={{ ...SPRING.sheet, delay: 0.2 }}
          >
            <FarmCard level={f.level} coins={f.coins} slot={slot} farms={farms} savedAt={f.savedAt} onLoad={() => setPage('load')} />
          </m.div>
        )}
      </div>
      <div className="intro-bottom">
        <m.div
          className="intro-card paper"
          layout
          style={{ borderRadius: 30 }}
          initial={{ opacity: 0, y: 70 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 90, transition: { duration: 0.24, ease: 'easeIn' } }}
          transition={{ ...SPRING.sheet, delay: 0.1, layout: SPRING.sheet }}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={paged}>
            {page === 'menu' ? (
              <m.div key="menu" className="intro-page-menu" layout="position" custom={paged} variants={SLIDE} initial="enter" animate="center" exit="leave">
                {failure && <Failure />}
                <GoButton ref={enter} back={back} slot={slot} v={v} failed={!!failure} going={going} onGo={go} />
                {v.ready && profile.light && lightModeAutomatic() && <p className="load-note intro-note">Light graphics are on: a start ran short of graphics memory here. Settings turn them off.</p>}
                {v.ready && v.offline && <p className="load-note intro-note">You are offline: playing from the copy kept on this device.</p>}
                <m.div className="intro-tiles" role="group" aria-label="Menu" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.035, delayChildren: 0.25 } } }}>
                  {TILES.filter((t) => back || t.page !== 'new').map((t) => (
                    <m.button key={t.page} className={`intro-tile${t.page === 'music' && playing ? ' on' : ''}`} variants={POP} onClick={() => setPage(t.page)} {...PRESS}>
                      <img className="art" src={art(t.art)} alt="" />
                      <span>{t.word}</span>
                      {t.page === 'music' && (
                        <span className="intro-eq" aria-label={playing ? 'playing' : 'off'}>
                          <i />
                          <i />
                          <i />
                        </span>
                      )}
                      {t.page === 'load' && farms > 1 && <b className="intro-tile-n">{farms}</b>}
                    </m.button>
                  ))}
                </m.div>
              </m.div>
            ) : (
              <m.section
                key={page}
                className={`intro-page intro-page-${page}`}
                layout="position"
                custom={paged}
                variants={SLIDE}
                initial="enter"
                animate="center"
                exit="leave"
                aria-label={TITLE[page]}
              >
                <header className="intro-page-head">
                  <m.button className="intro-back" onClick={toMenu} aria-label="Back to the menu" {...PRESS}>
                    <CaretLeft weight="bold" />
                  </m.button>
                  <img className="art" src={art(TILES.find((t) => t.page === page)!.art)} alt="" />
                  <h2>{TITLE[page]}</h2>
                </header>
                <div className="intro-page-body">
                  {page === 'new' && <NewFarm onStart={playChosen} onLoad={() => setPage('load')} />}
                  {page === 'load' && <SavesPanel onPlay={playChosen} />}
                  {page === 'settings' && <SettingsPage />}
                  {page === 'music' && <MusicPage />}
                  {page === 'help' && <HelpPage />}
                  {page === 'credits' && <CreditsPage />}
                </div>
              </m.section>
            )}
          </AnimatePresence>
        </m.div>
        <m.p className="intro-foot intro-device" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.5, duration: 0.3 }}>
          {deviceLabel()} · graphics {qualityAuto ? 'auto' : quality}
          {usingPlaceholders && ` · placeholders: ${[!assetStatus.house && 'house', !assetStatus.character && 'character', !assetStatus.hdri && 'HDRI'].filter(Boolean).join(', ')}`}
        </m.p>
      </div>
    </m.div>
  )
}

/** A returning player's farm: its level, its name, its coins, how long it has been, and what waits on it (the time away
 *  the farm has gone on for since it was saved: the "Welcome back" card tells it all once in). A touch opens Load farm. */
function FarmCard({ level, coins, slot, farms, savedAt, onLoad }: { level: number; coins: number; slot: number; farms: number; savedAt: number | null; onLoad: () => void }) {
  const w = awaySummary()
  const goods = w?.goods ?? []
  const more = goods.length - MOST
  const away = w ? w.seconds : savedAt ? (Date.now() - savedAt) / 1000 : 0
  return (
    <div className="intro-farm paper">
      <m.button className="intro-farm-name" onClick={onLoad} aria-label={`Farm ${slot}: load another farm`} {...PRESS}>
        <LevelStar level={level} />
        <span>
          <strong>Farm {slot}</strong>
          <small className={w ? 'intro-away' : ''}>{away >= 90 ? `${agoWords(away)} away` : `${farms} farm${farms === 1 ? '' : 's'}`}</small>
        </span>
      </m.button>
      <span className="tag intro-coins">
        <img src={art('coin')} alt="" />
        {coins.toLocaleString('en-US')}
      </span>
      {w && (goods.length > 0 || w.buyers > 0) && (
        <m.div className="intro-ready" aria-label="Waiting on your farm" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.045, delayChildren: 0.42 } } }}>
          {goods.slice(0, MOST).map((g) => (
            <m.span key={g.item} variants={POP}>
              <ItemPic id={g.item} count={g.count} />
            </m.span>
          ))}
          {more > 0 && (
            <m.span className="intro-more" variants={POP}>
              +{more}
            </m.span>
          )}
          {w.buyers > 0 && (
            <m.span className="item-pic intro-buyers" variants={POP} aria-label={`${w.buyers} buyers at the gate`}>
              <img className="art" src={art('people-queue')} alt="" />
              <b className="qty">{w.buyers}</b>
            </m.span>
          )}
        </m.div>
      )}
    </div>
  )
}

/** The music on or off in one press, in the corner. The music starts with the first tap anywhere (a browser allows sound
 *  only after one), so the corner says beforehand whether it will; a first tap on it turns it off before a note plays
 *  (the first tap's own start, ../audio/music.ts `wireMusic`, waits a moment and finds it off). */
function MusicToggle() {
  const on = useSettings((s) => s.music)
  const playing = useMusic((s) => s.playing)
  const stopped = useRef(false)
  return (
    <m.button
      className={`btn soft round intro-sound${on ? ' on' : ''}`}
      aria-label="Music"
      aria-pressed={on}
      title={on ? 'Music on' : 'Music off'}
      onPointerDown={() => {
        stopped.current = false
        if (!on || playing) return
        stopped.current = true
        useSettings.getState().update({ music: false })
      }}
      onClick={() => {
        if (stopped.current) stopped.current = false
        else if (on) pauseMusic()
        else playMusic()
      }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1, transition: { ...SPRING.pop, delay: 0.45 } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      {...PRESS}
    >
      {on ? <SpeakerSimpleHigh weight="fill" /> : <SpeakerSimpleSlash weight="fill" />}
    </m.button>
  )
}

/** How long, in a word or two: "25 min", "3 h", "2 days". */
function agoWords(seconds: number) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`
  const d = Math.round(seconds / 86400)
  return `${d} day${d === 1 ? '' : 's'}`
}

/** The big button: while the game loads, the loading bar itself; then Continue (your farm) or New farm (the first time). */
function GoButton({ ref, back, slot, v, failed, going, onGo }: { ref: React.Ref<HTMLButtonElement>; back: boolean; slot: number; v: LoadView; failed: boolean; going: boolean; onGo: () => void }) {
  const ready = v.ready && !failed
  return (
    <m.button
      ref={ref}
      className={`btn primary intro-go${going ? ' going' : ''}${ready ? '' : ' loading'}`}
      onClick={onGo}
      disabled={!ready}
      aria-label={failed ? 'Unavailable here' : !ready ? `Loading ${v.pct}%` : back ? `Continue · Farm ${slot}` : 'New farm'}
      whileTap={ready ? { scale: 0.95, y: 3 } : undefined}
      animate={going ? { scale: [0.95, 1.06, 1], transition: { duration: 0.3, ease: EASE.out } } : undefined}
      transition={SPRING.pop}
    >
      {!ready && !failed && <span className="intro-go-fill" style={{ width: `${v.p * 100}%` }} aria-hidden="true" />}
      <AnimatePresence mode="popLayout" initial={false}>
        {failed ? (
          <m.span key="failed" className="intro-go-words">
            Unavailable here
          </m.span>
        ) : ready ? (
          <m.span key="go" className="intro-go-words" initial={{ opacity: 0, scale: 0.5, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING.pop}>
            {back ? 'Continue' : 'New farm'}
            <ArrowRight weight="bold" />
          </m.span>
        ) : (
          <m.span key="load" className="intro-go-words" exit={{ opacity: 0, scale: 1.3, transition: { duration: 0.15 } }}>
            {v.again ? 'Lighter graphics' : 'Loading'} <b>{v.pct}%</b>
          </m.span>
        )}
      </AnimatePresence>
    </m.button>
  )
}

/** When the house cannot start: why, and what can be tried. */
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
        <button className="btn small" onClick={again}>
          Try again
        </button>
        {!profile.light && failure.kind !== 'network' && (
          <button
            className="btn soft small"
            onClick={() => {
              setLightMode(true)
              location.reload()
            }}
          >
            Try light graphics
          </button>
        )}
        <button
          className="btn soft small"
          onClick={() => {
            const text = `${failure.kind}: ${failure.detail ?? failure.message}\n\n${collectDiagnostics()}`
            void navigator.clipboard?.writeText(text).then(
              () => setCopied(true),
              () => setCopied(false),
            )
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

const ANIMAL = {
  hens: { art: 'chicken', say: (n: number) => `${n} hen${n === 1 ? '' : 's'}` },
  cows: { art: 'cow', say: (n: number) => (n === 1 ? 'a cow' : `${n} cows`) },
  sheep: { art: 'ewe', say: (n: number) => `${n} sheep` },
} as const

/** New farm: a fresh farm in the first empty place, and what it starts with. With every place taken, Load farm is where
 *  one is started afresh (a hold, never a tap). */
function NewFarm({ onStart, onLoad }: { onStart: () => void; onLoad: () => void }) {
  const empty = SLOTS.find((n) => !slotSummary(n).exists)
  // the animals a new farm starts with (their herds' first numbers)
  const animals = (['hens', 'cows', 'sheep'] as const).map((id) => ({ id, n: PRODUCERS[id].herd?.start ?? 0 })).filter((a) => a.n > 0)
  return (
    <div className="intro-new">
      <img className="art intro-new-pic" src={art('seedling')} alt="" />
      <p className="intro-new-where">{empty ? `A new farm in Farm ${empty}` : 'Every place holds a farm'}</p>
      <p className="intro-new-gives">
        <span className="tag">
          <img src={art('coin')} alt="" />
          {START_COINS} to start
        </span>
        {animals.map((a) => (
          <span key={a.id} className="tag">
            <img src={art(ANIMAL[a.id].art)} alt="" />
            {ANIMAL[a.id].say(a.n)}
          </span>
        ))}
      </p>
      {empty ? (
        <m.button
          className="btn primary intro-start"
          onClick={() => {
            switchSlot(empty)
            onStart()
          }}
          whileTap={{ scale: 0.95, y: 3 }}
          transition={SPRING.pop}
        >
          Start a new farm <ArrowRight weight="bold" />
        </m.button>
      ) : (
        <m.button className="btn soft intro-start" onClick={onLoad} {...PRESS}>
          Load farm: start one afresh
        </m.button>
      )}
    </div>
  )
}

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
function SettingsPage() {
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
          <Row label="Volume">
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
function MusicPage() {
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

/** How to play, in the game's own words: the touch controls on a touch screen, the keys on a computer. */
const TOUCH: { art: ArtId; what: string; how: string }[] = [
  { art: 'running-shoe', what: 'Move', how: 'The stick comes to your thumb' },
  { art: 'person-running', what: 'Run', how: 'Push the stick past its ring' },
  { art: 'sparkles', what: 'Look', how: 'Drag the scene' },
  { art: 'basket', what: 'Do what is near you', how: 'The round button' },
  { art: 'house', what: 'Change the view', how: 'The menu in the corner' },
]
const KEYS: { art: ArtId; what: string; how: string }[] = [
  { art: 'running-shoe', what: 'Move', how: 'W A S D · Shift to run · Space to jump' },
  { art: 'sparkles', what: 'Look', how: 'The mouse' },
  { art: 'basket', what: 'Do what is near you', how: 'E' },
  { art: 'house', what: 'Change the view', how: 'V · H for the top of the screen' },
  { art: 'gear', what: 'Settings', how: 'Esc' },
]
function HelpPage() {
  return (
    <ul className="intro-help">
      {(coarsePointer ? TOUCH : KEYS).map((t) => (
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

/** Who made what the game is built from (src/data/credits.ts), each with its licence. */
function CreditsPage() {
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
