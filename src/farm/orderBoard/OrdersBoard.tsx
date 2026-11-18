import { AnimatePresence, m, useDragControls, useIsPresent, type PanInfo, type Variants } from 'motion/react'
import { useLessMotion } from '../../ui/still'
import { Tabs } from 'radix-ui'
import { useEffect, useRef, useState, type Ref } from 'react'
import { flyCoins } from '../../fx/coins'
import { coinsToFly } from '../../fx/fx'
import { art } from '../../ui/art'
import { burst } from '../../ui/burst'
import { ArrowRight, Check, X } from '../../ui/glyphs'
import { GoodPic } from '../../ui/GoodPic'
import { ARRIVE, EASE, MotionRoot, PRESS, SHEET, SPRING, swipedAway } from '../../ui/motion'
import { useSheetMode } from '../../ui/sheetMode'
import { Coins } from '../../ui/Shell'
import type { OfficeUpgradeId, ProduceId } from '../data'
import { iconUrl } from '../icons'
import { cratesFor, isComplete, type Order } from '../orders'
import { canPut, clock, goingIn, nameOf, type OfficeRow, type OrdersActions, type OrdersView } from './view'
import './OrdersBoard.css'

// The order board on the office's computer: the design layer — it draws an `OrdersView` and calls `OrdersActions`,
// nothing of the farm in it (src/farm/OrdersPanel.tsx feeds it the farm's; the design lab, sample data). Chosen in the
// lab: the orders board's E, "the wooden board".
//
// A sheet holding a board of dark wood, each order a plank nailed to it: at its head, carved, what it pays and its
// crates (and a small × to decline it); under it each good on a line of its own — its picture with how many it still
// wants (a ✓ once all are in), its name carved, and a peg for each one asked: full (in), a dashed yellow ring (what Put
// in would add now: the next press seen before it is made), or empty (still to make). At its foot one press: Put in N
// (yellow when it would fill the order: "Put in 4 · ready"), then Send (green), the plank glowing and a READY tag
// swinging onto its nail. A touch on a good says its name, how many are in, what the store holds and where it comes
// from; with too few in store, its way there (src/ui/GoodPic.tsx: "Show me" walks you there on the farm, a remote opens
// the machine or the tool from afar). A place whose order was declined counts down on a ring. The office's two upgrades are a tab of their own, each
// bought through a card that asks first.
//
// Its moments: Put in — the goods fly from the press into their lines on an arc, one after another, the pegs fill
// and the numbers count down; all in, the tag swings onto the nail and Send springs up. Send — the coins fly to the
// coin chip with one burst, the plank swings off its nails and the next order drops in. × — the plank falls. The
// sheet comes in on the sheet's spring (from the bottom upright, the right sideways), its planks dropping onto their
// nails one by one; a swipe of its head down (sideways: right), a touch outside, ✕ or Esc sends it out the same way.
//
// Every screen: upright the planks one under another (two side by side on a tablet or a computer) and the board
// scrolls by itself, only the head swipes the sheet; sideways the planks stand in a row that slides (three fit), a
// long order's goods scroll inside its plank, its press always in view.

export interface OrdersBoardProps {
  v: OrdersView
  act: OrdersActions
  /** the office upgrade whose card is open, asking first (the game's 'office-upgrade' panel), or none */
  asking: OfficeUpgradeId | null
  /** opens the card that asks for an upgrade, or closes it (null) */
  onAsk: (id: OfficeUpgradeId | null) => void
  onClose: () => void
}

/** The board, with the game's motion round it. */
export function OrdersBoard(p: OrdersBoardProps) {
  return (
    <MotionRoot>
      <Board {...p} />
    </MotionRoot>
  )
}

/** A good flying from the press into its line: from (x, y) to (tx, ty), its picture. */
interface Flight {
  id: number
  pic: string
  x: number
  y: number
  tx: number
  ty: number
  delay: number
}
/** An order shown as it was while its goods fly in, and what is flying (its pegs dashed until they land). */
interface Held {
  order: Order
  coming: Map<ProduceId, number>
  /** how many its Put in moved */
  can: number
}

let flightId = 0

