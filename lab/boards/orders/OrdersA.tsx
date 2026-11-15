import { AnimatePresence, m } from 'motion/react'
import { Tabs } from 'radix-ui'
import { useState } from 'react'
import { art } from '../../../src/ui/art'
import { ArrowRight, Check, Clock, X } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { Coins } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { canPut, clock, complete, crates, decline, officeRows, placeCount, putIn, sendNow, units, type OrdersState } from './data'
import './orders.css'
import './OrdersA.css'

// A · delivery slips: each order a slip — its goods, each with the one number of how many it still wants (a ✓ once
// all are in: never two numbers on one good), one bar for the whole order with its crates at the end, what it pays.
// One main press per slip: Send (green, big) once it is all in; until then Put in (quiet, with how many can go in now),
// and a small × in the corner to decline. The office's upgrades are a tab of their own. Its moment: Put in — the
// numbers count down, the bar fills, a ✓ pops on each good that is done; all in, the slip glows and Send springs up.
// Send: the coins fly to the coin chip and the slip slides out as the next order slides in.

export function OrdersA({ s, act }: { s: OrdersState; act: Act<OrdersState> }) {
  const [tab, setTab] = useState('orders')
  const open = s.slots.filter((x) => 'order' in x).length
  return (
    <LevelSheet name="v-orders v-orders-a" label="Orders" onClose={act.close}>
      <m.header className="oa-head" variants={ITEM}>
        <img className="art" src={art('clipboard')} alt="" />
        <h2>Orders</h2>
        <span className="tag">
          {open}/{placeCount(s)}
        </span>
        <span className="tag oa-tractor">
          <img src={art('tractor')} alt="" />
          {s.tractor.back !== null ? `back in ${clock(s.tractor.back)}` : 'in the yard'}
        </span>
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <Tabs.Root value={tab} onValueChange={setTab} className="oa-tabs">
        <m.div variants={ITEM}>
          <Tabs.List className="oa-tablist" aria-label="Orders and the office">
            <Tabs.Trigger value="orders" className="oa-tab">
              Orders
              {tab === 'orders' && <m.span className="oa-tab-on" layoutId="oa-tab-on" transition={SPRING.pop} />}
            </Tabs.Trigger>
            <Tabs.Trigger value="office" className="oa-tab">
              Office
              {tab === 'office' && <m.span className="oa-tab-on" layoutId="oa-tab-on" transition={SPRING.pop} />}
            </Tabs.Trigger>
          </Tabs.List>
        </m.div>
        <Tabs.Content value="orders" className="oa-list" forceMount hidden={tab !== 'orders'}>
          <AnimatePresence mode="popLayout" initial={false}>
            {s.slots.map((slot, k) =>
              'order' in slot ? (
                <Slip key={slot.order.id} s={s} k={k} act={act} />
              ) : (
                <m.div key={`wait-${k}`} className="oa-wait" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={SPRING.sheet}>
                  <Clock weight="bold" />
                  <span>
                    New order in <b>{clock(slot.wait)}</b>
                  </span>
                </m.div>
              ),
            )}
          </AnimatePresence>
        </Tabs.Content>
        <Tabs.Content value="office" className="oa-office" forceMount hidden={tab !== 'office'}>
          {officeRows(s).map((r) => (
            <div key={r.id} className="oa-up">
              <img className="art" src={r.pic} alt="" />
              <span className="oa-up-text">
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
  )
}

function Slip({ s, k, act }: { s: OrdersState; k: number; act: Act<OrdersState> }) {
  const slot = s.slots[k]
  if (!('order' in slot)) return null
  const o = slot.order
  const u = units(o)
  const done = complete(o)
  const can = canPut(s, o)
  return (
    <m.article
      className={`oa-slip${done ? ' done' : ''}`}
      layout
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.22, ease: 'easeIn' } }}
      transition={SPRING.sheet}
      aria-label={`Order for ${o.coins} coins`}
    >
      <div className="oa-goods">
        {o.lines.map((l) => {
          const left = l.want - l.have
          return (
            <span key={l.good} className={`oa-good${left <= 0 ? ' in' : ''}`}>
              <ItemPic id={l.good} count={left > 0 ? left : undefined} />
              {left <= 0 && (
                <m.b className="oa-in" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={SPRING.pop}>
                  <Check weight="bold" />
                </m.b>
              )}
            </span>
          )
        })}
      </div>
      <div className="oa-bar-row">
        <div className="oa-bar" role="progressbar" aria-label="Put in so far" aria-valuemin={0} aria-valuemax={u.want} aria-valuenow={u.have}>
          <m.i initial={false} animate={{ width: `${(u.have / u.want) * 100}%` }} transition={{ duration: 0.6, ease: EASE.out }} />
        </div>
        <span className="oa-pay">
          <Coins n={o.coins} />
          {o.surprise && <img className="art" src={art('wrapped-gift')} alt="and a surprise" />}
        </span>
        <span className="oa-crates" aria-label={`${crates(o)} crates`}>
          {Array.from({ length: crates(o) }, (_, i) => (
            <img key={i} className="art" src={art('package')} alt="" />
          ))}
        </span>
      </div>
      <div className="oa-acts">
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <m.button
              key="send"
              className="btn leaf oa-send"
              initial={{ opacity: 0, scale: 0.7, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={SPRING.soft}
              whileTap={{ scale: 0.95, y: 3 }}
              onClick={(e) => sendNow(s, act, k, e.currentTarget, 420)}
              aria-label={`Send this order for ${o.coins} coins`}
            >
              Send <Coins n={o.coins} />
            </m.button>
          ) : (
            <m.button key="put" className="btn soft oa-put" disabled={!can} {...PRESS} onClick={() => act.set(putIn(s, k))} exit={{ opacity: 0, scale: 0.9 }}>
              {can ? `Put in ${can}` : 'None in store yet'}
            </m.button>
          )}
        </AnimatePresence>
        <m.button className="oa-no" {...PRESS} onClick={() => act.set(decline(s, k))} aria-label="Decline this order">
          <X weight="bold" />
        </m.button>
      </div>
    </m.article>
  )
}
