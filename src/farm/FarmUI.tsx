import { useEffect, useRef, type ReactNode } from 'react'
import { farmSound, placeSound, uiClick } from '../audio/sound'
import { coarsePointer } from '../lib/device'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { BEDS, CROPS, PRODUCE, UPGRADES, count, produceById, type CropId } from './data'
import { iconUrl } from './icons'
import { acceptOffer, buy, declineOffer, fairPrice, farm, owned, plant, useFarm, visitorById, yieldOf } from './state'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Coins and what is in the basket, while you are in the garden. */
function FarmChip() {
  useFarm((s) => s.rev)
  const stock = PRODUCE.filter((p) => farm.inv[p.id] > 0)
  return (
    <div className="farm-chip" aria-label="Your coins and harvest">
      <span className="farm-chip-item coins" title="Coins">
        <img src={iconUrl('coin', 48)} alt="" />
        <b>{farm.coins}</b>
      </span>
      {stock.map((p) => (
        <span key={p.id} className="farm-chip-item" title={cap(p.plural)}>
          <img src={iconUrl(p.id, 48)} alt="" />
          <b>{farm.inv[p.id]}</b>
        </span>
      ))}
    </div>
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

function OfferPanel({ visitor }: { visitor: number }) {
  useFarm((s) => s.rev)
  const close = useHome((s) => s.closePanel)
  const v = visitorById(visitor)
  const gone = !v || v.phase !== 'waiting'
  useEffect(() => {
    if (gone) close()
  }, [gone, close])
  useEffect(() => {
    if (!v) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key.toLowerCase() === 'y') && farm.inv[v.want] >= v.qty) acceptOffer(v.id)
      else if (e.key.toLowerCase() === 'n' || e.key === 'Backspace') declineOffer(v.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [v])
  if (!v || gone) return null
  const have = farm.inv[v.want]
  const fair = fairPrice(v.want, v.qty)
  const ratio = v.offer / fair
  const tag = ratio >= 1.15 ? 'generous' : ratio >= 0.9 ? 'fair' : 'low'
  const p = produceById(v.want)
  return (
    <Shell title={`${v.name} at the gate`} sub="would like to buy" onClose={close}>
      <div className="farm-offer">
        <span className="farm-avatar" style={{ background: v.look.shirt }} aria-hidden="true">
          {v.name[0]}
        </span>
        <div className="farm-offer-want">
          <img src={iconUrl(v.want, 96)} alt="" />
          <strong>{count(v.want, v.qty)}</strong>
        </div>
        <div className="farm-offer-price">
          <span>for</span>
          <strong>
            <Coins n={v.offer} />
          </strong>
          <span className={`farm-tag ${tag}`}>
            {tag === 'generous' ? 'Generous' : tag === 'fair' ? 'Fair' : 'Low'} · market ≈ {fair}
          </span>
        </div>
      </div>
      <p className={have >= v.qty ? 'farm-stock ok' : 'farm-stock short'}>
        {have >= v.qty ? `You have ${count(v.want, have)}.` : have > 0 ? `You only have ${count(v.want, have)}.` : `You have no ${p.plural} yet.`}
      </p>
      <div className="farm-actions">
        <button className="primary" disabled={have < v.qty} onClick={() => acceptOffer(v.id)}>
          Sell for {v.offer} coins
        </button>
        <button className="farm-secondary" onClick={() => declineOffer(v.id)}>
          No, thanks
        </button>
      </div>
      {!coarsePointer && (
        <p className="farm-hint">
          <kbd>Enter</kbd> sell · <kbd>N</kbd> decline · <kbd>Esc</kbd> think about it ({v.name} waits a little while)
        </p>
      )}
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
          const extra = u.id === 'hen' ? ` · ${farm.hens} now` : ''
          return (
            <div key={u.id} className="farm-row">
              <div>
                <strong>{u.name}</strong>
                <span>
                  {u.blurb}
                  {extra}
                </span>
              </div>
              <button
                className={has ? 'farm-secondary' : 'primary small'}
                disabled={has || farm.coins < u.price}
                onClick={() => {
                  if (buy(u.id)) {
                    uiClick()
                    farmSound('build')
                  }
                }}
              >
                {has ? 'Done' : <>Buy · {u.price}</>}
              </button>
            </div>
          )
        })}
      </div>
      <p className="farm-hint">
        This season: {stats.harvested} picked · {stats.sold} sold · {stats.earned} coins earned
        {stats.declined ? ` · ${stats.declined} offers turned down` : ''}
      </p>
    </Shell>
  )
}

/** The garden's interface: the coin/harvest chip outdoors and whichever farm panel is open. */
export function FarmUI() {
  const phase = useHome((s) => s.phase)
  const outdoors = useHome((s) => s.outdoors)
  const panel = useHome((s) => s.panel)
  if (phase !== 'playing') return null
  return (
    <>
      {(outdoors || panel) && <FarmChip />}
      {panel?.kind === 'seeds' && <SeedsPanel bed={panel.bed} />}
      {panel?.kind === 'offer' && <OfferPanel visitor={panel.visitor} />}
      {panel?.kind === 'shop' && <ShopPanel />}
    </>
  )
}

