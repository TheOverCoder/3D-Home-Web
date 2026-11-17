import { AnimatePresence, animate, m, useAnimate, useDragControls, useReducedMotion, type PanInfo, type Variants } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { produceById } from '../../../src/farm/data'
import { iconUrl } from '../../../src/farm/icons'
import { flyInto } from '../../../src/farm/machine/fly'
import { Bump } from '../../../src/farm/machine/parts'
import '../../../src/farm/machine/MachinePanel.css'
import '../../../src/farm/MarketPanel.css'
import { art } from '../../../src/ui/art'
import { ArrowRight, Check, Clock, X } from '../../../src/ui/glyphs'
import { DID, NOPE, PRESS, SPRING } from '../../../src/ui/motion'
import { Coins } from '../../../src/ui/Shell'
import { TopC } from '../top/TopC'
import { topAt } from '../unlocks/data'
import { climb, grow, take, TOOLS, viewOf, type ToolState, type ToolView } from './sample'
import './parts.css'

// What the three tool panels of the board share (the plan's ToolPanelView is one panel for the three tools; the
// variants differ in what stands in its middle): the machine panel's sheet (src/farm/machine/MachinePanel.css: from the
// bottom upright, on the right sideways, swiped away by its top), its head (the tool's picture, its name, how many a
// tap takes, the barn as a chip that fills), the two upgrades as chips under it (each opens the game's ladder card),
// a line that says what happened, and a tap: the goods fly from what was tapped into the barn's chip, which hops as
// each lands; with no room or nothing there, a shake and the reason.

const UPRIGHT = '(max-width: 520px)'
const SIDEWAYS = '(orientation: landscape) and (max-height: 560px)'
const watch = (q: string) => (changed: () => void) => {
  const mq = matchMedia(q)
  mq.addEventListener('change', changed)
  return () => mq.removeEventListener('change', changed)
}
export type Mode = 'bottom' | 'right' | 'middle'
/** Where the sheet stands: at the bottom (a phone upright), on the right (on its side), in the middle (a computer). */
export function useMode(): Mode {
  const wide = useSyncExternalStore(watch(SIDEWAYS), () => matchMedia(SIDEWAYS).matches)
  const narrow = useSyncExternalStore(watch(UPRIGHT), () => matchMedia(UPRIGHT).matches)
  return wide ? 'right' : narrow ? 'bottom' : 'middle'
}

const away = (mode: Mode) => (mode === 'right' ? { x: '104%', y: 0, opacity: 1 } : mode === 'bottom' ? { x: 0, y: '104%', opacity: 1 } : { x: 0, y: 40, opacity: 0 })
const SHEET: Variants = {
  hidden: away,
  show: { x: 0, y: 0, opacity: 1, transition: SPRING.sheet },
  out: (mode: Mode) => ({ ...away(mode), transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }),
}
/** Blocks of the sheet that come in one after another, after it (the hero last). */
export const BLOCKS: Variants = { show: { transition: { delayChildren: 0.12, staggerChildren: 0.05 } } }
export const BLOCK: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: SPRING.pop } }

/** The game's top behind the shade (the top board's live one), standing still: the scene's, not the design's. */
export function Behind({ level = 9, coins }: { level?: number; coins: number }) {
  const [top, setTop] = useState(() => topAt(level, coins, 0.4))
  return (
    <AnimatePresence initial={false}>
      <TopC s={top} set={setTop} bare />
    </AnimatePresence>
  )
}

export interface Line {
  id: number
  tone: 'good' | 'bad' | 'calm'
  text: ReactNode
}

/** The sheet of a tool's panel: the machine panel's own (shade, sheet, swipe, ✕, Esc). `head`: the chips under the
 *  name; `remote`: what a panel opened from afar shows over its head (the premium board's). */
