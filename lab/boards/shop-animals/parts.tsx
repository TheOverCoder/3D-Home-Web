import { animate, m, useReducedMotion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { Crown } from '@phosphor-icons/react/dist/csr/Crown'
import { art } from '../../../src/ui/art'
import { ArrowRight, Check, LockSimple } from '../../../src/ui/glyphs'
import { DID, NOPE } from '../../../src/ui/motion'
import { Shell } from '../../../src/ui/Shell'
import type { Act } from '../../board'
import { LadderAsk, Price } from '../animal-tools/parts'
import { crownPic } from '../animal-tools/sample'
import { bought, type Row, type ShopState } from './data'
import './parts.css'

// What the shop's variants share: the game's sheet for the shop (Shell: its picture, "Shop", the purse), a row as the
// shop draws one today (picture, name, its level or lock, now → next, the price on the button), the lock's chip (a
// level, or something to have first: "4/6 hens"), and what a press does — a herd's animal and the farm's rows buy at
// once as today (the row pops), a tool, a step of its ladders or a remote opens the game's ladder card first, a locked
// row shakes and its lock pops (the reason is already in its words). The premium look of the remotes is the
// premium-remotes board's to choose: here a stand-in (a sun rim and the crown).

export function ShopSheet({ coins, children, onClose }: { coins: number; children: ReactNode; onClose: () => void }) {
  return (
    <Shell
      title="Shop"
      art={art('shopping-bags')}
      sub={
        <span className="tag">
          <img src={art('coin')} alt="" />
          {coins.toLocaleString('en-US')}
        </span>
      }
      onClose={onClose}
    >
      <div className="sa-in">{children}</div>
    </Shell>
  )
}

/** The lock, as a chip: the level it opens at (Part B's), or what to have first. */
export function LockChip({ r }: { r: Row }) {
  return (
    <span className={`tag sa-lock ${r.lock ?? 'level'}`}>
      <LockSimple weight="fill" />
      {r.why}
    </span>
  )
}

/** The press of a row, the card it may open, and the row's answer (it pops; a locked one shakes). */
export function useShop(s: ShopState, act: Act<ShopState>) {
  const still = useReducedMotion()
  const [ask, setAsk] = useState<Row | null>(null)
  const [last, setLast] = useState<{ key: string; n: number } | null>(null)
  const n = useRef(0)
  const answer = (el: Element | null, a: typeof DID | typeof NOPE) => {
    if (el && !still) void animate(el, a.keyframes, a.options)
  }
  const press = (r: Row, el: Element | null) => {
    if (r.state === 'locked') {
      answer(el, NOPE)
      answer(el?.querySelector('.sa-lock') ?? null, DID)
      return
    }
    if (r.state === 'owned') return
    if (r.state === 'card') {
      setAsk(r)
      return
    }
    if (s.coins < r.price) {
      answer(el, NOPE)
      return
    }
    act.set(bought(s, r.key, r.price))
    setLast({ key: r.key, n: ++n.current })
    answer(el, DID)
  }
  const card = ask && (
    <LadderAsk
      l={{ name: ask.name, now: ask.now ?? '', next: ask.next, price: ask.price }}
      pic={ask.pic}
      coins={s.coins}
      line={ask.blurb}
      className={ask.premium ? 'sa-premium-card' : undefined}
      badge={ask.premium ? <img className="sa-crown" src={crownPic} alt="" /> : undefined}
      onClose={() => setAsk(null)}
      onBuy={() => {
        act.set(bought(s, ask.key, ask.price))
        setLast({ key: ask.key, n: ++n.current })
        setAsk(null)
      }}
    />
  )
  return { press, card, last }
}

/** A row as the shop draws one today: its picture, name, level or lock, now → next, and its button. */
export function RowView({ r, press, fresh, className = '' }: { r: Row; press: (r: Row, el: Element | null) => void; fresh?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <m.div
      ref={ref}
      layout="position"
      className={`farm-shop-item sa-row${r.state === 'owned' ? ' owned' : ''}${r.state === 'locked' ? ' sa-locked' : ''}${r.premium ? ' sa-premium' : ''}${fresh ? ' sa-fresh' : ''} ${className}`}
      onClick={r.state === 'locked' ? () => press(r, ref.current) : undefined}
    >
      <span className="sa-pic">
        <img className="art" src={r.pic} alt="" />
        {r.premium && <Crown weight="fill" className="sa-crown-glyph" />}
      </span>
      <div className="farm-shop-text">
        <strong>{r.name}</strong>
        <div className="farm-shop-tags">
          {r.state === 'locked' ? (
            <LockChip r={r} />
          ) : r.level ? (
            <span className="tag level">{r.level}</span>
          ) : r.state === 'owned' ? (
            <span className="tag ok">
              <Check weight="bold" />
              {r.steps ? 'Max' : 'Yours'}
            </span>
          ) : null}
          {r.now && (
            <span className="tag effect">
              {r.now}
              {r.next && r.state !== 'owned' && (
                <>
                  <ArrowRight weight="bold" className="effect-arrow" />
                  <b>{r.next}</b>
                </>
              )}
            </span>
          )}
        </div>
      </div>
      <RowButton r={r} press={(el) => press(r, el ?? ref.current)} />
    </m.div>
  )
}

/** The row's button: the price (buys, or opens the card), ✓ when it is yours, the lock while it is locked. */
export function RowButton({ r, press, small = true }: { r: Row; press: (el: Element | null) => void; small?: boolean }) {
  if (r.state === 'owned')
    return (
      <button className={`btn${small ? ' small' : ''} soft sa-btn`} aria-label={`${r.name}: yours`} aria-disabled="true">
        <Check weight="bold" />
      </button>
    )
  if (r.state === 'locked')
    return (
      <button
        className={`btn${small ? ' small' : ''} sa-btn sa-btn-locked`}
        aria-disabled="true"
        aria-label={`${r.name}: ${r.why}`}
        onClick={(e) => (e.stopPropagation(), press(e.currentTarget.closest('.sa-row, .sa-card, .sa-step')))}
      >
        <LockSimple weight="fill" />
      </button>
    )
  return (
    <button
      className={`btn${small ? ' small' : ''} sa-btn${r.premium ? ' sa-btn-premium' : ''}`}
      onClick={(e) => press(e.currentTarget.closest('.sa-row, .sa-card, .sa-step'))}
      aria-label={`${r.state === 'card' ? '' : 'Buy '}${r.name}${r.next ? `, ${r.next}` : ''}, for ${r.price} coins`}
    >
      <Price n={r.price} />
    </button>
  )
}

/** A heading of the shop's list: its picture and a few words. */
export const Heading = ({ pic, children, id }: { pic?: ReactNode; children: ReactNode; id?: string }) => (
  <h3 className="sa-heading" id={id}>
    {pic}
    {children}
  </h3>
)
