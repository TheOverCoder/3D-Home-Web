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