function Board({ v, act, asking, onAsk, onClose }: OrdersBoardProps) {
  const mode = useSheetMode()
  const still = useLessMotion()
  const [tab, setTabNow] = useState(asking ? 'office' : 'orders')
  // the sheet keeps the tallest height it had from one tab to the other (it never jumps under the finger)
  const [tall, setTall] = useState<number | null>(null)
  const setTab = (to: string) => {
    if (sheet.current) setTall((h) => Math.max(h ?? 0, sheet.current!.offsetHeight))
    setTabNow(to)
  }
  const [leaving, setLeaving] = useState(false)
  const close = () => setLeaving(true)
  const sheet = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  const [flights, setFlights] = useState<Flight[]>([])
  const [held, setHeld] = useState<Record<number, Held>>({})
  /** the good whose bubble is open (`order id:good`) */
  const [pop, setPop] = useState<string | null>(null)
  const timers = useRef<number[]>([])
  const later = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms))
  // planks present as the sheet opens drop onto their nails one by one; later ones (a new order) at once
  const [opening, setOpening] = useState(true)

  useEffect(() => {
    sheet.current?.focus({ preventScroll: true })
    const t = window.setTimeout(() => setOpening(false), 900)
    const all = timers.current
    return () => {
      window.clearTimeout(t)
      all.forEach((x) => window.clearTimeout(x))
    }
  }, [])
  // the card asking for an upgrade lives on the office's tab
  useEffect(() => {
    if (asking) setTab('office')
  }, [asking])

  // Esc: a bubble first, then the card, then the way out (before the game's own Esc, which would close it at once)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (pop) setPop(null)
      else if (asking) onAsk(null)
      else setLeaving(true)
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })

  const places = v.slots.length
  const open = v.slots.filter((x) => 'order' in x).length
  // ready as the board shows them (an order whose goods are still flying in is not ready yet)
  const ready = v.slots.filter((x) => 'order' in x && isComplete(held[x.order.id]?.order ?? x.order)).length

  /** Put in: what there is goes in at once; on the screen the goods fly from the press into their lines first. */
  const put = (k: number, from: HTMLElement) => {
    const slot = v.slots[k]
    if (!slot || !('order' in slot)) return
    const o = slot.order
    const go = goingIn(v.inv, o)
    const before: Held = { order: { ...o, lines: o.lines.map((l) => ({ ...l })) }, coming: new Map(go), can: canPut(v.inv, o) }
    const r = from.getBoundingClientRect()
    const fx = r.left + r.width / 2
    const fy = r.top + r.height / 2
    const plank = board.current?.querySelector(`[data-plank="${o.id}"]`)
    const list: Flight[] = []
    let i = 0
    for (const [good, n] of go) {
      const to = plank?.querySelector(`[data-good="${good}"]`)?.getBoundingClientRect()
      if (!to) continue
      for (let j = 0; j < Math.min(n, 3); j++) list.push({ id: ++flightId, pic: iconUrl(good), x: fx, y: fy, tx: to.left + to.width / 2, ty: to.top + to.height / 2, delay: i++ * 0.045 })
    }
    if (!act.put(k) || still || !list.length) return
    setFlights((f) => [...f, ...list])
    setHeld((h) => ({ ...h, [o.id]: before }))
    later(
      () => {
        setFlights((f) => f.filter((x) => !list.includes(x)))
        setHeld((h) => {
          const rest = { ...h }
          delete rest[o.id]
          return rest
        })
      },
      340 + i * 45,
    )
  }

  /** Send: paid at once; its coins fly from the press to the coin chip, with one burst. */
  const send = (k: number, el: HTMLElement) => {
    const slot = v.slots[k]
    if (!slot || !('order' in slot)) return
    const r = el.getBoundingClientRect()
    if (!act.send(k) || still) return
    const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    flyCoins(at.x, at.y, coinsToFly(slot.order.coins))
    burst(at, { count: 40, spread: 70, power: 24 })
  }

  const letGo = (_: unknown, i: PanInfo) => swipedAway(mode, i) && setLeaving(true)

  return (
    <div className={`ob-root ob-${mode}`}>
      <m.div className="ob-shade" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: leaving ? 0.18 : 0.24 }} onClick={close} />
      <m.div
        ref={sheet}
        className="ob-sheet farm-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Orders"
        tabIndex={-1}
        custom={mode}
        style={tall && mode !== 'right' ? { minHeight: tall } : undefined}
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
        <Tabs.Root value={tab} onValueChange={setTab} className="ob-tabs">
          <div
            className="ob-head"
            onPointerDown={(e) => {
              if (mode !== 'middle' && !(e.target as Element).closest('button')) controls.start(e)
            }}
          >
            <i className="ob-grab" aria-hidden="true" />
            <m.img className="art ob-head-art" src={art('clipboard')} alt="" {...ARRIVE} />
            <h2>Orders</h2>
            <Tabs.List className="ob-tablist" aria-label="Orders and the office">
              <Tabs.Trigger value="orders" className="ob-tab">
                Orders
                <span className="ob-tab-n" aria-label={`${open} of ${places} places`}>
                  {open}/{places}
                </span>
                {ready > 0 && (
                  <m.b key={ready} className="ob-tab-ready" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.pop} aria-label={`${ready} ready to send`}>
                    {ready}
                  </m.b>
                )}
                {tab === 'orders' && <m.span className="ob-tab-on" layoutId="ob-tab-on" transition={SPRING.pop} />}
              </Tabs.Trigger>
              <Tabs.Trigger value="office" className="ob-tab">
                Office
                {tab === 'office' && <m.span className="ob-tab-on" layoutId="ob-tab-on" transition={SPRING.pop} />}
              </Tabs.Trigger>
            </Tabs.List>
            <m.button className="close" onClick={close} aria-label="Close (Esc)" {...PRESS}>
              <X weight="bold" />
            </m.button>
          </div>
          {/* the board scrolls: its planks' layout moves are measured within it (layoutScroll), or a scroll would read
              as a plank moving, and the planks slide over one another as the board draws again */}
          <Tabs.Content value="orders" forceMount hidden={tab !== 'orders'} asChild>
            <m.div className="ob-board" ref={board} layoutScroll>
              <div className="ob-planks">
                <AnimatePresence mode="popLayout">
                  {v.slots.map((slot, k) =>
                    'order' in slot ? (
                      <Plank
                        key={slot.order.id}
                        o={held[slot.order.id]?.order ?? slot.order}
                        soon={held[slot.order.id]?.coming ?? new Map(goingIn(v.inv, slot.order))}
                        can={held[slot.order.id]?.can ?? canPut(v.inv, slot.order)}
                        flying={!!held[slot.order.id]}
                        inv={v.inv}
                        k={k}
                        delay={opening ? 0.14 + k * 0.07 : 0}
                        pop={pop}
                        setPop={setPop}
                        onPut={put}
                        onSend={send}
                        onDecline={(k) => act.decline(k)}
                      />
                    ) : (
                      <Waiting key={`wait-${k}`} left={slot.wait} full={v.wait} delay={opening ? 0.14 + k * 0.07 : 0} />
                    ),
                  )}
                </AnimatePresence>
              </div>
            </m.div>
          </Tabs.Content>
          <Tabs.Content value="office" className="ob-office farm-office" forceMount hidden={tab !== 'office'}>
            <p className="ob-purse">
              <img className="art" src={art('coin')} alt="" />
              <span>
                You have <b>{v.coins.toLocaleString('en-US')}</b>
              </span>
            </p>
            {v.office.map((r) => (
              <OfficeUpgrade key={r.id} r={r} coins={v.coins} onAsk={() => onAsk(r.id)} />
            ))}
          </Tabs.Content>
        </Tabs.Root>
        <AnimatePresence>
          {asking && (
            <OfficeCard
              key={asking}
              r={v.office.find((x) => x.id === asking)!}
              coins={v.coins}
              onCancel={() => onAsk(null)}
              onBuy={() => {
                if (!act.buy(asking)) return
                onAsk(null)
                // a new place: back to the board, where its first order drops onto the nails at its end
                if (asking === 'slots')
                  later(() => {
                    setTab('orders')
                    later(() => board.current?.scrollTo({ top: board.current.scrollHeight, left: board.current.scrollWidth, behavior: still ? 'auto' : 'smooth' }), 60)
                  }, 700)
              }}
            />
          )}
        </AnimatePresence>
      </m.div>
      {/* the goods on their way into an order */}
      <div className="ob-flights" aria-hidden="true">
        {flights.map((f) => (
          <m.img
            key={f.id}
            className="art"
            src={f.pic}
            alt=""
            initial={{ x: f.x - 18, y: f.y - 18, scale: 0.5, opacity: 0 }}
            animate={{ x: [f.x - 18, (f.x + f.tx) / 2 - 18, f.tx - 18], y: [f.y - 18, Math.min(f.y, f.ty) - 70, f.ty - 18], scale: [0.6, 1.15, 0.8], opacity: [0, 1, 1] }}
            transition={{ duration: 0.36, delay: f.delay, ease: 'easeInOut', times: [0, 0.5, 1] }}
          />
        ))}
      </div>
    </div>
  )
}

