import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { Popover, Tabs } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { OFFICE_UPGRADES, type ProduceId } from '../../../src/farm/data'
import { art } from '../../../src/ui/art'
import { ArrowRight, Check, NavigationArrow, X } from '../../../src/ui/glyphs'
import { iconUrl } from '../../../src/farm/icons'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { Coins } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { buyOffice, canPut, clock, complete, crates, decline, goingIn, nameOf, officeRows, placeCount, putIn, sendNow, type OfficeId, type OrdersState } from './data'
import { sourceOf } from './sources'
import './orders.css'
import './OrdersE.css'

// E · the wooden order board, round 3 (chosen: ✓ E; "better on every screen, animate what moves, more visual upgrades,
// the Office tab must work too, smarter where it can be"). D is gone: E was D with one thing more inside a bubble, so
// the two looked the same; this is the one reference.
//
// The sheet holds a board of dark wood, each order a plank nailed to it: at its head, carved, what it pays and its
// crates (and a small × to decline); under it each good on a line of its own — its picture with how many it still
// wants (a ✓ once all are in), its name carved, and a peg for each one asked: full (in), a dashed yellow ring (what
// Put in would add now: the next press seen before it is made), or empty (still to make). At its foot one press: Put
// in N (quiet), then Send (green), the plank glowing and a READY tag swinging from its nail. A touch on a good says
// its name, how many are in, what the store holds, where it comes from, and "Show me" (✦).
//
// Its moments: Put in — the goods fly from the press into their lines on an arc, one by one, the pegs fill with a pop
// and the numbers count down; all in, the tag swings onto its nail and Send springs up. Send — the coins fly to the
// coin chip, the crates jump onto the tractor's chip, the plank swings off its nails, and the next order drops in.
// × — the plank falls. A place waiting counts down on a ring. The Office tab buys for real, after a card: the row's
// number turns over to the next, the board gets its new place (it waits for its first order) or the waits get shorter.
//
// Every screen: upright the planks one under another (two side by side on a tablet), the board scrolls by itself and
// only the title and the grabber swipe the sheet away; sideways the sheet is wider and the planks stand in a row that
// slides (three fit; dots say how many), never cut.

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

let flightId = 0

