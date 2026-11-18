import { useEffect, useRef, type ReactNode } from 'react'
import { findFar } from '../lib/interaction'
import { walkTo } from '../lib/route/walking'
import { playerState } from '../lib/playerState'
import { span } from '../lib/time'
import { useHome } from '../store'
import { art, type ArtId } from '../ui/art'
import { ItemPic } from '../ui/ItemPic'
import { registerCard } from '../ui/cardQueue'
import { Coins, Shell } from '../ui/Sheet'
import { Clock, NavigationArrow } from '../ui/glyphs'
import { STORES, STORE_IDS, count, produceById, type StoreId } from './data'
import { returnWorth } from './economy'
import { iconUrl } from './icons'
import { pickNext, type NextItem } from './nextUp'
import { awaySummary, clearAwaySummary, farm, makeRoom, makeRoomPreview, room, stepNow, useFarm, waitingFor, type AwayReport } from './state'
import { walkTarget } from './walkTargets'

// Welcome back: after a time away (the page closed, or hidden while you were in another app or the phone was locked),
// the farm has gone on for it (src/farm/state.ts, cameBack) — and this card says, in a few pictures, what waited: the
// goods that came to be ready, who joined the line, the orders that came in, what your shop sold, a building too full
// for what waits (with one press to make room), beds to water. At most AWAY_ROWS of them, the most worth first
// (update-v1/JOURNEY.md fix 11): a card that says everything says nothing. Then what is next (src/farm/nextUp.ts: the
// step a new farm is on, else a goal to claim, else the nearest thing to do), and Go there: the step's place while the
// steps run, else the nearest thing ready to take (the morning round), else the board for a goal to claim, else the
// next goal's place. Close, or Go there.

/** [review: JOURNEY.md fix 11] At most this many pictures of what waited, the most worth first. */
export const AWAY_ROWS = 4

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** About what a buyer in line, an order on the board and a beat of the farm are worth (to rank the rows only: never a
 *  price). A row that needs you (a building full) always shows. */
const BUYER_WORTH = 12
const ORDER_WORTH = 30
const SMALL = 1

/** One picture of what waited: its key, its worth (to rank them), and how it is drawn. */
export interface AwayRow {
  key: string
  worth: number
  /** it needs you: shown whatever the others are worth */
  needs?: boolean
}

/** The rows a report has, the most worth first (those that need you first of all), at most AWAY_ROWS. `full`: the
 *  buildings too full for what waits (the report's, and any that cannot take all of it now). Pure. */
export function awayRows(r: AwayReport, most = AWAY_ROWS, full: readonly StoreId[] = r.full): AwayRow[] {
  const rows: AwayRow[] = [
    ...full.map((id) => ({ key: `full:${id}`, worth: Infinity, needs: true })),
    ...r.goods.map((g) => ({ key: `good:${g.item}`, worth: returnWorth([g]) })),
    ...(r.buyers > 0 ? [{ key: 'buyers', worth: r.buyers * BUYER_WORTH }] : []),
    ...(r.orders > 0 ? [{ key: 'orders', worth: r.orders * ORDER_WORTH }] : []),
    ...(r.shop && r.shop.goods > 0 ? [{ key: 'shop', worth: r.shop.coins }] : []),
    ...(r.thirsty > 0 ? [{ key: 'water', worth: r.thirsty * SMALL }] : []),
    ...(r.pieces ? [{ key: 'pieces', worth: SMALL }] : []),
    ...(r.tractor ? [{ key: 'tractor', worth: SMALL }] : []),
  ]
  // (a stable sort: rows worth the same keep the report's order)
  return rows.sort((a, b) => b.worth - a.worth).slice(0, most)
}

/** An interface picture with how many, in the same round badge as a good's (ItemPic). */
const ArtPic = ({ id, count: n }: { id: ArtId; count: number }) => (
  <span className="item-pic">
    <img className="art" src={art(id)} alt="" draggable={false} />
    <b className="qty">{n}</b>
  </span>
)

/** "2 h 14 min", "38 min", "3 days" (src/lib/time.ts, span) */
export const awayText = (seconds: number) => span(Math.max(60, seconds))

/** The welcome back on the card queue (src/ui/cardQueue.ts): due while a time away has something to tell, it is the
 *  first card of the visit its return began, a beat after the game is free. */
export function AwayWatcher() {
  useEffect(
    () =>
      registerCard('away', {
        due: () => awaySummary() !== null,
        open: () => useHome.getState().openPanel({ kind: 'away' }),
        showing: () => useHome.getState().panel?.kind === 'away',
      }),
    [],
  )
  return null
}

