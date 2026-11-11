import { useEffect, useState, type ReactNode } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { ItemPic } from '../ui/ItemPic'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { art } from '../ui/art'
import { Check, Clock, Minus, Plus, Users } from '../ui/glyphs'
import { ITEMS, LADDERS, MANAGER, SELLABLE, SHOP, count, produceById, type ProduceId } from './data'
import { buyChance, ladderPrice, managerPay, managerPct, placesOpen, shoppersAtOnce, snapPct, unitPrice } from './market'
import { iconUrl } from './icons'
import { ContractorLink, KeepTag } from './ContractorPanel'
import { LadderRow } from './Ladder'
import { buyMarket, clockText, emptyPlace, farm, fillPlace, ladderLevel, ladderMaxed, ladderOpen, orderAt, sellAllToManager, sellToManager, setPlacePrice, useFarm } from './state'

// The supermarket's panels: the manager's (what he pays for each good you have, his rate and its ladder, buying the
// shop), your shop's computer once it is yours (each place on the shelves with its good, how many, its price and the
// chance a shopper takes one; the next place's price tag; the shoppers' two ladders), one place's card (a good from
// the silo or the barn, how many, its price), and the card that asks before the shop is bought.

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
/** A chance as a whole percent. */
const percent = (p: number) => `${Math.round(p * 100)}%`

/** How many of a good the open orders still want (what is not in yet). */
function ordersWant(good: ProduceId) {
  let n = 0
  for (let k = 0; k < farm.orders.length; k++) for (const l of orderAt(k)?.lines ?? []) if (l.good === good) n += Math.max(0, l.want - l.have)
  return n
}

/** One good the manager buys: how many you have, what the orders still want of it, and Sell (the whole stack). */
function ManagerRow({ id, pct }: { id: ProduceId; pct: number }) {
  const have = farm.inv[id]
  const pay = managerPay(produceById(id).price, have, pct)
  const want = ordersWant(id)
  return (
    <div className="farm-buyer">
      <ItemPic id={id} count={have} className="farm-want" />
      <div className="farm-buyer-body">
        <strong>{cap(produceById(id).plural)}</strong>
        {want > 0 && (
          <span>
            <KeepTag pic={art('clipboard')} have={have} need={want} title={`The orders still want ${count(id, want)}`} />
          </span>
        )}
      </div>
      <div className="farm-buyer-actions">
        <button
          className="btn leaf small"
          disabled={pay <= 0}
          onClick={() => {
            if (sellToManager(id)) playGesture('interact')
          }}
          aria-label={`Sell ${count(id, have)} for ${pay} coins`}
        >
          Sell <Coins n={pay} />
        </button>
      </div>
    </div>
  )
}

/** Buying the shop, shown from the first visit: what it waits for (his best rate, the coins), each as a chip as the
 *  silo's next level shows its materials; its price opens the card once his rate is at its top. */
function ShopRow() {
  const openPanel = useHome((s) => s.openPanel)
  const owned = farm.market.owned
  const top = ladderMaxed('rate')
  const price = MANAGER.shopPrice
  return (
    <div className="farm-upgrade market-buy-row">
      <div className="farm-upgrade-head">
        <img className="art" src={art('convenience-store')} alt="" />
        <strong>Buy the shop</strong>
      </div>
      {owned ? (
        <span className="tag ok">
          <Check weight="bold" />
          Yours
        </span>
      ) : (
        <div className="farm-needs">
          <span className={`tag ${top ? 'ok' : 'short'}`} title="He sells once he pays his best rate">
            {top && <Check weight="bold" />}
            {LADDERS.rate.say(LADDERS.rate.levels)}
          </span>
          <KeepTag pic={art('coin')} have={farm.coins} need={price} title={`It costs ${price} coins`} />
        </div>
      )}
      <button
        className="btn small farm-upgrade-go"
        disabled={owned || !top}
        onClick={() => openPanel({ kind: 'market-buy' })}
        aria-label={owned ? 'The shop is yours' : `Buy the shop for ${price} coins`}
      >
        {owned ? <Check weight="bold" /> : <Coins n={price} />}
      </button>
    </div>
  )
}

/** The manager: Sell each good (the whole stack) at his rate, Sell all, his rate's ladder, and buying the shop. */
export function ManagerPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const armed = useArmed()
  const rate = ladderLevel('rate')
  const pct = managerPct(rate)
  const goods = SELLABLE.filter((id) => farm.inv[id] > 0)
  const all = goods.reduce((n, id) => n + managerPay(produceById(id).price, farm.inv[id], pct), 0)
  return (
    <Shell
      title="The manager"
      art={art('office-worker')}
      sub={
        <>
          <Purse />
          <span className="tag" title="What he pays of a good's price">
            {LADDERS.rate.say(rate)}
          </span>
        </>
      }
      onClose={close}
    >
      <div className="farm-list">
        {goods.map((id) => (
          <ManagerRow key={id} id={id} pct={pct} />
        ))}
        {!goods.length && <p className="farm-empty">Nothing to sell — harvest, collect, bake.</p>}
      </div>
      <button
        className={`primary market-sell-all${armed ? '' : ' arming'}`}
        disabled={all <= 0}
        aria-disabled={!armed}
        onClick={() => {
          if (armed && sellAllToManager()) playGesture('interact')
        }}
      >
        {all > 0 ? (
          <>
            Sell all · <Coins n={all} />
          </>
        ) : (
          'Nothing he pays for yet'
        )}
      </button>
      {ITEMS.some((id) => farm.inv[id] > 0) && <ContractorLink />}
      <div className="farm-shop market-ladders">
        <LadderRow id="rate" />
      </div>
      <ShopRow />
    </Shell>
  )
}

