import { AnimatePresence, m, type Variants } from 'motion/react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from 'react'
import { assetStatus, usingPlaceholders } from '../assets/registry'
import { pauseMusic, playMusic, useMusic } from '../audio/music'
import { coarsePointer } from '../lib/device'
import { collectDiagnostics } from '../lib/diagnostics'
import { deviceLabel, lightModeAutomatic, profile, setLightMode } from '../lib/profile'
import { amount, field, isObject } from '../lib/saved'
import { restartGraphics } from '../lib/startup'
import { persistStorage } from '../lib/sw'
import { useSettings } from '../settings'
import { useHome } from '../store'
import { art, type ArtId } from './art'
import { ArrowRight, CaretLeft, SpeakerSimpleHigh, SpeakerSimpleSlash } from './glyphs'
import { GameName, Loading, useLoadView, useSettled, type LoadView } from './Loading'
import { EASE, MotionRoot, PRESS, SPRING } from './motion'
import { lessMotion } from './still'
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

// What the page shell holds of all this (update-v1 decision 18: 160 KB): the loading screen, the menu and the pages
// with nothing to load. The farm is not part of it: its code and the slot it reads (src/farm/state.ts) come a moment
// after the intro paints (src/App.tsx: `loadFarm`), with the pieces of the menu that read the farm — a returning
// player's card, Load farm and New farm (./SavesPanel.tsx) — and the pages built with Radix's controls, Settings and
// Music, with Credits (./IntroPages.tsx). Until the farm is in, the loading screen tells a returning player from a
// new one by reading the slot as stored (`lightSummary`); the farm's own summaries take over once it is in.

type Page = 'menu' | 'new' | 'load' | 'settings' | 'music' | 'help' | 'credits'

type FarmModule = typeof import('../farm/state')
let farmModule: FarmModule | null = null
let farmLoad: Promise<FarmModule> | null = null
const farmListeners = new Set<() => void>()
let resolveFarm: (m: FarmModule) => void = () => {}
/** Resolves once the farm is in (`loadFarm`). */
export const farmIn = new Promise<FarmModule>((resolve) => (resolveFarm = resolve))

/** Brings the farm in (once): its code and the slot this device played last, read and made safe (src/farm/state.ts).
 *  The scene and the game's interface bring it too; this is the intro's door to it. */
export function loadFarm(): Promise<FarmModule> {
  farmLoad ??= import('../farm/state').then((m) => {
    farmModule = m
    resolveFarm(m)
    for (const f of farmListeners) f()
    return m
  })
  return farmLoad
}
const onFarmIn = (f: () => void) => {
  farmListeners.add(f)
  return () => farmListeners.delete(f)
}
const noFarm = () => () => {}

/** The farm once it is in (null until then), and its revision: what reads it is read again as it changes. */
function useFarmNow(): { farm: FarmModule | null; rev: number } {
  const farm = useSyncExternalStore(onFarmIn, () => farmModule)
  const rev = useSyncExternalStore(farm ? farm.useFarm.subscribe : noFarm, () => (farm ? farm.useFarm.getState().rev : -1))
  return { farm, rev }
}

/** The places farms are kept in, as src/farm/state/save.ts keeps them (`SLOTS`, the keys below: Intro.test.ts holds the
 *  two to each other). */
export const FARM_SLOTS = [1, 2, 3] as const
const SLOT_KEY = '3d-home:slot:v1'
const keyFor = (slot: number) => (slot === 1 ? '3d-home:farm:v1' : `3d-home:farm:v1:slot${slot}`)
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
/** The place this device played last, read as stored. */
export function lightSlot(): number {
  const n = Number(stored(SLOT_KEY))
  return (FARM_SLOTS as readonly number[]).includes(n) ? n : 1
}
/** What a place holds, read lightly before the farm is in: whether it holds a farm, and whether that farm has been
 *  played (something planted, harvested or sold: a brand-new one says "New farm", not "Continue") — as the farm's own
 *  `slotSummary` tells them. */
export function lightSummary(slot: number): { slot: number; exists: boolean; played: boolean } {
  const text = stored(keyFor(slot))
  if (!text) return { slot, exists: false, played: false }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { slot, exists: true, played: false }
  }
  if (!isObject(raw)) return { slot, exists: true, played: false }
  const stats = field(raw, 'stats')
  return { slot, exists: true, played: !!raw.started || amount(field(stats, 'sold'), 0) > 0 || amount(field(stats, 'harvested'), 0) > 0 }
}

/** A page of the menu that loads with what it needs; one that did not download draws nothing. */
function later<P>(load: () => Promise<Record<string, unknown>>, name: string) {
  return lazy<ComponentType<P>>(() =>
    load().then(
      (m) => ({ default: m[name] as ComponentType<P> }),
      () => ({ default: () => null }),
    ),
  )
}
const saves = () => loadFarm().then(() => import('./SavesPanel'))
const pages = () => import('./IntroPages')
const SavesPanel = later<{ onPlay: () => void }>(saves, 'SavesPanel')
const FarmCard = later<{ onLoad: () => void }>(saves, 'FarmCard')
const NewFarm = later<{ onStart: () => void; onLoad: () => void }>(saves, 'NewFarm')
const SettingsPage = later<object>(pages, 'SettingsPage')
const MusicPage = later<object>(pages, 'MusicPage')
const CreditsPage = later<object>(pages, 'CreditsPage')
/** Everything the menu's pages need, fetched once the intro has painted (the farm with them), so a tile opens at once. */
const fetchPages = () => Promise.all([saves(), pages()]).catch(() => {})

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
  // (settled: a couple of frames after the game is ready, once its heaviest first frames have passed)
  const ready = useSettled(useHome((s) => s.ready.scene && s.ready.env && s.ready.warm))
  const failure = useHome((s) => s.failure)
  // (read again only when the farm changes: reading the playing farm's summary saves it first; until the farm is in, its
  // place as stored)
  const { farm, rev } = useFarmNow()
  const returning = useMemo(() => (void rev, farm ? farm.slotSummary(farm.currentSlot()).played : lightSummary(lightSlot()).played), [farm, rev])
  const v = useLoadView(ready, returning)
  // the menu's pages, once the intro has painted
  useEffect(() => {
    const t = setTimeout(() => void fetchPages())
    return () => clearTimeout(t)
  }, [])
  // the menu, once shown, stays (a restart of the graphics from its settings loads again on its big button)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    if (menu || !ready) return
    const now = () => setMenu(true)
    const t = setTimeout(now, lessMotion() ? 300 : HANDOVER_MS)
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
  const { farm, rev } = useFarmNow()
  const [page, setPage] = useState<Page>('menu')
  const [going, setGoing] = useState(false)
  const enter = useRef<HTMLButtonElement>(null)
  // the farms as the farm tells them, or as stored until it is in
  const slot = farm ? farm.currentSlot() : lightSlot()
  const all = useMemo(() => (void rev, FARM_SLOTS.map((n) => (farm ? farm.slotSummary(n) : lightSummary(n)))), [farm, rev])
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
            <Suspense fallback={null}>
              <FarmCard onLoad={() => setPage('load')} />
            </Suspense>
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
                  <Suspense fallback={null}>
                    {page === 'new' && <NewFarm onStart={playChosen} onLoad={() => setPage('load')} />}
                    {page === 'load' && <SavesPanel onPlay={playChosen} />}
                    {page === 'settings' && <SettingsPage />}
                    {page === 'music' && <MusicPage />}
                    {page === 'help' && <HelpPage />}
                    {page === 'credits' && <CreditsPage />}
                  </Suspense>
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
