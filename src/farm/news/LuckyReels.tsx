import { animate, m, useMotionValue, type AnimationPlaybackControls } from 'motion/react'
import { useLessMotion } from '../../ui/still'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { art } from '../../ui/art'
import { burst } from '../../ui/burst'
import { SINK, SPRING } from '../../ui/motion'
import { produceById, type ProduceId } from '../data'
import { iconUrl } from '../icons'
import { GoodPic } from '../../ui/GoodPic'

// The lucky draw's machine (the farm news, ./NewsCard.tsx): two reels, one for each good it gives. At rest each shows a
// "?" card with goods of the pool peeking above and below it; one tap on Draw and the farm draws (the goods are decided
// before anything moves: what the reels show is what was drawn), the bulbs chase, each reel winds up a hair, spins
// through the goods the draw picks from and slows into its good with a little overshoot — the first, then the second
// (a tick under the finger as each lands, its ×2 stamp slams on) — and once both are in, one burst of confetti and the
// gift's sound. A tap on the reels while they spin lands them at once. Opened again on the same day: the two goods,
// still. Less motion: no spin, the goods at once.

/** A reel's cell and window, in px (./NewsCard.css). */
const CELL = 64
const WINDOW = 128
const MID = (WINDOW - CELL) / 2
/** The y that puts cell `i` in the middle of the window. */
const yFor = (i: number) => MID - i * CELL

/** How long each reel spins (the second lands after the first). */
const SPIN_S = [1.45, 2.05]
/** How many cells each spins through before its good. */
const FILL = [14, 20]

type Cell = ProduceId | '?'
/** At rest (the "?"), spinning into its good (and staying there), or shown as it was drawn before the card opened. */
type Mode = 'rest' | 'spin' | 'shown'
type Phase = 'idle' | 'spin' | 'done'

const at = <T,>(list: readonly T[], i: number) => list[((i % list.length) + list.length) % list.length]

/**
 * A reel's cells, top to bottom, and the one in the middle at first. At rest: a good of the pool, the "?", another.
 * Spinning: the one above its good, its good, the goods it spins through (never its good next to it), the "?" it starts
 * from and the one under it — the "?" and its neighbours as they stood at rest, so nothing jumps as it starts. Shown:
 * its good between two others.
 */
function cellsOf(pool: readonly ProduceId[], k: number, good: ProduceId | null, mode: Mode): { cells: Cell[]; from: number } {
  const p = pool.length ? pool : (['egg'] as ProduceId[])
  const above = at(p, 2 * k)
  const below = at(p, 2 * k + 1)
  if (!good || mode === 'rest') return { cells: [above, '?', below], from: 1 }
  const other = (i: number) => {
    const c = at(p, i)
    return c === good && p.length > 1 ? at(p, i + 1) : c
  }
  if (mode === 'shown') return { cells: [other(k + 3), good, other(k + 4)], from: 1 }
  // the goods it runs through, from the "?" up: the first is the one that stood above it at rest
  const fill: Cell[] = Array.from({ length: FILL[k] }, (_, i) => (i === 0 ? above : other(2 * k + 3 + i)))
  const cells: Cell[] = [other(k + 5), good, ...fill.reverse(), '?', below]
  return { cells, from: cells.length - 2 }
}

