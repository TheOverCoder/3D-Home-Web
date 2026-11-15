import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { Popover, Tabs } from 'radix-ui'
import { useState } from 'react'
import type { ProduceId } from '../../../src/farm/data'
import { art } from '../../../src/ui/art'
import { ArrowRight, Check, Clock, NavigationArrow, X } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { PRESS, SPRING } from '../../../src/ui/motion'
import { Coins } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { canPut, clock, complete, crates, decline, nameOf, officeRows, placeCount, putIn, sendNow, type OrdersState } from './data'
import { sourceOf } from './sources'
import './orders.css'
import './OrdersD.css'

// D · the wooden order board, round 2: A and B made one, as the user asked. The sheet holds a board of wood, and each
// order is a plank nailed to it with the whole order carved into it: every good it asks for on a line of its own — its
// picture with the one number of how many it still wants (A: never two numbers; a ✓ once all are in), its name carved
// in the wood, and a peg for every one it asks (B: how much is left is seen, not read — pegs fill as goods go in). A
// touch on a good, missing or in, says its name in a bubble, with how many are in and how many the silo or the barn
// holds. At the plank's foot, carved, what it pays and its crates, beside its one main press: Put in (quiet, with how
// many can go in now) until all are in, then Send (green), and a small × to decline. The office's
// upgrades are a tab of their own (A). Its moments: Put in — the pegs fill one by one with a pop, the numbers count
// down, a ✓ pops on each good done; all in, READY is branded into the plank and Send springs up. Send — the coins fly
// to the coin chip, the plank swings off its nails and slides away, and the next order drops onto the nails.
//
// E is the same board with a feature the game does not have (`find`): the bubble of a good also says where it comes
// from (a bed, the hens, the mill from wheat…), and "Show me" puts that place on the compass (./sources.ts).

const PLANKS = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }
const PLANK = {
  hidden: { opacity: 0, y: -26, rotate: -2 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 520, damping: 22 } },
} as const
const PEG = { hidden: { scale: 0.2, opacity: 0 }, show: { scale: 1, opacity: 1, transition: SPRING.pop } }