export function OrdersE({ s, act }: { s: OrdersState; act: Act<OrdersState> }) {
  const [tab, setTab] = useState('orders')
  const [shown, setShown] = useState<string | null>(null)
  const [flights, setFlights] = useState<Flight[]>([])
  const [asking, setAsking] = useState<OfficeId | null>(null)
  const [bought, setBought] = useState<string | null>(null)
  const still = useReducedMotion()
  const board = useRef<HTMLDivElement>(null)
  const open = s.slots.filter((x) => 'order' in x).length
  const ready = s.slots.filter((x) => 'order' in x && complete(x.order)).length
  const [crateHop, setCrateHop] = useState(0)

  /** Put in: the goods fly into their lines, then they are in (at once for reduced motion). */
  const put = (k: number, from: HTMLElement) => {
    const slot = s.slots[k]
    if (!('order' in slot)) return
    const go = goingIn(s, slot.order)
    if (still || !board.current) return act.set(putIn(s, k))
    const r = from.getBoundingClientRect()
    const fx = r.left + r.width / 2
    const fy = r.top + r.height / 2
    const plank = board.current.querySelector(`[data-plank="${k}"]`)
    const list: Flight[] = []
    let i = 0
    for (const [good, n] of go) {
      const to = plank?.querySelector(`[data-good="${good}"]`)?.getBoundingClientRect()
      if (!to) continue
      for (let j = 0; j < Math.min(n, 3); j++) list.push({ id: ++flightId, pic: iconUrl(good), x: fx, y: fy, tx: to.left + to.width / 2, ty: to.top + to.height / 2, delay: i++ * 0.045 })
    }
    setFlights((f) => [...f, ...list])
    const land = 340 + i * 45
    setTimeout(() => {
      setFlights((f) => f.filter((x) => !list.includes(x)))
      act.set(putIn(s, k))
    }, land)
  }

  const send = (k: number, el: HTMLElement) => {
    sendNow(s, act, k, el, 420)
    setTimeout(() => setCrateHop((n) => n + 1), 260)
  }

  return (
    <>
      <LevelSheet name="v-orders v-orders-e" label="Orders" scrolls onClose={act.close}>
        <Tabs.Root value={tab} onValueChange={setTab} className="oe-tabs">
          <m.header className="oe-head" variants={ITEM}>
            <img className="art oe-head-art" src={art('clipboard')} alt="" />
            <h2>Orders</h2>
            <m.span
              key={crateHop}
              className={`tag oe-tractor${s.tractor.back !== null ? ' out' : ''}`}
              initial={crateHop ? { scale: 1.3, rotate: -6 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={SPRING.pop}
            >
              <img src={art('tractor')} alt="" />
              {s.tractor.back !== null ? (
                <>
                  back in <b>{clock(s.tractor.back)}</b>
                </>
              ) : s.tractor.waiting > 0 ? (
                <>
                  <b>{s.tractor.waiting}</b> crates waiting
                </>
              ) : (
                'in the yard'
              )}
            </m.span>
            <Tabs.List className="oe-tablist" aria-label="Orders and the office">
              <Tabs.Trigger value="orders" className="oe-tab">
                Orders
                <span className="oe-tab-n" aria-label={`${open} of ${placeCount(s)} places`}>
                  {open}/{placeCount(s)}
                </span>
                {ready > 0 && (
                  <m.b key={ready} className="oe-tab-ready" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.pop} aria-label={`${ready} ready to send`}>
                    {ready}
                  </m.b>
                )}
                {tab === 'orders' && <m.span className="oe-tab-on" layoutId="oe-tab-on" transition={SPRING.pop} />}
              </Tabs.Trigger>
              <Tabs.Trigger value="office" className="oe-tab">
                Office
                {tab === 'office' && <m.span className="oe-tab-on" layoutId="oe-tab-on" transition={SPRING.pop} />}
              </Tabs.Trigger>
            </Tabs.List>
            <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
              <X weight="bold" />
            </m.button>
          </m.header>
          <Tabs.Content value="orders" className="oe-board" forceMount hidden={tab !== 'orders'} ref={board} data-scroll>
            <m.div className="oe-planks" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } } }}>
              <AnimatePresence mode="popLayout" initial={false}>
                {s.slots.map((slot, k) =>
                  'order' in slot ? <Plank key={slot.order.id} s={s} k={k} act={act} onPut={put} onSend={send} onShow={setShown} /> : <Waiting key={`wait-${k}-${slot.wait}`} seconds={slot.wait} />,
                )}
              </AnimatePresence>
            </m.div>
          </Tabs.Content>
          <Tabs.Content value="office" className="oe-office" forceMount hidden={tab !== 'office'} data-scroll>
            <p className="oe-purse">
              <img className="art" src={art('coin')} alt="" />
              <span>
                You have <b>{s.coins.toLocaleString('en-US')}</b>
              </span>
            </p>
            {officeRows(s).map((r) => (
              <div key={r.id} className={`oe-up${r.max ? ' max' : ''}`}>
                <img className="art" src={r.pic} alt="" />
                <span className="oe-up-text">
                  <b>{r.name}</b>
                  <span className="oe-up-line">
                    <span className={`tag ${r.max ? 'ok' : 'level'}`}>{r.max ? 'Max' : `Level ${r.level + 1}`}</span>
                    <span className="tag effect">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <m.span
                          key={r.now}
                          initial={{ rotateX: 90, opacity: 0 }}
                          animate={{ rotateX: 0, opacity: 1 }}
                          exit={{ rotateX: -90, opacity: 0 }}
                          transition={{ duration: 0.25, ease: EASE.out }}
                        >
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
                  <span className="oe-up-done" aria-label={`${r.name}: done`}>
                    <Check weight="bold" />
                  </span>
                ) : (
                  <m.button
                    className="btn small oe-up-buy"
                    disabled={s.coins < r.price}
                    {...PRESS}
                    onClick={() => setAsking(r.id)}
                    aria-label={`${r.name}, level ${r.level + 1}, for ${r.price} coins`}
                  >
                    <Coins n={r.price} />
                  </m.button>
                )}
              </div>
            ))}
          </Tabs.Content>
        </Tabs.Root>
        <AnimatePresence>
          {bought && (
            <m.p
              key={bought}
              className="oe-bought"
              role="status"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={SPRING.pop}
            >
              <Check weight="bold" /> {bought}
            </m.p>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {asking && (
            <OfficeCard
              key={asking}
              s={s}
              id={asking}
              onCancel={() => setAsking(null)}
              onBuy={() => {
                const r = officeRows(s).find((x) => x.id === asking)!
                const next = buyOffice(s, asking)
                act.set(next)
                setAsking(null)
                setBought(asking === 'slots' ? `The board holds ${r.next.replace(' at a time', '')} orders` : `A new order every ${r.next}`)
                // a new place: back to the board, where its first order drops onto the nails
                if (asking === 'slots' && next !== s) setTimeout(() => setTab('orders'), 700)
                setTimeout(() => setBought(null), 2600)
              }}
            />
          )}
        </AnimatePresence>
      </LevelSheet>
      {/* the goods on their way into an order */}
      <div className="v-orders-e-flights" aria-hidden="true">
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
      <AnimatePresence>
        {shown && (
          <m.div
            key={shown}
            className="v-orders-e-mark"
            role="status"
            initial={{ opacity: 0, y: -16, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
            transition={SPRING.pop}
            onAnimationComplete={() => setTimeout(() => setShown(null), 1600)}
          >
            <NavigationArrow weight="fill" /> {shown} · on your compass
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}

const PLANK = {
  hidden: { opacity: 0, y: -30, rotate: -3 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 520, damping: 22 } },
} as const
const PEG = { hidden: { scale: 0.2, opacity: 0 }, show: { scale: 1, opacity: 1, transition: SPRING.pop } }

/** An order: a plank nailed to the board, the whole order carved into it. */
function Plank({
  s,
  k,
  act,
  onPut,
  onSend,
  onShow,
}: {
  s: OrdersState
  k: number
  act: Act<OrdersState>
  onPut: (k: number, el: HTMLElement) => void
  onSend: (k: number, el: HTMLElement) => void
  onShow: (where: string) => void
}) {
  const still = useReducedMotion()
  const slot = s.slots[k]
  const [falling, setFalling] = useState(false)
  if (!('order' in slot)) return null
  const o = slot.order
  const done = complete(o)
  const can = canPut(s, o)
  const coming = new Map(goingIn(s, o))
  const fills = can > 0 && o.lines.every((l) => l.have + (coming.get(l.good) ?? 0) >= l.want)
  return (
    <m.article
      className={`oe-plank${done ? ' done' : ''}`}
      data-plank={k}
      layout
      variants={PLANK}
      initial="hidden"
      animate="show"
      exit={falling ? { opacity: 0, y: 160, rotate: -16, transition: { duration: 0.4, ease: 'easeIn' } } : { opacity: 0, x: 140, y: 24, rotate: 16, transition: { duration: 0.36, ease: 'easeIn' } }}
      aria-label={`Order for ${o.coins} coins`}
    >
      <i className="oe-nail tl" />
      <i className="oe-nail tr" />
      <header className="oe-pays">
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <m.b
              key="ready"
              className="oe-ready"
              initial={{ opacity: 0, rotate: -60, y: -6 }}
              animate={{ opacity: 1, rotate: [-60, 14, -7, 3, 0], y: 0 }}
              transition={{ duration: 0.8, times: [0, 0.35, 0.6, 0.8, 1], ease: 'easeOut', delay: 0.15 }}
            >
              <Check weight="bold" /> Ready
            </m.b>
          ) : (
            <m.span key="pays" className="oe-coins" exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}>
              <img className="art" src={art('coin')} alt="" />
              <b>{o.coins}</b>
            </m.span>
          )}
        </AnimatePresence>
        {o.surprise && <img className="art oe-surprise" src={art('wrapped-gift')} alt="and a surprise" />}
        <span className="oe-crates" aria-label={`${crates(o)} crates`}>
          {Array.from({ length: crates(o) }, (_, i) => (
            <img key={i} className="art" src={art('package')} alt="" />
          ))}
        </span>
        {!done && (
          <m.button
            className="oe-no"
            {...PRESS}
            onClick={() => {
              setFalling(true)
              setTimeout(() => act.set(decline(s, k)), 0)
            }}
            aria-label="Decline this order"
          >
            <X weight="bold" />
          </m.button>
        )}
      </header>
      <ul className="oe-lines">
        {o.lines.map((l) => (
          <Line key={l.good} good={l.good} want={l.want} have={l.have} soon={coming.get(l.good) ?? 0} store={s.inv[l.good] ?? 0} onShow={onShow} still={!!still} />
        ))}
      </ul>
      <footer className="oe-foot">
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <m.button
              key="send"
              className="btn leaf oe-send"
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
            <m.button key="put" className={`btn ${fills ? 'primary' : 'soft'} oe-put`} disabled={!can} {...PRESS} onClick={(e) => onPut(k, e.currentTarget)} exit={{ opacity: 0, scale: 0.9 }}>
              {can ? (fills ? `Put in ${can} · ready` : `Put in ${can}`) : 'None in store yet'}
            </m.button>
          )}
        </AnimatePresence>
      </footer>
    </m.article>
  )
}

