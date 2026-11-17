import { m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Crown } from '@phosphor-icons/react/dist/csr/Crown'
import { art } from '../../../src/ui/art'
import { Check, LockSimple } from '../../../src/ui/glyphs'
import { SPRING } from '../../../src/ui/motion'
import { Coins } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { Behind } from '../animal-tools/parts'
import { crownPic } from '../animal-tools/sample'
import { ANIMAL_ART, KIND_NAME, TOOL_KINDS, farmRows, herdRow, ladderRows, ownedLast, remoteRows, toolRow, type Row, type ShopState, type ToolKind } from './data'
import { Heading, LockChip, RowButton, RowView, ShopSheet, useShop } from './parts'
import './ShopAnimalsC.css'

// C · a card per animal: the animals are a shelf of three big cards that swipe sideways (the next one peeks; dots
// under say which), each the whole story of a kind — the animal and her herd as dots with "another" and its price,
// then her tool big: locked, a bar of how full the herd is ("4/6 hens"); for sale, one sun button with its price;
// yours, its two ladders as meters (a segment a step) with the next step's price. Under the shelf, the farm's rows,
// then the two remotes as two tiles side by side. Every rule under .v-shop-animals-c.

export function ShopAnimalsC({ s, act }: { s: ShopState; act: Act<ShopState> }) {
  const shop = useShop(s, act)
  const shelf = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()
  const [at, setAt] = useState(0)
  useEffect(() => {
    const el = shelf.current
    if (!el) return
    const seen = () => setAt(Math.round(el.scrollLeft / Math.max(1, (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1)))
    el.addEventListener('scroll', seen, { passive: true })
    return () => el.removeEventListener('scroll', seen)
  }, [])
  const go = (i: number) => {
    const el = shelf.current
    const card = el?.children[i] as HTMLElement | undefined
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 2, behavior: still ? 'auto' : 'smooth' })
  }
  return (
    <>
      <Behind coins={s.coins} level={s.level} />
      <ShopSheet coins={s.coins} onClose={act.close}>
        <div className="v-shop-animals-c">
          <Heading>Animals</Heading>
          <div className="sac-shelf" ref={shelf}>
            {TOOL_KINDS.map((k, i) => (
              <Card key={k} k={k} i={i} s={s} press={shop.press} last={shop.last?.key} />
            ))}
          </div>
          <div className="sac-dots" role="tablist" aria-label="Animals">
            {TOOL_KINDS.map((k, i) => (
              <button key={k} role="tab" aria-selected={at === i} aria-label={KIND_NAME[k]} className={at === i ? 'on' : ''} onClick={() => go(i)}>
                <img src={art(ANIMAL_ART[k])} alt="" />
              </button>
            ))}
          </div>
          <Heading>Farm</Heading>
          <div className="farm-shop">
            {ownedLast(farmRows(s)).map((r) => (
              <RowView key={r.key} r={r} press={shop.press} fresh={shop.last?.key === r.key} />
            ))}
          </div>
          <Heading pic={<Crown weight="fill" className="sac-crown" />}>Premium</Heading>
          <div className="sac-tiles">
            {remoteRows(s).map((r) => (
              <Tile key={r.key} r={r} press={shop.press} />
            ))}
          </div>
        </div>
      </ShopSheet>
      {shop.card}
    </>
  )
}

