import { farmSound, uiClick } from '../audio/sound'
import { useHome } from '../store'
import { art, type ArtId } from '../ui/art'
import { LockCorner, LockTag, opensWords, useNope } from '../ui/LockTag'
import { Coins, Purse, Shell, useArmed } from '../ui/Sheet'
import { Check } from '../ui/glyphs'
import { MACHINES, MACHINE_IDS, MACHINE_PIC, type MachineId } from './data'
import { SHOP, setsOf, type MachineItemView, type ShopItemView, type ShopKind, type ShopTab } from './decor'
import { editView, keepPlayerClear, settle, useEdit } from './edit'
import { iconUrl, shopArtUrl } from './icons'
import { isShopKind } from './layout'
import { buyDecor, buyMachine, decorOwned, decorPrice, farm, freeDecorSpot, lockOf, machineOwned, machineShopView, placeDecor, shopView, useFarm } from './state'
import { openFirst } from './unlockArt'

// The edit mode's shop (the bag on its card): the farm's decoration — lights, fences and hedges, paths, a bench, trees,
// bushes and flowers — and, on a tab of its own, the fruit trees and bushes, each with its picture, how many the farm
// has and what the next one costs (each one dearer than the last: src/farm/decor.ts, nextPrice). A kind opens its card
// first — its picture, what it costs and what you have, Cancel or Buy (armed a moment after it opens) — and once bought
// it stands at the free spot nearest the middle of the view, picked, so a drag moves it on (with no room it waits in the
// farm's store, on the edit mode's card). A kind not open yet at the farm's level is shown after the open ones, faded,
// with the level it opens at across its corner (a tap shakes it); its card has no Buy. The kinds stand in their sets
// (src/farm/decor.ts, SETS: "Harvest scarecrows 2/3", how many of the set the farm has), the year's first.
//
// The third tab sells the machines (MACHINES' `price` in src/farm/data.ts): each once, locked till its level like a
// kind, then bought on the same card; it comes onto the farm at its own place in the yard (or the free spot nearest
// it), picked, so a drag moves it on. One the farm has is marked as on the farm, with nothing to buy.

const TABS: { id: ShopTab; name: string }[] = [
  { id: 'decor', name: 'Decoration' },
  { id: 'fruit', name: 'Fruit trees' },
  { id: 'machines', name: 'Machines' },
]
/** Each tab's title and picture. */
const TAB_HEAD: Record<ShopTab, { title: string; art: string }> = {
  decor: { title: 'Decoration', art: art('shopping-bags') },
  fruit: { title: 'Fruit trees', art: art('seedling') },
  machines: { title: 'Machines', art: art('gear') },
}

/** Puts one of a kind down from the store at the free spot nearest the middle of the view, picked so a drag moves it on:
 *  whether it went down (with no room in view it stays in the store, and the card says so). */
