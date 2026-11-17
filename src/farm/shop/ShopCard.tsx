import { animate, m, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { art } from '../../ui/art'
import { ArrowRight, Check, Clock, Crown, LockSimple, Users } from '../../ui/glyphs'
import { LockCorner, LockTag, opensWords, useNope } from '../../ui/LockTag'
import { DEAL, DID, FLIP, NOPE, SHIMMER, SINK } from '../../ui/motion'
import { Coins, Shell } from '../../ui/Shell'
import type { LadderId, ToolKind, UpgradeId } from '../data'
import type { AnimalCard, FarmRow, RemoteTile, UpgradesView } from './view'
import './Shop.css'

// The farm shop (the design lab's shop-animals board, C, with the user's change: a tool's upgrades are in its own panel,
// not here): the design layer — it draws an UpgradesView (./view.ts) and calls ShopActions, nothing of the farm in it.
//
// Its animals are a shelf of three cards that slide sideways (the next one peeks; the animals' pictures under it say
// which, and the shelf opens on a tool for sale), each the whole story of a kind: the animal and her herd as dots with
// "+1" and its price (or the level it opens at, on the berry ribbon), then her tool, big — locked, a bar of how full
// the herd is ("4/6 hens"); for sale, one sun button with its price, the card glowing; yours, a button that opens its
// panel. Then the farm's own upgrades, as rows (as the shop always had them), and the two premium remotes as two
// tiles of night velvet. A tool and a remote are bought through their card (it asks first); an animal or a farm
// upgrade at once, as before.

export interface ShopActions {
  /** one of the farm's upgrades, or another animal, bought at once (as ever): whether it was */
  buy: (id: UpgradeId) => boolean
  /** a tool's or a remote's card, which asks before it buys */
  ask: (id: LadderId) => void
  /** an owned tool's panel */
  open: (kind: ToolKind) => void
}

/** A price with its thousands marked (10,000). */
const Price = ({ n }: { n: number }) => (
  <span className="farm-coins">
    <img src={art('coin')} alt="" />
    {n.toLocaleString('en-US')}
  </span>
)

export function ShopCard({ v, act, onClose }: { v: UpgradesView; act: ShopActions; onClose: () => void }) {
  const shelf = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()
  const [at, setAt] = useState(0)
  const go = (i: number, smooth = true) => {
    const el = shelf.current
    const card = el?.children[i] as HTMLElement | undefined
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: smooth && !still ? 'smooth' : 'auto' })
  }
  useEffect(() => {
    const el = shelf.current
    if (!el) return
    const seen = () => {
      const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1
      setAt(Math.max(0, Math.min(v.animals.length - 1, Math.round(el.scrollLeft / Math.max(1, w)))))
    }
    // it opens on the first tool for sale (else the first card)
    const first = v.animals.findIndex((a) => a.tool.state === 'sale')
    if (first > 0) go(first, false)
    seen()
    el.addEventListener('scroll', seen, { passive: true })
    return () => el.removeEventListener('scroll', seen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Shell title="Shop" art={art('shopping-bags')} sub={<CoinsTag n={v.coins} />} onClose={onClose}>
      <div className="shop">
        <h3 className="sheet-heading">Animals</h3>
        <div className="shop-shelf" ref={shelf}>
          {v.animals.map((a, i) => (
            <Animal key={a.kind} a={a} i={i} coins={v.coins} act={act} />
          ))}
        </div>
        <div className="shop-dots" role="tablist" aria-label="Animals">
          {v.animals.map((a, i) => (
            <button key={a.kind} role="tab" aria-selected={at === i} aria-label={a.title} className={at === i ? 'on' : ''} onClick={() => go(i)}>
              <img src={art(a.pic)} alt="" />
              {a.tool.state === 'sale' && <i className="shop-dot-ready" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <h3 className="sheet-heading">Farm</h3>
        <div className="farm-shop">{v.farm.map((r) => (r.lock !== null ? <LockedRow key={r.id} r={r} lock={r.lock} /> : <Row key={r.id} r={r} coins={v.coins} act={act} />))}</div>
        <h3 className="sheet-heading">
          <Crown weight="fill" className="crown" />
          Premium
        </h3>
        <div className="shop-tiles">
          {v.remotes.map((t, i) => (
            <Remote key={t.id} t={t} i={i} act={act} />
          ))}
        </div>
      </div>
    </Shell>
  )
}

const CoinsTag = ({ n }: { n: number }) => (
  <span className="tag">
    <img src={art('coin')} alt="" />
    {n.toLocaleString('en-US')}
  </span>
)

/** An animal's card: her herd, then her tool. */
function Animal({ a, i, coins, act }: { a: AnimalCard; i: number; coins: number; act: ShopActions }) {
  const { herd, tool } = a
  const full = herd.n >= herd.most
  const [scope, nope] = useNope<HTMLElement>()
  const [toolEl, flip] = useAnimate<HTMLDivElement>()
  // the tool's part turns over as it changes (locked → for sale → yours)
  const was = useRef(tool.state)
  useEffect(() => {
    if (was.current !== tool.state && toolEl.current) void flip(toolEl.current, FLIP.keyframes, FLIP.options)
    was.current = tool.state
  }, [tool.state, flip, toolEl])
  const more = (el: HTMLElement) => {
    if (coins < herd.price || !act.buy(herd.upgrade)) return void animate(el, NOPE.keyframes, NOPE.options)
    void animate(el, DID.keyframes, DID.options)
  }
  return (
    <m.article ref={scope} className={`shop-animal${tool.state === 'sale' ? ' ready' : ''}`} data-kind={a.kind} aria-label={a.title} variants={DEAL} custom={i} initial="hidden" animate="show">
      <header className="shop-animal-head">
        <img className="art shop-animal-pic" src={art(a.pic)} alt="" />
        <div className="shop-animal-name">
          <b>{a.title}</b>
          <span className="shop-herd" role="img" aria-label={`${herd.n} of ${herd.most}`}>
            {Array.from({ length: herd.most }, (_, j) => (
              <i key={j} className={j < herd.n ? 'on' : ''} />
            ))}
          </span>
        </div>
        {full ? (
          <span className="tag ok">
            <Check weight="bold" />
            Full
          </span>
        ) : herd.lock !== null ? (
          <button className="shop-lock" aria-disabled="true" aria-label={`${herd.name}: ${opensWords(herd.lock)}`} onClick={nope}>
            <LockTag level={herd.lock} />
          </button>
        ) : (
          <button className="btn small shop-more" disabled={coins < herd.price} onClick={(e) => more(e.currentTarget)} aria-label={`Buy ${herd.name}, for ${herd.price} coins`}>
            +1 · <Coins n={herd.price} />
          </button>
        )}
      </header>
      <div ref={toolEl} className={`shop-tool ${tool.state}`}>
        <img className="art shop-tool-pic" src={art(tool.pic)} alt="" />
        <div className="shop-tool-text">
          <b>{tool.name}</b>
          {tool.state === 'locked' ? (
            <span className="shop-bar" role="progressbar" aria-valuemin={0} aria-valuemax={herd.most} aria-valuenow={herd.n} aria-label={tool.why}>
              <m.i initial={false} animate={{ width: `${(herd.n / herd.most) * 100}%` }} />
              <span>
                <LockSimple weight="fill" /> {tool.why}
              </span>
            </span>
          ) : (
            <small>{tool.state === 'owned' ? 'Yours' : tool.says}</small>
          )}
        </div>
      </div>
      {tool.state === 'sale' && (
        <m.button className="btn shop-tool-buy" onClick={() => act.ask(tool.id)} aria-label={`${tool.name}, for ${tool.price} coins`} {...SINK}>
          <img src={art(tool.pic)} alt="" />
          {tool.name} · <Coins n={tool.price} />
        </m.button>
      )}
      {tool.state === 'owned' && (
        <m.button className="btn soft shop-tool-open" onClick={() => act.open(a.kind)} {...SINK}>
          <img src={art(tool.pic)} alt="" />
          Open the {tool.name.toLowerCase()}
          <ArrowRight weight="bold" />
        </m.button>
      )}
      {tool.state === 'locked' && <p className="shop-note">Fill the herd to open its {tool.name.toLowerCase()}.</p>}
    </m.article>
  )
}

const ICON = { users: <Users weight="bold" />, clock: <Clock weight="bold" /> } as const

/** One of the farm's upgrades: its picture, its name, which level the next one is ("Level 2", or Max once there are no
 *  more) and what it changes ("👥 5 → 6"), and its price (bought at once, as ever). */
function Row({ r, coins, act }: { r: FarmRow; coins: number; act: ShopActions }) {
  const repeat = r.levels > 1
  const row = useRef<HTMLDivElement>(null)
  return (
    <div ref={row} className={`farm-shop-item${r.owned ? ' owned' : ''}`}>
      <img className="art" src={art(r.pic)} alt="" />
      <div className="farm-shop-text">
        <strong>{r.name}</strong>
        <div className="farm-shop-tags">
          {repeat && <span className={`tag ${r.owned ? 'ok' : 'level'}`}>{r.owned ? 'Max' : `Level ${r.level + 1}`}</span>}
          {!repeat && r.owned && (
            <span className="tag ok">
              <Check weight="bold" />
              Yours
            </span>
          )}
          <span className="tag effect">
            {r.icon === 'users' || r.icon === 'clock' ? ICON[r.icon] : <img src={art(r.icon)} alt="" />}
            {r.now}
            {r.next && !r.owned && (
              <>
                <ArrowRight weight="bold" className="effect-arrow" />
                <b>{r.next}</b>
              </>
            )}
          </span>
        </div>
        <small className="farm-shop-blurb">{r.blurb}</small>
      </div>
      <button
        className={`btn small${r.owned ? ' soft' : ''}`}
        disabled={r.owned || coins < r.price}
        onClick={() => act.buy(r.id) && row.current && void animate(row.current, DID.keyframes, DID.options)}
        aria-label={r.owned ? `${r.name}: done` : `Buy ${r.name}${repeat ? `, level ${r.level + 1}` : ''}, for ${r.price} coins`}
      >
        {r.owned ? <Check weight="bold" /> : <Coins n={r.price} />}
      </button>
    </div>
  )
}

/** An upgrade not open yet at the farm's level: its picture faded, its name and line, the level it opens at across its
 *  corner where the price was (a tap shakes it). */
function LockedRow({ r, lock }: { r: FarmRow; lock: number }) {
  const [scope, nope] = useNope<HTMLDivElement>()
  return (
    <div ref={scope} className="farm-shop-item locked" onClick={nope}>
      <LockCorner level={lock} right />
      <img className="art" src={art(r.pic)} alt="" />
      <div className="farm-shop-text">
        <strong>{r.name}</strong>
        <small className="farm-shop-blurb">{r.blurb}</small>
      </div>
      <span className="prompt-sr">{`${r.name}: ${opensWords(lock)}`}</span>
    </div>
  )
}

/** A premium remote's tile: night velvet with its stars, the crown on its picture, what it does, its price on a velvet
 *  button (it opens its card); yours, a ✓; the animals' waiting for a tool, its lock. */
function Remote({ t, i, act }: { t: RemoteTile; i: number; act: ShopActions }) {
  return (
    <m.div
      className={`shop-tile velvet stars${t.state === 'owned' ? ' owned' : ''}${t.state === 'locked' ? ' locked' : ''}`}
      data-remote={t.id}
      variants={DEAL}
      custom={i}
      initial="hidden"
      animate="show"
    >
      <span className="shop-tile-pic">
        <img className="art" src={art(t.pic)} alt="" />
        <Crown weight="fill" className="crown shop-tile-crown" />
      </span>
      <b>{t.name}</b>
      <small>{t.blurb}</small>
      {t.state === 'owned' ? (
        <span className="tag ok">
          <Check weight="bold" />
          Yours
        </span>
      ) : t.state === 'locked' ? (
        <span className="tag shop-need">
          <LockSimple weight="fill" />
          Needs a tool
        </span>
      ) : (
        <m.button className="btn small velvet shop-tile-buy" onClick={() => act.ask(t.id)} aria-label={`${t.name}, for ${t.price} coins`} {...SINK}>
          <Crown weight="fill" className="crown" />
          <Price n={t.price} />
          <m.i className="shine" aria-hidden="true" {...SHIMMER(0.4 + i * 0.5)} />
        </m.button>
      )}
    </m.div>
  )
}