/** One open place on the shelves, as a row: its good, how many of SHOP.units, its price and the chance a shopper takes
 *  one; empty, a dashed ring. Tapped, it opens the place's card. */
function PlaceRow({ k }: { k: number }) {
  const openPanel = useHome((s) => s.openPanel)
  const s = farm.market.shelves[k]
  const good = s.good
  const name = good ? cap(produceById(good).plural) : 'Empty'
  return (
    <button
      className={`market-place${s.units > 0 ? '' : ' empty'}`}
      onClick={() => openPanel({ kind: 'market-place', place: k })}
      aria-label={`Place ${k + 1}: ${good ? `${s.units} of ${SHOP.units} ${name.toLowerCase()}` : 'empty'}`}
    >
      {good ? <ItemPic id={good} /> : <span className="market-slot" aria-hidden="true" />}
      <span className="market-place-text">
        <strong>{name}</strong>
        {good && (
          <span className="market-place-tags">
            <span className={`tag${s.units > 0 ? '' : ' short'}`}>
              {s.units}/{SHOP.units}
            </span>
            <span className="tag" title="A unit's price">
              <img src={art('coin')} alt="" />
              {unitPrice(produceById(good).price, s.pct)}
            </span>
            <span className="tag" title="The chance a shopper takes one">
              <img src={art('shopping-cart')} alt="" />
              {percent(buyChance(s.pct))}
            </span>
          </span>
        )}
      </span>
    </button>
  )
}

/** The next place, not open yet: its price tag (the `places` ladder's next step), which opens that ladder's card. */
function ClosedPlace() {
  const openPanel = useHome((s) => s.openPanel)
  if (ladderMaxed('places')) return null
  const k = ladderLevel('places')
  const price = ladderPrice('places', k)
  return (
    <button
      className="market-place closed"
      disabled={!ladderOpen('places')}
      onClick={() => openPanel({ kind: 'ladder', id: 'places' })}
      aria-label={`Open place ${placesOpen(k) + 1} for ${price} coins`}
    >
      <span className="market-slot" aria-hidden="true" />
      <span className="market-place-text">
        <strong>{LADDERS.places.name}</strong>
        <span className="market-place-tags">
          <span className="tag">{LADDERS.places.say(k + 1)}</span>
        </span>
      </span>
      <span className="tag market-price">
        <img src={art('coin')} alt="" />
        {price}
      </span>
    </button>
  )
}

/** Your shop's computer: the till, the shoppers (how many at a time, the next visit — or that the shelves are empty),
 *  every open place, the next place's price tag, and the shoppers' two ladders. */
