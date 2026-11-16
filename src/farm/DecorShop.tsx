import { farmSound, uiClick } from '../audio/sound'
import { useHome } from '../store'
import { art } from '../ui/art'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { Check } from '../ui/glyphs'
import { SHOP, type DecorTab, type ShopItemView, type ShopKind } from './decor'
import { editView, useEdit } from './edit'
import { iconUrl, shopArtUrl } from './icons'
import { isShopKind } from './layout'
import { buyDecor, decorOwned, decorPrice, farm, freeDecorSpot, placeDecor, shopView, useFarm } from './state'

// The edit mode's shop (the bag on its card): the farm's decoration — lights, fences and hedges, paths, a bench, trees,
// bushes and flowers — and, on a tab of its own, the fruit trees and bushes, each with its picture, how many the farm
// has and what the next one costs (each one dearer than the last: src/farm/decor.ts, nextPrice). A kind opens its card
// first — its picture, what it costs and what you have, Cancel or Buy (armed a moment after it opens) — and once bought
// it stands at the free spot nearest the middle of the view, picked, so a drag moves it on (with no room it waits in the
// farm's store, on the edit mode's card).

const TABS: { id: DecorTab; name: string }[] = [
  { id: 'decor', name: 'Decoration' },
  { id: 'fruit', name: 'Fruit trees & bushes' },
]

/** Puts one of a kind down from the store at the free spot nearest the middle of the view, picked so a drag moves it on:
 *  whether it went down (with no room in view it stays in the store, and the card says so). */
export function putDown(kind: ShopKind): boolean {
  const spot = freeDecorSpot(kind, editView.x, editView.z)
  const placed = spot ? placeDecor(kind, spot) : null
  if (placed?.ok && placed.id !== undefined) {
    useEdit.getState().pick({ kind: 'decor', id: placed.id })
    return true
  }
  useEdit.getState().pick(null)
  useEdit.getState().setNote(`${SHOP[kind].name}: in your store — no free spot in view`)
  return false
}

/** One kind on a shop's card: its picture, its name, how many the farm has, and the next one's price. */
function ShopCard({ item }: { item: ShopItemView }) {
  const open = useHome((s) => s.openPanel)
  return (
    <button
      className="farm-card decor-card"
      aria-label={`${item.name}: ${item.owned ? `you have ${item.owned}, ` : ''}the next costs ${item.price} coins`}
      onClick={() => {
        uiClick()
        open({ kind: 'decor-buy', item: item.kind })
      }}
    >
      <img className="art" src={shopArtUrl(item.kind)} alt="" />
      <span className="farm-card-name">{item.name}</span>
      <span className="farm-card-tags">
        {item.fruit && <img className="decor-fruit" src={iconUrl(item.fruit)} alt="" />}
        {item.owned > 0 && (
          <span className="tag ok">
            <Check weight="bold" />
            {item.owned}
          </span>
        )}
        <span className={`tag${item.can ? '' : ' short'}`}>
          <img src={art('coin')} alt="" />
          {item.price}
        </span>
      </span>
    </button>
  )
}

/** The shop: two tabs, decoration and fruit plants. */
export function DecorShop({ tab }: { tab: DecorTab }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const open = useHome((s) => s.openPanel)
  const items = shopView().filter((i) => i.tab === tab)
  return (
    <Shell title={tab === 'decor' ? 'Decoration' : 'Fruit trees'} art={art(tab === 'decor' ? 'shopping-bags' : 'seedling')} sub={<Purse />} onClose={close}>
      <div className="edit-actions deco-tabs decor-tabs" role="tablist" aria-label="The farm shop">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`btn small ${tab === t.id ? 'leaf' : 'soft'}`}
            onClick={() => {
              uiClick()
              open({ kind: 'decor-shop', tab: t.id })
            }}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="farm-grid compact decor-grid" role="tabpanel">
        {items.map((item) => (
          <ShopCard key={item.kind} item={item} />
        ))}
      </div>
    </Shell>
  )
}

/** Buying one always asks first: its picture, how many you have, what it costs and what you have, Cancel or Buy. */
export function BuyDecor({ item }: { item: string }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const open = useHome((s) => s.openPanel)
  const armed = useArmed()
  if (!isShopKind(item)) return null
  const def = SHOP[item]
  const price = decorPrice(item)
  const owned = decorOwned(item)
  const afford = farm.coins >= price
  const back = () => open({ kind: 'decor-shop', tab: def.tab })
  const buy = () => {
    if (!armed || !afford) return
    close()
    if (!buyDecor(item)) return
    farmSound('build', 0, 1)
    putDown(item)
  }
  return (
    <Shell title={def.name} art={shopArtUrl(item)} sub={<Purse />} onClose={back}>
      <div className="farm-shop-tags">
        <span className="tag">You have {owned}</span>
        {owned > 0 && (
          <span className="tag">
            The first was <Coins n={def.price} />
          </span>
        )}
      </div>
      <p className="farm-line">It goes on your land in view, ready to drag.</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={back}>
          Cancel
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={buy}>
          {afford ? (
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
