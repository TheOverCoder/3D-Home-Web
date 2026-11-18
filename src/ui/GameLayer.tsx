import { AnimatePresence, m, useAnimate } from 'motion/react'
import { useLessMotion } from './still'
import { ToggleGroup } from 'radix-ui'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { SoundDirector } from '../audio/SoundDirector'
import { FarmUI } from '../farm/FarmUI'
import { SLOTS, currentSlot, deleteSlot, exportSlot, freeUpSpace, importSlot, restoreCopy, saveState, saveWords, slotSummary, switchSlot, useFarm, type Slot } from '../farm/state'
import { debugSet } from '../lib/debug'
import { coarsePointer } from '../lib/device'
import { persistStorage } from '../lib/sw'
import { span } from '../lib/time'
import { useHome } from '../store'
import { art } from './art'
import { cardShowing, visitNow } from './cardQueue'
import { Curtain } from './Curtain'
import { FilmLayer } from './FilmLayer'
import { ArrowRight, DownloadSimple, UploadSimple } from './glyphs'
import { GraphicsNotice } from './GraphicsNotice'
import { Hud } from './Hud'
import { HudMode } from './HudMode'
import { EASE, PRESS, SPRING } from './motion'
import { guardHooks, PanelGuard } from './PanelGuard'
import { PhotoButton } from './PhotoButton'
import { LevelStar } from './SavesPanel'
import { ScreenModal } from './ScreenModal'
import { SettingsPanel } from './SettingsPanel'
import { gameFree, useGameFree } from './useGameFree'
import './SavesPanel.css'

// What loads behind the start screen: the game's interface, everything drawn over the scene while you play (the sounds'
// director, the HUD and the farm's panels, the touch controls, a screen open, the curtain, a film, the settings; over
// the intro's place, the notice when the browser reset the graphics, the corner menu and the photo button), and the
// opening menu's list of saved farms (`SavesList`, below). None of it is in the page shell: the intro shows before it
// has downloaded (src/App.tsx imports it lazily, once the loader has fetched it with the scene's files; the scene waits
// for it too, so the game's button never comes before it). Each part that can throw is guarded (./PanelGuard.tsx): what
// is open closes, a layer is left out a moment, and the game plays on. Two parts of the page, so that it keeps its
// order: this one under the intro, the corner over it.

// The on-screen stick comes from ecctrl, which is part of the 3D bundle: imported on touch screens only, and lazily, so
// this layer never waits for the 3D engine to download.
const TouchControls = lazy(() => import('./TouchControls').then((m) => ({ default: m.TouchControls })))

// (?debug) a part of the interface that throws, on purpose (./PanelGuard.tsx); the cards that open by themselves
// (./cardQueue.ts): this visit, the card showing, whether the game is free; how the save stands (src/farm/state/save.ts:
// the farm could not be read, the storage is full, another tab has it) and what the saves list does about it. Here with
// the interface they are about, which is in before the game can be entered
debugSet('guard', guardHooks)
debugSet('cards', { visit: visitNow, showing: cardShowing, free: () => gameFree() })
debugSet('saves', { state: saveState, restoreCopy, freeUpSpace })

/** The screen open (the television, a computer): if it throws, it closes. */
function ScreenSlot() {
  const screen = useHome((s) => s.screen)
  return (
    <PanelGuard name={screen ? `screen:${screen}` : ''} close={useHome.getState().closeScreen}>
      <ScreenModal />
    </PanelGuard>
  )
}

/** The settings: if they throw, they close. */
function SettingsSlot() {
  const open = useHome((s) => s.settingsOpen)
  return (
    <PanelGuard name={open ? 'settings' : ''} close={() => useHome.getState().setSettingsOpen(false)}>
      <SettingsPanel />
    </PanelGuard>
  )
}

/** How long the game is free before the save's words are said (ms): the world first, then the word, as the cards that
 *  open by themselves wait (./useGameFree.ts). */
const SAY_AFTER_MS = 900

/** What the player is told about the save, once a visit each, as the game is played with nothing over it: the farm
 *  could not be read (it is kept as it was, and the saves list has it), or the storage is full (the saves list frees up
 *  space). */