const PLANK: Variants = {
  hidden: { opacity: 0, y: -30, rotate: -3 },
  show: (delay: number) => ({ opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 520, damping: 22, delay } }),
}
const PEG: Variants = { hidden: { scale: 0.2, opacity: 0 }, show: { scale: 1, opacity: 1, transition: SPRING.pop } }

/** An order: a plank nailed to the board, the whole order carved into it. */
function Plank({
  ref,
  o,
  soon,
  can,
  flying,
  inv,
  k,
  delay,
  pop,
  setPop,
  onPut,
  onSend,
  onDecline,
}: {
  ref?: Ref<HTMLElement>
  o: Order
  /** what the next Put in would move (or, while it flies in, what is flying), good by good */
  soon: Map<ProduceId, number>
  /** how many the next Put in would move */
  can: number
  /** its goods are flying in: Put in waits until they land (× may still decline it) */
  flying: boolean
  inv: OrdersView['inv']
  k: number
  delay: number
  pop: string | null
  setPop: (key: string | null) => void
  onPut: (k: number, el: HTMLElement) => void
  onSend: (k: number, el: HTMLElement) => void
  onDecline: (k: number) => void
}) {
  const still = useLessMotion()
  // on its way out (sent, declined) it is no longer one of the board's orders
  const present = useIsPresent()
  const [falling, setFalling] = useState(false)
  const done = isComplete(o)
  const fills = can > 0 && o.lines.every((l) => l.have + (soon.get(l.good) ?? 0) >= l.want)
  const crates = cratesFor(o)
  return (
    <m.article
      ref={ref}
      className={`${present ? 'farm-order ' : ''}ob-plank${done ? ' done' : ''}`}
      data-plank={o.id}
      layout
      custom={delay}
      variants={PLANK}
      initial="hidden"
      animate="show"
      exit={falling ? { opacity: 0, y: 160, rotate: -16, transition: { duration: 0.4, ease: 'easeIn' } } : { opacity: 0, x: 140, y: 24, rotate: 16, transition: { duration: 0.36, ease: 'easeIn' } }}
      aria-label={`Order for ${o.coins} coins`}
    >
      <i className="ob-nail tl" />
      <i className="ob-nail tr" />
      <div className="ob-pays">
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <m.b
              key="ready"
              className="ob-ready"
              initial={{ opacity: 0, rotate: -60, y: -6 }}
              animate={{ opacity: 1, rotate: [-60, 14, -7, 3, 0], y: 0 }}
              transition={{ duration: 0.8, times: [0, 0.35, 0.6, 0.8, 1], ease: 'easeOut', delay: 0.15 }}
            >
              <Check weight="bold" /> Ready
            </m.b>
          ) : (
            <m.span key="pays" className="ob-coins" exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}>
              <img className="art" src={art('coin')} alt="" />
              <b>{o.coins}</b>
            </m.span>
          )}
        </AnimatePresence>
        {o.surprise && <img className="art ob-surprise" src={art('wrapped-gift')} alt="and a surprise" title="Brings a surprise" />}
        <span className="ob-crates" role="img" aria-label={`${crates} ${crates === 1 ? 'crate' : 'crates'} for the tractor`}>
          {Array.from({ length: crates }, (_, i) => (
            <img key={i} className="art" src={art('package')} alt="" />
          ))}
        </span>
        {!done && (
          <m.button
            className="ob-no"
            {...PRESS}
            onClick={() => {
              setFalling(true)
              // the plank knows it falls before it goes
              window.setTimeout(() => onDecline(k), 0)
            }}
            aria-label="Decline this order"
          >
            <X weight="bold" />
          </m.button>
        )}
      </div>
      <ul className="ob-lines">
        {o.lines.map((l) => (
          <Line key={l.good} id={`${o.id}:${l.good}`} good={l.good} want={l.want} have={l.have} soon={soon.get(l.good) ?? 0} store={inv[l.good] ?? 0} pop={pop} setPop={setPop} still={!!still} />
        ))}
      </ul>
      <div className="ob-foot">
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <m.button
              key="send"
              className="btn leaf ob-send"
              initial={{ opacity: 0, scale: 0.7, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...SPRING.soft, delay: 0.3 }}
              whileTap={{ scale: 0.95, y: 3 }}
              onClick={(e) => onSend(k, e.currentTarget)}
              aria-label={`Send this order for ${o.coins} coins`}
            >
              Send <Coins n={o.coins} />
            </m.button>
          ) : (
            <m.button
              key="put"
              className={`btn ${fills ? 'primary' : 'soft'} ob-put`}
              disabled={!can || flying}
              {...PRESS}
              onClick={(e) => onPut(k, e.currentTarget)}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {can ? (fills ? `Put in ${can} · ready` : `Put in ${can}`) : 'None in store yet'}
            </m.button>
          )}
        </AnimatePresence>
      </div>
    </m.article>
  )
}