export function MarketPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // the next visit's countdown ticks on while the panel is open
  const [, setSecond] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSecond((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const m = farm.market
  const open = placesOpen(ladderLevel('places'))
  const bare = m.shelves.slice(0, open).every((s) => !s.good || s.units <= 0)
  return (
    <Shell
      title="Your shop"
      art={art('convenience-store')}
      sub={
        <>
          <span className="tag" title="Coins in the till">
            <img src={art('coin')} alt="" />
            {m.till.coins} in the till
          </span>
          <span className="tag" title="Shoppers at a time">
            <Users weight="bold" />
            {shoppersAtOnce(ladderLevel('group'))} at a time
          </span>
          {bare ? (
            <span className="tag short" title="Nobody comes while the shelves are empty">
              <Clock weight="bold" />
              Shelves empty
            </span>
          ) : (
            <span className="tag" title="The next shoppers">
              <Clock weight="bold" />
              next {clockText(m.nextIn)}
            </span>
          )}
        </>
      }
      onClose={close}
    >
      <div className="farm-list market-places">
        {m.shelves.slice(0, open).map((_, k) => (
          <PlaceRow key={k} k={k} />
        ))}
        <ClosedPlace />
      </div>
      <div className="farm-shop market-ladders">
        <LadderRow id="group" />
        <LadderRow id="pace" />
      </div>
    </Shell>
  )
}

/** A − and + pair round what it sets (how many, the price). */
function Stepper({ label, less, more, onLess, onMore, children }: { label: string; less: boolean; more: boolean; onLess: () => void; onMore: () => void; children: ReactNode }) {
  return (
    <div className="market-step">
      <span className="market-step-label">{label}</span>
      <div className="market-step-set">
        <button className="btn soft round small" disabled={!less} onClick={onLess} aria-label={`${label}: less`}>
          <Minus weight="bold" />
        </button>
        <span className="market-step-value">{children}</span>
        <button className="btn soft round small" disabled={!more} onClick={onMore} aria-label={`${label}: more`}>
          <Plus weight="bold" />
        </button>
      </div>
    </div>
  )
}

/** One place's card: an empty place takes a good from the silo or the barn (1 to SHOP.units of it); one with goods on
 *  it can be emptied (they go back); its price is set with − and + (it shows a unit's coins and a shopper's chance),
 *  at once, like a bed's gear. Not now, then Fill (or Empty). */
export function MarketPlacePanel({ place }: { place: number }) {
  useFarm((s) => s.rev)
  const openPanel = useHome((s) => s.openPanel)
  const close = useHome((s) => s.closePanel)
  const shelf = farm.market.shelves[place]
  const stock = SELLABLE.filter((id) => farm.inv[id] > 0)
  const [pick, setPick] = useState<ProduceId | null>(() => (shelf?.good && farm.inv[shelf.good] > 0 ? shelf.good : (stock[0] ?? null)))
  const [units, setUnits] = useState<number>(SHOP.units)
  const [pct, setPct] = useState(() => snapPct(shelf?.pct ?? SHOP.pct.start))
  if (!shelf) return null
  const held = shelf.units > 0
  const good = held ? shelf.good : pick && farm.inv[pick] > 0 ? pick : (stock[0] ?? null)
  const most = good ? Math.min(SHOP.units, farm.inv[good]) : 0
  const n = Math.max(1, Math.min(units, most))
  const back = () => openPanel({ kind: 'market' })
  const price = (d: number) => {
    const next = snapPct(pct + d * SHOP.pct.step)
    setPct(next)
    setPlacePrice(place, next)
    uiClick()
  }
  const fill = () => {
    if (!good || !fillPlace(place, good, n)) return
    farmSound('plant')
    playGesture('interact')
    back()
  }
  const empty = () => {
    if (emptyPlace(place)) uiClick()
  }
  return (
    <Shell title={`Place ${place + 1}`} art={good ? iconUrl(good) : art('convenience-store')} onClose={close}>
      {held && good ? (
        <div className="market-held">
          <ItemPic id={good} count={shelf.units} />
          <strong>{cap(produceById(good).plural)}</strong>
          <span className="tag" title="On the shelf">
            {shelf.units}/{SHOP.units}
          </span>
        </div>
      ) : stock.length ? (
        <div className="market-goods" role="group" aria-label="What to put up">
          {stock.map((id) => (
            <button
              key={id}
              className="market-good"
              aria-pressed={id === good}
              onClick={() => {
                setPick(id)
                uiClick()
              }}
              aria-label={`${cap(produceById(id).plural)}: ${farm.inv[id]}`}
              title={cap(produceById(id).plural)}
            >
              <ItemPic id={id} count={farm.inv[id]} />
            </button>
          ))}
        </div>
      ) : (
        <p className="farm-empty">Nothing that sells in the silo or the barn.</p>
      )}
      {!held && good && (
        <Stepper label="How many" less={n > 1} more={n < most} onLess={() => setUnits(n - 1)} onMore={() => setUnits(n + 1)}>
          <ItemPic id={good} count={n} />
        </Stepper>
      )}
      <Stepper label="Price" less={pct > SHOP.pct.min} more={pct < SHOP.pct.max} onLess={() => price(-1)} onMore={() => price(1)}>
        {good ? <Coins n={unitPrice(produceById(good).price, pct)} /> : <span>{pct}%</span>}
        <span className="market-chance" title="The chance a shopper takes one">
          <img src={art('shopping-cart')} alt="" />
          {percent(buyChance(pct))}
        </span>
      </Stepper>
      <div className="farm-confirm">
        <button className="btn soft" onClick={back}>
          Not now
        </button>
        {held ? (
          <button className="btn farm-buy" onClick={empty}>
            Empty
          </button>
        ) : (
          <button className="btn farm-buy" disabled={!good} onClick={fill}>
            Fill
          </button>
        )}
      </div>
    </Shell>
  )
}

/** The card that asks before the shop is bought: what you get, Not now, and Buy with its price (it arms after a
 *  moment). Bought, the panel closes: the manager waves and walks off, and the computer is yours. */
export function MarketBuyPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const armed = useArmed()
  const price = MANAGER.shopPrice
  const ready = ladderMaxed('rate') && !farm.market.owned
  const afford = ready && farm.coins >= price
  const confirm = () => {
    if (!armed || !buyMarket()) return
    playGesture('interact')
    close()
  }
  return (
    <Shell title="Buy the shop" art={art('convenience-store')} sub={<Purse />} onClose={close}>
      <p className="farm-line">Its shelves and its till become yours.</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={close}>
          Not now
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={confirm}>
          {afford || !ready ? (
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
