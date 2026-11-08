import { useEffect, useRef, useState, type ReactNode } from 'react'
import { farmSound, placeSound, uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { BEDS, CROPS, MILL, MILLABLE, OVEN, PRODUCE, RECIPES, UPGRADES, arrivalEvery, count, produceById, queuePlaces, type CropId, type MillInput, type ProduceId } from './data'
import { EditButton, EditPanel } from './EditPanel'
import { iconUrl } from './icons'
import {
  acceptOffer,
  arrivalSeconds,
  bake,
  buy,
  canBake,
  canSell,
  clockText,
  declineOffer,
  fairPrice,
  farm,
  inLine,
  millLoad,
  owned,
  placesInLine,
  plant,
  sellAll,
  sellAllPreview,
  upgradeLevel,
  upgradePrice,
  useFarm,
  waiting,
  yieldOf,
  type Visitor,
} from './state'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** How many chips fit across the top: fewer on an upright phone, more on its side or on a big screen. */
function useChipRoom() {
  const [room, setRoom] = useState(() => chipRoom())
  useEffect(() => {
    const update = () => setRoom(chipRoom())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return room
}
const chipRoom = () => Math.max(2, Math.min(9, Math.floor((window.innerWidth - 230) / 66)))

const PersonGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="7.5" r="3.5" />
    <path d="M5 20.5c.8-4 3.6-6.5 7-6.5s6.2 2.5 7 6.5" />
  </svg>
)

/** Coins, the line at the gate and what is in the basket, while you are in the garden. Tap it for the whole basket. */
function FarmChip() {
  useFarm((s) => s.rev)
  const room = useChipRoom()
  const openPanel = useHome((s) => s.openPanel)
  const panel = useHome((s) => s.panel)
  const stock = PRODUCE.filter((p) => farm.inv[p.id] > 0)
  const shown = stock.length > room ? stock.slice(0, room - 1) : stock
  const hidden = stock.length - shown.length
  const line = inLine().length
  return (
    <button className="farm-chip" aria-label="Your coins and harvest — open the basket" onClick={() => !panel && openPanel({ kind: 'basket' })}>
      <span className="farm-chip-item coins" title="Coins">
        <img src={iconUrl('coin', 48)} alt="" />
        <b>{farm.coins}</b>
      </span>
      {farm.started && (
        <span className={`farm-chip-item line${line >= placesInLine() ? ' full' : ''}`} title="Buyers in line at the gate">
          <PersonGlyph />
          <b>
            {line}/{placesInLine()}
          </b>
        </span>
      )}
      {shown.map((p) => (
        <span key={p.id} className="farm-chip-item" title={cap(p.plural)}>
          <img src={iconUrl(p.id, 48)} alt="" />
          <b>{farm.inv[p.id]}</b>
        </span>
      ))}
      {hidden > 0 && <span className="farm-chip-item more">+{hidden}</span>}
    </button>
  )
}

function Shell({ title, sub, children, onClose }: { title: string; sub?: ReactNode; children: ReactNode; onClose: () => void }) {
  const first = useRef<HTMLDivElement>(null)
  useEffect(() => {
    first.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="farm-backdrop" onClick={onClose}>
      <div className="farm-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} ref={first}>
        <header>
          <div>
            <h2>{title}</h2>
            {sub && <p className="farm-sub">{sub}</p>}
          </div>
          <button className="close" onClick={onClose} aria-label="Close (Esc)">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

const Coins = ({ n }: { n: number }) => (
  <span className="farm-coins">
    <img src={iconUrl('coin', 40)} alt="" />
    {n}
  </span>
)

function SeedsPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const choose = (crop: CropId) => {
    if (!plant(bed, crop)) return
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
    <Shell title="Plant seeds" sub={<>Seeds are bought as you plant · you have <Coins n={farm.coins} /></>} onClose={close}>
      <div className="farm-grid">
        {CROPS.map((c, i) => {
          const afford = farm.coins >= c.seedCost
          return (
            <button key={c.id} className="farm-card" disabled={!afford} onClick={() => choose(c.id)}>
              <kbd className="farm-key">{i + 1}</kbd>
              <img src={iconUrl(c.id, 96)} alt="" />
              <span className="farm-card-name">{cap(c.plural)}</span>
              <span className="farm-card-meta">
                ready in {c.growSeconds < 60 ? `${c.growSeconds} s` : `${Math.round((c.growSeconds / 60) * 10) / 10} min`}
              </span>
              <span className="farm-card-meta">
                {yieldOf(c.id)} × ~{c.price} coins
              </span>
              <span className="farm-card-price">
                seeds <Coins n={c.seedCost} />
              </span>
            </button>
          )
        })}
      </div>
      <p className="farm-hint">Water them when the bed asks for it. Buyers come to the gate for what you grow.</p>
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
  const next = farm.started ? (line.length + coming >= places ? 'the line is full' : `next buyer in ${clockText(farm.nextVisitorIn)}`) : 'buyers come once you plant'
  return (
    <Shell title="Buyers at the gate" sub={`${line.length} of ${places} waiting${coming ? ` · ${coming} on the way` : ''} · ${next}`} onClose={close}>
      <button className="primary farm-sell-all" disabled={!all.buyers} onClick={() => sellAll()}>
        {all.buyers ? (
          <>
            Sell to everyone I can · {all.buyers} {all.buyers === 1 ? 'buyer' : 'buyers'} · + {all.coins} coins
          </>
        ) : (
          'Nothing in the basket for anyone yet'
        )}
      </button>
      <div className="farm-list farm-queue">
        {line.map((v, i) => {
          const have = farm.inv[v.want]
          const ok = canSell(v)
          return (
            <div key={v.id} className={`farm-row farm-buyer${ok ? ' ok' : ''}`}>
              <span className="farm-avatar small" style={{ background: v.look.shirt, color: light(v.look.shirt) ? '#1d232c' : '#fff' }} aria-hidden="true">
                {i + 1}
              </span>
              <img className="farm-buyer-icon" src={iconUrl(v.want, 64)} alt="" />
              <div className="farm-buyer-body">
                <strong>
                  {v.name} · {count(v.want, v.qty)}
                </strong>
                <span>
                  for <Coins n={v.offer} /> <Tag v={v} /> {ok ? `you have ${have}` : have ? `you have only ${have}` : `you have none`}
                </span>
              </div>
              <div className="farm-buyer-actions">
                <button className="primary small" disabled={!ok} onClick={() => acceptOffer(v.id)}>
                  Sell
                </button>
                <button className="farm-secondary small" onClick={() => declineOffer(v.id)} aria-label={`Send ${v.name} away`}>
                  No
                </button>
              </div>
            </div>
          )
        })}
        {!line.length && <p className="farm-empty">Nobody is waiting right now{coming ? ' — someone is on the way.' : '.'}</p>}
      </div>
      <p className="farm-hint">
        Buyers wait in line until you sell to them or send them away; someone new soon takes the place of anyone you turn down.
        {!coarsePointer && (
          <>
            {' '}
            <kbd>Enter</kbd> sell to the first you can · <kbd>Shift</kbd>+<kbd>Enter</kbd> sell to everyone · <kbd>N</kbd> send the first away
          </>
        )}
      </p>
    </Shell>
  )
}

/** Everything in the basket, with what it fetches. */
function BasketPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const stock = PRODUCE.filter((p) => farm.inv[p.id] > 0)
  const worth = stock.reduce((sum, p) => sum + p.price * farm.inv[p.id], 0)
  return (
    <Shell title="Your basket" sub={<>You have <Coins n={farm.coins} /> · basket worth ≈ {worth}</>} onClose={close}>
      {stock.length ? (
        <div className="farm-basket">
          {stock.map((p) => (
            <div key={p.id} className="farm-basket-item" title={`${count(p.id, farm.inv[p.id])} · about ${p.price} coins each`}>
              <img src={iconUrl(p.id, 64)} alt="" />
              <b>{farm.inv[p.id]}</b>
              <span>{cap(p.plural)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="farm-empty">The basket is empty — harvest a bed, collect eggs, milk a cow or shear a sheep.</p>
      )}
      <p className="farm-hint">
        {farm.started ? `${inLine().length} of ${placesInLine()} places in the line at the gate taken · a new buyer about every ${clockText(arrivalSeconds())}.` : 'Plant something and buyers start coming to the gate.'}
      </p>
    </Shell>
  )
}

function ShopPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const { stats } = farm
  return (
    <Shell title="Farm shop" sub={<>You have <Coins n={farm.coins} /></>} onClose={close}>
      <div className="farm-list">
        {UPGRADES.map((u) => {
          const has = owned(u.id)
          const price = upgradePrice(u.id)
          const level = upgradeLevel(u.id)
          const extra =
            u.id === 'hen'
              ? ` · ${farm.hens} now`
              : u.id === 'cow'
                ? ` · ${farm.cows} now`
                : u.id === 'sheep'
                  ? ` · ${farm.sheep} now`
                  : u.id === 'queue'
                    ? has
                      ? ` · ${placesInLine()} places, the most there is`
                      : ` · ${placesInLine()} → ${queuePlaces(level + 1)} places`
                    : u.id === 'pace'
                      ? has
                        ? ` · one every ${clockText(arrivalSeconds())}, as often as it gets`
                        : ` · one every ${clockText(arrivalSeconds())} → ${clockText(arrivalEvery(level + 1))}`
                      : ''
          return (
            <div key={u.id} className="farm-row">
              <div>
                <strong>
                  {u.name}
                  {u.levels ? <small className="farm-level"> {level}/{u.levels}</small> : null}
                </strong>
                <span>
                  {u.blurb}
                  {extra}
                </span>
              </div>
              <button
                className={has ? 'farm-secondary' : 'primary small'}
                disabled={has || farm.coins < price}
                onClick={() => {
                  if (buy(u.id)) {
                    uiClick()
                    farmSound('build')
                  }
                }}
              >
                {has ? (u.levels ? 'Max' : 'Done') : <>Buy · {price}</>}
              </button>
            </div>
          )
        })}
      </div>
      <p className="farm-hint">
        This season: {stats.harvested} picked · {stats.sold} sold · {stats.earned} coins earned
        {stats.declined ? ` · ${stats.declined} buyers turned away` : ''}
      </p>
    </Shell>
  )
}

const Need = ({ id, n }: { id: ProduceId; n: number }) => {
  const have = farm.inv[id]
  return (
    <span className={have >= n ? 'farm-need ok' : 'farm-need short'} title={`${count(id, n)} (you have ${have})`}>
      <img src={iconUrl(id, 40)} alt="" />
      {n}
      <small>/{have}</small>
    </span>
  )
}

function MillPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const run = (input: MillInput) => {
    if (!millLoad(input)) return
    const { pan, near } = placeSound(MILL.x, MILL.z)
    farmSound('creak', pan, near)
    playGesture('interact')
    close()
  }
  return (
    <Shell title="Mill" sub={`Up to ${MILL.capacity} at a time · ${MILL.perItem} s each`} onClose={close}>
      <div className="farm-list">
        {(Object.keys(MILLABLE) as MillInput[]).map((input) => {
          const out = MILLABLE[input]
          const have = farm.inv[input]
          const n = Math.min(MILL.capacity, have)
          return (
            <div key={input} className="farm-row">
              <div className="farm-row-flow">
                <img src={iconUrl(input, 48)} alt="" />
                <span className="farm-arrow">→</span>
                <img src={iconUrl(out, 48)} alt="" />
                <div>
                  <strong>{input === 'sugarcane' ? 'Press sugar cane into sugar' : 'Grind wheat into flour'}</strong>
                  <span>{have ? `You have ${count(input, have)}` : `Grow some ${produceById(input).plural} first`}</span>
                </div>
              </div>
              <button className="primary small" disabled={!n} onClick={() => run(input)}>
                {n ? `Mill ${n}` : 'Nothing to mill'}
              </button>
            </div>
          )
        })}
      </div>
      <p className="farm-hint">Sugar and flour go into cakes at the oven — and buyers take them too.</p>
    </Shell>
  )
}

function OvenPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const go = (id: (typeof RECIPES)[number]['id']) => {
    if (!bake(id)) return
    const { pan, near } = placeSound(OVEN.x, OVEN.z)
    farmSound('oven', pan, near)
    playGesture('interact')
    close()
  }
  return (
    <Shell title="Oven" sub="Bake with what the farm makes · cakes sell for the most" onClose={close}>
      <div className="farm-list">
        {RECIPES.map((r) => {
          const ok = canBake(r.id)
          return (
            <div key={r.id} className="farm-row farm-recipe">
              <img className="farm-recipe-icon" src={iconUrl(r.id, 64)} alt="" />
              <div className="farm-recipe-body">
                <strong>
                  {r.name} <span className="farm-coins-inline">≈ {produceById(r.id).price} coins</span>
                </strong>
                <div className="farm-needs">
                  {Object.entries(r.needs).map(([k, n]) => (
                    <Need key={k} id={k as ProduceId} n={n ?? 0} />
                  ))}
                </div>
              </div>
              <button className="primary small" disabled={!ok} onClick={() => go(r.id)}>
                Bake · {r.seconds} s
              </button>
            </div>
          )
        })}
      </div>
      <p className="farm-hint">Flour and sugar come from the mill, milk from the cows, eggs from the hens.</p>
    </Shell>
  )
}

/** The garden's interface: the coin/harvest chip outdoors and whichever farm panel is open. */
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
      {panel?.kind === 'seeds' && <SeedsPanel bed={panel.bed} />}
      {panel?.kind === 'queue' && <QueuePanel />}
      {panel?.kind === 'basket' && <BasketPanel />}
      {panel?.kind === 'shop' && <ShopPanel />}
      {panel?.kind === 'mill' && <MillPanel />}
      {panel?.kind === 'oven' && <OvenPanel />}
    </>
  )
}