export function ToolSheet({ v, className, head, remote, onClose, children }: { v: ToolView; className: string; head?: ReactNode; remote?: ReactNode; onClose: () => void; children: ReactNode }) {
  const mode = useMode()
  const [leaving, setLeaving] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.farm-backdrop')) return
      e.stopPropagation()
      setLeaving(true)
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [])
  const letGo = (_: unknown, i: PanInfo) => {
    const far = mode === 'right' ? i.offset.x : i.offset.y
    const fast = mode === 'right' ? i.velocity.x : i.velocity.y
    if (far > 110 || (far > 24 && fast > 500)) setLeaving(true)
  }
  return (
    <div className={`mp-root mp-${mode} at-root ${className}`}>
      <m.div
        className="mp-shade"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: leaving ? 0.18 : 0.24 }}
        onClick={() => setLeaving(true)}
      />
      <m.div
        ref={sheet}
        className="mp-sheet farm-panel at-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={v.name}
        tabIndex={-1}
        custom={mode}
        variants={SHEET}
        initial="hidden"
        animate={leaving ? 'out' : 'show'}
        onAnimationComplete={(d) => d === 'out' && onClose()}
        drag={mode === 'middle' ? false : mode === 'right' ? 'x' : 'y'}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={mode === 'right' ? { right: 0.9, left: 0 } : { bottom: 0.9, top: 0 }}
        dragMomentum={false}
        onDragEnd={letGo}
      >
        {remote}
        <header
          className="mp-head at-head"
          onPointerDown={(e) => {
            if (mode !== 'middle' && !(e.target as Element).closest('button')) controls.start(e)
          }}
        >
          <i className="mp-grab" aria-hidden="true" />
          <m.img className="art at-head-art" src={TOOLS[v.kind].pic} alt="" initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={SPRING.soft} />
          <div className="mp-head-text">
            <h2>{v.name}</h2>
            <div className="mp-sub">{head}</div>
          </div>
          <m.button className="mp-round" onClick={() => setLeaving(true)} aria-label="Close (Esc)" {...PRESS}>
            <X weight="bold" />
          </m.button>
        </header>
        <m.div className="at-body" initial="hidden" animate="show" variants={BLOCKS}>
          {children}
        </m.div>
      </m.div>
    </div>
  )
}

/** A price: the coin and how many, with its thousands marked (10,000: the game's Coins writes 10000). */
export const Price = ({ n }: { n: number }) => (
  <span className="farm-coins">
    <img src={art('coin')} alt="" />
    {n.toLocaleString('en-US')}
  </span>
)

/** How many one tap takes: the good and ×n. */
export function PerTap({ v }: { v: ToolView }) {
  return (
    <span className="tag at-pertap" aria-label={`${v.perTap} a tap`}>
      <img src={iconUrl(v.good)} alt="" />
      <b>×{v.perTap}</b>
      <span className="at-pertap-word">a tap</span>
    </span>
  )
}

/** The barn as a chip: its picture and how full (red when there is no room); the goods fly into its picture. */
export function BarnChip({ v, chip }: { v: ToolView; chip: RefObject<HTMLSpanElement | null> }) {
  const full = v.room <= 0
  return (
    <span ref={chip} className={`tag at-barn${full ? ' full' : ''}`} data-barn-chip aria-label={`Barn: ${v.stored} of ${v.capacity}${full ? ', full' : ''}`}>
      <img src={iconUrl(v.store)} alt="" />
      <Bump n={v.stored} />
      <span className="at-barn-of">/{v.capacity}</span>
    </span>
  )
}

/** The tool's two upgrades as chips (what it is now → after the next step, and the price); each opens the game's ladder
 *  card (Not now, Buy · price), here over the sheet. At the top: Max. */
export function Upgrades({ v, coins, onBuy }: { v: ToolView; coins: number; onBuy: (part: 'hold' | 'tap') => void }) {
  const [asking, setAsking] = useState<ToolView['ladders'][number] | null>(null)
  return (
    <>
      <m.div className="at-ups" variants={BLOCK}>
        {v.ladders.map((l) => (
          <UpgradeChip key={l.id} l={l} onOpen={() => setAsking(l)} />
        ))}
      </m.div>
      {asking && (
        <LadderAsk
          l={v.ladders.find((x) => x.id === asking.id)!}
          pic={TOOLS[v.kind].pic}
          coins={coins}
          onClose={() => setAsking(null)}
          onBuy={() => {
            onBuy(asking.part)
            setAsking(null)
          }}
        />
      )}
    </>
  )
}

