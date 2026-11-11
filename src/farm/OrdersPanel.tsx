import { useEffect, useState, type ReactNode } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { ItemPic } from '../ui/ItemPic'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { art, type ArtId } from '../ui/art'
import { ArrowRight, Check, Clock, X } from '../ui/glyphs'
import { OFFICE_UPGRADES, orderSlots, orderWait, produceById, type OfficeUpgradeId } from './data'
import { isComplete, type Order } from './orders'
import { buyOffice, canFill, clockText, declineOrder, farm, fillOrder, gateX, officeLevel, officeMaxed, officePrice, orderPlaces, orderWaitSeconds, sendOrder, useFarm } from './state'
import { tripSeconds } from './tractorRoute'

// The order board on the office's computer: each order with what it asks for (each good with how many, and how many
// are in so far), what it pays and whether it brings a surprise; Put in (what the silo and the barn have of it; the
// rest can follow), Send once it is all in (paid at once; its crates go out on the tractor), or a small × to decline
// it (what was put in goes back). A place whose order was declined counts down to the next. Under them, the office's
// two upgrades, as the farm shop shows its own: a card each, its level and what it changes, its price — which opens a
// card that asks first.

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** What the tractor is doing, as a chip: in its yard (with crates waiting to go: how many), or out (back in m:ss). */
function TractorTag() {
  const d = farm.dispatch
  const out = d.trip >= 0
  return (
    <span className="tag" title={out ? 'The tractor is out delivering' : 'The tractor is in its yard'}>
      <img src={art('tractor')} alt="" />
      {out ? `back in ${clockText(tripSeconds(d.aboard, gateX()) - d.trip)}` : 'in the yard'}
      {d.waiting > 0 && ` · ${d.waiting} waiting`}
    </span>
  )
}

