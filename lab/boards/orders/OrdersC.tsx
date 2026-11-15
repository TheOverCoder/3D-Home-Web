import { AnimatePresence, m, type PanInfo } from 'motion/react'
import { useState } from 'react'
import { art } from '../../../src/ui/art'
import { Check, Clock, X } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { Coins } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { canPut, clock, complete, decline, putIn, sendNow, units, type OrdersState } from './data'
import './orders.css'
import './OrdersC.css'

// C · one order at a time: the board is a stack of order cards and you look at one, big — each good large in a ring
// that fills as it goes in, what it pays, one wide press. A swipe (or the dots under it) goes to the next order; the
// dots say which are ready (green) and which places wait for a new one. Sideways the card lies wide, the goods in a
// row. Its moment: Put in — the rings fill one after another; all in, Send turns green with a shine; Send: the coins fly
// to the coin chip and the card flies off the top of the stack to the next one.

export function OrdersC({ s, act }: { s: OrdersState; act: Act<OrdersState> }) {
  const [at, setAt] = useState(0)
  const [dir, setDir] = useState(1)
  const k = Math.min(at, s.slots.length - 1)
  const go = (n: number) => {
    const to = Math.max(0, Math.min(s.slots.length - 1, n))
    setDir(to >= k ? 1 : -1)
    setAt(to)
  }
  const swiped = (_: unknown, i: PanInfo) => {
    if (i.offset.x < -50 || i.velocity.x < -400) go(k + 1)
    else if (i.offset.x > 50 || i.velocity.x > 400) go(k - 1)
  }
  const slot = s.slots[k]
  return (
    <LevelSheet name="v-orders v-orders-c" label="Orders" onClose={act.close}>
      <m.header className="oc-head" variants={ITEM}>
        <img className="art" src={art('clipboard')} alt="" />
        <h2>Orders</h2>
        <span className="tag">
          {k + 1} of {s.slots.length}
        </span>
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.div className="oc-stage" variants={ITEM}>
        {/* the cards behind, as a stack */}
        <span className="oc-behind one" aria-hidden="true" />
        <span className="oc-behind two" aria-hidden="true" />
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <m.div
            key={'order' in slot ? slot.order.id : `wait-${k}`}
            className="oc-card"
            custom={dir}
            initial={{ opacity: 0, x: dir * 120, rotate: dir * 6 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -60, x: -dir * 40, rotate: -dir * 8, transition: { duration: 0.24, ease: 'easeIn' } }}
            transition={SPRING.sheet}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={swiped}
          >
            {'order' in slot ? <Big s={s} k={k} act={act} /> : <Waiting wait={slot.wait} />}
          </m.div>
        </AnimatePresence>
      </m.div>
      <m.nav className="oc-dots" variants={ITEM} aria-label="Orders">
        {s.slots.map((x, i) => (
          <button
            key={i}
            className={`oc-dot${i === k ? ' on' : ''}${'order' in x && complete(x.order) ? ' ready' : ''}${'wait' in x ? ' wait' : ''}`}
            onClick={() => go(i)}
            aria-label={`Order ${i + 1}`}
            aria-current={i === k}
          >
            <i />
          </button>
        ))}
      </m.nav>
    </LevelSheet>
  )
}

function Big({ s, k, act }: { s: OrdersState; k: number; act: Act<OrdersState> }) {
  const slot = s.slots[k]
  if (!('order' in slot)) return null
  const o = slot.order
  const done = complete(o)
  const u = units(o)
  const can = canPut(s, o)
  return (
    <div className={`oc-order${done ? ' done' : ''}`}>
      <div className="oc-top">
        <span className="oc-pay">
          <Coins n={o.coins} />
          {o.surprise && <img className="art" src={art('wrapped-gift')} alt="and a surprise" />}
        </span>
        <span className="oc-units">
          {u.have}/{u.want} in
        </span>
        <m.button className="oc-no" {...PRESS} onClick={() => act.set(decline(s, k))} aria-label="Decline this order">
          <X weight="bold" />
        </m.button>
      </div>
      <div className="oc-goods">
        {o.lines.map((l, i) => {
          const part = l.have / l.want
          const r = 30
          const c = 2 * Math.PI * r
          return (
            <span key={l.good} className={`oc-good${part >= 1 ? ' in' : ''}`}>
              <svg viewBox="0 0 72 72" aria-hidden="true">
                <circle className="oc-track" cx={36} cy={36} r={r} />
                <m.circle
                  className="oc-fill"
                  cx={36}
                  cy={36}
                  r={r}
                  strokeDasharray={c}
                  initial={false}
                  animate={{ strokeDashoffset: c * (1 - part) }}
                  transition={{ duration: 0.5, delay: i * 0.12, ease: EASE.out }}
                  transform="rotate(-90 36 36)"
                />
              </svg>
              <ItemPic id={l.good} count={part >= 1 ? undefined : l.want - l.have} />
              {part >= 1 && (
                <m.b className="oc-in" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.pop, delay: i * 0.12 + 0.3 }}>
                  <Check weight="bold" />
                </m.b>
              )}
            </span>
          )
        })}
      </div>
      {done ? (
        <m.button
          className="btn leaf oc-go"
          whileTap={{ scale: 0.95, y: 3 }}
          transition={SPRING.pop}
          onClick={(e) => sendNow(s, act, k, e.currentTarget, 380)}
          aria-label={`Send this order for ${o.coins} coins`}
        >
          Send <Coins n={o.coins} />
        </m.button>
      ) : (
        <m.button className="btn oc-go" disabled={!can} {...PRESS} onClick={() => act.set(putIn(s, k))}>
          {can ? `Put in ${can}` : 'None in store yet'}
        </m.button>
      )}
    </div>
  )
}

const Waiting = ({ wait }: { wait: number }) => (
  <div className="oc-waiting">
    <Clock weight="bold" />
    <b>{clock(wait)}</b>
    <span>until a new order</span>
  </div>
)
