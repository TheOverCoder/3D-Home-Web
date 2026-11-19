import { m, AnimatePresence, useAnimate } from 'motion/react'
import { ToggleGroup } from 'radix-ui'
import { useRef, useState, type ReactNode } from 'react'
import { PRODUCERS, START_COINS } from '../farm/data'
import { SLOTS, awaySummary, currentSlot, deleteSlot, exportSlot, freeUpSpace, importSlot, restoreCopy, saveState, slotSummary, switchSlot, useFarm, type Slot } from '../farm/state'
import { persistStorage } from '../lib/sw'
import { span } from '../lib/time'
import { art } from './art'
import { ArrowRight, DownloadSimple, UploadSimple } from './glyphs'
import { ItemPic } from './ItemPic'
import { EASE, PRESS, SINK, SPRING } from './motion'
import { useLessMotion } from './still'
import './SavesPanel.css'

// The farms kept on this device, three places (the design lab's board "saves", D): three tabs at the top — each farm
// with its level's star, a green dot on the one being played — and under them the chosen farm as a card of pictures
// with numbers (its level, its coins, the beds growing, its animals, "Playing now" on the one being played), then one
// big Play, and quieter its file (save it on the device, or load one into this place) and the hold to start it afresh:
// a fill runs across while the finger stays, and only a full hold clears a farm (a slip of the finger never loses
// one). An empty place says so in a picture and a chip (a new farm, with the coins it starts with). Sideways the card
// on the left, the presses on the right. Its moments: a tab — the highlight slides to it and the card turns over to
// that farm; Play — the house hops and the screen goes on into that farm; a full hold — the card turns to an empty place.
// A farm whose save could not be read says so, kept as it was (src/farm/state/save.ts: never written over until you
// choose): its big press loads the copy kept as its last visit began (its chip says when), or saves it as a file (the
// text as it was stored) when there is no copy; it can also be started afresh, or loaded from a file. A storage that is
// full says so, with a press that frees up space. The opening screen's "Load farm" page (./Intro.tsx).
//
// Here too the opening menu's other two pieces that read the farm: a returning player's farm card (`FarmCard`) and the
// New farm page (`NewFarm`). None of it is part of the page shell: the intro loads this module (and the farm with it) a
// moment after it paints, well before its menu shows (update-v1 decision 18).

/** A farm's level: the game's star with the number on it. */
export const LevelStar = ({ level, className = '' }: { level: number; className?: string }) => (
  <span className={`level-star ${className}`} aria-label={`Level ${level}`}>
    <img className="art" src={art('glowing-star')} alt="" />
    <b>{level}</b>
  </span>
)

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

/** The saved farms (the opening screen's Load farm page). `onPlay`: a farm chosen to play (it is the current one
 *  already: switched to, or started). */
export function SavesPanel({ onPlay }: { onPlay: () => void }) {
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
            <m.button className="btn primary saves-go" {...SINK} onClick={f.copy ? loadCopy : saveFile}>
              {f.copy ? 'Load the copy' : 'Save as file'}
              {f.copy ? <ArrowRight weight="bold" /> : <DownloadSimple weight="bold" />}
            </m.button>
          ) : (
            <m.button className="btn primary saves-go" {...SINK} onClick={play}>
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

const POP = { hidden: { opacity: 0, scale: 0.4, y: 8 }, shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } } as const
/** The goods a returning player's farm card shows at most (then +N). */
const MOST = 4

/** A returning player's farm, in the opening menu: its level, its name, its coins, how long it has been, and what waits
 *  on it (the time away the farm has gone on for since it was saved: the "Welcome back" card tells it all once in). A
 *  touch opens Load farm. */
export function FarmCard({ onLoad }: { onLoad: () => void }) {
  useFarm((s) => s.rev)
  const slot = currentSlot()
  const f = slotSummary(slot)
  const farms = SLOTS.filter((n) => slotSummary(n).exists).length
  const w = awaySummary()
  const goods = w?.goods ?? []
  const more = goods.length - MOST
  const away = w ? w.seconds : f.savedAt ? (Date.now() - f.savedAt) / 1000 : 0
  return (
    <div className="intro-farm paper">
      <m.button className="intro-farm-name" onClick={onLoad} aria-label={`Farm ${slot}: load another farm`} {...PRESS}>
        <LevelStar level={f.level} />
        <span>
          <strong>Farm {slot}</strong>
          <small className={w ? 'intro-away' : ''}>{away >= 90 ? `${span(away)} away` : `${farms} farm${farms === 1 ? '' : 's'}`}</small>
        </span>
      </m.button>
      <span className="tag intro-coins">
        <img src={art('coin')} alt="" />
        {f.coins.toLocaleString('en-US')}
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

const ANIMAL = {
  hens: { art: 'chicken', say: (n: number) => `${n} hen${n === 1 ? '' : 's'}` },
  cows: { art: 'cow', say: (n: number) => (n === 1 ? 'a cow' : `${n} cows`) },
  sheep: { art: 'ewe', say: (n: number) => `${n} sheep` },
} as const

/** New farm: a fresh farm in the first empty place, and what it starts with. With every place taken, Load farm is where
 *  one is started afresh (a hold, never a tap). */
export function NewFarm({ onStart, onLoad }: { onStart: () => void; onLoad: () => void }) {
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
          {...SINK}
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
