import { useEffect, useRef } from 'react'
import { produceById, type ProduceId } from '../farm/data'
import { aimPointOf, guideTo } from '../lib/interaction'
import { look } from '../lib/look'
import { playerState } from '../lib/playerState'
import { busy, useHome } from '../store'
import { ItemPic } from './ItemPic'

// The quest compass: a strip across the top of the screen that turns as you turn, with a mark for each thing ready
// to take that the action button cannot reach from here — a ripe bed, a nest with no room for another egg, a cow
// full of milk, a batch out of the oven: its picture, how many, and where it lies from where you look (the middle
// is straight ahead; what is behind you waits at the nearer edge, with an arrow). Tap a mark to turn to it (an
// arrow then hangs over it until you get there). Within reach a thing leaves the compass — the action button takes
// it — and if you walk off without it, it comes back. Nothing to fetch: no compass.

const HALF = Math.PI / 2 // the strip spans what lies within 90° either side of where you look
const GAP = 48 // marks closer than this are spread apart (a mark is 44 px across)
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
// the directions as look yaws (0 looks along −z; a positive turn is to the left)
const LETTERS: [string, number][] = [
  ['N', 0],
  ['W', Math.PI / 2],
  ['S', Math.PI],
  ['E', -Math.PI / 2],
]
const TICKS = Array.from({ length: 24 }, (_, k) => (k * Math.PI) / 12).filter((_, k) => k % 6 !== 0)

/** Where something at `bearing` (a look yaw) sits on a strip `half` pixels either side of its middle, and whether
 *  it is behind (then held at the edge it is nearer: 'left' or 'right'). */
function place(bearing: number, half: number) {
  const rel = wrap(bearing - look.yaw)
  if (Math.abs(rel) <= HALF) return { x: (-rel / HALF) * half, behind: '', rel }
  return { x: rel > 0 ? -half : half, behind: rel > 0 ? 'left' : 'right', rel }
}

const name = (item: string, n: number) => {
  const p = produceById(item as ProduceId)
  return p ? `${n} ${n === 1 ? p.name : p.plural}` : item
}

export function Compass() {
  const phase = useHome((s) => s.phase)
  const outdoors = useHome((s) => s.outdoors)
  const occupied = useHome(busy)
  const marks = useHome((s) => s.compass)
  const strip = useRef<HTMLDivElement>(null)
  const ticks = useRef<(HTMLSpanElement | null)[]>([])
  const letters = useRef<(HTMLSpanElement | null)[]>([])
  const pins = useRef(new Map<string, HTMLButtonElement>())
  const shown = phase === 'playing' && outdoors && !occupied && marks.length > 0

  // the marks and the ticks follow the view every frame, without React: only their transforms change
  useEffect(() => {
    if (!shown) return
    let raf = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const el = strip.current
      if (!el) return
      const half = el.clientWidth / 2 - 26
      TICKS.forEach((a, k) => {
        const t = ticks.current[k]
        if (!t) return
        const p = place(a, half)
        t.style.transform = `translateX(${p.x}px)`
        t.style.opacity = p.behind ? '0' : String(1 - Math.abs(p.rel) / HALF)
      })
      LETTERS.forEach(([, a], k) => {
        const t = letters.current[k]
        if (!t) return
        const p = place(a, half)
        t.style.transform = `translateX(${p.x}px)`
        t.style.opacity = p.behind ? '0' : String(1 - 0.7 * (Math.abs(p.rel) / HALF))
      })
      // each mark where it lies, then spread so that none covers another (in the same order, within the strip)
      const from = playerState.position
      const laid: { pin: HTMLButtonElement; x: number; behind: string }[] = []
      for (const [id, pin] of pins.current) {
        const at = aimPointOf(id)
        if (!at) continue
        const p = place(Math.atan2(-(at.x - from.x), -(at.z - from.z)), half)
        laid.push({ pin, x: p.x, behind: p.behind })
      }
      laid.sort((a, b) => a.x - b.x)
      for (let k = 1; k < laid.length; k++) laid[k].x = Math.max(laid[k].x, laid[k - 1].x + GAP)
      if (laid.length) laid[laid.length - 1].x = Math.min(laid[laid.length - 1].x, half)
      for (let k = laid.length - 2; k >= 0; k--) laid[k].x = Math.min(laid[k].x, laid[k + 1].x - GAP)
      for (const l of laid) {
        l.pin.style.transform = `translateX(${l.x}px)`
        if (l.pin.dataset.side !== l.behind) l.pin.dataset.side = l.behind
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [shown, marks])

  if (!shown) return null
  return (
    <div className="compass" aria-label="Ready to take elsewhere">
      <div className="compass-strip" ref={strip}>
        {TICKS.map((a, k) => (
          <span key={a} className="compass-tick" ref={(el) => void (ticks.current[k] = el)} />
        ))}
        {LETTERS.map(([l], k) => (
          <span key={l} className="compass-letter" ref={(el) => void (letters.current[k] = el)}>
            {l}
          </span>
        ))}
        <span className="compass-ahead" aria-hidden="true" />
        {marks.map((m) => (
          <button
            key={m.item}
            className="compass-mark"
            ref={(el) => {
              if (el) pins.current.set(m.id, el)
              else pins.current.delete(m.id)
            }}
            onClick={() => guideTo(m.id)}
            aria-label={`${name(m.item, m.count)} ready — turn to it`}
          >
            <ItemPic id={m.item} count={m.count} />
          </button>
        ))}
      </div>
    </div>
  )
}