export function OrdersD({ s, act, find = false }: { s: OrdersState; act: Act<OrdersState>; find?: boolean }) {
  const [tab, setTab] = useState('orders')
  const [shown, setShown] = useState<string | null>(null)
  const open = s.slots.filter((x) => 'order' in x).length
  return (
    <>
      <LevelSheet name={`v-orders v-orders-d${find ? ' v-orders-e' : ''}`} label="Orders" onClose={act.close}>
        <m.header className="od-head" variants={ITEM}>
          <img className="art" src={art('clipboard')} alt="" />
          <h2>Orders</h2>
          <span className="tag">
            {open}/{placeCount(s)}
          </span>
          <span className="tag od-tractor">
            <img src={art('tractor')} alt="" />
            {s.tractor.back !== null ? `back in ${clock(s.tractor.back)}` : 'in the yard'}
          </span>
          <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
            <X weight="bold" />
          </m.button>
        </m.header>
        <Tabs.Root value={tab} onValueChange={setTab} className="od-tabs">
          <m.div variants={ITEM}>
            <Tabs.List className="od-tablist" aria-label="Orders and the office">
              {['orders', 'office'].map((t) => (
                <Tabs.Trigger key={t} value={t} className="od-tab">
                  {t === 'orders' ? 'Orders' : 'Office'}
                  {tab === t && <m.span className="od-tab-on" layoutId="od-tab-on" transition={SPRING.pop} />}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </m.div>
          <Tabs.Content value="orders" className="od-board" forceMount hidden={tab !== 'orders'}>
            <m.div className="od-planks" variants={PLANKS} initial="hidden" animate="show">
              <AnimatePresence mode="popLayout" initial={false}>
                {s.slots.map((slot, k) =>
                  'order' in slot ? (
                    <Plank key={slot.order.id} s={s} k={k} act={act} find={find} onShow={setShown} />
                  ) : (
                    <m.div key={`wait-${k}`} className="od-wait" variants={PLANK} initial="hidden" animate="show" exit={{ opacity: 0 }}>
                      <i className="od-nail tl" />
                      <i className="od-nail tr" />
                      <Clock weight="bold" />
                      <span>
                        New order in <b>{clock(slot.wait)}</b>
                      </span>
                    </m.div>
                  ),
                )}
              </AnimatePresence>
            </m.div>
          </Tabs.Content>
          <Tabs.Content value="office" className="od-office" forceMount hidden={tab !== 'office'}>
            {officeRows(s).map((r) => (
              <div key={r.id} className="od-up">
                <img className="art" src={r.pic} alt="" />
                <span className="od-up-text">
                  <b>{r.name}</b>
                  <span className="tag effect">
                    {r.now}
                    <ArrowRight weight="bold" />
                    <b>{r.next}</b>
                  </span>
                </span>
                <m.button className="btn small" {...PRESS} aria-label={`${r.name} for ${r.price} coins`}>
                  <Coins n={r.price} />
                </m.button>
              </div>
            ))}
          </Tabs.Content>
        </Tabs.Root>
      </LevelSheet>
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

/** An order: a plank nailed to the board, the whole order carved into it. */
function Plank({ s, k, act, find, onShow }: { s: OrdersState; k: number; act: Act<OrdersState>; find: boolean; onShow: (where: string) => void }) {
  const still = useReducedMotion()
  const slot = s.slots[k]
  if (!('order' in slot)) return null
  const o = slot.order
  const done = complete(o)
  const can = canPut(s, o)
  return (
    <m.article
      className={`od-plank${done ? ' done' : ''}`}
      layout
      variants={PLANK}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, x: 120, y: 30, rotate: 14, transition: { duration: 0.36, ease: 'easeIn' } }}
      aria-label={`Order for ${o.coins} coins`}
    >
      <i className="od-nail tl" />
      <i className="od-nail tr" />
      <ul className="od-lines">
        {o.lines.map((l) => (
          <Line key={l.good} good={l.good} want={l.want} have={l.have} store={s.inv[l.good] ?? 0} find={find} onShow={onShow} still={!!still} />
        ))}
      </ul>
      <AnimatePresence>
        {done && (
          <m.b
            key="ready"
            className="od-brand"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 2.4, rotate: -24 }}
            animate={{ opacity: 1, scale: [2.4, 0.92, 1.04, 1], rotate: -9 }}
            transition={{ duration: 0.42, times: [0, 0.55, 0.8, 1], ease: 'easeOut', delay: 0.18 }}
          >
            Ready
          </m.b>
        )}
      </AnimatePresence>
      <footer className="od-foot">
        <span className="od-pays">
          {!done && (
            <>
              <img className="art" src={art('coin')} alt="" />
              <b>{o.coins}</b>
            </>
          )}
          {o.surprise && <img className="art od-surprise" src={art('wrapped-gift')} alt="and a surprise" />}
          <span className="od-crates" aria-label={`${crates(o)} crates`}>
            {Array.from({ length: crates(o) }, (_, i) => (
              <img key={i} className="art" src={art('package')} alt="" />
            ))}
          </span>
        </span>
        <div className="od-act">
          <AnimatePresence mode="popLayout" initial={false}>
            {done ? (
              <m.button
                key="send"
                className="btn leaf od-send"
                initial={{ opacity: 0, scale: 0.7, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ ...SPRING.soft, delay: 0.3 }}
                whileTap={{ scale: 0.95, y: 3 }}
                onClick={(e) => sendNow(s, act, k, e.currentTarget, 420)}
                aria-label={`Send this order for ${o.coins} coins`}
              >
                Send <Coins n={o.coins} />
              </m.button>
            ) : (
              <m.button key="put" className="btn soft od-put" disabled={!can} {...PRESS} onClick={() => act.set(putIn(s, k))} exit={{ opacity: 0, scale: 0.9 }}>
                {can ? `Put in ${can}` : 'None in store yet'}
              </m.button>
            )}
          </AnimatePresence>
        </div>
        <m.button className="od-no" {...PRESS} onClick={() => act.set(decline(s, k))} aria-label="Decline this order">
          <X weight="bold" />
        </m.button>
      </footer>
    </m.article>
  )
}

/** A good of an order, carved on its line: its picture with how many it still wants (a ✓ once all are in), its name,
 *  and a peg for each one asked, filled as they go in. A touch says its name in a bubble. */
function Line({ good, want, have, store, find, onShow, still }: { good: ProduceId; want: number; have: number; store: number; find: boolean; onShow: (where: string) => void; still: boolean }) {
  const left = Math.max(0, want - have)
  const src = find ? sourceOf(good) : null
  return (
    <li className={`od-line${left === 0 ? ' in' : ''}`}>
      <Popover.Root>
        <Popover.Trigger asChild>
          <m.button className="od-good" aria-label={`${nameOf(good, want)}: ${have} of ${want} in`} whileTap={{ scale: 0.9, rotate: -6 }} transition={SPRING.pop}>
            <ItemPic id={good} count={left > 0 ? left : undefined} />
            <AnimatePresence>
              {left === 0 && (
                <m.b key="in" className="od-in" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.pop, delay: still ? 0 : 0.05 * want }}>
                  <Check weight="bold" />
                </m.b>
              )}
            </AnimatePresence>
          </m.button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="v-orders-d-pop" side="top" sideOffset={6} collisionPadding={12}>
            <m.div initial={{ opacity: 0, scale: 0.85, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING.pop}>
              <b className="v-orders-d-pop-name">{nameOf(good, 1)}</b>
              <span className={`v-orders-d-pop-state${left === 0 ? ' in' : ''}`}>{left === 0 ? `All ${want} in` : `${have} of ${want} in · ${left} more`}</span>
              <span className="v-orders-d-pop-store">{store > 0 ? `${store} in store` : 'None in store'}</span>
              {src && (
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
              )}
              {src && left > 0 && (
                <Popover.Close asChild>
                  <button className="btn soft small v-orders-e-show" onClick={() => onShow(src.place)}>
                    <NavigationArrow weight="fill" /> Show me
                  </button>
                </Popover.Close>
              )}
            </m.div>
            <Popover.Arrow className="v-orders-d-pop-arrow" width={14} height={7} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <span className="od-name">{nameOf(good, want)}</span>
      <m.span className="od-pegs" aria-hidden="true" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: still ? 0 : 0.045, delayChildren: 0.15 } } }}>
        {Array.from({ length: want }, (_, i) => (
          <m.i key={`${i}${i < have ? 'f' : 'e'}`} className={i < have ? 'full' : ''} variants={i < have ? PEG : undefined} />
        ))}
      </m.span>
    </li>
  )
}
