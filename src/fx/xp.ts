import { art } from '../ui/art'
import { reducedMotion } from './fx'

// XP crystals (role G): small blue-violet crystals with a golden halo fly from where XP was gained on the screen into
// the level chip's bar and join it at the end of its fill (DOM flights, the pattern of src/fx/coins.ts). FarmFx.tsx
// calls flyXp with the screen point; it returns whether anything flew (none when the chip is hidden, in reduced
// motion, or with as many in the air as there may be: that XP then joins the bar at once). The bar shows the points
// minus what is still in the air (xpInFlight), so it grows as each crystal lands, never before.

const SIZE = 24 // CSS px, a crystal at its biggest
const FLIGHT = 820 // ms, each crystal
const STAGGER = 60 // ms between the crystals of one gain
/** At most this many crystals in the air at once. */
export const MAX_AIR = 12

let air = 0
let carried = 0
const heard = new Set<() => void>()

/** XP still in the air (the bar shows what has landed: the points minus this). */
export const xpInFlight = () => carried

/** Calls `fn` whenever crystals take off or land (the bar and the level-up show follow); returns the unsubscribe. */
export function onXpFlight(fn: () => void): () => void {
  heard.add(fn)
  return () => {
    heard.delete(fn)
  }
}
const tell = () => {
  for (const fn of heard) fn()
}

/** How many crystals carry `xp`: one for a little, more for more, never a swarm (the root: 1 → 1, 4 → 2, 25 → 5). */
export const crystalsFor = (xp: number) => (xp > 0 ? Math.max(1, Math.min(6, Math.ceil(Math.sqrt(xp)))) : 0)

/** `xp` shared out over `n` crystals as whole points, the first ones one more where it does not divide: the shares
 *  add up to `xp` exactly, so the bar ends where the points are. */
export function shares(xp: number, n: number): number[] {
  const base = Math.floor(xp / n)
  const extra = xp - base * n
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0))
}

/** Where the crystals join the bar: the end of its fill (its start when empty), or null when it is not on the screen
 *  (the top of the screen set to the compass only, or clear, or outside the garden). */
function barEnd(): { x: number; y: number } | null {
  const bar = document.querySelector('.xp-bar')
  if (!bar || bar.getClientRects().length === 0) return null
  const r = bar.getBoundingClientRect()
  if (r.width <= 0) return null
  const fill = bar.querySelector('.xp-bar-fill')?.getBoundingClientRect()
  return { x: fill && fill.width > 0 ? Math.min(r.right, fill.right) : r.left + r.height, y: r.top + r.height / 2 }
}

/** XP crystals from (x, y) on the screen to the level chip's bar; whether any flew. */
export function flyXp(x: number, y: number, xp: number): boolean {
  const total = Number.isFinite(xp) ? Math.round(xp) : 0
  if (typeof document === 'undefined' || total <= 0 || reducedMotion()) return false
  const n = Math.min(crystalsFor(total), MAX_AIR - air)
  const to = n > 0 ? barEnd() : null
  if (!to || typeof document.body.animate !== 'function') return false
  // XP gained with no point to fly from (or none that projects): from low in the middle, as FarmFx does for one behind
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    x = innerWidth / 2
    y = innerHeight * 0.6
  }
  const dx = to.x - x
  const dy = to.y - y
  const share = shares(total, n)
  for (let i = 0; i < n; i++) {
    const img = document.createElement('img')
    img.src = art('gem-stone')
    img.alt = ''
    img.className = 'xp-fly'
    img.setAttribute('aria-hidden', 'true')
    img.draggable = false
    img.style.left = `${x - SIZE / 2}px`
    img.style.top = `${y - SIZE / 2}px`
    document.body.appendChild(img)
    // a little burst out round where it was gained, a moment's hang, then a curve up into the bar
    const a = -Math.PI / 2 + (n > 1 ? (i / (n - 1) - 0.5) * 2.2 : 0) + (Math.random() - 0.5) * 0.4
    const out = 26 + Math.random() * 14
    const bx = Math.cos(a) * out
    const by = Math.sin(a) * out
    const spin = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 120)
    const flight = img.animate(
      [
        { transform: 'translate(0px, 0px) scale(0.3) rotate(0deg)', opacity: 0, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
        { transform: `translate(${bx}px, ${by}px) scale(1) rotate(${spin * 0.2}deg)`, opacity: 1, offset: 0.24 },
        { transform: `translate(${bx}px, ${by - 5}px) scale(1) rotate(${spin * 0.3}deg)`, opacity: 1, offset: 0.34, easing: 'ease-in' },
        { transform: `translate(${bx + (dx - bx) * 0.5}px, ${by + (dy - by) * 0.3 - 26}px) scale(0.85) rotate(${spin * 0.7}deg)`, opacity: 1, offset: 0.7, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
        { transform: `translate(${dx}px, ${dy}px) scale(0.45) rotate(${spin}deg)`, opacity: 1 },
      ],
      { duration: FLIGHT, delay: i * STAGGER, fill: 'both' },
    )
    air++
    carried += share[i]
    let landed = false
    const land = () => {
      if (landed) return
      landed = true
      img.remove()
      air = Math.max(0, air - 1)
      carried = Math.max(0, carried - share[i])
      tell()
    }
    flight.onfinish = land
    flight.oncancel = land
  }
  tell()
  return true
}
