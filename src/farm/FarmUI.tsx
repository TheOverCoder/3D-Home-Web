import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { farmSound, placeSound, uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { farmFx } from '../fx/fx'
import { playGesture } from '../lib/gestures'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { BEDS, BED_BOX, CROPS, EXPANSIONS, PACE_LEVELS, PRODUCERS, QUEUE_LEVELS, STORES, STORE_IDS, UPGRADES, arrivalEvery, queuePlaces, type BedDef, type CropId, type StoreId } from './data'
import { EditButton, EditPanel } from './EditPanel'
import { DecoratePanel } from '../home/DecoratePanel'
import { BuyPiece, FurnitureShop } from '../home/FurnitureShop'
import { iconUrl } from './icons'
import { StorePanel, StoreUpgradePanel } from './StorePanel'
import { ItemPic } from '../ui/ItemPic'
import { ARM_MS, Coins, Purse, Shell } from '../ui/Sheet'
import { art, type ArtId } from '../ui/art'
import { ArrowRight, Check, Clock, Users, X } from '../ui/glyphs'
import {
  acceptOffer,
  animals,
  arrivalSeconds,
  bedsForSeeds,
  bedsNear,
  buildBed,
  buy,
  canSell,
  capacity,
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
  used,
  waiting,
  type Visitor,
} from './state'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Coins, the line at the gate, and how full the silo and the barn are, while you are in the garden. Tap the silo or
 *  the barn for what is inside. */
function FarmChip() {
  useFarm((s) => s.rev)
  const row = useRef<HTMLDivElement>(null)
  // how far down the chips reach (one row or two), for the compass under them (styles.css: .compass)
  useEffect(() => {
    const el = row.current
    if (!el) return
    const css = document.documentElement.style
    const measure = () => css.setProperty('--chips-bottom', `${Math.round(el.getBoundingClientRect().bottom)}px`)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      ro.disconnect()
      css.removeProperty('--chips-bottom')
    }
  }, [])
  const line = inLine().length
  return (
    <div className="farm-chip" ref={row} role="group" aria-label="Your coins, the line at the gate, the silo and the barn">
      <ChipItem value={farm.coins} className="coins" title="Coins">
        <img src={art('coin')} alt="" />
        <b>{farm.coins}</b>
      </ChipItem>
      {farm.started && (
        <ChipItem value={line} className={`line${line >= placesInLine() ? ' full' : ''}`} title="Buyers in line at the gate">
          <Users weight="bold" />
          <b>
            {line}/{placesInLine()}
          </b>
        </ChipItem>
      )}
      {STORE_IDS.map((id) => (
        <StoreChip key={id} id={id} />
      ))}
    </div>
  )
}

/** How full the silo or the barn is (34/50): it hops as goods come in, turns red when full, and opens its panel. */
function StoreChip({ id }: { id: StoreId }) {
  const openPanel = useHome((s) => s.openPanel)
  const panel = useHome((s) => s.panel)
  const n = used(id)
  const cap = capacity(id)
  return (
    <ChipItem
      value={n}
      className={`store ${id}${n >= cap ? ' full' : ''}`}
      title={`${STORES[id].name}: ${n} of ${cap}`}
      onClick={() => !panel && openPanel({ kind: 'store', store: id })}
      label={`${STORES[id].name}: ${n} of ${cap}${n >= cap ? ', full' : ''} — open it`}
    >
      <img src={iconUrl(id)} alt="" />
      <b>
        {n}
        <span className="of">/{cap}</span>
      </b>
    </ChipItem>
  )
}

/** One count in the chip row. It hops when the count goes up — a harvest landing in the silo, a sale paid — so you
 *  see where it went (two class names, so that a hop right after another starts again). With `onClick` it is a
 *  button (the silo, the barn). */
function ChipItem({ value, className = '', title, children, onClick, label }: { value: number; className?: string; title?: string; children: ReactNode; onClick?: () => void; label?: string }) {
  const [last, setLast] = useState(value)
  const [hops, setHops] = useState(0)
  if (value !== last) {
    setLast(value)
    if (value > last) setHops(hops + 1)
  }
  const cls = `farm-chip-item${className ? ` ${className}` : ''}${hops ? (hops % 2 ? ' hop-a' : ' hop-b') : ''}`
  return onClick ? (
    <button className={cls} title={title} onClick={onClick} aria-label={label}>
      {children}
    </button>
  ) : (
    <span className={cls} title={title}>
      {children}
    </span>
  )
}

const seconds = (s: number) => (s < 60 ? `${s} s` : `${Math.round((s / 60) * 10) / 10} min`)

function SeedsPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // every empty bed within reach gets the same seeds (as far as the coins go), but one set to grow something else
  const beds = useMemo(() => bedsNear(bed, 'empty', playerState.position.x, playerState.position.z).filter((i) => i === bed || !farm.beds[i].fixed), [bed])
  const choose = (crop: CropId) => {
    if (!plantBeds(bedsForSeeds(bed, crop, playerState.position.x, playerState.position.z), crop)) return
    const def = BEDS[bed]
    const { pan, near } = placeSound(def.x, def.z)
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

/** The garden's interface: the chips at the top outdoors (coins, the line, the silo and the barn) and whichever farm
 *  panel is open. */
export function FarmUI() {
  const phase = useHome((s) => s.phase)
  const outdoors = useHome((s) => s.outdoors)
  const panel = useHome((s) => s.panel)
  const editing = useHome((s) => s.editing)
  if (phase !== 'playing') return null
  return (
    <>
      {(outdoors || panel || editing) && <FarmChip />}
      <EditButton />
      <EditPanel />
      <DecoratePanel />
      {panel?.kind === 'seeds' && <SeedsPanel bed={panel.bed} />}
      {panel?.kind === 'build' && <BuildPanel bed={panel.bed} />}
      {panel?.kind === 'bed' && <BedPanel bed={panel.bed} />}
      {panel?.kind === 'furniture' && <FurnitureShop />}
      {panel?.kind === 'buy-piece' && <BuyPiece type={panel.type} />}
      {panel?.kind === 'queue' && <QueuePanel />}
      {panel?.kind === 'shop' && <ShopPanel />}
      {panel?.kind === 'store' && <StorePanel store={panel.store} />}
      {panel?.kind === 'store-upgrade' && <StoreUpgradePanel store={panel.store} />}
    </>
  )
}