/** A good of an order, carved on its line: its picture with how many it still wants (a ✓ once all are in), its name,
 *  and a peg for each one asked — in, coming with the next Put in (a dashed ring), or still to make. A touch opens its
 *  bubble (src/ui/GoodPic.tsx): its name, how many are in and what the store holds, where it comes from, and — while
 *  the store is short of it — the way there ("Show me", or a remote's "Open"). */
function Line({
  id,
  good,
  want,
  have,
  soon,
  store,
  pop,
  setPop,
  still,
}: {
  id: string
  good: ProduceId
  want: number
  have: number
  soon: number
  store: number
  pop: string | null
  setPop: (key: string | null) => void
  still: boolean
}) {
  const left = Math.max(0, want - have)
  return (
    <li className={`ob-line${left === 0 ? ' in' : ''}`}>
      <GoodPic
        good={good}
        count={left > 0 ? left : undefined}
        className="ob-good"
        label={`${nameOf(good, want)}: ${have} of ${want} in`}
        open={pop === id}
        onOpenChange={(o) => setPop(o ? id : null)}
        walk={left > store}
        lines={
          <>
            <span className={`ob-pop-state${left === 0 ? ' in' : ''}`}>{left === 0 ? `All ${want} in` : `${have} of ${want} in · ${left} more`}</span>
            <span className="ob-pop-store">{store > 0 ? `${store} in store` : 'None in store'}</span>
          </>
        }
      >
        <AnimatePresence>
          {left === 0 && (
            <m.b key="in" className="ob-in" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.pop, delay: still ? 0 : Math.min(0.5, 0.05 * want) }}>
              <Check weight="bold" />
            </m.b>
          )}
        </AnimatePresence>
      </GoodPic>
      <span className="ob-name">{nameOf(good, want)}</span>
      <m.span
        className="ob-pegs"
        aria-hidden="true"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: still ? 0 : Math.min(0.045, 0.6 / want), delayChildren: 0.15 } } }}
      >
        {Array.from({ length: want }, (_, i) => (
          <m.i key={`${i}${i < have ? 'f' : i < have + soon ? 's' : 'e'}`} className={i < have ? 'full' : i < have + soon ? 'soon' : ''} variants={i < have ? PEG : undefined} />
        ))}
      </m.span>
    </li>
  )
}

