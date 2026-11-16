import { BuyDecor, DecorShop } from './DecorShop'
import { GoalsPanel } from './GoalsPanel'
import { AwayPanel, AwayWatcher } from './AwayPanel'
import { DailyPanel, DailyWatcher } from './DailyPanel'
import { LevelUp } from './XpChip'
import { LevelPanel } from './LevelPanel'
import { WardrobePanel } from '../home/WardrobePanel'
import { ManagerPanel, MarketBuyPanel, MarketPanel, MarketPlacePanel } from './MarketPanel'
import { ContractorPanel } from './ContractorPanel'
import { EstatePanel, HouseBuyPanel } from './EstatePanel'
import { CarPanel } from './car/CarPanel'
import { LadderCard } from './Ladder'
import { MachinePanel, MachineSlotCard } from './MachinePanel'
import './Xp.css'
import { AnimatePresence } from 'motion/react'
import './MarketPanel.css'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { farmSound, placeSound, uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { farmFx } from '../fx/fx'
import { playGesture } from '../lib/gestures'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { BEDS, BED_BOX, CROPS, EXPANSIONS, PACE_LEVELS, PRODUCERS, QUEUE_LEVELS, UPGRADES, arrivalEvery, queuePlaces, type BedDef, type CropId } from './data'
import { EditPanel } from './EditPanel'
import { TopDash } from './TopDash'
import { DecoratePanel } from '../home/DecoratePanel'
import { BuyPiece, FurnitureShop } from '../home/FurnitureShop'
import { iconUrl } from './icons'
import { OrdersPanel } from './OrdersPanel'
import { StorePanel, StoreUpgradePanel } from './StorePanel'
import { ItemPic } from '../ui/ItemPic'
import { ARM_MS, Coins, Purse, Shell } from '../ui/Sheet'
import { art, type ArtId } from '../ui/art'
import { ArrowRight, Check, Clock, Users, X } from '../ui/glyphs'
import {
  acceptOffer,
  animals,
  arrivalSeconds,
  bedSpot,
  bedsForSeeds,
  bedsNear,
  buildBed,
  buy,
  canSell,
  clockText,
  declineOffer,
  fairPrice,
  farm,
  fixBed,
  inLine,
  owned,
  placesInLine,
  plantBeds,
  sellAll,
  sellAllPreview,
  upgradeLevel,
  upgradePrice,
  useFarm,
  waiting,
  type Visitor,
} from './state'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

const seconds = (s: number) => (s < 60 ? `${s} s` : `${Math.round((s / 60) * 10) / 10} min`)

function SeedsPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // every empty bed within reach gets the same seeds (as far as the coins go), but one set to grow something else
  const beds = useMemo(() => bedsNear(bed, 'empty', playerState.position.x, playerState.position.z).filter((i) => i === bed || !farm.beds[i].fixed), [bed])
  const choose = (crop: CropId) => {
    if (!plantBeds(bedsForSeeds(bed, crop, playerState.position.x, playerState.position.z), crop)) return
    const at = bedSpot(bed)
    const { pan, near } = placeSound(at.x, at.z)
    farmSound('plant', pan, near)
    playGesture('interact')
    close()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= CROPS.length && farm.coins >= CROPS[n - 1].seedCost) choose(CROPS[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <Shell title={beds.length > 1 ? `Plant ${beds.length} beds` : 'Plant seeds'} art={art('seedling')} sub={<Purse />} onClose={close}>
      <div className="farm-grid">
        {CROPS.map((c, i) => {
          const afford = farm.coins >= c.seedCost
          return (
            <button key={c.id} className="farm-card" disabled={!afford} onClick={() => choose(c.id)}>
              <kbd className="farm-key">{i + 1}</kbd>
              <span className={`tag farm-stock${farm.inv[c.id] ? '' : ' none'}`} title={`${farm.inv[c.id]} in the silo`} aria-label={`${farm.inv[c.id]} in the silo`}>
                <img src={iconUrl('silo')} alt="" />
                {farm.inv[c.id]}
              </span>
              <img className="art" src={iconUrl(c.id)} alt="" />
              <span className="farm-card-name">{cap(c.plural)}</span>
              <span className="farm-card-tags">
                <span className="tag">
                  <Clock weight="bold" />
                  {seconds(c.growSeconds)}
                </span>
                <span className="tag">
                  <img src={art('coin')} alt="" />
                  {c.seedCost}
                  {beds.length > 1 ? '/bed' : ''}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </Shell>
  )
}

/** What a bed always grows (its gear): one crop — the action button then buys those seeds and plants them there —
 *  or nothing set, and the seed packets open each time. Choosing is all there is: it closes. */
function BedPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const fixed = farm.beds[bed]?.fixed ?? null
  const choose = (crop: CropId | null) => {
    fixBed(bed, crop)
    uiClick()
    close()
  }
  return (
    <Shell title="This bed grows" art={art('gear')} onClose={close}>
      <p className="farm-line">Set a crop and the button buys its seeds and plants it.</p>
      <div className="farm-grid compact">
        <button className="farm-card" aria-pressed={fixed === null} onClick={() => choose(null)}>
          <img className="art" src={art('seedling')} alt="" />
          <span className="farm-card-name">I choose</span>
        </button>
        {CROPS.map((c) => (
          <button key={c.id} className="farm-card" aria-pressed={fixed === c.id} onClick={() => choose(c.id)}>
            <img className="art" src={iconUrl(c.id)} alt="" />
            <span className="farm-card-name">{cap(c.plural)}</span>
          </button>
        ))}
      </div>
    </Shell>
  )
}

/** A puff of dust round each bed just built (one bed, or every bed of a field). */
const dustOver = (beds: BedDef[]) => beds.forEach((b) => farmFx('dust', b.x, 0.04, b.z, { half: BED_BOX }))

/** Spending coins on the farm itself (a bed, a field) always asks first: what it is, what it costs, what you have,
 *  and a Build button that only arms after a moment — never on the button you press to water or harvest. */
function BuildPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_MS)
    return () => clearTimeout(t)
  }, [])
  const def = BEDS[bed]
  const field = def.expansion ? EXPANSIONS[def.expansion] : null
  const title = field ? field.name : 'A new bed'
  const blurb = field ? field.blurb : 'One more raised bed to plant in.'
  const price = field ? field.price : (def.price ?? 0)
  const afford = farm.coins >= price
  const confirm = () => {
    if (!armed || !afford) return
    const ok = def.expansion ? buy(def.expansion) : buildBed(bed)
    if (!ok) return
    const { pan, near } = placeSound(def.x, def.z)
    farmSound('build', pan, near)
    dustOver(def.expansion ? BEDS.filter((b) => b.expansion === def.expansion) : [def])
    playGesture('interact')
    close()
  }
  return (
    <Shell title={title} art={field ? iconUrl('wheat') : art('hammer')} sub={<Purse />} onClose={close}>
      <p className="farm-line">{blurb}</p>
      <div className="farm-confirm">
        <button className="btn soft" onClick={close}>
          Not now
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!afford} aria-disabled={!armed} onClick={confirm}>
          {afford ? (
            <>
              Build · <Coins n={price} />
            </>
          ) : (
            <>Needs {price - farm.coins} more</>
          )}
        </button>
      </div>
    </Shell>
  )
}

