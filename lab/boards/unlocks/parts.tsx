import { AnimatePresence, useAnimate } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CROPS, UPGRADES } from '../../../src/farm/data'
import { iconUrl, shopArtUrl, type PictureId } from '../../../src/farm/icons'
import { LevelCard } from '../../../src/farm/LevelCard'
import { levelView } from '../../../src/farm/levelView'
import { garmentAt, type Garment } from '../../../src/farm/outfit'
import { PARCELS, type ParcelId } from '../../../src/farm/layout'
import { xpAt } from '../../../src/farm/xp'
import { art } from '../../../src/ui/art'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { ArrowRight, Clock, LockSimple, X } from '../../../src/ui/glyphs'
import { DID, NOPE } from '../../../src/ui/motion'
import { Coins, Shell } from '../../../src/ui/Shell'
import '../../../src/ui/ThingTag.css'
import { TopC } from '../top/TopC'
import { DECOR_ROWS, lockFor, openFirst, topAt, UPGRADE_ART, type Face, type UnlocksState } from './data'
import editUp from '../../map/edit-upright.jpg'
import editSide from '../../map/edit-sideways.jpg'
import './parts.css'

// What every variant of the "unlocks" board shares: the dashboard behind (the top board's D, as the game has it),
// the top column where the level's show stands, the level's show itself (the game's markup, src/farm/XpChip.tsx) and
// the garment's card, and the panels where a thing can be locked — the seed packets, the farm shop, the decoration,
// a price tag on a staked field and its card, the oven's prompt, the meadows' labels from above, the level card —
// drawn with the game's own classes, each locked thing in the face its variant gives (`face`). A tap on a locked thing
// shakes it and pops its lock (the reason is already in its words); a tap on an open one closes the panel, as buying
// or planting would.

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const seconds = (s: number) => (s < 60 ? `${s} s` : `${Math.round((s / 60) * 10) / 10} min`)
export const opensWords = (level: number) => `opens at level ${level}`