/** A place waiting for its next order: a ring that runs down with the time. */
function Waiting({ ref, left, full, delay }: { ref?: Ref<HTMLDivElement>; left: number; full: number; delay: number }) {
  const present = useIsPresent()
  const share = full > 0 ? Math.max(0, Math.min(1, left / full)) : 0
  return (
    <m.div ref={ref} className={`${present ? 'farm-order waiting ' : ''}ob-wait`} custom={delay} variants={PLANK} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.9 }} layout>
      <i className="ob-nail tl" />
      <i className="ob-nail tr" />
      <span className="ob-ring" style={{ ['--share' as string]: share }} aria-hidden="true">
        <img className="art" src={art('hourglass-done')} alt="" />
      </span>
      <span className="ob-wait-words">
        New order in <b>{clock(left)}</b>
      </span>
    </m.div>
  )
}

/** An office upgrade as the farm shop shows its own: its picture, name, level and what it changes, its price. */
function OfficeUpgrade({ r, coins, onAsk }: { r: OfficeRow; coins: number; onAsk: () => void }) {
  return (
    <div className={`ob-up farm-shop-item${r.max ? ' max' : ''}`}>
      <img className="art" src={art(r.pic)} alt="" />
      <span className="ob-up-text">
        <b>{r.name}</b>
        <span className="ob-up-line">
          <span className={`tag ${r.max ? 'ok' : 'level'}`}>{r.max ? 'Max' : `Level ${r.level + 1}`}</span>
          <span className="tag effect">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span key={r.now} initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} exit={{ rotateX: -90, opacity: 0 }} transition={{ duration: 0.25, ease: EASE.out }}>
                {r.now}
              </m.span>
            </AnimatePresence>
            {!r.max && (
              <>
                <ArrowRight weight="bold" />
                <b>{r.next}</b>
              </>
            )}
          </span>
        </span>
      </span>
      {r.max ? (
        <span className="ob-up-done" aria-label={`${r.name}: done`}>
          <Check weight="bold" />
        </span>
      ) : (
        <m.button className="btn small ob-up-buy" disabled={coins < r.price} {...PRESS} onClick={onAsk} aria-label={`${r.name}, level ${r.level + 1}, for ${r.price} coins`}>
          <Coins n={r.price} />
        </m.button>
      )}
    </div>
  )
}