/** A good of an order, carved on its line: its picture with how many it still wants (a ✓ once all are in), its name,
 *  and a peg for each one asked — in, coming with the next Put in (a dashed ring), or still to make. A touch says its
 *  name in a bubble, where it comes from, and offers to show the way. */
function Line({ good, want, have, soon, store, onShow, still }: { good: ProduceId; want: number; have: number; soon: number; store: number; onShow: (where: string) => void; still: boolean }) {
  const left = Math.max(0, want - have)
  const src = sourceOf(good)
  return (
    <li className={`oe-line${left === 0 ? ' in' : ''}`}>
      <Popover.Root>
        <Popover.Trigger asChild>
          <m.button className="oe-good" data-good={good} aria-label={`${nameOf(good, want)}: ${have} of ${want} in`} whileTap={{ scale: 0.9, rotate: -6 }} transition={SPRING.pop}>
            <ItemPic id={good} count={left > 0 ? left : undefined} />
            <AnimatePresence>
              {left === 0 && (
                <m.b key="in" className="oe-in" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.pop, delay: still ? 0 : 0.05 * want }}>
                  <Check weight="bold" />
                </m.b>
              )}
            </AnimatePresence>
          </m.button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="v-orders-e-pop" side="top" sideOffset={6} collisionPadding={12}>
            <m.div initial={{ opacity: 0, scale: 0.85, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING.pop}>
              <b className="v-orders-e-pop-name">{nameOf(good, 1)}</b>
              <span className={`v-orders-e-pop-state${left === 0 ? ' in' : ''}`}>{left === 0 ? `All ${want} in` : `${have} of ${want} in · ${left} more`}</span>
              <span className="v-orders-e-pop-store">{store > 0 ? `${store} in store` : 'None in store'}</span>
              <span className="v-orders-e-src">
                <img className="art" src={art(src.pic)} alt="" />
                <span>
                  {src.words}
                  {src.from && (
                    <span className="v-orders-e-from">
                      {' '}
                      from{' '}
                      {src.from.map((f) => (
                        <ItemPic key={f} id={f} />
                      ))}
                    </span>
                  )}
                </span>
              </span>
              {left > store && (
                <Popover.Close asChild>
                  <button className="btn soft small v-orders-e-show" onClick={() => onShow(src.place)}>
                    <NavigationArrow weight="fill" /> Show me
                  </button>
                </Popover.Close>
              )}
            </m.div>
            <Popover.Arrow className="v-orders-e-pop-arrow" width={14} height={7} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <span className="oe-name">{nameOf(good, want)}</span>
      <m.span className="oe-pegs" aria-hidden="true" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: still ? 0 : 0.045, delayChildren: 0.15 } } }}>
        {Array.from({ length: want }, (_, i) => (
          <m.i key={`${i}${i < have ? 'f' : i < have + soon ? 's' : 'e'}`} className={i < have ? 'full' : i < have + soon ? 'soon' : ''} variants={i < have ? PEG : undefined} />
        ))}
      </m.span>
    </li>
  )
}