/** One order: its goods (how many it asks for on each picture; under it, how many are in), its pay, its surprise. */
function OrderCard({ k, order }: { k: number; order: Order }) {
  const done = isComplete(order)
  const words = order.lines.map((l) => `${l.want} ${l.want === 1 ? produceById(l.good).name : produceById(l.good).plural}`).join(', ')
  return (
    <div className={`farm-order${done ? ' ok' : ''}`}>
      <div className="farm-order-goods" aria-label={words}>
        {order.lines.map((l) => {
          const ok = l.have >= l.want
          return (
            <div key={l.good} className="farm-order-line" title={`${cap(produceById(l.good).plural)}: ${l.have} of ${l.want} in`}>
              <ItemPic id={l.good} count={l.want} />
              <span className={`tag ${ok ? 'ok' : 'short'}`}>
                {ok && <Check weight="bold" />}
                {l.have}/{l.want}
              </span>
            </div>
          )
        })}
      </div>
      <div className="farm-order-foot">
        <span className="farm-order-pay">
          <Coins n={order.coins} />
          {order.surprise && <img className="farm-surprise" src={art('wrapped-gift')} alt="and a surprise" title="Brings a surprise" />}
        </span>
        <div className="farm-buyer-actions">
          {done ? (
            <button
              className="btn leaf small"
              onClick={() => {
                if (sendOrder(k)) playGesture('interact')
              }}
              aria-label={`Send this order for ${order.coins} coins`}
            >
              Send <Coins n={order.coins} />
            </button>
          ) : (
            <button
              className="btn small"
              disabled={!canFill(k)}
              onClick={() => {
                if (fillOrder(k)) {
                  uiClick()
                  farmSound('plant')
                }
              }}
            >
              Put in
            </button>
          )}
          <button className="btn soft round small" onClick={() => declineOrder(k)} aria-label="Decline this order">
            <X weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** A place on the board whose order was declined: the next one's countdown. */
const WaitCard = ({ wait }: { wait: number }) => (
  <div className="farm-order waiting">
    <Clock weight="bold" />
    <span>New order in {clockText(wait)}</span>
  </div>
)

/** Each office upgrade's picture. */
const OFFICE_ART: Record<OfficeUpgradeId, ArtId> = { slots: 'clipboard', wait: 'hourglass-done' }

/** Where an office upgrade stands: its level, and what it changes now → after the next step. */
function officeStep(id: OfficeUpgradeId): { now: string; next: string | null; icon: ReactNode } {
  const l = officeLevel(id)
  const max = officeMaxed(id)
  if (id === 'slots') return { now: String(orderSlots(l)), next: max ? null : String(orderSlots(l + 1)), icon: <img src={art('clipboard')} alt="" /> }
  return { now: clockText(orderWait(l)), next: max ? null : clockText(orderWait(l + 1)), icon: <Clock weight="bold" /> }
}

/** An office upgrade as the farm shop shows its own: picture, name, level and what it changes, its price. */
function OfficeUpgrade({ id }: { id: OfficeUpgradeId }) {
  const openPanel = useHome((s) => s.openPanel)
  const def = OFFICE_UPGRADES[id]
  const has = officeMaxed(id)
  const price = officePrice(id)
  const step = officeStep(id)
  return (
    <div className={`farm-shop-item${has ? ' owned' : ''}`}>
      <img className="art" src={art(OFFICE_ART[id])} alt="" />
      <div className="farm-shop-text">
        <strong>{def.name}</strong>
        <div className="farm-shop-tags">
          <span className={`tag ${has ? 'ok' : 'level'}`}>{has ? 'Max' : `Level ${officeLevel(id) + 1}`}</span>
          <span className="tag effect">
            {step.icon}
            {step.now}
            {step.next && (
              <>
                <ArrowRight weight="bold" className="effect-arrow" />
                <b>{step.next}</b>
              </>
            )}
          </span>
        </div>
        <small className="farm-shop-blurb">{def.blurb}</small>
      </div>
      <button
        className={`btn small${has ? ' soft' : ''}`}
        disabled={has || farm.coins < price}
        onClick={() => openPanel({ kind: 'office-upgrade', id })}
        aria-label={has ? `${def.name}: done` : `${def.name}, level ${officeLevel(id) + 1}, for ${price} coins`}
      >
        {has ? <Check weight="bold" /> : <Coins n={price} />}
      </button>
    </div>
  )
}

/** The order board. */
export function OrdersPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // the countdowns and the tractor's time tick on while the panel is open
  const [, setSecond] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSecond((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const open = farm.orders.filter((slot) => 'order' in slot).length
  return (
    <Shell
      title="Orders"
      art={art('clipboard')}
      sub={
        <>
          <Purse />
          <span className="tag" title="Orders on the board">
            <img src={art('clipboard')} alt="" />
            {open}/{orderPlaces()}
          </span>
          <TractorTag />
        </>
      }
      onClose={close}
    >
      <div className="farm-list farm-orders">
        {farm.orders.map((slot, k) => ('order' in slot ? <OrderCard key={slot.order.id} k={k} order={slot.order} /> : <WaitCard key={`wait-${k}`} wait={slot.wait} />))}
      </div>
      <div className="farm-shop farm-office">
        <OfficeUpgrade id="slots" />
        <OfficeUpgrade id="wait" />
      </div>
    </Shell>
  )
}

/** The card that asks before an office upgrade is bought: what it is, what it changes, and its price. */
export function OfficeUpgradePanel({ id }: { id: OfficeUpgradeId }) {
  useFarm((s) => s.rev)
  const openPanel = useHome((s) => s.openPanel)
  const close = useHome((s) => s.closePanel)
  const armed = useArmed()
  const def = OFFICE_UPGRADES[id]
  const price = officePrice(id)
  const step = officeStep(id)
  const afford = farm.coins >= price && !officeMaxed(id)
  const back = () => openPanel({ kind: 'orders' })
  const confirm = () => {
    if (!armed || !buyOffice(id)) return
    farmSound('build')
    playGesture('interact')
    back()
  }
  return (
    <Shell
      title={def.name}
      art={art(OFFICE_ART[id])}
      sub={
        <>
          <Purse />
          <span className="tag effect">
            {step.icon}
            {step.now}
            {step.next && (
              <>
                <ArrowRight weight="bold" className="effect-arrow" />
                <b>{step.next}</b>
              </>
            )}
          </span>
        </>
      }
      onClose={close}
    >
      <p className="farm-line">{id === 'slots' ? `Up to ${orderSlots(officeLevel(id) + 1)} orders at a time.` : `A new order every ${clockText(orderWaitSeconds() - 60)}.`}</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={back}>
          Not now
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={confirm}>
          {afford || officeMaxed(id) ? (
            <>
              Buy · <Coins n={price} />
            </>
          ) : (
            <>Needs {price - farm.coins} more</>
          )}
        </button>
      </div>
    </Shell>
  )
}