/** A row of the card, drawn. */
function Row({ row, r }: { row: AwayRow; r: AwayReport }): ReactNode {
  const [kind, id] = row.key.split(':')
  if (kind === 'good') {
    const g = r.goods.find((x) => x.item === id)!
    return (
      <div className="farm-basket-item" title={count(g.item, g.count)}>
        <ItemPic id={g.item} count={g.count} />
        <span>{cap(produceById(g.item).plural)}</span>
      </div>
    )
  }
  if (kind === 'full') {
    // a building too full for what waits: one press makes room (src/farm/state/stores.ts: the surplus nobody wants, sold
    // at its fair price), and its row then says so
    const store = id as StoreId
    const made = room(store) >= waitingFor(store)
    const sell = makeRoomPreview(store)
    return (
      <div className={`farm-basket-item${made ? '' : ' needs'}`} title={made ? `${STORES[store].name}: room made` : `${STORES[store].name} full`}>
        <img className="art" src={iconUrl(store)} alt="" />
        <span>{made ? 'Room made' : `${STORES[store].name} full`}</span>
        {!made && sell.goods.length > 0 && (
          <button
            className="btn small leaf make-room"
            onClick={() => makeRoom(store)}
            aria-label={`Make room in the ${STORES[store].name.toLowerCase()}: sell what nobody wants for ${sell.coins} coins`}
          >
            Make room
          </button>
        )}
      </div>
    )
  }
  if (kind === 'buyers')
    return (
      <div className="farm-basket-item" title={`${r.buyers} joined the line`}>
        <ArtPic id="people-queue" count={r.buyers} />
        <span>In line</span>
      </div>
    )
  if (kind === 'orders')
    return (
      <div className="farm-basket-item" title={`${r.orders} new orders`}>
        <ArtPic id="clipboard" count={r.orders} />
        <span>Orders</span>
      </div>
    )
  if (kind === 'shop')
    return (
      <div className="farm-basket-item" title={`${r.shop!.goods} sold in your shop; ${r.shop!.coins} coins in the till`}>
        <ArtPic id="convenience-store" count={r.shop!.goods} />
        <span>
          <Coins n={r.shop!.coins} /> in the till
        </span>
      </div>
    )
  // beds gone dry: nothing is lost, they wait for water (in the card's own tone, not as a fault)
  if (kind === 'water')
    return (
      <div className="farm-basket-item" title={`${r.thirsty} beds to water`}>
        <ArtPic id="droplet" count={r.thirsty} />
        <span>To water</span>
      </div>
    )
  if (kind === 'pieces')
    return (
      <div className="farm-basket-item" title="The contractor has new pieces">
        <img className="art" src={art('construction-worker')} alt="" />
        <span>New pieces</span>
      </div>
    )
  return (
    <div className="farm-basket-item" title="The tractor is back">
      <img className="art" src={art('tractor')} alt="" />
      <span>Back home</span>
    </div>
  )
}

/** What is next, in one row: its picture, its words, and how far along ("22/30"). */
function NextRow({ next }: { next: NextItem }) {
  const pic = 'item' in next.pic ? iconUrl(next.pic.item) : art(next.pic.art)
  return (
    <div
      className="away-next"
      role="group"
      aria-label={`Next: ${next.words}${next.of !== undefined ? `, ${next.have ?? 0} of ${next.of}` : ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '8px 12px', borderRadius: 'var(--r-card)', background: 'var(--paper-2)' }}
    >
      <img className="art" src={pic} alt="" draggable={false} style={{ width: 40, height: 40, flex: 'none' }} />
      <span style={{ flex: '1 1 auto', minWidth: 0, font: '600 16px/1.2 var(--font-display)' }}>
        <b style={{ display: 'block', font: '800 13px/1.2 var(--font-text)', color: 'var(--ink-2)' }}>Next</b>
        {next.words}
      </span>
      {next.of !== undefined && (
        <span className="tag" style={{ flex: 'none' }}>
          {Math.min(next.have ?? 0, next.of)}/{next.of}
        </span>
      )}
    </div>
  )
}

export function AwayPanel() {
  useFarm((s) => s.rev)
  const closePanel = useHome((s) => s.closePanel)
  // (the buildings shown full on this card, below)
  const shownFull = useRef(new Set<StoreId>())
  const r = awaySummary()
  if (!r) return null
  const close = () => {
    clearAwaySummary()
    closePanel()
  }
  // what is next, and where Go there takes you: the step's place while they run; else the nearest thing ready to take,
  // from where you stand (the morning round); else the goals' board for one to claim; else the next goal's place
  const next = pickNext(farm, { steps: stepNow() !== null })
  const p = playerState.position
  const far = findFar({ x: p.x, y: p.y, z: p.z }).filter((m) => !m.alert)
  const target = typeof next.item.go === 'object' ? walkTarget(next.item.go) : null
  const go: (() => void) | null =
    next.id === 'step' && target
      ? () => walkTo(target)
      : far[0]
        ? () => walkTo(far[0].id, far[0].item)
        : next.item.go === 'goals'
          ? () => useHome.getState().openPanel({ kind: 'goals' })
          : target
            ? () => walkTo(target)
            : null
  // a building too full for what waits: not only one with no room at all (the report's), but one that cannot take all
  // of what waits; kept on the card once shown, so its row can say the room was made
  for (const id of STORE_IDS) if (r.full.includes(id) || waitingFor(id) > room(id)) shownFull.current.add(id)
  const full = STORE_IDS.filter((id) => shownFull.current.has(id))
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
        {awayRows(r, AWAY_ROWS, full).map((row) => (
          <Row key={row.key} row={row} r={r} />
        ))}
      </div>
      <NextRow next={next.item} />
      <div className="farm-confirm">
        <button className="btn soft" onClick={close}>
          Close
        </button>
        {go && (
          <button
            className="btn farm-buy"
            onClick={() => {
              close()
              // (the walk there by itself, as tapping its mark on the compass does; the board opens once this card has gone)
              go()
            }}
          >
            <NavigationArrow weight="fill" />
            Go there
          </button>
        )}
      </div>
    </Shell>
  )
}