function Card({ k, i, s, press, last }: { k: ToolKind; i: number; s: ShopState; press: (r: Row, el: Element | null) => void; last?: string }) {
  const herd = herdRow(s, k)
  const tool = toolRow(s, k)
  const [n, most] = herd.steps!
  const ref = useRef<HTMLElement>(null)
  return (
    <m.article
      ref={ref}
      className={`sac-card sa-card${tool.state === 'card' ? ' ready' : ''}`}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0, transition: { ...SPRING.pop, delay: 0.06 * i } }}
      aria-label={KIND_NAME[k]}
    >
      <header className="sac-head">
        <img className="sac-animal" src={art(ANIMAL_ART[k])} alt="" />
        <div className="sac-head-text">
          <b>{KIND_NAME[k]}</b>
          <span className="sac-herd" aria-label={`${n} of ${most}`}>
            {Array.from({ length: most }, (_, j) => (
              <i key={j} className={j < n ? 'on' : ''} />
            ))}
          </span>
        </div>
        {herd.state === 'owned' ? (
          <span className="tag ok">
            <Check weight="bold" />
            Full
          </span>
        ) : herd.state === 'locked' ? (
          <LockChip r={herd} />
        ) : (
          <button className={`btn small sac-more${last === herd.key ? ' sa-fresh' : ''}`} onClick={(e) => press(herd, e.currentTarget)} aria-label={`${herd.name}, for ${herd.price} coins`}>
            +1 · <Coins n={herd.price} />
          </button>
        )}
      </header>
      <div className={`sac-tool ${tool.state}`}>
        <img className="sac-tool-pic" src={tool.pic} alt="" />
        <div className="sac-tool-text">
          <b>{tool.name}</b>
          {tool.state === 'locked' ? (
            <span className="sac-bar" role="progressbar" aria-valuemin={0} aria-valuemax={most} aria-valuenow={n} aria-label={tool.why}>
              <m.i initial={false} animate={{ width: `${(n / most) * 100}%` }} transition={SPRING.soft} />
              <span>
                <LockSimple weight="fill" /> {tool.why}
              </span>
            </span>
          ) : (
            <small>{tool.state === 'owned' ? 'Yours' : tool.now}</small>
          )}
        </div>
      </div>
      {tool.state === 'card' && (
        <button className="btn sac-buy" onClick={(e) => press(tool, e.currentTarget)} aria-label={`${tool.name}, for ${tool.price} coins`}>
          <img src={tool.pic} alt="" />
          {tool.name} · <Coins n={tool.price} />
        </button>
      )}
      {tool.state === 'owned' && (
        <div className="sac-meters">
          {ladderRows(s, k).map((r) => (
            <Meter key={r.key} r={r} press={press} fresh={last === r.key} />
          ))}
        </div>
      )}
      {tool.state === 'locked' && <p className="sac-note">Fill the herd to open its {tool.name.toLowerCase()}.</p>}
    </m.article>
  )
}

/** A ladder as a meter: its words now, a segment a step, the next step's price (✓ at the top). */
function Meter({ r, press, fresh }: { r: Row; press: (r: Row, el: Element | null) => void; fresh: boolean }) {
  const [k, of] = r.steps!
  return (
    <div className={`sac-meter sa-step${fresh ? ' sa-fresh' : ''}`}>
      <span className="sac-meter-words">
        <b>{r.now}</b>
        {r.next && <small> → {r.next}</small>}
      </span>
      <span className="sac-meter-bar" aria-hidden="true">
        {Array.from({ length: of }, (_, j) => (
          <i key={j} className={j < k ? 'on' : ''} />
        ))}
      </span>
      <RowButton r={r} press={(el) => press(r, el)} />
    </div>
  )
}

/** A remote as a tile: the crown on its picture, its name, what it does, its price. */
function Tile({ r, press }: { r: Row; press: (r: Row, el: Element | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={`sac-tile sa-premium sa-card${r.state === 'owned' ? ' owned' : ''}${r.state === 'locked' ? ' sa-locked' : ''}`}
      onClick={r.state === 'locked' ? () => press(r, ref.current) : undefined}
    >
      <span className="sac-tile-pic">
        <img className="art" src={r.pic} alt="" />
        <img className="sac-tile-crown" src={crownPic} alt="" />
      </span>
      <b>{r.name}</b>
      <small>{r.now}</small>
      {r.state === 'locked' ? <LockChip r={r} /> : <RowButton r={r} press={(el) => press(r, el ?? ref.current)} />}
    </div>
  )
}