/** A pale shirt colour wants a dark number on it. */
const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160
}

function Tag({ v }: { v: Visitor }) {
  const ratio = v.offer / fairPrice(v.want, v.qty)
  const tag = ratio >= 1.15 ? 'generous' : ratio >= 0.9 ? 'fair' : 'low'
  return <span className={`farm-tag ${tag}`}>{tag === 'generous' ? 'Generous' : tag === 'fair' ? 'Fair' : 'Low'}</span>
}

/** The line at the gate: sell to one buyer, to everyone you have enough for, or send someone away. */
function QueuePanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const line = waiting()
  const coming = inLine().length - line.length
  const all = sellAllPreview()
  const places = placesInLine()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      const front = waiting()
      // (not a letter of WASD: walking away from the panel must never sell anything)
      if (e.key === 'Enter' && e.shiftKey) sellAll()
      else if (e.key === 'Enter' || k === 'y') {
        const v = front.find(canSell)
        if (v) acceptOffer(v.id)
      } else if (k === 'n' || e.key === 'Backspace') {
        if (front[0]) declineOffer(front[0].id)
      } else return
      // the key did its job here: it must not also press whichever button has the focus (it would close the panel)
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const next = farm.started ? (line.length + coming >= places ? 'full' : clockText(farm.nextVisitorIn)) : null
  return (
    <Shell
      title="Buyers"
      art={art('shopping-bags')}
      sub={
        <>
          <span className="tag">
            <Users weight="bold" />
            {line.length}/{places}
          </span>
          {next && (
            <span className="tag">
              <Clock weight="bold" />
              {next === 'full' ? 'line full' : `next ${next}`}
            </span>
          )}
        </>
      }
      onClose={close}
    >
      <button className="primary farm-sell-all" disabled={!all.buyers} onClick={() => sellAll()}>
        {all.buyers ? (
          <>
            Sell to all · <Coins n={all.coins} />
          </>
        ) : (
          'Nothing to sell yet'
        )}
      </button>
      <div className="farm-list farm-queue">
        {line.map((v, i) => {
          const have = farm.inv[v.want]
          const ok = canSell(v)
          return (
            <div key={v.id} className={`farm-buyer${ok ? ' ok' : ''}`}>
              <span className="farm-avatar small" style={{ background: v.look.shirt, color: light(v.look.shirt) ? '#1d232c' : '#fff' }} aria-hidden="true">
                {i + 1}
              </span>
              <ItemPic id={v.want} count={v.qty} className="farm-want" />
              <div className="farm-buyer-body">
                <strong>{v.name}</strong>
                <span>
                  <span className={`tag ${ok ? 'ok' : 'short'}`} title={`You have ${have}`}>
                    {ok && <Check weight="bold" />}
                    {Math.min(have, v.qty)}/{v.qty}
                  </span>
                  <Tag v={v} />
                  {v.gift && <img className="farm-surprise small" src={art('wrapped-gift')} alt="and a surprise" title="Brings a surprise: a building material" />}
                </span>
              </div>
              <div className="farm-buyer-actions">
                <button className="btn leaf small" disabled={!ok} onClick={() => acceptOffer(v.id)} aria-label={`Sell to ${v.name} for ${v.offer} coins`}>
                  Sell <Coins n={v.offer} />
                </button>
                <button className="btn soft round small" onClick={() => declineOffer(v.id)} aria-label={`Send ${v.name} away`}>
                  <X weight="bold" />
                </button>
              </div>
            </div>
          )
        })}
        {!line.length && <p className="farm-empty">{coming ? 'Someone is on the way.' : 'Nobody waiting.'}</p>}
      </div>
      {!coarsePointer && (
        <p className="farm-keys">
          <kbd>Enter</kbd> sell · <kbd>Shift</kbd>+<kbd>Enter</kbd> sell to all · <kbd>N</kbd> send away
        </p>
      )}
    </Shell>
  )
}