function UpgradeChip({ l, onOpen }: { l: ToolView['ladders'][number]; onOpen: () => void }) {
  const [scope, animate] = useAnimate<HTMLButtonElement>()
  const was = useRef(l.k)
  useEffect(() => {
    if (l.k > was.current && scope.current) void animate(scope.current, DID.keyframes, DID.options)
    was.current = l.k
  }, [l.k, animate, scope])
  const max = !l.next
  return (
    <m.button
      ref={scope}
      className={`at-up${max ? ' max' : ''}`}
      onClick={max ? undefined : onOpen}
      aria-disabled={max || undefined}
      aria-label={max ? `${l.name}: ${l.now}, the most` : `${l.name}: ${l.now} to ${l.next}, ${l.price} coins`}
      {...(max ? {} : PRESS)}
    >
      <span className="at-up-now">{l.now}</span>
      {max ? (
        <span className="tag ok">
          <Check weight="bold" />
          Max
        </span>
      ) : (
        <>
          <ArrowRight weight="bold" className="effect-arrow" />
          <b className="at-up-next">{l.next}</b>
          <span className="at-up-price">
            <Coins n={l.price} />
          </span>
        </>
      )}
      <span className="at-up-steps" aria-hidden="true">
        {Array.from({ length: l.steps }, (_, i) => (
          <i key={i} className={i < l.k ? 'on' : ''} />
        ))}
      </span>
    </m.button>
  )
}

/** The game's ladder card (src/farm/Ladder.tsx LadderCard, in the game's Shell markup): picture, now → after (or what
 *  it gives), at most one line, Not now and Buy · price — or "Needs N more". `className`: a look of its own (the
 *  premium board's); `badge`: something on the picture's corner (the crown). */
