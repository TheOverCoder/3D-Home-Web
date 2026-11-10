import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { farmSound, placeSound, uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { playGesture } from '../lib/gestures'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { BEDS, CROPS, EXPANSIONS, MILL, MILLABLE, OVEN, PRODUCE, RECIPES, UPGRADES, arrivalEvery, count, produceById, queuePlaces, type CropId, type MillInput, type ProduceId } from './data'
import { EditButton, EditPanel } from './EditPanel'
import { iconUrl } from './icons'
import { art, type ArtId } from '../ui/art'
import { Check, Clock, Users, X } from '../ui/glyphs'
import {
  acceptOffer,
  arrivalSeconds,
  bake,
  bedsNear,
  buildBed,
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
        <img src={art('coin')} alt="" />
        <b>{farm.coins}</b>
      </span>
      {farm.started && (
        <span className={`farm-chip-item line${line >= placesInLine() ? ' full' : ''}`} title="Buyers in line at the gate">
          <Users weight="bold" />
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

/** A farm panel: its picture, a title of a few words, a row of chips, what it is for, and a close button. */
function Shell({ title, art: pic, sub, children, onClose }: { title: string; art?: string; sub?: ReactNode; children: ReactNode; onClose: () => void }) {
  const first = useRef<HTMLDivElement>(null)
  useEffect(() => {
    first.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="farm-backdrop" onClick={onClose}>
      <div className="farm-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} ref={first}>
        <header>
          {pic && <img className="art farm-head-art" src={pic} alt="" />}
          <div className="farm-head-text">
            <h2>{title}</h2>
            {sub && <div className="farm-sub">{sub}</div>}
          </div>
          <button className="close" onClick={onClose} aria-label="Close (Esc)">
            <X weight="bold" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

const Coins = ({ n }: { n: number }) => (
  <span className="farm-coins">
    <img src={art('coin')} alt="" />
    {n}
  </span>
)

/** What you have, as a chip. */
const Purse = () => (
  <span className="tag">
    <img src={art('coin')} alt="" />
    {farm.coins}
  </span>
)

const seconds = (s: number) => (s < 60 ? `${s} s` : `${Math.round((s / 60) * 10) / 10} min`)

function SeedsPanel({ bed }: { bed: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  // every empty bed within reach gets the same seeds (as far as the coins go)
  const beds = useMemo(() => bedsNear(bed, 'empty', playerState.position.x, playerState.position.z), [bed])
  const choose = (crop: CropId) => {
    if (!plantBeds(beds, crop)) return
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
              <img className="art" src={iconUrl(c.id, 128)} alt="" />
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

/** How long a confirm button waits before it can be pressed: a second tap of the button that opened the card (a
 *  double tap, a key held down) lands on nothing. */
const ARM_MS = 450

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
    playGesture('interact')
    close()
  }
  return (
    <Shell title={title} art={art(field ? 'sheaf-of-rice' : 'hammer')} sub={<Purse />} onClose={close}>
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
              <span className="farm-want">
                <img className="art" src={iconUrl(v.want, 128)} alt="" />
                <b>×{v.qty}</b>
              </span>
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

/** Everything in the basket, with what it fetches. */
function BasketPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const stock = PRODUCE.filter((p) => farm.inv[p.id] > 0)
  const worth = stock.reduce((sum, p) => sum + p.price * farm.inv[p.id], 0)
  return (
    <Shell
      title="Basket"
      art={art('basket')}
      sub={
        <>
          <Purse />
          {worth > 0 && (
            <span className="tag" title="What the basket would fetch">
              <img src={art('sparkles')} alt="" />≈ {worth}
            </span>
          )}
        </>
      }
      onClose={close}
    >
      {stock.length ? (
        <div className="farm-basket">
          {stock.map((p) => (
            <div key={p.id} className="farm-basket-item" title={`${count(p.id, farm.inv[p.id])} · about ${p.price} coins each`}>
              <img className="art" src={iconUrl(p.id, 128)} alt="" />
              <b>{farm.inv[p.id]}</b>
              <span>{cap(p.plural)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="farm-empty">Nothing yet — harvest, collect, milk or shear.</p>
      )}
    </Shell>
  )
}

/** Each upgrade's picture in the shop. */
const UPGRADE_ART: Record<string, ArtId> = {
  east: 'seedling',
  west: 'sheaf-of-rice',
  queue: 'ticket',
  pace: 'running-shoe',
  cow: 'cow',
  sheep: 'ewe',
  hen: 'chicken',
  sprinkler: 'droplet',
  compost: 'fallen-leaf',
}

function ShopPanel() {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  return (
    <Shell title="Shop" art={art('shopping-bags')} sub={<Purse />} onClose={close}>
      <div className="farm-shop">
        {UPGRADES.map((u) => {
          const has = owned(u.id)
          const price = upgradePrice(u.id)
          const level = upgradeLevel(u.id)
          const now =
            u.id === 'hen'
              ? `${farm.hens} now`
              : u.id === 'cow'
                ? `${farm.cows} now`
                : u.id === 'sheep'
                  ? `${farm.sheep} now`
                  : u.id === 'queue'
                    ? has
                      ? `${placesInLine()} places`
                      : `${placesInLine()} → ${queuePlaces(level + 1)}`
                    : u.id === 'pace'
                      ? has
                        ? `every ${clockText(arrivalSeconds())}`
                        : `${clockText(arrivalSeconds())} → ${clockText(arrivalEvery(level + 1))}`
                      : null
          return (
            <div key={u.id} className={`farm-shop-item${has ? ' owned' : ''}`}>
              <img className="art" src={art(UPGRADE_ART[u.id] ?? 'package')} alt="" />
              <div className="farm-shop-text">
                <strong>{u.name}</strong>
                <span>{u.blurb}</span>
                {(now || u.levels) && (
                  <span className="farm-shop-tags">
                    {u.levels ? (
                      <span className="tag">
                        {level}/{u.levels}
                      </span>
                    ) : null}
                    {now && <span className="tag">{now}</span>}
                  </span>
                )}
              </div>
              <button
                className={`btn small${has ? ' soft' : ''}`}
                disabled={has || farm.coins < price}
                onClick={() => {
                  if (buy(u.id)) {
                    uiClick()
                    farmSound('build')
                  }
                }}
                aria-label={has ? `${u.name}: done` : `Buy ${u.name} for ${price} coins`}
              >
                {has ? (
                  u.levels ? (
                    'Max'
                  ) : (
                    <Check weight="bold" />
                  )
                ) : (
                  <Coins n={price} />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

const Need = ({ id, n }: { id: ProduceId; n: number }) => {
  const have = farm.inv[id]
  return (
    // enough: how many it takes, ticked; short: what you have of what it takes, in red
    <span className={have >= n ? 'farm-need ok' : 'farm-need short'} title={`${count(id, n)} (you have ${have})`}>
      <img src={iconUrl(id, 40)} alt="" />
      {have >= n ? (
        <>
          ×{n}
          <Check weight="bold" />
        </>
      ) : (
        `${have}/${n}`
      )}
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
    <Shell
      title="Mill"
      art={art('sheaf-of-rice')}
      sub={
        <span className="tag">
          <Clock weight="bold" />
          {MILL.perItem} s each · up to {MILL.capacity}
        </span>
      }
      onClose={close}
    >
      <div className="farm-list">
        {(Object.keys(MILLABLE) as MillInput[]).map((input) => {
          const out = MILLABLE[input]
          const have = farm.inv[input]
          const n = Math.min(MILL.capacity, have)
          return (
            <div key={input} className="farm-row farm-recipe">
              <div className="farm-row-flow">
                <img className="art" src={iconUrl(input, 128)} alt="" />
                <span className="farm-arrow">→</span>
                <img className="art" src={iconUrl(out, 128)} alt="" />
              </div>
              <div className="farm-recipe-body">
                <strong>{cap(produceById(out).plural)}</strong>
                <span className={`tag ${have ? '' : 'short'}`}>
                  <img src={iconUrl(input, 40)} alt="" />
                  {have}
                </span>
              </div>
              <button className="btn small" disabled={!n} onClick={() => run(input)}>
                {n ? `Mill ${n}` : 'None'}
              </button>
            </div>
          )
        })}
      </div>
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
    <Shell title="Oven" art={art('shortcake')} sub={<Purse />} onClose={close}>
      <div className="farm-list">
        {RECIPES.map((r) => {
          const ok = canBake(r.id)
          return (
            <div key={r.id} className="farm-row farm-recipe">
              <img className="art farm-recipe-icon" src={iconUrl(r.id, 128)} alt="" />
              <div className="farm-recipe-body">
                <strong>
                  {r.name}{' '}
                  <span className="tag">
                    <img src={art('coin')} alt="" />≈ {produceById(r.id).price}
                  </span>
                </strong>
                <div className="farm-needs">
                  {Object.entries(r.needs).map(([k, n]) => (
                    <Need key={k} id={k as ProduceId} n={n ?? 0} />
                  ))}
                </div>
              </div>
              <button className="btn small" disabled={!ok} onClick={() => go(r.id)}>
                Bake · {r.seconds} s
              </button>
            </div>
          )
        })}
      </div>
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
      {panel?.kind === 'build' && <BuildPanel bed={panel.bed} />}
      {panel?.kind === 'queue' && <QueuePanel />}
      {panel?.kind === 'basket' && <BasketPanel />}
      {panel?.kind === 'shop' && <ShopPanel />}
      {panel?.kind === 'mill' && <MillPanel />}
      {panel?.kind === 'oven' && <OvenPanel />}
    </>
  )
}

