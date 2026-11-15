import { AnimatePresence, m, useAnimate } from 'motion/react'
import { Popover } from 'radix-ui'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { produceById } from '../data'
import { iconUrl } from '../icons'
import type { QueueSlot } from '../machineView'
import { Check, LockSimple, Plus, X } from '../../ui/glyphs'
import { PRESS, SPRING } from '../../ui/motion'
import { Coins } from '../../ui/Shell'
import type { Axis, Lifted } from './drag'
import { TimeLeft, useJobProgress } from './parts'
import { clock, type Cell, type Payload } from './queue'

// The queue's places, in order: what is done (glowing, to collect), the job at work (a ring round its place fills as
// it works, its time running down), the waiting ones (drag one to move it, or out of the queue to take it out; a tap
// shows a ✕), the empty places (a dragged recipe lands in one), and the next place to buy, with its price.

const name = (s: QueueSlot) => produceById(s.makes).name
const nth = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`

export interface QueueHandlers {
  press: (e: ReactPointerEvent<HTMLElement>, p: Payload, o: { src: string; axis: Axis; pic?: HTMLElement | null }) => void
  wasDrag: () => boolean
  remove: (index: number) => void
  moveBy: (index: number, by: number) => void
  collect: () => void
}

export function QueueGrid({
  cells,
  lifted,
  holeSrc,
  outOfQueue,
  picked,
  setPicked,
  h,
  upgrade,
  coins,
  onBuy,
  nudge,
  opening,
  arriving,
}: {
  cells: Cell[]
  lifted: Lifted<Payload> | null
  /** the picture of what is being dragged, drawn faintly where it would land */
  holeSrc: string | null
  /** a waiting job dragged out of the queue: let go, it is taken out */
  outOfQueue: boolean
  picked: number | null
  setPicked: (i: number | null) => void
  h: QueueHandlers
  upgrade: { capacity: number; price: number } | null
  coins?: number
  onBuy: () => boolean
  /** a count that, as it grows, nudges the place to buy (a recipe tapped with the queue full) */
  nudge: number
  /** the panel is opening: the places come in one after another */
  opening: boolean
  /** the job whose picture is flying into its place (it shows as the picture lands) */
  arriving: string | null
}) {
  const recipeOver = lifted?.payload.kind === 'recipe'
  return (
    <div className={`mp-places${recipeOver ? ' inviting' : ''}`} role="list">
      <AnimatePresence mode="popLayout" initial={opening}>
        {cells.map((c, i) => (
          <Place
            key={c.key}
            c={c}
            i={i}
            arriving={arriving === c.key}
            picked={picked === c.from}
            setPicked={setPicked}
            h={h}
            holeSrc={holeSrc}
            outOfQueue={outOfQueue}
            delay={opening ? 0.06 + i * 0.03 : 0}
          />
        ))}
        {upgrade && <BuyPlace key={`buy-${upgrade.capacity}`} upgrade={upgrade} coins={coins} onBuy={onBuy} nudge={nudge} delay={opening ? 0.06 + cells.length * 0.03 : 0.12} />}
      </AnimatePresence>
    </div>
  )
}

const enter = (delay: number) => ({
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1, transition: { ...SPRING.pop, delay } },
  exit: { opacity: 0, scale: 0.4, transition: { duration: 0.16 } },
})

function Place({
  c,
  i,
  arriving,
  picked,
  setPicked,
  h,
  holeSrc,
  outOfQueue,
  delay,
}: {
  c: Cell
  i: number
  arriving: boolean
  picked: boolean
  setPicked: (i: number | null) => void
  h: QueueHandlers
  holeSrc: string | null
  outOfQueue: boolean
  delay: number
}) {
  const s = c.slot
  // a job that has just finished pops in its place (not one that was done already as the panel opened)
  const was = useRef(c.kind)
  const justDone = was.current === 'working' && c.kind === 'done'
  useEffect(() => {
    was.current = c.kind
  }, [c.kind])
  const common = { 'data-cell': i, 'data-kind': c.kind, 'data-key': c.key, layout: 'position' as const, role: 'listitem', ...enter(delay) }
  if (c.kind === 'empty')
    return (
      <m.div className="mp-place empty" {...common} aria-label="An empty place">
        <Plus weight="bold" />
      </m.div>
    )
  if (c.kind === 'hole')
    return (
      <m.div className={`mp-place hole${outOfQueue ? ' out' : ''}`} {...common} aria-hidden="true">
        {holeSrc && <img className="art" src={holeSrc} alt="" draggable={false} />}
      </m.div>
    )
  if (!s) return null
  if (c.kind === 'done')
    return (
      <m.div className="mp-place done" {...common}>
        <m.button className="mp-place-btn" aria-label={`${cap(name(s))}, ready — collect`} onClick={h.collect} {...PRESS}>
          <m.span className={`mp-pop${justDone ? ' shine' : ''}`} initial={justDone ? { scale: 0.5, rotate: -14 } : false} animate={{ scale: 1, rotate: 0 }} transition={SPRING.soft}>
            <img className="art" src={iconUrl(s.makes)} alt="" draggable={false} data-pic />
          </m.span>
          <m.span className="mp-check" initial={justDone ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ ...SPRING.pop, delay: 0.14 }}>
            <Check weight="bold" />
          </m.span>
        </m.button>
      </m.div>
    )
  if (c.kind === 'working')
    return (
      <m.div className="mp-place working" {...common} aria-label={`${cap(name(s))}, at work: ${clock(s.left)} to go`}>
        <Working s={s} arriving={arriving} />
      </m.div>
    )
  // waiting: drag it (to move it, or out to take it out), or tap it for its ✕
  const keys = (e: KeyboardEvent) => {
    if (c.from === undefined) return
    if (e.key === 'Delete' || e.key === 'Backspace') h.remove(c.from)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') h.moveBy(c.from, -1)
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') h.moveBy(c.from, 1)
    else return
    e.preventDefault()
  }
  return (
    <m.div className={`mp-place waiting${picked ? ' picked' : ''}`} {...common}>
      <button
        className="mp-place-btn"
        aria-label={`${cap(name(s))}, ${nth(i + 1)} in the queue, ${clock(s.seconds)} — drag to move, or out to take out`}
        aria-pressed={picked}
        onPointerDown={(e) =>
          c.from !== undefined && h.press(e, { kind: 'job', index: c.from }, { src: iconUrl(s.makes), axis: 'none', pic: e.currentTarget.querySelector<HTMLElement>('[data-pic]') })
        }
        onClick={() => !h.wasDrag() && setPicked(picked ? null : (c.from ?? null))}
        onKeyDown={keys}
        onContextMenu={(e) => e.preventDefault()}
      >
        <m.img
          className="art"
          src={iconUrl(s.makes)}
          alt=""
          draggable={false}
          data-pic
          initial={arriving ? { opacity: 0, scale: 0.6 } : false}
          animate={{ opacity: 1, scale: 1, transition: { ...SPRING.pop, delay: arriving ? 0.16 : 0 } }}
        />
        <span className="mp-time">{clock(s.seconds)}</span>
      </button>
      <AnimatePresence>
        {picked && (
          <m.button
            key="x"
            className="mp-remove"
            aria-label={`Take the ${name(s)} out`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.1 } }}
            onClick={() => c.from !== undefined && h.remove(c.from)}
            {...PRESS}
          >
            <X weight="bold" />
          </m.button>
        )}
      </AnimatePresence>
    </m.div>
  )
}

/** The job at work: its picture bobs, a ring round its place fills, its time runs down; as it starts, a hop. */
function Working({ s, arriving }: { s: QueueSlot; arriving: boolean }) {
  const p = useJobProgress(s.seconds, s.left, true)
  return (
    <>
      <svg className="mp-fuse" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="mp-fuse-track" d={FUSE} />
        <m.path className="mp-fuse-fill" d={FUSE} style={{ pathLength: p }} />
      </svg>
      <m.span
        className="mp-pop mp-bob"
        initial={arriving ? { scale: 0.6, opacity: 0 } : { scale: 0.7, y: 6 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ ...SPRING.soft, delay: arriving ? 0.16 : 0 }}
      >
        <img className="art" src={iconUrl(s.makes)} alt="" draggable={false} data-pic />
      </m.span>
      <TimeLeft p={p} seconds={s.seconds} />
    </>
  )
}

/** Round a place's edge from the middle of its top, clockwise (a rounded square in a 100 × 100 box). */
const FUSE = 'M50,4.5 H74.5 A21,21 0 0 1 95.5,25.5 V74.5 A21,21 0 0 1 74.5,95.5 H25.5 A21,21 0 0 1 4.5,74.5 V25.5 A21,21 0 0 1 25.5,4.5 Z'

const cap = (t: string) => t[0].toUpperCase() + t.slice(1)

/** The next place of the queue, for its price: a tap asks first (a small card: the place, its price, Cancel and Buy;
 *  Buy wakes a moment after it shows, so a second tap does not buy). */
function BuyPlace({ upgrade, coins, onBuy, nudge, delay }: { upgrade: { capacity: number; price: number }; coins?: number; onBuy: () => boolean; nudge: number; delay: number }) {
  const [open, setOpen] = useState(false)
  const [armed, setArmed] = useState(false)
  const [scope, wiggle] = useAnimate()
  const short = coins !== undefined && coins < upgrade.price
  useEffect(() => {
    setArmed(false)
    if (!open) return
    const t = window.setTimeout(() => setArmed(true), 450)
    return () => window.clearTimeout(t)
  }, [open])
  useEffect(() => {
    if (nudge && scope.current) void wiggle(scope.current, { rotate: [0, -8, 7, -5, 3, 0], scale: [1, 1.08, 1] }, { duration: 0.5 })
  }, [nudge, scope, wiggle])
  return (
    <m.div className="mp-place buy" data-kind="buy" layout="position" role="listitem" {...enter(delay)}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <m.button ref={scope} className={`mp-place-btn${short ? ' short' : ''}`} aria-label={`One more place (${upgrade.capacity} of 12) for ${upgrade.price} coins`} {...PRESS}>
            <LockSimple weight="fill" />
            <Coins n={upgrade.price} />
          </m.button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="mp-buy-card paper" side="bottom" align="center" sideOffset={8} collisionPadding={12}>
            <m.div initial={{ opacity: 0, scale: 0.9, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING.pop}>
              <div className="mp-buy-head">
                <span className="mp-buy-icon" aria-hidden="true">
                  <Plus weight="bold" />
                </span>
                <span>
                  <strong>One more place</strong>
                  <span className="tag">{upgrade.capacity} of 12</span>
                </span>
              </div>
              <div className="mp-buy-actions">
                <m.button className="btn soft small" onClick={() => setOpen(false)} {...PRESS}>
                  Cancel
                </m.button>
                <m.button
                  className={`btn small mp-buy-go${armed ? '' : ' arming'}`}
                  disabled={short}
                  aria-label={`Buy a place for ${upgrade.price} coins`}
                  onClick={() => {
                    if (!armed) return
                    if (onBuy()) setOpen(false)
                  }}
                  {...PRESS}
                >
                  Buy <Coins n={upgrade.price} />
                </m.button>
              </div>
              {short && coins !== undefined && <p className="mp-buy-short">{upgrade.price - coins} more coins needed</p>}
            </m.div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </m.div>
  )
}