/** A place waiting for its next order: a ring that runs down with the time. */
function Waiting({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds)
  const start = useRef(seconds)
  useEffect(() => {
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const share = start.current > 0 ? left / start.current : 0
  return (
    <m.div className="oe-wait" variants={PLANK} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.9 }} layout>
      <i className="oe-nail tl" />
      <i className="oe-nail tr" />
      <span className="oe-ring" style={{ ['--share' as string]: share }} aria-hidden="true">
        <img className="art" src={art('hourglass-done')} alt="" />
      </span>
      <span className="oe-wait-words">
        New order in <b>{clock(left)}</b>
      </span>
    </m.div>
  )
}

/** The card that asks before an office upgrade is bought (as the game's does): its picture, what it changes, its price. */
function OfficeCard({ s, id, onCancel, onBuy }: { s: OrdersState; id: OfficeId; onCancel: () => void; onBuy: () => void }) {
  const r = officeRows(s).find((x) => x.id === id)!
  const def = OFFICE_UPGRADES[id]
  return (
    <m.div className="oe-ask-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onCancel}>
      <m.div
        className="oe-ask paper"
        role="dialog"
        aria-label={`Buy ${def.name}`}
        initial={{ opacity: 0, scale: 0.86, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.14 } }}
        transition={SPRING.pop}
        onClick={(e) => e.stopPropagation()}
      >
        <img className="art oe-ask-art" src={r.pic} alt="" />
        <h3>{def.name}</h3>
        <span className="tag effect oe-ask-effect">
          {r.now} <ArrowRight weight="bold" /> <b>{r.next}</b>
        </span>
        <p>{def.blurb}</p>
        <div className="farm-confirm">
          <m.button className="btn soft" onClick={onCancel} {...PRESS}>
            Cancel
          </m.button>
          <m.button className="btn primary" onClick={onBuy} {...PRESS} aria-label={`Buy ${def.name} for ${r.price} coins`}>
            Buy <Coins n={r.price} />
          </m.button>
        </div>
      </m.div>
    </m.div>
  )
}