/** The screen's size, kept as it turns. */
export function useRoom() {
  const [room, setRoom] = useState({ w: innerWidth, h: innerHeight })
  useEffect(() => {
    const fit = () => setRoom({ w: innerWidth, h: innerHeight })
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [])
  return { ...room, wide: room.w > room.h }
}

/** A point of a picture that covers the screen as the lab's still does (from its top; sideways, from its left), on
 *  the screen: the picture's size in CSS px is the phone's it was taken on. */
function onScreen(room: { w: number; h: number; wide: boolean }, p: { x: number; y: number }) {
  const W = room.wide ? 844 : 390
  const k = scaleOf(room)
  const ox = room.wide ? 0 : (room.w - W * k) / 2
  return { left: ox + p.x * k, top: p.y * k }
}

/** How much bigger than the phone it was taken on such a picture is drawn (a computer's screen: about twice). */
const scaleOf = (room: { w: number; h: number; wide: boolean }) => Math.max(room.w / (room.wide ? 844 : 390), room.h / (room.wide ? 390 : 844))

// ── what stands behind and above ──

/** The dashboard of the game's top (lab/boards/top, D) for the farm's level and coins, standing still: it is the
 *  scene's, not the design's (it does not play its opening each time). */
export function Backdrop({ level, coins }: { level: number; coins: number }) {
  const [top, setTop] = useState(() => topAt(level, coins))
  return (
    <AnimatePresence initial={false}>
      <TopC s={top} set={setTop} bare />
    </AnimatePresence>
  )
}

/** The top column under the dashboard (src/ui/TopStack.tsx): the level's show and what follows it stand here. */
export const Column = ({ children }: { children: ReactNode }) => <div className="v-unlocks-col">{children}</div>

/** The level's show as the game draws it (src/farm/XpChip.tsx LevelUp): a flash, a ring and the number. `hold`: it
 *  does not go out by itself after two seconds (B keeps it while its ribbon is there). */
export function LevelShow({ level, hold }: { level: number; hold?: boolean }) {
  return (
    <div className="level-up">
      <div className={`level-up-show${hold ? ' v-unlocks-hold' : ''}`}>
        <span className="level-up-flash" aria-hidden="true" />
        <span className="level-up-ring" aria-hidden="true" />
        <span className="level-up-ring late" aria-hidden="true" />
        <span className="level-up-word">Level</span>
        <b className="level-up-number">{level}</b>
      </div>
    </div>
  )
}

/** The garment a level brought, as the game shows it after the level's show (src/farm/XpChip.tsx): the card "Unlocked!"
 *  grows out of. */
export function GarmentShow({ g }: { g: Garment }) {
  return (
    <div className="level-up">
      <div className="garment-show">
        <span className="garment-show-rays" aria-hidden="true" />
        <GarmentPic g={g} />
        <span className="garment-show-text">
          <span className="garment-show-word">New garment!</span>
          <b>{g.name}</b>
          <small>In the wardrobe</small>
        </span>
      </div>
    </div>
  )
}

/** The game's timings: the level's show, then a garment's (src/farm/XpChip.tsx LEVEL_MS, GIFT_MS). */
export const LEVEL_MS = 2400
export const GIFT_MS = 3400

/** A show in steps, each for its time, over and over (the lab plays it again after a short rest, as a level reached
 *  again would). `round` changes each time it starts again. */
export function useShow(steps: { id: string; ms: number }[]) {
  const [at, setAt] = useState({ k: 0, round: 0 })
  const plan = useRef(steps)
  useEffect(() => {
    plan.current = steps
  })
  useEffect(() => {
    const now = plan.current[at.k]
    const t = window.setTimeout(() => setAt((p) => (p.k + 1 < plan.current.length ? { k: p.k + 1, round: p.round } : { k: 0, round: p.round + 1 })), now.ms)
    return () => window.clearTimeout(t)
  }, [at])
  return { step: steps[Math.min(at.k, steps.length - 1)].id, round: at.round }
}

/** The steps of a level's show: the level, its garment (every fifth level), what it opened, a rest. */
export function showSteps(level: number, opened: { id: string; ms: number }[], levelMs = LEVEL_MS) {
  const g = garmentAt(level)
  return { garment: g, steps: [{ id: 'level', ms: levelMs }, ...(g ? [{ id: 'garment', ms: GIFT_MS }] : []), ...opened, { id: 'rest', ms: 1300 }] }
}

// ── the locked face ──

/** The lock as each variant draws it: a chip with the lock and the level where the price was (A), a violet badge with
 *  the lock and the number on the picture's corner (B), the level card's berry banner (C). */
export function LockMark({ face, level }: { face: Face; level: number }) {
  if (face === 'chip')
    return (
      <span className="tag ul-chip">
        <LockSimple weight="fill" />
        Level {level}
      </span>
    )
  if (face === 'badge')
    return (
      <span className="ul-badge" aria-hidden="true">
        <LockSimple weight="fill" />
        <b>{level}</b>
      </span>
    )
  if (face === 'banner') return <span className="ul-banner">Level {level}</span>
  return null
}

/** A picture, with B's badge on its corner while it is locked. */
export function Pic({ src, face, lock }: { src: string; face: Face; lock: number | null }) {
  return (
    <span className="ul-pic">
      <img className="art" src={src} alt="" draggable={false} />
      {lock !== null && face === 'badge' && <LockMark face="badge" level={lock} />}
    </span>
  )
}

/** C's banner across a card's top corner. */
const Corner = ({ level }: { level: number }) => (
  <span className="ul-corner" aria-hidden="true">
    <LockMark face="banner" level={level} />
  </span>
)

/** A locked thing's answer to a tap: a short shake, and its lock pops (the words already say why). */
function useNope<T extends HTMLElement>() {
  const [scope, animate] = useAnimate<T>()
  const nope = () => {
    if (!scope.current) return
    void animate(scope.current as Element, NOPE.keyframes, NOPE.options)
    const mark = scope.current.querySelector('.ul-chip, .ul-badge, .ul-banner, .ul-lock-btn')
    if (mark) void animate(mark, DID.keyframes, DID.options)
  }
  return [scope, nope] as const
}

/** A card of a grid (a seed packet, a piece of decoration): open, a tap does its job (the panel closes); locked, it
 *  answers with a shake. */
function Card({ face, lock, label, className, onOpen, children }: { face: Face; lock: number | null; label: string; className: string; onOpen: () => void; children: ReactNode }) {
  const [scope, nope] = useNope<HTMLButtonElement>()
  return (
    <button
      ref={scope}
      className={`${className}${lock !== null ? ' ul-locked' : ''}`}
      aria-disabled={lock !== null ? true : undefined}
      aria-label={lock !== null ? `${label}: ${opensWords(lock)}` : undefined}
      onClick={() => (lock !== null ? nope() : onOpen())}
    >
      {lock !== null && face === 'banner' && <Corner level={lock} />}
      {children}
    </button>
  )
}

/** Where a price was: the price (open), the chip (A), the price greyed (B, its badge is on the picture), nothing (C). */
function PriceSpot({ face, lock, price }: { face: Face; lock: number | null; price: number }) {
  if (lock === null)
    return (
      <span className="tag">
        <img src={art('coin')} alt="" />
        {price}
      </span>
    )
  if (face === 'chip') return <LockMark face="chip" level={lock} />
  if (face === 'badge')
    return (
      <span className="tag ul-price-off">
        <img src={art('coin')} alt="" />
        {price}
      </span>
    )
  return null
}

const Purse = ({ n }: { n: number }) => (
  <span className="tag">
    <img src={art('coin')} alt="" />
    {n}
  </span>
)

// ── the panels ──

/** The seed packets (src/farm/FarmUI.tsx SeedsPanel) at the farm's level. */
export function SeedsSheet({ s, face, onDone }: { s: UnlocksState; face: Face; onDone: () => void }) {
  const rows = openFirst(face, CROPS, (c) => `crop:${c.id}`, s.level)
  return (
    <Shell title="Plant seeds" art={art('seedling')} sub={<Purse n={s.coins} />} onClose={onDone}>
      <div className="farm-grid">
        {rows.map((c) => {
          const lock = lockFor(face, `crop:${c.id}`, s.level)
          return (
            <Card key={c.id} face={face} lock={lock} label={cap(c.plural)} className="farm-card" onOpen={onDone}>
              <span className="tag farm-stock none" aria-label="0 in the silo">
                <img src={iconUrl('silo')} alt="" />0
              </span>
              <Pic src={iconUrl(c.id)} face={face} lock={lock} />
              <span className="farm-card-name">{cap(c.plural)}</span>
              <span className="farm-card-tags">
                <span className="tag">
                  <Clock weight="bold" />
                  {seconds(c.growSeconds)}
                </span>
                <PriceSpot face={face} lock={lock} price={c.seedCost} />
              </span>
            </Card>
          )
        })}
      </div>
    </Shell>
  )
}

/** One upgrade of the farm shop: its picture, name and line, its price on the button — or, locked, its face. */
function ShopRow({ u, face, lock, coins, onDone }: { u: (typeof UPGRADES)[number]; face: Face; lock: number | null; coins: number; onDone: () => void }) {
  const [scope, nope] = useNope<HTMLDivElement>()
  return (
    <div ref={scope} className={`farm-shop-item ul-row${lock !== null ? ' ul-locked' : ''}`} onClick={lock !== null ? nope : undefined}>
      {lock !== null && face === 'banner' && <Corner level={lock} />}
      <Pic src={art(UPGRADE_ART[u.id])} face={face} lock={lock} />
      <div className="farm-shop-text">
        <strong>{u.name}</strong>
        <small className="farm-shop-blurb">{u.blurb}</small>
      </div>
      {lock === null ? (
        <button className="btn small" disabled={coins < u.price} onClick={onDone} aria-label={`Buy ${u.name}, for ${u.price} coins`}>
          <Coins n={u.price} />
        </button>
      ) : face === 'chip' ? (
        <button className="btn small ul-lock-btn" aria-disabled="true" aria-label={`${u.name}: ${opensWords(lock)}`}>
          <LockSimple weight="fill" />
          Level {lock}
        </button>
      ) : face === 'badge' ? (
        <button className="btn small ul-btn-off" aria-disabled="true" aria-label={`${u.name}, ${u.price} coins: ${opensWords(lock)}`}>
          <Coins n={u.price} />
        </button>
      ) : (
        <span className="prompt-sr">{`${u.name}: ${opensWords(lock)}`}</span>
      )}
    </div>
  )
}

/** The farm shop (src/farm/FarmUI.tsx ShopPanel) at the farm's level: what is open first, then what is locked. */
export function ShopSheet({ s, face, onDone }: { s: UnlocksState; face: Face; onDone: () => void }) {
  const rows = openFirst(face, UPGRADES, (u) => `upgrade:${u.id}`, s.level)
  return (
    <Shell title="Shop" art={art('shopping-bags')} sub={<Purse n={s.coins} />} onClose={onDone}>
      <div className="farm-shop">
        {rows.map((u) => (
          <ShopRow key={u.id} u={u} face={face} lock={lockFor(face, `upgrade:${u.id}`, s.level)} coins={s.coins} onDone={onDone} />
        ))}
      </div>
    </Shell>
  )
}

/** The edit mode's shop, its decoration tab (src/farm/DecorShop.tsx) at the farm's level. */
export function DecorSheet({ s, face, onDone }: { s: UnlocksState; face: Face; onDone: () => void }) {
  const rows = openFirst(face, DECOR_ROWS, (d) => `decor:${d.id}`, s.level)
  return (
    <Shell title="Decoration" art={art('shopping-bags')} sub={<Purse n={s.coins} />} onClose={onDone}>
      <div className="edit-actions deco-tabs decor-tabs" role="tablist" aria-label="The farm shop">
        <button role="tab" aria-selected="true" className="btn small leaf">
          Decoration
        </button>
        <button role="tab" aria-selected="false" className="btn small soft">
          Fruit trees & bushes
        </button>
      </div>
      <div className="farm-grid compact decor-grid ul-decor" role="tabpanel">
        {rows.map((d) => {
          const lock = lockFor(face, `decor:${d.id}`, s.level)
          return (
            <Card key={d.id} face={face} lock={lock} label={d.name} className="farm-card decor-card" onOpen={onDone}>
              <Pic src={shopArtUrl(d.id)} face={face} lock={lock} />
              <span className="farm-card-name">{d.name}</span>
              <span className="farm-card-tags">
                <PriceSpot face={face} lock={lock} price={d.price} />
              </span>
            </Card>
          )
        })}
      </div>
    </Shell>
  )
}

// ── on the farm itself: a price tag, its card, the action button's prompt ──

/** Where the still's two staked plots are (the signs of the yard still, in its own CSS px). */
const PLOTS = {
  upright: { bed: { x: 182, y: 398 }, field: { x: 322, y: 420 } },
  sideways: { bed: { x: 432, y: 168 }, field: { x: 572, y: 182 } },
}
const EAST = UPGRADES.find((u) => u.id === 'east')!

/** A price tag on a thing for sale (src/ui/ThingTag.tsx), or its locked face. */
function PriceTag({ face, lock, price, at, label, onOpen }: { face: Face; lock: number | null; price: number; at: { left: number; top: number }; label: string; onOpen: () => void }) {
  const [scope, nope] = useNope<HTMLButtonElement>()
  const style = { left: at.left, top: at.top }
  if (lock === null || face === 'none')
    return (
      <button className="thing-tag thing-price ul-tag" style={style} onClick={onOpen} aria-label={label}>
        <img src={art('coin')} alt="" draggable={false} />
        <b>{price}</b>
      </button>
    )
  const open = () => {
    nope()
    window.setTimeout(onOpen, 380)
  }
  return (
    <button ref={scope} className={`thing-tag ul-tag ul-tag-${face}`} style={style} onClick={open} aria-label={`${label}: ${opensWords(lock)}`}>
      {face === 'chip' && (
        <>
          <LockSimple weight="fill" className="ul-tag-lock" />
          <b>Level {lock}</b>
        </>
      )}
      {face === 'badge' && (
        <>
          <img src={art('coin')} alt="" draggable={false} />
          <b>{price}</b>
          <LockMark face="badge" level={lock} />
        </>
      )}
      {face === 'banner' && <LockMark face="banner" level={lock} />}
    </button>
  )
}

/** What a price tag opens: a staked bed, or a field of beds (src/farm/FarmUI.tsx BuildPanel). */
interface Build {
  title: string
  pic: string
  blurb: string
  price: number
  lock: number | null
}

/** A card that asks before anything is spent (src/farm/FarmUI.tsx BuildPanel), the game's panel's markup with a
 *  picture B can badge: Not now, and Build with its price — or, locked, its face. */
function BuildCard({ b, face, coins, onClose }: { b: Build; face: Face; coins: number; onClose: () => void }) {
  const [scope, nope] = useNope<HTMLDivElement>()
  const lock = face === 'none' ? null : b.lock
  return (
    <div className="farm-backdrop" onClick={onClose}>
      <div className="farm-panel" role="dialog" aria-modal="true" aria-label={b.title} onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="ul-pic ul-head">
            <img className="art farm-head-art" src={b.pic} alt="" />
            {lock !== null && face === 'badge' && <LockMark face="badge" level={lock} />}
          </span>
          <div className="farm-head-text">
            <h2>{b.title}</h2>
            <div className="farm-sub">
              <Purse n={coins} />
            </div>
          </div>
          <button className="close" onClick={onClose} aria-label="Close (Esc)">
            <X weight="bold" />
          </button>
        </header>
        <p className="farm-line">{b.blurb}</p>
        <div className="farm-confirm" ref={scope}>
          <button className="btn soft" onClick={onClose}>
            Not now
          </button>
          {lock === null ? (
            <button className="btn farm-buy" disabled={coins < b.price} onClick={onClose}>
              Build · <Coins n={b.price} />
            </button>
          ) : face === 'chip' ? (
            <button className="btn farm-buy ul-lock-btn" aria-disabled="true" onClick={nope} aria-label={`Build: ${opensWords(lock)}`}>
              <LockSimple weight="fill" />
              Level {lock}
            </button>
          ) : face === 'badge' ? (
            <button className="btn farm-buy ul-btn-off" aria-disabled="true" onClick={nope} aria-label={`Build, ${b.price} coins: ${opensWords(lock)}`}>
              Build · <Coins n={b.price} />
            </button>
          ) : (
            <span className="ul-banner ul-banner-big" role="note">
              Opens at level {lock}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** The oven's prompt over the action button while it is locked ("Oven · opens at level 5"): its cake's picture and the
 *  lock; today's, what it makes from what. */
function OvenPrompt({ face, lock }: { face: Face; lock: number }) {
  const pic = (id: PictureId, withBadge = false) => (
    <span className="prompt-pic ul-pic">
      <img src={iconUrl(id)} alt="" draggable={false} />
      {withBadge && <LockMark face="badge" level={lock} />}
    </span>
  )
  return (
    <div className="hud-prompt">
      <div className="prompt status" data-verb="wait">
        {face === 'none' ? (
          <span className="prompt-goods" aria-hidden="true">
            <span className="prompt-make">
              {pic('carrot')}
              <ArrowRight weight="bold" className="prompt-arrow" />
              {pic('carrot_cake')}
            </span>
            <span className="prompt-make">
              {pic('lemon')}
              <ArrowRight weight="bold" className="prompt-arrow" />
              {pic('lemon_cake')}
            </span>
          </span>
        ) : (
          <span className="prompt-goods" aria-hidden="true">
            {pic('carrot_cake', face === 'badge')}
            {face !== 'badge' && <LockMark face={face} level={lock} />}
          </span>
        )}
        <span className="prompt-sr">{face === 'none' ? 'Oven: cakes from carrots and lemons' : `Oven · ${opensWords(lock)}`}</span>
      </div>
    </div>
  )
}

/** In the yard at level 1: a staked bed's price tag (open), the East field's (locked till 5), the card a tag opens,
 *  and the oven's prompt at the action button (locked till 5). */
export function WorldView({ s, face }: { s: UnlocksState; face: Face }) {
  const room = useRoom()
  const spots = room.wide ? PLOTS.sideways : PLOTS.upright
  const [card, setCard] = useState<Build | null>(null)
  const bed: Build = { title: 'A new bed', pic: art('hammer'), blurb: 'One more raised bed to plant in.', price: 30, lock: lockFor(face, 'bed', s.level) }
  const field: Build = { title: EAST.name, pic: iconUrl('wheat'), blurb: EAST.blurb, price: EAST.price, lock: lockFor(face, 'upgrade:east', s.level) }
  return (
    <div className="v-unlocks-world">
      <PriceTag face={face} lock={bed.lock} price={bed.price} at={onScreen(room, spots.bed)} label={`${bed.title}: ${bed.price} coins`} onOpen={() => setCard(bed)} />
      <PriceTag face={face} lock={field.lock} price={field.price} at={onScreen(room, spots.field)} label={`${field.title}: ${field.price} coins`} onOpen={() => setCard(field)} />
      <OvenPrompt face={face} lock={lockFor('chip', 'recipe:oven:carrot_cake', s.level) ?? 5} />
      {card && <BuildCard b={card} face={face} coins={s.coins} onClose={() => setCard(null)} />}
    </div>
  )
}

// ── from above: the meadows beyond the hedge (the edit mode) ──

/** The meadows' labels in the edit mode's pictures (lab/map/edit-*.jpg, a farm at level 5), where each one is (upright,
 *  the west and east meadows' are off the screen but for a letter or two: left as the picture has them). `edge`: mostly
 *  off the screen, a cover over the picture's own label, not a target. */
const MEADOWS: Record<'upright' | 'sideways', { id: ParcelId; x: number; y: number; edge?: true }[]> = {
  upright: [
    { id: 'north', x: 195, y: 224 },
    { id: 'northWest', x: 4, y: 224, edge: true },
    { id: 'northEast', x: 386, y: 224, edge: true },
  ],
  sideways: [
    { id: 'west', x: 185, y: 182 },
    { id: 'east', x: 660, y: 182 },
    { id: 'north', x: 422, y: -9, edge: true },
    { id: 'northWest', x: 215, y: -9, edge: true },
    { id: 'northEast', x: 628, y: -9, edge: true },
  ],
}

function Meadow({ id, face, level, at, edge }: { id: ParcelId; face: Face; level: number; at: { left: number; top: number; scale: string }; edge?: boolean }) {
  const [scope, nope] = useNope<HTMLButtonElement>()
  const p = PARCELS[id]
  const lock = lockFor(face, `parcel:${id}`, level)
  if (lock === null) return null
  const Tag = edge ? 'span' : 'button'
  return (
    <Tag
      ref={edge ? undefined : scope}
      className={`edit-sale locked ul-meadow ul-meadow-${face}${edge ? ' edge' : ''}`}
      style={at}
      onClick={edge ? undefined : nope}
      aria-hidden={edge ? true : undefined}
      aria-label={edge ? undefined : `${p.name}: ${opensWords(lock)}`}
    >
      <strong>{p.name}</strong>
      {face === 'chip' && (
        <span className="ul-meadow-lock">
          <LockSimple weight="fill" />
          Level {lock}
        </span>
      )}
      {face === 'badge' && (
        <>
          <span>{p.price} coins</span>
          <LockMark face="badge" level={lock} />
        </>
      )}
      {face === 'banner' && <LockMark face="banner" level={lock} />}
    </Tag>
  )
}

/** The edit mode from above (a picture of the game's: lab/map/edit-*.jpg, its farm at level 5), the meadows' labels
 *  drawn over its own in the variant's face; today, the picture as it is ("150 coins", or "not yet"). */
export function EditView({ s, face }: { s: UnlocksState; face: Face }) {
  const room = useRoom()
  return (
    <div className="v-unlocks-edit">
      <img className="v-unlocks-shot" src={room.wide ? editSide : editUp} alt="The edit mode from above, in the game today (a picture)" />
      {face !== 'none' &&
        MEADOWS[room.wide ? 'sideways' : 'upright'].map((mw) => (
          <Meadow key={mw.id} id={mw.id} face={face} level={s.level} edge={mw.edge} at={{ ...onScreen(room, mw), scale: String(scaleOf(room)) }} />
        ))}
    </div>
  )
}

// ── the level's card ──

/** Children put into an element of what another component drew (the level card's "At level N"), once it is there. */
function Into({ selector, children }: { selector: string; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    let tries = 0
    let raf = 0
    let made: HTMLElement | null = null
    const find = () => {
      const el = document.querySelector<HTMLElement>(selector)
      if (el) {
        made = document.createElement('div')
        made.className = 'v-unlocks-into'
        el.append(made)
        setHost(made)
      } else if (tries++ < 90) raf = requestAnimationFrame(find)
    }
    find()
    return () => {
      cancelAnimationFrame(raf)
      made?.remove()
    }
  }, [selector])
  return host ? createPortal(children, host) : null
}

/** The level card (src/farm/LevelCard.tsx, the game's own) at the farm's level, with what the next level opens put
 *  under "At level N" in the variant's way (`row`; today: nothing). */
export function CardView({ s, row, onDone }: { s: UnlocksState; row?: ReactNode; onDone: () => void }) {
  const points = xpAt(s.level) + Math.round((xpAt(s.level + 1) - xpAt(s.level)) * 0.42)
  return (
    <>
      <LevelCard v={levelView(points, s.level)} onOpen={() => []} onClose={onDone} />
      {row && <Into selector=".level-card .lf-next">{row}</Into>}
    </>
  )
}

/** Every scene of the board, the reveal and the card's row given by the variant. */
export function Scenes({ s, face, reveal, row, onDone }: { s: UnlocksState; face: Face; reveal: ReactNode; row?: ReactNode; onDone: () => void }) {
  const behind = s.scene !== 'edit'
  return (
    <div className="v-unlocks">
      {behind && <Backdrop level={s.level} coins={s.coins} />}
      {s.scene === 'reveal' && reveal}
      {s.scene === 'seeds' && <SeedsSheet s={s} face={face} onDone={onDone} />}
      {s.scene === 'shop' && <ShopSheet s={s} face={face} onDone={onDone} />}
      {s.scene === 'decor' && <DecorSheet s={s} face={face} onDone={onDone} />}
      {s.scene === 'world' && <WorldView s={s} face={face} />}
      {s.scene === 'edit' && <EditView s={s} face={face} />}
      {s.scene === 'card' && <CardView s={s} row={row} onDone={onDone} />}
    </div>
  )
}