export function putDown(kind: ShopKind): boolean {
  const spot = freeDecorSpot(kind, editView.x, editView.z)
  const placed = spot ? placeDecor(kind, spot) : null
  if (placed?.ok && placed.id !== undefined) {
    // it settles where it is put down, with a puff of dust (as one dropped does: ./edit.ts)
    settle({ kind: 'decor', id: placed.id })
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
  const [scope, nope] = useNope<HTMLButtonElement>()
  if (item.locked !== undefined)
    return (
      <button ref={scope} className="farm-card decor-card locked" aria-disabled="true" aria-label={`${item.name}: ${opensWords(item.locked)}`} onClick={nope}>
        <LockCorner level={item.locked} />
        <img className="art" src={shopArtUrl(item.kind)} alt="" />
        <span className="farm-card-name">{item.name}</span>
        <span className="farm-card-tags">{item.fruit && <img className="decor-fruit" src={iconUrl(item.fruit)} alt="" />}</span>
      </button>
    )
  // a season's piece out of its season: faded, back in its season (mission 10 c8; one bought stands all year)
  if (item.season && !item.season.now)
    return (
      <button ref={scope} className="farm-card decor-card locked" aria-disabled="true" aria-label={`${item.name}: back in ${item.season.name.toLowerCase()}`} onClick={nope}>
        <img className="art" src={shopArtUrl(item.kind)} alt="" />
        <span className="farm-card-name">{item.name}</span>
        <span className="farm-card-tags">
          <span className="tag">
            <img src={art(item.season.pic as ArtId)} alt="" />
            Back in {item.season.name.toLowerCase()}
          </span>
        </span>
      </button>
    )
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
        {item.season && (
          // its season's ribbon: sold now, for this season only
          <span className="tag ribbon-season" title={`${item.season.name} only`}>
            <img src={art(item.season.pic as ArtId)} alt="" />
            {item.season.name}
          </span>
        )}
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

/** A machine on the Machines tab: its picture, its name and its price; one not open yet faded with its level, one the
 *  farm has marked as on the farm (nothing to buy). */
function MachineCard({ item }: { item: MachineItemView }) {
  const open = useHome((s) => s.openPanel)
  const [scope, nope] = useNope<HTMLButtonElement>()
  if (item.locked !== undefined)
    return (
      <button ref={scope} className="farm-card decor-card machine-card locked" aria-disabled="true" aria-label={`${item.name}: ${opensWords(item.locked)}`} onClick={nope}>
        <LockCorner level={item.locked} />
        <img className="art" src={art(item.art)} alt="" />
        <span className="farm-card-name">{item.name}</span>
      </button>
    )
  if (item.owned)
    return (
      <div className="farm-card decor-card machine-card" role="group" aria-label={`${item.name}: on your farm`}>
        <img className="art" src={art(item.art)} alt="" />
        <span className="farm-card-name">{item.name}</span>
        <span className="farm-card-tags">
          <span className="tag ok">
            <Check weight="bold" />
            On the farm
          </span>
        </span>
      </div>
    )
  return (
    <button
      className="farm-card decor-card machine-card"
      aria-label={`${item.name}: ${item.price} coins`}
      onClick={() => {
        uiClick()
        open({ kind: 'machine-buy', id: item.id })
      }}
    >
      <img className="art" src={art(item.art)} alt="" />
      <span className="farm-card-name">{item.name}</span>
      <span className="farm-card-tags">
        <span className={`tag${item.can ? '' : ' short'}`}>
          <img src={art('coin')} alt="" />
          {item.price}
        </span>
      </span>
    </button>
  )
}

/** The shop: three tabs, decoration, fruit plants and machines. */
export function DecorShop({ tab }: { tab: ShopTab }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const open = useHome((s) => s.openPanel)
  // the season's own piece first (mission 10 c8), then what is open, then what opens later
  const items = openFirst(
    shopView().filter((i) => i.tab === tab),
    (i) => i.locked ?? null,
  ).sort((a, b) => Number(b.season?.now === true && b.locked === undefined) - Number(a.season?.now === true && a.locked === undefined))
  // (the machines: what is open first, then what opens later, the nearest level first)
  const machines = tab === 'machines' ? openFirst(machineShopView(), (m) => m.locked ?? null) : []
  return (
    <Shell title={TAB_HEAD[tab].title} art={TAB_HEAD[tab].art} sub={<Purse />} onClose={close}>
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
      <div role="tabpanel">
        {machines.length > 0 && (
          <div className="farm-grid compact decor-grid">
            {machines.map((m) => (
              <MachineCard key={m.id} item={m} />
            ))}
          </div>
        )}
        {setsOf(items).map((set) => (
          <section key={set.id} className="deco-shop-group decor-set" aria-label={`${set.name}: ${set.got} of ${set.of}`}>
            <h3>
              <img className="decor-set-art" src={art(set.art)} alt="" />
              {set.name}
              <span className={`tag decor-set-count${set.got === set.of ? ' ok' : ''}`}>
                {set.got === set.of && <Check weight="bold" />}
                {set.got}/{set.of}
              </span>
            </h3>
            <div className="farm-grid compact decor-grid">
              {set.items.map((item) => (
                <ShopCard key={item.kind} item={item} />
              ))}
            </div>
          </section>
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
  const lock = lockOf(`decor:${item}`)
  const back = () => open({ kind: 'decor-shop', tab: def.tab })
  const buy = () => {
    if (!armed || !afford || lock !== null) return
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
        {lock !== null ? (
          <span role="note" className="farm-lock">
            <LockTag big level={lock} words={`Opens at level ${lock}`} />
          </span>
        ) : (
          <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={buy}>
            {afford ? (
              <>
                Buy · <Coins n={price} />
              </>
            ) : (
              <>Needs {price - farm.coins} more</>
            )}
          </button>
        )}
      </div>
    </Shell>
  )
}

/** Where a machine just bought stands up: it settles with a puff of dust, you step out of it if it went up where you
 *  stand, and it is picked, so a drag moves it on (as a piece put down is). */
function standUp(id: MachineId) {
  const t = { kind: 'place', id } as const
  settle(t)
  keepPlayerClear(t)
  useEdit.getState().pick(t)
}

/** Buying a machine asks first, as a piece of decoration does: its picture, how many things it makes, what it costs and
 *  what you have, Cancel or Buy. One not open yet shows its level instead; one the farm has, that it is there. */
export function BuyMachine({ id }: { id: MachineId }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const open = useHome((s) => s.openPanel)
  const armed = useArmed()
  if (!MACHINE_IDS.includes(id) || MACHINES[id].price === undefined) return null
  const def = MACHINES[id]
  const price = def.price!
  const owned = machineOwned(id)
  const afford = farm.coins >= price
  const lock = lockOf(`machine:${id}`)
  const back = () => open({ kind: 'decor-shop', tab: 'machines' })
  const buy = () => {
    if (!armed || !afford || lock !== null || owned) return
    close()
    if (!buyMachine(id)) return
    farmSound('build', 0, 1)
    standUp(id)
  }
  return (
    <Shell title={def.name} art={art(MACHINE_PIC[id])} sub={<Purse />} onClose={back}>
      <div className="farm-shop-tags">
        {owned ? (
          <span className="tag ok">
            <Check weight="bold" />
            On the farm
          </span>
        ) : (
          <span className="tag">{def.recipes.length} recipes</span>
        )}
      </div>
      <p className="farm-line">{owned ? 'It stands on your land.' : 'It goes to its own place on your land, ready to drag.'}</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={back}>
          Cancel
        </button>
        {owned ? null : lock !== null ? (
          <span role="note" className="farm-lock">
            <LockTag big level={lock} words={`Opens at level ${lock}`} />
          </span>
        ) : (
          <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={buy}>
            {afford ? (
              <>
                Buy · <Coins n={price} />
              </>
            ) : (
              <>Needs {price - farm.coins} more</>
            )}
          </button>
        )}
      </div>
    </Shell>
  )
}
