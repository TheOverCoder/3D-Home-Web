import { farmSound, placeSound } from '../audio/sound'
import { farmFx } from '../fx/fx'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { ItemPic } from '../ui/ItemPic'
import { Shell, useArmed } from '../ui/Sheet'
import { ArrowRight, Check } from '../ui/glyphs'
import { STORES, count, produceById, type StoreId } from './data'
import { iconUrl } from './icons'
import { footprint } from './layout'
import { STORE_GOODS } from './storage'
import { ContractorLink } from './ContractorPanel'
import { canUpgradeStore, capacity, farm, nextStoreLevel, storeLevel, upgradeStore, useFarm, used } from './state'

// The silo and the barn, tapped (their chip at the top, or the button at their door): what is inside, each good with
// how many; how full it is and its level; and what its next level takes — its three building materials, each with how
// many you have of how many it takes, and the room it gives. Upgrading asks first, on a card of its own (Cancel, then
// an Upgrade button that arms after a moment), like building a bed.

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** How full a building is, as a chip: its picture, 34/50 (red when full). */
export function FillTag({ store }: { store: StoreId }) {
  const n = used(store)
  const most = capacity(store)
  return (
    <span className={`tag fill${n >= most ? ' short' : ''}`} title={`${n} of ${most}`}>
      <img src={iconUrl(store)} alt="" />
      {n}/{most}
    </span>
  )
}

/** What a building's next level gives: its room now → then. */
const RoomTag = ({ from, to }: { from: number; to: number }) => (
  <span className="tag effect">
    {from}
    <ArrowRight weight="bold" className="effect-arrow" />
    <b>{to}</b>
  </span>
)

/** What a building's next level takes, each material with how many you have of how many it takes. */
function Needs({ store }: { store: StoreId }) {
  return (
    <div className="farm-needs">
      {nextStoreLevel(store).needs.map((n) => {
        const have = farm.inv[n.item]
        const ok = have >= n.count
        return (
          <div key={n.item} className="farm-need" title={`${cap(produceById(n.item).plural)}: you have ${have}`}>
            <ItemPic id={n.item} count={n.count} />
            <span className={`tag ${ok ? 'ok' : 'short'}`}>
              {ok && <Check weight="bold" />}
              {Math.min(have, n.count)}/{n.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** A building's panel: what is inside, how full, and its next level. */
export function StorePanel({ store }: { store: StoreId }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const openPanel = useHome((s) => s.openPanel)
  const def = STORES[store]
  const goods = STORE_GOODS[store].filter((id) => farm.inv[id] > 0)
  const next = nextStoreLevel(store)
  return (
    <Shell
      title={def.name}
      art={iconUrl(store)}
      sub={
        <>
          <FillTag store={store} />
          <span className="tag level">Level {storeLevel(store)}</span>
        </>
      }
      onClose={close}
    >
      {goods.length ? (
        <div className="farm-basket">
          {goods.map((id) => (
            <div key={id} className="farm-basket-item" title={count(id, farm.inv[id])}>
              <ItemPic id={id} count={farm.inv[id]} />
              <span>{cap(produceById(id).plural)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="farm-empty">{store === 'silo' ? 'Empty — harvest the beds, pick the lemons.' : 'Empty — collect from the animals and the machines.'}</p>
      )}
      <div className="farm-upgrade">
        <div className="farm-upgrade-head">
          <strong>Level {next.level}</strong>
          <RoomTag from={capacity(store)} to={next.capacity} />
        </div>
        <Needs store={store} />
        <button className="btn small farm-upgrade-go" disabled={!canUpgradeStore(store)} onClick={() => openPanel({ kind: 'store-upgrade', store })}>
          Upgrade
        </button>
      </div>
      {/* short of a material: the contractor behind the market sells a few pieces a day */}
      {next.needs.some((n) => farm.inv[n.item] < n.count) && <ContractorLink />}
    </Shell>
  )
}

/** The card that asks before a building's materials are used: its next level, the room it gives, what it takes. */
export function StoreUpgradePanel({ store }: { store: StoreId }) {
  useFarm((s) => s.rev)
  const openPanel = useHome((s) => s.openPanel)
  const close = useHome((s) => s.closePanel)
  const armed = useArmed()
  const def = STORES[store]
  const next = nextStoreLevel(store)
  const ok = canUpgradeStore(store)
  const back = () => openPanel({ kind: 'store', store })
  const confirm = () => {
    if (!armed || !upgradeStore(store)) return
    const at = farm.layout.places[def.place]
    const r = footprint(def.place, at)
    const { pan, near } = placeSound(at.x, at.z)
    farmSound('build', pan, near)
    farmFx('dust', at.x, 0.04, at.z, { half: { x: (r.maxX - r.minX) / 2, z: (r.maxZ - r.minZ) / 2 } })
    playGesture('interact')
    back()
  }
  return (
    <Shell title={`${def.name} · level ${next.level}`} art={iconUrl(store)} sub={<RoomTag from={capacity(store)} to={next.capacity} />} onClose={close}>
      <Needs store={store} />
      <div className="farm-confirm">
        <button className="btn soft" onClick={back}>
          Not now
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!ok} aria-disabled={!armed} onClick={confirm}>
          <Check weight="bold" />
          Upgrade
        </button>
      </div>
    </Shell>
  )
}