function SaveWords() {
  const free = useGameFree()
  const trouble = useFarm(() => {
    const s = saveState()
    return s.held ? 'held' : s.full ? 'full' : ''
  })
  useEffect(() => {
    if (!free || !trouble) return
    const t = window.setTimeout(() => {
      const words = saveWords()
      if (words) useHome.getState().showToast(words, 'floppy-disk')
    }, SAY_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [free, trouble])
  return null
}

/** The game's interface under the intro: the HUD, the farm's panels, the controls, a screen, the curtain, a film and
 *  the settings. */
export function GameLayer() {
  return (
    <>
      <SoundDirector />
      <PanelGuard name="hud" layer>
        <Hud />
      </PanelGuard>
      <FarmUI />
      {coarsePointer && (
        <PanelGuard name="touch" layer>
          <Suspense fallback={null}>
            <TouchControls />
          </Suspense>
        </PanelGuard>
      )}
      <ScreenSlot />
      <Curtain />
      <FilmLayer />
      <SettingsSlot />
      <SaveWords />
    </>
  )
}

/** Over the intro's place: what the graphics are doing when the browser reset them; the game's corner menu, and the
 *  photo button in the clear view. */
export function GameCorner() {
  return (
    <>
      <GraphicsNotice />
      <PanelGuard name="corner" layer>
        <HudMode />
      </PanelGuard>
      <PanelGuard name="photo" layer>
        <PhotoButton />
      </PanelGuard>
    </>
  )
}

// ─── The saved farms: the opening screen's Load farm page (./SavesPanel.tsx says what it shows). Here rather than there so
// that the page shell holds only its door, and the list comes with the rest of the interface. ───

/** How long ago, in a word or two. */
function ago(t: number | null) {
  if (!t) return ''
  const s = (Date.now() - t) / 1000
  return s < 90 ? 'just now' : `${span(s)} ago`
}

/** When a copy was saved: its time today, else its date. */
function when(t: number) {
  const d = new Date(t)
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** The saved farms (./SavesPanel.tsx, the opening screen's Load farm page). `onPlay`: a farm chosen to play (it is the
 *  current one already: switched to, or started). */
export function SavesList({ onPlay }: { onPlay: () => void }) {
  useFarm((s) => s.rev)
  const current = currentSlot()
  const [pick, setPick] = useState<Slot>(current)
  const [going, setGoing] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const farms = SLOTS.map((n) => slotSummary(n))
  const f = farms.find((x) => x.slot === pick) ?? farms[0]
  const here = f.slot === current
  const { full } = saveState()

  const play = () => {
    if (going) return
    setGoing(true)
    if (!here) switchSlot(f.slot)
    setTimeout(onPlay, 320)
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const got = e.target.files?.[0]
    e.target.value = ''
    if (!got) return
    const result = importSlot(f.slot, await got.text())
    setNote(result.ok ? { ok: true, text: `Farm ${f.slot} loaded from “${got.name}”.` } : { ok: false, text: result.error })
    if (result.ok) void persistStorage(true)
  }
  const saveFile = () => {
    const out = exportSlot(f.slot)
    download(out.name, out.text)
    setNote({ ok: true, text: `Saved Farm ${f.slot} as ${out.name}.` })
    void persistStorage(true)
  }
  const loadCopy = () => {
    const result = restoreCopy(f.slot)
    setNote(result.ok ? { ok: true, text: `Farm ${f.slot} is back as it was then.` } : { ok: false, text: result.error })
  }

  return (
    <div className="saves">
      <ToggleGroup.Root
        className="saves-tabs slots"
        type="single"
        value={String(pick)}
        onValueChange={(v) => {
          if (!v) return
          setPick(Number(v) as Slot)
          setNote(null)
        }}
        aria-label="Your farms"
      >
        {farms.map((x) => (
          <ToggleGroup.Item
            key={x.slot}
            value={String(x.slot)}
            className={`saves-tab slot${x.slot === current ? ' current' : ''}`}
            aria-label={`Farm ${x.slot}${x.slot === current ? ', playing' : ''}`}
          >
            {x.slot === pick && <m.span className="saves-tab-on" layoutId="saves-tab-on" transition={SPRING.pop} />}
            <span className="saves-tab-in">
              {x.broken ? <img className="art saves-seed" src={art('warning')} alt="" /> : x.exists ? <LevelStar level={x.level} /> : <img className="art saves-seed" src={art('seedling')} alt="" />}
              <b>Farm {x.slot}</b>
              {x.slot === current && <i className="saves-dot" />}
            </span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <div className="saves-body">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.section
            key={`${f.slot}-${f.exists}-${!!f.broken}`}
            className={`saves-card${f.exists && !f.broken ? '' : ' empty'}`}
            initial={{ opacity: 0, rotateY: -40 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 40 }}
            transition={{ duration: 0.28, ease: EASE.out }}
            style={{ transformPerspective: 800 }}
            aria-label={`Farm ${f.slot}`}
          >
            <m.span className="saves-pic-wrap" animate={going ? { y: [0, -18, 0], scale: [1, 1.08, 1] } : undefined} transition={{ duration: 0.32, ease: EASE.out }}>
              <img className="art saves-pic" src={art(f.broken ? 'warning' : f.exists ? 'house-with-garden' : 'seedling')} alt="" />
            </m.span>
            {f.broken ? (
              <div className="saves-empty">
                <b>This farm could not be read</b>
                <span className="tag">{f.copy?.savedAt ? `A copy from ${when(f.copy.savedAt)}` : 'Kept as it was'}</span>
              </div>
            ) : f.exists ? (
              <>
                <p className="saves-when">
                  {here && <span className="tag ok saves-now">Playing now</span>}
                  {f.savedAt ? `Played ${ago(f.savedAt)}` : 'Not played yet'}
                </p>
                <ul className="saves-stats">
                  <li>
                    <LevelStar level={f.level} />
                    <span>
                      <b>{f.level}</b> level
                    </span>
                  </li>
                  <li>
                    <img className="art" src={art('coin')} alt="" />
                    <span>
                      <b>{f.coins.toLocaleString('en-US')}</b> coins
                    </span>
                  </li>
                  <li>
                    <img className="art" src={art('seedling')} alt="" />
                    <span>
                      <b>{f.growing}</b> beds growing
                    </span>
                  </li>
                  <li>
                    <img className="art" src={art('chicken')} alt="" />
                    <span>
                      <b>{f.animals}</b> animals
                    </span>
                  </li>
                </ul>
              </>
            ) : (
              <div className="saves-empty">
                <b>An empty place</b>
                <span className="tag">
                  <img src={art('coin')} alt="" />
                  {f.coins} to start a new farm
                </span>
              </div>
            )}
          </m.section>
        </AnimatePresence>
        <div className="saves-acts">
          {f.broken ? (
            <m.button className="btn primary saves-go" whileTap={{ scale: 0.96, y: 3 }} transition={SPRING.pop} onClick={f.copy ? loadCopy : saveFile}>
              {f.copy ? 'Load the copy' : 'Save as file'}
              {f.copy ? <ArrowRight weight="bold" /> : <DownloadSimple weight="bold" />}
            </m.button>
          ) : (
            <m.button className="btn primary saves-go" whileTap={{ scale: 0.96, y: 3 }} transition={SPRING.pop} onClick={play}>
              {f.exists ? (here ? 'Keep playing' : `Play Farm ${f.slot}`) : 'Start this farm'}
              <ArrowRight weight="bold" />
            </m.button>
          )}
          <div className="saves-quiet">
            <m.button className="btn soft small" disabled={!f.exists && !here} {...PRESS} onClick={saveFile}>
              <DownloadSimple weight="bold" /> Save file
            </m.button>
            <m.button className="btn soft small" {...PRESS} onClick={() => file.current?.click()}>
              <UploadSimple weight="bold" /> Load file
            </m.button>
          </div>
          {f.exists && (
            <HoldToClear
              label={`Hold to start Farm ${f.slot} afresh`}
              onDone={() => {
                deleteSlot(f.slot)
                setNote({ ok: true, text: `Farm ${f.slot} starts afresh.` })
              }}
            >
              Hold to start afresh
            </HoldToClear>
          )}
          {full && !note && (
            <>
              <p className="saves-note" role="status">
                The storage is full: the farm is not being saved.
              </p>
              <m.button
                className="btn soft small"
                {...PRESS}
                onClick={() => setNote(freeUpSpace() ? { ok: true, text: 'Space made: the farm is saved again.' } : { ok: false, text: 'Still full: a farm started afresh frees more.' })}
              >
                Free up space
              </m.button>
            </>
          )}
          {note && (
            <p className={`saves-note${note.ok ? ' ok' : ''}`} role="status">
              {note.text}
            </p>
          )}
        </div>
      </div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
    </div>
  )
}

/**
 * Hold to start a farm afresh: a fill runs across the button while the finger stays on it (1.2 s), and goes back if it
 * lifts early. Reduced motion: the same hold, the fill without its glide back.
 */
export function HoldToClear({ onDone, label, children }: { onDone: () => void; label: string; children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLButtonElement>()
  const still = useLessMotion()
  const [held, setHeld] = useState(false)
  const run = useRef<ReturnType<typeof animate> | null>(null)
  const start = () => {
    setHeld(true)
    const r = animate('.hold-fill', { scaleX: [0, 1] }, { duration: 1.2, ease: 'linear' })
    run.current = r
    void r.then(() => {
      // a full hold (a hold let go early is stopped, and never gets here as the one running)
      if (run.current !== r || !scope.current) return
      run.current = null
      setHeld(false)
      void animate('.hold-fill', { scaleX: 0 }, { duration: 0 })
      onDone()
    })
  }
  const stop = () => {
    if (!held) return
    const r = run.current
    run.current = null
    r?.stop()
    setHeld(false)
    void animate('.hold-fill', { scaleX: 0 }, { duration: still ? 0 : 0.25, ease: EASE.out })
  }
  return (
    <button
      ref={scope}
      className={`btn soft hold-clear${held ? ' held' : ''}`}
      aria-label={label}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && !held && start()}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-words">{held ? 'Keep holding…' : children}</span>
    </button>
  )
}
