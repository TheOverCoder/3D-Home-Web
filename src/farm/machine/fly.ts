// Goods flying on the page (the Web Animations API, over everything): a done job's picture from its place in the queue
// into the Collect button, then from the button up into the store's chip at the top of the screen (the barn's, where
// what the machines make is kept). Each on an arc of its own, one a moment after another; nothing for whoever prefers
// less motion (the counts change all the same).

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

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
          img.className = 'mp-fly'
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