/** How long the card's Buy waits before it can be pressed: a second tap of the price that opened it lands on nothing. */
const ARM_MS = 450

/** The card that asks before an office upgrade is bought: its picture, what it changes, what it is, its price. */
function OfficeCard({ r, coins, onCancel, onBuy }: { r: OfficeRow; coins: number; onCancel: () => void; onBuy: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setArmed(true), ARM_MS)
    return () => window.clearTimeout(t)
  }, [])
  const afford = !r.max && coins >= r.price
  return (
    <m.div className="ob-ask-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onCancel}>
      <m.div
        className="ob-ask paper"
        role="dialog"
        aria-label={`Buy ${r.name}`}
        initial={{ opacity: 0, scale: 0.86, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.14 } }}
        transition={SPRING.pop}
        onClick={(e) => e.stopPropagation()}
      >
        <img className="art ob-ask-art" src={art(r.pic)} alt="" />
        <h3>{r.name}</h3>
        <span className="tag effect ob-ask-effect">
          {r.now} <ArrowRight weight="bold" /> <b>{r.next}</b>
        </span>
        <p>{r.blurb}</p>
        <div className="farm-confirm">
          <m.button className="btn soft" onClick={onCancel} {...PRESS}>
            Cancel
          </m.button>
          <m.button
            className={`btn primary farm-buy${armed ? '' : ' arming'}`}
            disabled={!afford}
            aria-disabled={!armed}
            onClick={() => armed && onBuy()}
            {...PRESS}
            aria-label={afford ? `Buy ${r.name} for ${r.price} coins` : `${r.name}: needs ${r.price - coins} more coins`}
          >
            {afford ? (
              <>
                Buy <Coins n={r.price} />
              </>
            ) : (
              <>Needs {r.price - coins} more</>
            )}
          </m.button>
        </div>
      </m.div>
    </m.div>
  )
}
