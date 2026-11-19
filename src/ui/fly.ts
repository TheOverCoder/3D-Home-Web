import { lessMotion } from './still'

// Goods flying on the page (the Web Animations API, over everything; the base's flying-goods helper): a machine's done
// job from its place in the queue into the Collect button and up into the barn's chip at the top of the screen, an
// egg from its nest into the barn's chip on the tool's panel. Each on an arc of its own, one a moment after another;
// nothing for whoever prefers less motion (the counts change all the same). And goods popping up where they came from
// in the world — a harvest, eggs, a surprise — that hold a moment and arc into their store's chip (`popInto`): the
// store's gauge holds them back until each lands (`holdGoods`), so it steps up as they arrive.

const still = lessMotion

/** Where goods are kept: the silo (what grows) or the barn (the rest). */
export type Store = 'silo' | 'barn'

/** The longest a hold keeps goods back from a gauge (ms): a flight that never lands (the page hidden, a picture
 *  cancelled without telling) still lets them go. */
export const HOLD_MOST_MS = 2000

// Goods the farm has that the interface still shows on their way to their store (a harvest's picture in the air): the
// store's gauge at the top (src/farm/TopDash.tsx) leaves them out until they land.
const held: Record<Store, number> = { silo: 0, barn: 0 }
/** bumped as everything is let go at once: a hold from before lets nothing go again */
let era = 0
const holders = new Set<() => void>()
const told = () => holders.forEach((f) => f())

/** The goods held back from a store's gauge now. */
export const goodsHeld = (store: Store) => held[store]
/** Called whenever the goods held back change; the returned function stops it. */
export function onGoodsHeld(f: () => void) {
  holders.add(f)
  return () => void holders.delete(f)
}

/** Holds `n` goods back from a store's gauge; the function returned lets them go (once: as they land, or the flight is
 *  cancelled), and they go by themselves after `most` ms at the latest. Never below none. */
export function holdGoods(store: Store, n: number, most = HOLD_MOST_MS): () => void {
  if (!(n > 0)) return () => {}
  held[store] += n
  told()
  const from = era
  let gone = false
  const go = () => {
    if (gone) return
    gone = true
    clearTimeout(timer)
    if (from !== era) return
    held[store] = Math.max(0, held[store] - n)
    told()
  }
  const timer = setTimeout(go, most)
  return go
}

/** Every hold let go at once (another farm, a test): the gauges show what the farm has. */
export function letGoodsGo() {
  era++
  held.silo = held.barn = 0
  told()
}

export interface Flight {
  src: string
  from: DOMRect
}

/** Flies each picture from its place to the middle of `to` (an arc that rises first); `landed(i)` as each arrives.
 *  Resolves when the last has landed (at once, with nothing to fly or motion reduced). */
export function flyInto(flights: Flight[], to: DOMRect, o: { size?: number; stagger?: number; duration?: number; landed?: (i: number) => void } = {}): Promise<void> {
  if (!flights.length || still() || typeof document.body.animate !== 'function') {
    flights.forEach((_, i) => o.landed?.(i))
    return Promise.resolve()
  }
  const size = o.size ?? 44
  const stagger = o.stagger ?? 70
  const duration = o.duration ?? 440
  const tx = to.left + to.width / 2
  const ty = to.top + to.height / 2
  return Promise.all(
    flights.map(
      (f, i) =>
        new Promise<void>((done) => {
          const img = document.createElement('img')
          img.src = f.src
          img.alt = ''
          img.className = 'goods-fly'
          img.setAttribute('aria-hidden', 'true')
          img.draggable = false
          const x = f.from.left + f.from.width / 2
          const y = f.from.top + f.from.height / 2
          img.style.width = img.style.height = `${size}px`
          img.style.left = `${x - size / 2}px`
          img.style.top = `${y - size / 2}px`
          document.body.appendChild(img)
          const dx = tx - x
          const dy = ty - y
          // an arc: up to a chip at the top it rises on a wide curve; down into a button it hops up a little first
          const up = dy < -20
          const lift = up ? Math.min(90, 30 + Math.abs(dx) * 0.25) : 22
          const run = img.animate(
            [
              { transform: 'translate(0, 0) scale(1)', opacity: 1 },
              { transform: `translate(${dx * 0.4}px, ${(up ? dy * 0.35 : dy * 0.15) - lift}px) scale(1.15)`, opacity: 1, offset: 0.42 },
              { transform: `translate(${dx}px, ${dy}px) scale(0.55)`, opacity: 0.9 },
            ],
            { duration, delay: i * stagger, easing: 'cubic-bezier(0.45, 0, 0.6, 1)', fill: 'both' },
          )
          const end = () => {
            img.remove()
            o.landed?.(i)
            done()
          }
          run.onfinish = end
          run.oncancel = end
        }),
    ),
  ).then(() => undefined)
}

/** The store's picture in the chip row at the top (the silo's or the barn's), or null when it is not on the screen. */
export function storeChip(store: 'silo' | 'barn'): DOMRect | null {
  const el = document.querySelector(`.farm-chip-item.${store} img`)
  if (!el || el.getClientRects().length === 0) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 ? r : null
}

/** A good's picture flying from one element to another, up to `most` of them (`n` goods: never more pictures than fit
 *  the eye); `landed(i, k)` as each arrives with how many it stands for (the last carries the rest), so a count can go
 *  up as they land. Resolves when the last has landed (at once with motion reduced or nothing to fly from or to). */