export function LadderAsk({
  l,
  pic,
  coins,
  line,
  className,
  badge,
  buyWord = 'Buy',
  onClose,
  onBuy,
}: {
  l: { name: string; now: string; next?: string | null; price: number }
  pic: string
  coins: number
  line?: string
  className?: string
  badge?: ReactNode
  buyWord?: string
  onClose: () => void
  onBuy: () => void
}) {
  const afford = coins >= l.price
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })
  return (
    <div className={`farm-backdrop at-ask${className ? ` ${className}` : ''}`} onClick={onClose}>
      <div className="farm-panel" role="dialog" aria-modal="true" aria-label={l.name} onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="at-ask-pic">
            <img className="art farm-head-art" src={pic} alt="" />
            {badge}
          </span>
          <div className="farm-head-text">
            <h2>{l.name}</h2>
            <div className="farm-sub">
              <span className="tag">
                <img src={art('coin')} alt="" />
                {coins.toLocaleString('en-US')}
              </span>
              <span className="ladder-say">
                <span className="tag">{l.now}</span>
                {l.next && (
                  <>
                    <ArrowRight weight="bold" className="effect-arrow" />
                    <span className="tag">
                      <b>{l.next}</b>
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
          <button className="close" onClick={onClose} aria-label="Close (Esc)">
            <X weight="bold" />
          </button>
        </header>
        {line && <p className="farm-line">{line}</p>}
        <div className="farm-confirm">
          <button className="btn soft" onClick={onClose}>
            Not now
          </button>
          <button className="btn farm-buy" disabled={!afford} onClick={onBuy}>
            {afford ? (
              <>
                {buyWord} · <Price n={l.price} />
              </>
            ) : (
              <>Needs {(l.price - coins).toLocaleString('en-US')} more</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/** A line of the panel: what a tap did, or why it did nothing (it goes after a moment); else what waits. */
export function Said({ line, idle }: { line: Line | null; idle: { tone: Line['tone']; text: ReactNode } }) {
  return (
    <div className="at-said" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        {line ? (
          <m.p
            key={line.id}
            className={`mp-note ${line.tone}`}
            role="status"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
            transition={SPRING.pop}
          >
            {line.text}
          </m.p>
        ) : (
          <m.p key={`idle-${idle.tone}`} className={`mp-note ${idle.tone}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
            {idle.text}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s % 60))).padStart(2, '0')}`
export { clock }

/** The idle line: no room in the barn, what waits in all, or when the next comes. */
export function idleWords(v: ToolView): { tone: Line['tone']; text: ReactNode } {
  const all = v.spots.reduce((a, s) => a + s.has, 0)
  const good = produceById(v.good)
  if (v.room <= 0 && all > 0)
    return {
      tone: 'bad',
      text: (
        <>
          <img className="art" src={iconUrl(v.store)} alt="" /> The barn is full
        </>
      ),
    }
  if (all > 0)
    return {
      tone: 'calm',
      text: (
        <>
          <img className="art" src={iconUrl(v.good)} alt="" />
          <span className="mp-count">{all}</span> waiting
        </>
      ),
    }
  const soon = Math.min(...v.spots.map((s) => s.seconds))
  return {
    tone: 'calm',
    text: (
      <>
        <Clock weight="bold" /> Next {good.name} in {clock(soon)}
      </>
    ),
  }
}

/**
 * The panel's working state: the farm going on (each ring fills as the farm's clock would), a tap that takes (its
 * goods flying from what was tapped into the barn chip, which hops as each one lands and counts up), the ladders
 * bought, and the line that says so. `tap(spot, from)`: a spot of the herd, or none (the tool itself: the fullest).
 */
export function useTool(s: ToolState, set: (s: ToolState) => void) {
  const still = useReducedMotion()
  const now = useRef(s)
  now.current = s
  const v = viewOf(s)
  const chip = useRef<HTMLSpanElement>(null)
  const [line, setLine] = useState<Line | null>(null)
  const id = useRef(0)
  const say = (tone: Line['tone'], text: ReactNode) => setLine({ id: ++id.current, tone, text })
  useEffect(() => {
    if (!line) return
    const t = window.setTimeout(() => setLine(null), 2200)
    return () => window.clearTimeout(t)
  }, [line])
  // the farm goes on: a few times a second
  useEffect(() => {
    let last = performance.now()
    const t = window.setInterval(() => {
      const at = performance.now()
      const next = grow(now.current, (at - last) / 1000)
      last = at
      if (next !== now.current) set(next)
    }, 250)
    return () => window.clearInterval(t)
  }, [set])

  const tap = (spot: number | undefined, from: Element | null): number => {
    const before = now.current
    const [after, n, i] = take(before, spot)
    const good = produceById(v.good)
    if (!n) {
      if (from && !still) void animate(from, NOPE.keyframes, NOPE.options)
      if (i >= 0 && before.has[i] > 0) {
        if (chip.current && !still) void animate(chip.current, NOPE.keyframes, NOPE.options)
        say('bad', <>The barn is full</>)
      } else {
        const sp = v.spots[spot ?? 0]
        say(
          'calm',
          <>
            <Clock weight="bold" /> {spot === undefined ? `Nothing waiting: next ${good.name} in ${clock(Math.min(...v.spots.map((x) => x.seconds)))}` : `${sp.name}: next in ${clock(sp.seconds)}`}
          </>,
        )
      }
      return 0
    }
    // the count goes down at once; the barn's goes up as each lands
    set({ ...after, stored: before.stored })
    const to = chip.current?.querySelector('img')?.getBoundingClientRect()
    const rect = from?.getBoundingClientRect()
    const flights = rect && to && !still ? Array.from({ length: Math.min(n, 5) }, () => ({ src: iconUrl(v.good), from: rect })) : []
    let landed = 0
    const land = () => {
      landed += 1
      const add = landed === flights.length ? n - (flights.length - 1) : 1
      now.current = { ...now.current, stored: now.current.stored + add }
      set(now.current)
      if (chip.current && !still) void animate(chip.current, DID.keyframes, DID.options)
    }
    if (flights.length && to) void flyInto(flights, to, { size: 40, stagger: 55, duration: 460, landed: land })
    else set(after)
    say(
      'good',
      <>
        <img className="art" src={iconUrl(v.good)} alt="" />+{n} to the barn
      </>,
    )
    return n
  }
  const buy = (part: 'hold' | 'tap') => set(climb(now.current, part))
  return { v, chip, line, tap, buy }
}

/** A count that ticks down as goods are taken (the number pops). */
export const Count = ({ n }: { n: number }) => <Bump n={n} />
