import { playGesture } from '../lib/gestures'
import { walkTo } from '../lib/route/walking'
import { useHome } from '../store'
import { ItemPic } from '../ui/ItemPic'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { art } from '../ui/art'
import { Check, NavigationArrow } from '../ui/glyphs'
import { CONTRACTOR, HOURS, ITEMS, STORES, STORE_IDS, count, produceById, type ItemId } from './data'
import { piecePrice } from './contractor'
import { iconUrl } from './icons'
import { LadderRow } from './Ladder'
import { buyFromContractor, contractorHere, farm, nextStoreLevel, sellToContractor, useFarm } from './state'

// The contractor's panel (his window behind the market): today's pieces, each with its price (a sold one greyed out);
// what he pays for the building materials you have, each with what the silo's or the barn's next level takes of it;
// his two ladders. And ContractorLink, a way to walk to him from where materials matter.

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** What the farm keeps a good for, as the store's needs show it: a picture (the building, the order board) and how
 *  many of how many it takes — green with a tick when you have them, red when short. */
export function KeepTag({ pic, have, need, title }: { pic: string; have: number; need: number; title: string }) {
  const ok = have >= need
  return (
    <span className={`tag keep ${ok ? 'ok' : 'short'}`} title={title}>
      <img src={pic} alt="" />
      {ok && <Check weight="bold" />}
      {Math.min(have, need)}/{need}
    </span>
  )
}

/** While he is away (at night): when he is back, as a red chip. */
const AwayTag = () => (
  <span className="tag short">
    <img src={art('sunrise')} alt="" />
    Back in the {HOURS.contractor[0]}
  </span>
)

/** One building material you have: how many, what he pays each, what the next level of its building takes, and Sell
 *  (the whole stack). */
function MaterialRow({ id, here }: { id: ItemId; here: boolean }) {
  const have = farm.inv[id]
  const store = STORE_IDS.find((s) => STORES[s].materials.includes(id))
  const need = store ? (nextStoreLevel(store).needs.find((n) => n.item === id)?.count ?? 0) : 0
  const pay = have * CONTRACTOR.buys
  return (
    <div className="farm-buyer">
      <ItemPic id={id} count={have} className="farm-want" />
      <div className="farm-buyer-body">
        <strong>{cap(produceById(id).plural)}</strong>
        <span>
          <span className="tag">
            <img src={art('coin')} alt="" />
            {CONTRACTOR.buys} each
          </span>
          {store && need > 0 && <KeepTag pic={iconUrl(store)} have={have} need={need} title={`The ${STORES[store].name.toLowerCase()}'s next level takes ${count(id, need)}`} />}
        </span>
      </div>
      <div className="farm-buyer-actions">
        <button
          className="btn leaf small"
          disabled={!here || pay <= 0}
          onClick={() => {
            if (sellToContractor(id)) playGesture('interact')
          }}
          aria-label={`Sell ${count(id, have)} for ${pay} coins`}
        >
          Sell <Coins n={pay} />
        </button>
      </div>
    </div>
  )
}

/** The contractor's window: today's pieces (buying arms a moment after the panel opens, so the press that opened it
 *  never buys), the materials he buys from you, and his ladders. */
export function ContractorPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const armed = useArmed()
  const here = contractorHere()
  // as saved: the farm's tick makes each day's offers (read only here, so drawing never rolls the dice)
  const offers = farm.contractor.offers
  const price = piecePrice(farm.ladders.discount)
  const mats = ITEMS.filter((id) => farm.inv[id] > 0)
  return (
    <Shell
      title="The contractor"
      art={art('construction-worker')}
      sub={
        <>
          <Purse />
          {!here && <AwayTag />}
        </>
      }
      onClose={close}
    >
      <h3 className="market-head">Today</h3>
      <div className="contractor-today">
        {offers.map((o, k) => (
          <button
            key={k}
            className={`contractor-piece${o.sold ? ' sold' : ''}${armed ? '' : ' arming'}`}
            disabled={o.sold || !here || farm.coins < price}
            aria-disabled={!armed}
            onClick={() => {
              if (armed && buyFromContractor(k)) playGesture('interact')
            }}
            aria-label={o.sold ? `${cap(produceById(o.item).name)}: sold` : `Buy ${count(o.item, 1)} for ${price} coins`}
          >
            <ItemPic id={o.item} count={1} />
            {o.sold ? (
              <span className="tag ok">
                <Check weight="bold" />
                Sold
              </span>
            ) : (
              <span className="tag">
                <img src={art('coin')} alt="" />
                {price}
              </span>
            )}
          </button>
        ))}
        {!offers.length && <p className="farm-empty">Nothing yet today.</p>}
      </div>
      <h3 className="market-head">He buys</h3>
      <div className="farm-list">
        {mats.map((id) => (
          <MaterialRow key={id} id={id} here={here} />
        ))}
        {!mats.length && <p className="farm-empty">No building materials to sell.</p>}
      </div>
      <div className="farm-shop market-ladders">
        <LadderRow id="stock" />
        <LadderRow id="discount" />
      </div>
    </Shell>
  )
}

/** A row that walks you to the contractor (the manager's panel, the silo's and the barn's needs): his picture, and Go
 *  there, which closes the panel and walks you to his window, as tapping his mark on the compass does. */
export function ContractorLink() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const go = () => {
    close()
    walkTo('farm-contractor')
  }
  return (
    <div className="farm-shop-item contractor-link">
      <img className="art" src={art('construction-worker')} alt="" />
      <div className="farm-shop-text">
        <strong>The contractor</strong>
        <div className="farm-shop-tags">{contractorHere() ? <span className="tag">Building materials</span> : <AwayTag />}</div>
      </div>
      <button className="btn small" onClick={go}>
        <NavigationArrow weight="fill" />
        Go there
      </button>
    </div>
  )
}
