import { useEffect } from 'react'
import { findFar } from '../lib/interaction'
import { walkTo } from '../lib/route/walking'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { art, type ArtId } from '../ui/art'
import { ItemPic } from '../ui/ItemPic'
import { Coins, Shell } from '../ui/Sheet'
import { Clock, NavigationArrow } from '../ui/glyphs'
import { STORES, count, produceById } from './data'
import { iconUrl } from './icons'
import { awaySummary, clearAwaySummary, useFarm } from './state'

// Welcome back: after a time away (the page closed, or hidden while you were in another app or the phone was locked),
// the farm has gone on for it (src/farm/state.ts, cameBack) — and this card says what happened: each good that came to
// be ready with how many, who joined the line, the orders that came in, what your shop sold (and the coins in its
// till), new pieces at the contractor, the tractor back; what needs you (beds gone dry, a building too full to take
// what waits) in red. Close, or Go there: you walk to the nearest thing ready to take, as tapping its mark on the
// compass does.

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** An interface picture with how many, in the same round badge as a good's (ItemPic). */
const ArtPic = ({ id, count: n }: { id: ArtId; count: number }) => (
  <span className="item-pic">
    <img className="art" src={art(id)} alt="" draggable={false} />
    <b className="qty">{n}</b>
  </span>
)

/** "2 h 14 min", "38 min", "3 days" */
export function awayText(seconds: number) {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${Math.max(1, m)} min`
  const h = Math.floor(m / 60)
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
  return `${Math.round(h / 24)} days`
}

/** Opens the card once the game is being played and nothing else is open. */
export function AwayWatcher() {
  const rev = useFarm((s) => s.rev)
  const phase = useHome((s) => s.phase)
  const panel = useHome((s) => s.panel)
  const editing = useHome((s) => s.editing)
  const decorating = useHome((s) => s.decorating)
  const screen = useHome((s) => s.screen)
  const settingsOpen = useHome((s) => s.settingsOpen)
  useEffect(() => {
    if (phase !== 'playing' || panel || editing || decorating || screen || settingsOpen || !awaySummary()) return
    useHome.getState().openPanel({ kind: 'away' })
  }, [rev, phase, panel, editing, decorating, screen, settingsOpen])
  return null
}

export function AwayPanel() {
  useFarm((s) => s.rev)
  const closePanel = useHome((s) => s.closePanel)
  const r = awaySummary()
  if (!r) return null
  const close = () => {
    clearAwaySummary()
    closePanel()
  }
  // the nearest thing ready to take, from where you stand
  const p = playerState.position
  const far = findFar({ x: p.x, y: p.y, z: p.z }).filter((m) => !m.alert)
  const go = () => {
    const target = far[0]
    close()
    // the walk there by itself, as tapping its mark on the compass does
    if (target) walkTo(target.id, target.item)
  }
  const capped = r.counted < r.seconds
  return (
    <Shell
      title="Welcome back"
      art={art('house-with-garden')}
      sub={
        <span className="tag" title={capped ? `The farm went on for ${awayText(r.counted)} of it` : undefined}>
          <Clock weight="bold" />
          {awayText(r.seconds)} away
        </span>
      }
      onClose={close}
    >
      <div className="farm-basket farm-away">
        {r.goods.map((g) => (
          <div key={g.item} className="farm-basket-item" title={count(g.item, g.count)}>
            <ItemPic id={g.item} count={g.count} />
            <span>{cap(produceById(g.item).plural)}</span>
          </div>
        ))}
        {r.buyers > 0 && (
          <div className="farm-basket-item" title={`${r.buyers} joined the line`}>
            <ArtPic id="people-queue" count={r.buyers} />
            <span>In line</span>
          </div>
        )}
        {r.orders > 0 && (
          <div className="farm-basket-item" title={`${r.orders} new orders`}>
            <ArtPic id="clipboard" count={r.orders} />
            <span>Orders</span>
          </div>
        )}
        {r.shop && r.shop.goods > 0 && (
          <div className="farm-basket-item" title={`${r.shop.goods} sold in your shop; ${r.shop.coins} coins in the till`}>
            <ArtPic id="convenience-store" count={r.shop.goods} />
            <span>
              <Coins n={r.shop.coins} /> in the till
            </span>
          </div>
        )}
        {r.pieces && (
          <div className="farm-basket-item" title="The contractor has new pieces">
            <img className="art" src={art('construction-worker')} alt="" />
            <span>New pieces</span>
          </div>
        )}
        {r.tractor && (
          <div className="farm-basket-item" title="The tractor is back">
            <img className="art" src={art('tractor')} alt="" />
            <span>Back home</span>
          </div>
        )}
        {r.thirsty > 0 && (
          <div className="farm-basket-item needs" title={`${r.thirsty} beds need water`}>
            <ArtPic id="droplet" count={r.thirsty} />
            <span>Dry beds</span>
          </div>
        )}
        {r.full.map((id) => (
          <div key={id} className="farm-basket-item needs" title={`${STORES[id].name} full`}>
            <img className="art" src={iconUrl(id)} alt="" />
            <span>{STORES[id].name} full</span>
          </div>
        ))}
      </div>
      <p className="farm-empty away-line">{capped ? `The farm went on for ${awayText(r.counted)} of it.` : 'The farm went on while you were away.'}</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={close}>
          Close
        </button>
        {far.length > 0 && (
          <button className="btn farm-buy" onClick={go}>
            <NavigationArrow weight="fill" />
            Go there
          </button>
        )}
      </div>
    </Shell>
  )
}