function Reel({
  k,
  pool,
  good,
  mode,
  landed,
  skip,
  onStop,
}: {
  k: number
  pool: readonly ProduceId[]
  good: ProduceId | null
  mode: Mode
  landed: boolean
  skip: number
  onStop: (k: number) => void
}) {
  const still = useLessMotion()
  const { cells, from } = useMemo(() => cellsOf(pool, k, good, mode), [pool, k, good, mode])
  const y = useMotionValue(yFor(from))
  const run = useRef<AnimationPlaybackControls | null>(null)
  const stop = useRef(onStop)
  stop.current = onStop
  // before the frame is drawn: the strip where it starts (at rest, the "?"; spinning, the same "?" further down it)
  useLayoutEffect(() => {
    y.set(yFor(from))
    if (mode !== 'spin') return
    let gone = false
    const land = () => !gone && stop.current(k)
    const to = yFor(1)
    if (still) {
      y.set(to)
      land()
      return () => void (gone = true)
    }
    // a wind-up against the spin, the run through the goods slowing into its good, a little past it and back
    const a = animate(y, [yFor(from), yFor(from) - 12, to + 12, to], { duration: SPIN_S[k] ?? SPIN_S[1], times: [0, 0.07, 0.9, 1], ease: ['easeOut', [0.3, 0.08, 0.12, 1], 'easeInOut'] })
    run.current = a
    void a.then(land)
    return () => {
      gone = true
      a.stop()
    }
  }, [mode, from, still, y, k])
  // a tap on the reels while they spin: they land at once
  useEffect(() => {
    if (skip && mode === 'spin') run.current?.complete()
  }, [skip, mode])
  return (
    <span className="nw-window">
      <m.span className="nw-strip" style={{ y }}>
        {cells.map((c, i) =>
          c === '?' ? (
            <span key={i} className="nw-cell ask">
              <b>?</b>
            </span>
          ) : (
            <span key={i} className={`nw-cell${i === 1 && landed ? ' won' : ''}`}>
              {/* once the reels stop, the good drawn says where it is made (a tap: src/ui/GoodPic.tsx) */}
              {i === 1 && landed ? <GoodPic good={c as ProduceId} /> : <img className="art" src={iconUrl(c)} alt="" draggable={false} />}
            </span>
          ),
        )}
      </m.span>
    </span>
  )
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const BULBS = 9

/**
 * `goods`: drawn already (the card opened again on the day), or null. `onDraw` draws (the farm's): the goods, or null
 * when it could not. `onLand` as each reel lands, `onReveal` as both are in.
 */
export function LuckyReels({
  pool,
  goods,
  until,
  onDraw,
  onLand,
  onReveal,
}: {
  pool: readonly ProduceId[]
  goods: readonly ProduceId[] | null
  until: string
  onDraw: () => ProduceId[] | null
  onLand?: () => void
  onReveal?: () => void
}) {
  // what this card drew (or found drawn as it opened), whether it spun, and which reels are in
  const [got, setGot] = useState<readonly ProduceId[] | null>(goods)
  const [spun, setSpun] = useState(false)
  const [landed, setLanded] = useState<boolean[]>(() => [!!goods, !!goods])
  const [skip, setSkip] = useState(0)
  const machine = useRef<HTMLDivElement>(null)
  const reels = got ? got.length : 2
  const phase: Phase = !got ? 'idle' : landed.slice(0, reels).every(Boolean) ? 'done' : 'spin'
  const mode: Mode = !got ? 'rest' : spun ? 'spin' : 'shown'

  // both in after a spin: the moment of the screen, once
  const told = useRef(false)
  useEffect(() => {
    if (phase !== 'done' || !spun || told.current) return
    told.current = true
    onReveal?.()
    if (machine.current) burst(machine.current, { count: 70, spread: 80, power: 30 })
  }, [phase, spun, onReveal])

  const draw = () => {
    if (phase !== 'idle') return
    const drawn = onDraw()
    if (!drawn?.length) return
    setGot(drawn)
    setSpun(true)
    setLanded([false, false])
  }
  const stop = (k: number) => {
    onLand?.()
    setLanded((l) => l.map((x, i) => x || i === k))
  }

  return (
    <div className={`nw-lucky-play ${phase}`}>
      <div
        className="nw-machine"
        ref={machine}
        onClick={() => phase === 'spin' && setSkip((n) => n + 1)}
        onKeyDown={(e) => phase === 'spin' && (e.key === 'Enter' || e.key === ' ') && setSkip((n) => n + 1)}
        role={phase === 'spin' ? 'button' : undefined}
        tabIndex={phase === 'spin' ? 0 : undefined}
        aria-label={phase === 'spin' ? 'Skip: show the goods now' : got ? `Drawn: ${got.map((g) => produceById(g).plural).join(' and ')}, double price` : 'Two reels, waiting for the draw'}
      >
        <span className="nw-bulbs" aria-hidden="true">
          {Array.from({ length: BULBS }, (_, i) => (
            <i key={i} style={{ '--i': i } as CSSProperties} />
          ))}
        </span>
        <span className="nw-reels">
          {Array.from({ length: reels }, (_, k) => (
            <span key={k} className="nw-reel">
              <Reel k={k} pool={pool} good={got?.[k] ?? null} mode={mode} landed={!!got && landed[k]} skip={skip} onStop={stop} />
              {got && landed[k] && (
                <m.b className="nw-stamp" initial={{ scale: 2.4, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: -10, opacity: 1 }} transition={SPRING.pop}>
                  ×2
                </m.b>
              )}
            </span>
          ))}
        </span>
        <span className="nw-bulbs" aria-hidden="true">
          {Array.from({ length: BULBS }, (_, i) => (
            <i key={i} style={{ '--i': BULBS - 1 - i } as CSSProperties} />
          ))}
        </span>
      </div>
      {phase === 'done' && got ? (
        <m.div className="nw-won" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: spun ? 0.15 : 0 }}>
          <span className="nw-won-names">
            {got.map((g) => (
              <b key={g}>{cap(produceById(g).plural)}</b>
            ))}
          </span>
          <span className="nw-won-say">
            Double price until <b>{until}</b>
          </span>
          <span className="nw-where" role="img" aria-label="Wherever they sell: the gate, the orders, the market">
            <span className="tag">
              <img src={art('people-queue')} alt="" />
              Gate
            </span>
            <span className="tag">
              <img src={art('clipboard')} alt="" />
              Orders
            </span>
            <span className="tag">
              <img src={art('convenience-store')} alt="" />
              Market
            </span>
          </span>
        </m.div>
      ) : (
        <div className="nw-draw-row">
          <m.button className="btn nw-draw" {...SINK} disabled={phase !== 'idle'} onClick={draw} aria-label="Draw two lucky goods">
            <img src={art('four-leaf-clover')} alt="" />
            {phase === 'spin' ? 'Drawing…' : 'Draw'}
          </m.button>
          <span className="nw-draw-say">{phase === 'spin' ? 'Tap the reels to stop them' : 'Two goods sell for double today'}</span>
        </div>
      )}
    </div>
  )
}
