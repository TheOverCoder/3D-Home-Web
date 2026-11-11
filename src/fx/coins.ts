import { art } from '../ui/art'

// Coins from a buyer to the coin chip at the top of the screen when they pay: a few coin pictures, one after another,
// each on its own arc (the Web Animations API; the page, not the 3D scene). The count in the chip has already gone up
// and hopped; this only shows where the coins came from. Nothing flies when the chip is hidden (the top of the screen
// set to the compass only, or clear).

const SIZE = 30 // CSS px, about the chip's own coin
const FLIGHT = 700 // ms, each coin
const STAGGER = 70 // ms between coins

/** The coin in the chip at the top, where the coins land, or null when it is not on the screen. */
function chipCoin(): DOMRect | null {
  const el = document.querySelector('.farm-chip-item.coins img')
  if (!el || el.getClientRects().length === 0) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 ? r : null
}

/** Flies `n` coins from the screen point (x, y) to the coin chip; returns how many took off (0: the chip is hidden). */
export function flyCoins(x: number, y: number, n: number): number {
  const to = chipCoin()
  if (!to || typeof document.body.animate !== 'function') return 0
  const dx = to.left + to.width / 2 - x
  const dy = to.top + to.height / 2 - y
  for (let i = 0; i < n; i++) {
    const img = document.createElement('img')
    img.src = art('coin')
    img.alt = ''
    img.className = 'coin-fly'
    img.setAttribute('aria-hidden', 'true')
    img.draggable = false
    img.style.left = `${x - SIZE / 2}px`
    img.style.top = `${y - SIZE / 2}px`
    document.body.appendChild(img)
    // up and out to one side first, then into the chip: every coin on an arc of its own
    const side = (i % 2 ? 1 : -1) * (18 + 10 * i)
    const lift = 50 + 12 * (i % 3)
    const flight = img.animate(
      [
        { transform: 'translate(0px, 0px) scale(0.4)', opacity: 0 },
        { transform: `translate(${side}px, ${-lift}px) scale(1.1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.75)`, opacity: 1 },
      ],
      { duration: FLIGHT, delay: i * STAGGER, easing: 'cubic-bezier(0.5, 0, 0.75, 1)', fill: 'both' },
    )
    const done = () => img.remove()
    flight.onfinish = done
    flight.oncancel = done
  }
  return n
}

const ITEM = 56 // CSS px, a surprise as it pops up
const POP = 520 // ms: up it pops, and shows itself
const HOLD = 420
const TO_CHIP = 640

/** The barn's picture in the chip row at the top, where a surprise lands, or null when it is not on the screen. */
function barnChip(): DOMRect | null {
  const el = document.querySelector('.farm-chip-item.barn img')
  if (!el || el.getClientRects().length === 0) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 ? r : null
}

/**
 * A surprise found at the screen point (x, y): its picture pops up there with a little bounce, shows itself a
 * moment, then flies on an arc into the barn's chip (or, with the chip hidden, fades where it is). `order`: the k-th
 * of several found at once, a moment after the one before. The toast names it too: this shows where it went.
 */
export function flyItem(x: number, y: number, src: string, order = 0): boolean {
  if (typeof document.body.animate !== 'function') return false
  const to = barnChip()
  const img = document.createElement('img')
  img.src = src
  img.alt = ''
  img.className = 'item-fly'
  img.setAttribute('aria-hidden', 'true')
  img.draggable = false
  img.style.left = `${x - ITEM / 2}px`
  img.style.top = `${y - ITEM / 2}px`
  document.body.appendChild(img)
  const up = -56
  const total = POP + HOLD + (to ? TO_CHIP : 260)
  const at = (ms: number) => ms / total
  const frames: Keyframe[] = [
    { transform: 'translate(0px, 0px) scale(0.2)', opacity: 0 },
    { transform: `translate(0px, ${up - 14}px) scale(1.25)`, opacity: 1, offset: at(POP * 0.65) },
    { transform: `translate(0px, ${up}px) scale(1)`, opacity: 1, offset: at(POP) },
    { transform: `translate(0px, ${up - 4}px) scale(1.04)`, opacity: 1, offset: at(POP + HOLD) },
  ]
  if (to) {
    const dx = to.left + to.width / 2 - x
    const dy = to.top + to.height / 2 - y
    const k = to.width / ITEM
    frames.push({ transform: `translate(${dx * 0.35}px, ${Math.min(up, dy) - 40}px) scale(0.8)`, opacity: 1, offset: at(POP + HOLD + TO_CHIP * 0.4) })
    frames.push({ transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0.9 })
  } else frames.push({ transform: `translate(0px, ${up - 30}px) scale(0.9)`, opacity: 0 })
  const flight = img.animate(frames, { duration: total, delay: order * 260, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'both' })
  const done = () => img.remove()
  flight.onfinish = done
  flight.oncancel = done
  return true
}
