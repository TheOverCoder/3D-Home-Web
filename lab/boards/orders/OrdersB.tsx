import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { art } from '../../../src/ui/art'
import { Clock, X } from '../../../src/ui/glyphs'
import { iconUrl } from '../../../src/farm/icons'
import { PRESS, SPRING } from '../../../src/ui/motion'
import { Coins } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { canPut, clock, complete, decline, placeCount, putIn, sendNow, units, type OrdersState } from './data'
import './orders.css'
import './OrdersB.css'

// B · crates to pack: each order is a crate with a place for every good it asks for, so how much is left is seen, not
// read — empty places show the good faintly, filled ones show it whole. Put in fills the places one after another with
// a little pop each; all in, the crate's lid slides shut with a thud and its label turns green, and Send is the press.
// Sideways the crates stand in a row you can slide. The office's upgrades leave the list (their own card, from the
// office). Its moment: Send — the
// coins fly to the coin chip, the crate slides off towards the tractor, and the next order's empty crate slides in.

const CELL = { hidden: { scale: 0.4, opacity: 0 }, show: { scale: 1, opacity: 1, transition: SPRING.pop } }

export function OrdersB({ s, act }: { s: OrdersState; act: Act<OrdersState> }) {
  const open = s.slots.filter((x) => 'order' in x).length
  return (
    <LevelSheet name="v-orders v-orders-b" label="Orders" onClose={act.close}>
      <m.header className="ob-head" variants={ITEM}>
        <img className="art" src={art('package')} alt="" />
        <h2>Orders</h2>
        <span className="tag">
          {open}/{placeCount(s)}
        </span>
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.div className="ob-row" variants={ITEM}>
        <AnimatePresence mode="popLayout" initial={false}>
          {s.slots.map((slot, k) =>
            'order' in slot ? (
              <Crate key={slot.order.id} s={s} k={k} act={act} />
            ) : (
              <m.div key={`wait-${k}`} className="ob-wait" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={SPRING.sheet}>
                <Clock weight="bold" />
                <span>
                  New order in <b>{clock(slot.wait)}</b>
                </span>
              </m.div>
            ),
          )}
        </AnimatePresence>
      </m.div>
      <m.p className="ob-foot" variants={ITEM}>
        <img className="art" src={art('tractor')} alt="" />
        {s.tractor.back !== null ? `The tractor is out, back in ${clock(s.tractor.back)}` : 'The tractor waits in its yard'}
      </m.p>
    </LevelSheet>
  )
}

function Crate({ s, k, act }: { s: OrdersState; k: number; act: Act<OrdersState> }) {
  const still = useReducedMotion()
  const slot = s.slots[k]
  if (!('order' in slot)) return null
  const o = slot.order
  const done = complete(o)
  const u = units(o)
  const can = canPut(s, o)
  // every place in the crate: one per good asked for, filled as far as it is in
  const cells = o.lines.flatMap((l) => Array.from({ length: l.want }, (_, i) => ({ good: l.good, full: i < l.have, key: `${l.good}${i}` })))
  return (
    <m.article
      className={`ob-crate${done ? ' done' : ''}`}
      layout
      initial={{ opacity: 0, x: -60, rotate: -3 }}
      animate={{ opacity: 1, x: 0, rotate: 0 }}
      exit={{ opacity: 0, x: 140, rotate: 4, transition: { duration: 0.3, ease: 'easeIn' } }}
      transition={SPRING.sheet}
      aria-label={`Order: ${u.have} of ${u.want} in, pays ${o.coins} coins`}
    >
      <header className="ob-label">
        <span className="ob-count">
          {u.have}/{u.want}
        </span>
        <span className="ob-pay">
          <Coins n={o.coins} />
          {o.surprise && <img className="art" src={art('wrapped-gift')} alt="and a surprise" />}
        </span>
        <m.button className="ob-no" {...PRESS} onClick={() => act.set(decline(s, k))} aria-label="Decline this order">
          <X weight="bold" />
        </m.button>
      </header>
      <div className="ob-box">
        <m.div className="ob-cells" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: still ? 0 : 0.025 } } }}>
          {cells.map((c) => (
            <m.span key={`${c.key}${c.full ? 'f' : 'e'}`} className={`ob-cell${c.full ? ' full' : ''}`} variants={CELL}>
              <img src={iconUrl(c.good)} alt="" />
            </m.span>
          ))}
        </m.div>
        {/* the lid slides shut when it is all in */}
        <AnimatePresence>
          {done && (
            <m.span
              key="lid"
              className="ob-lid"
              initial={{ y: '-110%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.15 }}
              aria-hidden="true"
            >
              <b>Ready</b>
            </m.span>
          )}
        </AnimatePresence>
      </div>
      {done ? (
        <m.button
          className="btn leaf ob-send"
          whileTap={{ scale: 0.95, y: 3 }}
          transition={SPRING.pop}
          onClick={(e) => sendNow(s, act, k, e.currentTarget, 420)}
          aria-label={`Send this order for ${o.coins} coins`}
        >
          Send <Coins n={o.coins} />
        </m.button>
      ) : (
        <m.button className="btn soft ob-put" disabled={!can} {...PRESS} onClick={() => act.set(putIn(s, k))}>
          {can ? `Put in ${can}` : 'None in store'}
        </m.button>
      )}
    </m.article>
  )
}