/** Each upgrade's picture in the shop. */
const UPGRADE_ART: Record<string, ArtId> = {
  east: 'seedling',
  west: 'sheaf-of-rice',
  queue: 'people-queue',
  pace: 'person-running',
  cow: 'cow',
  sheep: 'ewe',
  hen: 'chicken',
  sprinkler: 'droplet',
  compost: 'fallen-leaf',
}

const bedsIn = (e: 'east' | 'west') => BEDS.filter((b) => b.expansion === e).length

/** Where an upgrade stands: how many times it has been bought, how many it can be, and what it changes — now and
 *  after the next one ("5 → 6" places in the line), so a card says what it does in numbers, not words. */
function upgradeStep(id: string): { level: number; levels: number; icon: ReactNode; now: string; next: string | null } {
  const glyph = (a: ArtId) => <img src={art(a)} alt="" />
  // another animal: how many there are, of how many there can be
  const herd = UPGRADES.find((u) => u.id === id)?.herd
  const range = herd && PRODUCERS[herd].herd
  if (herd && range) {
    const n = animals(herd)
    return { level: n - range.start, levels: range.max - range.start, icon: glyph(UPGRADE_ART[id]), now: String(n), next: n < range.max ? String(n + 1) : null }
  }
  switch (id) {
    case 'queue': {
      const l = upgradeLevel('queue')
      return { level: l, levels: QUEUE_LEVELS, icon: <Users weight="bold" />, now: String(placesInLine()), next: l < QUEUE_LEVELS ? String(queuePlaces(l + 1)) : null }
    }
    case 'pace': {
      const l = upgradeLevel('pace')
      return { level: l, levels: PACE_LEVELS, icon: <Clock weight="bold" />, now: clockText(arrivalSeconds()), next: l < PACE_LEVELS ? clockText(arrivalEvery(l + 1)) : null }
    }
    case 'east':
    case 'west':
      return { level: owned(id) ? 1 : 0, levels: 1, icon: glyph('seedling'), now: `+${bedsIn(id)} beds`, next: null }
    case 'sprinkler':
      return { level: owned(id) ? 1 : 0, levels: 1, icon: glyph('droplet'), now: 'Waters every bed', next: null }
    default:
      return { level: owned('compost') ? 1 : 0, levels: 1, icon: glyph('basket'), now: '×1.5 every harvest', next: null }
  }
}

/** The farm shop: a card per upgrade — its picture, its name, which level the next one is ("Level 2", or Max once
 *  there are no more) and what it changes ("👥 5 → 6"), and its price. */
function ShopPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  return (
    <Shell title="Shop" art={art('shopping-bags')} sub={<Purse />} onClose={close}>
      <div className="farm-shop">
        {UPGRADES.map((u) => {
          const has = owned(u.id)
          const price = upgradePrice(u.id)
          const step = upgradeStep(u.id)
          const repeat = step.levels > 1
          return (
            <div key={u.id} className={`farm-shop-item${has ? ' owned' : ''}`}>
              <img className="art" src={art(UPGRADE_ART[u.id] ?? 'package')} alt="" />
              <div className="farm-shop-text">
                <strong>{u.name}</strong>
                <div className="farm-shop-tags">
                  {repeat && <span className={`tag ${has ? 'ok' : 'level'}`}>{has ? 'Max' : `Level ${step.level + 1}`}</span>}
                  {!repeat && has && (
                    <span className="tag ok">
                      <Check weight="bold" />
                      Yours
                    </span>
                  )}
                  <span className="tag effect">
                    {step.icon}
                    {step.now}
                    {step.next && !has && (
                      <>
                        <ArrowRight weight="bold" className="effect-arrow" />
                        <b>{step.next}</b>
                      </>
                    )}
                  </span>
                </div>
                <small className="farm-shop-blurb">{u.blurb}</small>
              </div>
              <button
                className={`btn small${has ? ' soft' : ''}`}
                disabled={has || farm.coins < price}
                onClick={() => {
                  if (buy(u.id)) {
                    uiClick()
                    farmSound('build')
                    if (u.id === 'east' || u.id === 'west') dustOver(BEDS.filter((b) => b.expansion === u.id))
                  }
                }}
                aria-label={has ? `${u.name}: done` : `Buy ${u.name}${repeat ? `, level ${step.level + 1}` : ''}, for ${price} coins`}
              >
                {has ? <Check weight="bold" /> : <Coins n={price} />}
              </button>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

/** A number for each panel opened (the store gives a new panel object each time one opens): a card's key. */
const opened = new WeakMap<object, number>()
let opens = 0
const opening = (panel: object) => {
  if (!opened.has(panel)) opened.set(panel, ++opens)
  return opened.get(panel)
}

/** The garden's interface: the dashboard at the top outdoors (./TopDash.tsx) and whichever farm panel is open. */
export function FarmUI() {
  const phase = useHome((s) => s.phase)
  const outdoors = useHome((s) => s.outdoors)
  const panel = useHome((s) => s.panel)
  const editing = useHome((s) => s.editing)
  if (phase !== 'playing') return null
  return (
    <>
      {(outdoors || panel || editing) && <TopDash />}
      <EditPanel />
      <DecoratePanel />
      {panel?.kind === 'seeds' && <SeedsPanel bed={panel.bed} />}
      {panel?.kind === 'build' && <BuildPanel bed={panel.bed} />}
      {panel?.kind === 'bed' && <BedPanel bed={panel.bed} />}
      {panel?.kind === 'furniture' && <FurnitureShop />}
      {panel?.kind === 'buy-piece' && <BuyPiece type={panel.type} />}
      {panel?.kind === 'decor-shop' && <DecorShop tab={panel.tab} />}
      {panel?.kind === 'decor-buy' && <BuyDecor item={panel.item} />}
      {panel?.kind === 'queue' && <QueuePanel />}
      {panel?.kind === 'shop' && <ShopPanel />}
      {panel?.kind === 'store' && <StorePanel store={panel.store} />}
      {panel?.kind === 'store-upgrade' && <StoreUpgradePanel store={panel.store} />}
      {/* one element for both: the card that asks for an upgrade opens over the board, never a board again */}
      {(panel?.kind === 'orders' || panel?.kind === 'office-upgrade') && <OrdersPanel asking={panel.kind === 'office-upgrade' ? panel.id : null} />}
      {panel?.kind === 'away' && <AwayPanel />}
      {panel?.kind === 'goals' && <GoalsPanel />}
      {panel?.kind === 'manager' && <ManagerPanel />}
      {panel?.kind === 'market' && <MarketPanel />}
      {panel?.kind === 'market-place' && <MarketPlacePanel place={panel.place} />}
      {panel?.kind === 'market-buy' && <MarketBuyPanel />}
      {panel?.kind === 'contractor' && <ContractorPanel />}
      {panel?.kind === 'car' && <CarPanel />}
      {panel?.kind === 'estate' && <EstatePanel />}
      {panel?.kind === 'house-buy' && <HouseBuyPanel />}
      {panel?.kind === 'ladder' && <LadderCard id={panel.id} />}
      {panel?.kind === 'machine' && <MachinePanel id={panel.id} />}
      {panel?.kind === 'machine-slot' && <MachineSlotCard id={panel.id} />}
      {/* the level's card goes out the way it came in (src/ui/SwipeSheet.tsx); opened again while it is still going,
          it is a new card (a key of its own each time), never the one leaving brought back */}
      <AnimatePresence>{panel?.kind === 'level' && <LevelPanel key={`level-${opening(panel)}`} />}</AnimatePresence>
      {/* the daily gift: out the way it came in, as the level's card */}
      <AnimatePresence>{panel?.kind === 'daily' && <DailyPanel key={`daily-${opening(panel)}`} />}</AnimatePresence>
      {panel?.kind === 'wardrobe' && <WardrobePanel />}
      <LevelUp />
      <AwayWatcher />
      <DailyWatcher />
    </>
  )
}
