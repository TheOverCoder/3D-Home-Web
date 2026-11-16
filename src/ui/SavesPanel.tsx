import { AnimatePresence, m, useAnimate, useReducedMotion } from 'motion/react'
import { ToggleGroup } from 'radix-ui'
import { useRef, useState, type ReactNode } from 'react'
import { SLOTS, currentSlot, deleteSlot, exportSlot, importSlot, slotSummary, switchSlot, useFarm, type Slot } from '../farm/state'
import { persistStorage } from '../lib/sw'
import { art } from './art'
import { ArrowRight, DownloadSimple, UploadSimple } from './glyphs'
import { EASE, PRESS, SPRING } from './motion'
import './SavesPanel.css'

// The farms kept on this device, three places (the design lab's board "saves", D): three tabs at the top — each farm
// with its level's star, a green dot on the one being played — and under them the chosen farm as a card of pictures
// with numbers (its level, its coins, the beds growing, its animals, "Playing now" on the one being played), then one
// big Play, and quieter its file (save it on the device, or load one into this place) and the hold to start it afresh:
// a fill runs across while the finger stays, and only a full hold clears a farm (a slip of the finger never loses
// one). An empty place says so in a picture and a chip (a new farm, with the coins it starts with). Sideways the card
// on the left, the presses on the right. Its moments: a tab — the highlight slides to it and the card turns over to
// that farm; Play — the house hops and the screen goes on into that farm; a full hold — the card turns to an empty place.
// The opening screen's "Load farm" page (./Intro.tsx).

/** How long ago, in a word or two. */
function ago(t: number | null) {
  if (!t) return ''
  const s = (Date.now() - t) / 1000
  if (s < 90) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  const d = Math.round(s / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
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

/** A farm's level: the game's star with the number on it. */
export const LevelStar = ({ level, className = '' }: { level: number; className?: string }) => (
  <span className={`level-star ${className}`} aria-label={`Level ${level}`}>
    <img className="art" src={art('glowing-star')} alt="" />
    <b>{level}</b>
  </span>
)

/** The saved farms. `onPlay`: a farm chosen to play (it is the current one already: switched to, or started). */
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
              {x.exists ? <LevelStar level={x.level} /> : <img className="art saves-seed" src={art('seedling')} alt="" />}
              <b>Farm {x.slot}</b>
              {x.slot === current && <i className="saves-dot" />}
            </span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <div className="saves-body">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.section
            key={`${f.slot}-${f.exists}`}
            className={`saves-card${f.exists ? '' : ' empty'}`}
            initial={{ opacity: 0, rotateY: -40 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 40 }}
            transition={{ duration: 0.28, ease: EASE.out }}
            style={{ transformPerspective: 800 }}
            aria-label={`Farm ${f.slot}`}
          >
            <m.span className="saves-pic-wrap" animate={going ? { y: [0, -18, 0], scale: [1, 1.08, 1] } : undefined} transition={{ duration: 0.32, ease: EASE.out }}>
              <img className="art saves-pic" src={art(f.exists ? 'house-with-garden' : 'seedling')} alt="" />
            </m.span>
            {f.exists ? (
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
          <m.button className="btn primary saves-go" whileTap={{ scale: 0.96, y: 3 }} transition={SPRING.pop} onClick={play}>
            {f.exists ? (here ? 'Keep playing' : `Play Farm ${f.slot}`) : 'Start this farm'}
            <ArrowRight weight="bold" />
          </m.button>
          <div className="saves-quiet">
            <m.button
              className="btn soft small"
              disabled={!f.exists && !here}
              {...PRESS}
              onClick={() => {
                const out = exportSlot(f.slot)
                download(out.name, out.text)
                setNote({ ok: true, text: `Saved Farm ${f.slot} as ${out.name}.` })
                void persistStorage(true)
              }}
            >
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
  const still = useReducedMotion()
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