export function flyGoods(
  src: string,
  n: number,
  from: Element | null,
  to: Element | null,
  o: { most?: number; size?: number; stagger?: number; duration?: number; landed?: (i: number, k: number) => void } = {},
) {
  const a = from?.getBoundingClientRect()
  const b = to?.getBoundingClientRect()
  const pics = Math.max(0, Math.min(n, o.most ?? 5))
  const each = (i: number) => (i === pics - 1 ? n - (pics - 1) : 1)
  if (!a || !b || !b.width || !pics) {
    if (n > 0) o.landed?.(0, n)
    return Promise.resolve()
  }
  return flyInto(
    Array.from({ length: pics }, () => ({ src, from: a })),
    b,
    { size: o.size, stagger: o.stagger, duration: o.duration, landed: (i) => o.landed?.(i, each(i)) },
  )
}

/** A good's picture popping up where it came from and flying into its store's chip (`popInto`). */
export interface PopInto {
  /** its picture */
  src: string
  /** where it lands: the store's chip at the top */
  store: Store
  /** how many it stands for: the round badge on its corner (the ItemPic rule: one picture, never copies); none without */
  count?: number
  /** goods held back from the store's gauge until it lands (none: the gauge counts them already) */
  hold?: number
  /** the k-th of several at once, `stagger` ms after the one before */
  order?: number
  stagger?: number
  /** its size as it pops (CSS px), and its look (a class of its own: position, layer, glow) */
  size?: number
  className?: string
  /** how long it pops up, holds (the moment: a reward's tier) and flies to the chip (ms) */
  pop?: number
  holdMs?: number
  fly?: number
  /** with the chip off the screen (the top set to the compass alone, or clear): fade where it is (a surprise found,
   *  still worth seeing), or nothing flies at all (the count changes at once) */
  ifHidden?: 'fade' | 'none'
  /** as it lands on the chip */
  landed?: () => void
}

/**
 * A good's picture pops up at the screen point (x, y) with its count in the badge, holds a moment, then arcs into its
 * store's chip at the top; the store's gauge holds `hold` goods back until it lands (or its flight is cancelled, or
 * `HOLD_MOST_MS` at the latest), so the tank steps up as it arrives. Whether it took off: nothing under less motion, and
 * nothing with the chip off the screen unless it is to fade where it is.
 */
export function popInto(x: number, y: number, o: PopInto): boolean {
  if (still() || typeof document === 'undefined' || typeof document.body.animate !== 'function') return false
  const to = storeChip(o.store)
  if (!to && o.ifHidden !== 'fade') return false
  const size = o.size ?? 48
  const pop = o.pop ?? 320
  const hold = o.holdMs ?? 80
  const fly = to ? (o.fly ?? 560) : 260
  // its own box at the point (its layer and look), the good's picture with its badge inside (the ItemPic's)
  const el = document.createElement('span')
  el.className = o.className ?? 'goods-pop'
  el.setAttribute('aria-hidden', 'true')
  el.style.left = `${x - size / 2}px`
  el.style.top = `${y - size / 2}px`
  el.style.width = el.style.height = `${size}px`
  const pic = document.createElement('span')
  pic.className = 'item-pic'
  const img = document.createElement('img')
  img.className = 'art'
  img.src = o.src
  img.alt = ''
  img.draggable = false
  img.style.width = img.style.height = `${size}px`
  pic.appendChild(img)
  if (o.count !== undefined) {
    const qty = document.createElement('b')
    qty.className = 'qty'
    qty.textContent = String(o.count)
    pic.appendChild(qty)
  }
  el.appendChild(pic)
  document.body.appendChild(el)
  const up = -size
  const total = pop + hold + fly
  const at = (ms: number) => ms / total
  const frames: Keyframe[] = [
    { transform: 'translate(0px, 0px) scale(0.2)', opacity: 0 },
    { transform: `translate(0px, ${up - 14}px) scale(1.25)`, opacity: 1, offset: at(pop * 0.65) },
    { transform: `translate(0px, ${up}px) scale(1)`, opacity: 1, offset: at(pop) },
    { transform: `translate(0px, ${up - 4}px) scale(1.04)`, opacity: 1, offset: at(pop + hold) },
  ]
  if (to) {
    const dx = to.left + to.width / 2 - x
    const dy = to.top + to.height / 2 - y
    frames.push({ transform: `translate(${dx * 0.35}px, ${Math.min(up, dy) - 40}px) scale(0.8)`, opacity: 1, offset: at(pop + hold + fly * 0.4) })
    frames.push({ transform: `translate(${dx}px, ${dy}px) scale(${to.width / size})`, opacity: 0.9 })
  } else frames.push({ transform: `translate(0px, ${up - 30}px) scale(0.9)`, opacity: 0 })
  const delay = (o.order ?? 0) * (o.stagger ?? 260)
  const flight = el.animate(frames, { duration: total, delay, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'both' })
  // held until it lands: at the latest `HOLD_MOST_MS`, or a little after its own end where it plays slower (a test's)
  const release = to ? holdGoods(o.store, o.hold ?? 0, Math.max(HOLD_MOST_MS, (delay + total) / Math.max(0.01, Math.abs(flight.playbackRate || 1)) + 250)) : () => {}
  flight.onfinish = () => {
    el.remove()
    release()
    if (to) o.landed?.()
  }
  flight.oncancel = () => {
    el.remove()
    release()
  }
  return true
}
