import { useEffect, useRef } from 'react'
import { produceById, type ProduceId } from '../farm/data'
import { aimPointOf, guideTo } from '../lib/interaction'
import { look } from '../lib/look'
import { playerState } from '../lib/playerState'
import { useSettings } from '../settings'
import { busy, useHome } from '../store'
import { ItemPic } from './ItemPic'
import './Compass.css'

// The compass: a thin, see-through strip across the top of the screen that turns as you turn — a fine scale every
// 15°, small degree numbers, N E S W, the heading you face under the middle — and on it a small mark for each thing
// ready to take that the action button cannot reach from here (a ripe bed, a nest with no room for another egg, a
// cow full of milk, a batch out of the oven): its picture, how many, and where it lies from where you look. What is
// behind you waits at the nearer edge, with an arrow. Tap a mark to turn to it (an arrow then hangs over it until
// you get there). Within reach a thing leaves the compass — the button takes it — and if you walk off without it,
// it comes back. Outdoors, unless the top of the screen is set clear (HudMode).

const SPAN = (75 * Math.PI) / 180 // the strip spans what lies within 75° either side of where you look
const GAP = 30 // marks closer than this are spread apart
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
/** A compass bearing (degrees, clockwise from north) as a look yaw (radians; 0 looks along −z, positive turns left). */
const yawOf = (deg: number) => (-deg * Math.PI) / 180

// the scale: a tick every 15° (longer every 45°), a number every 30°, the four letters
interface Mark {
  deg: number
  kind: 'tick' | 'major' | 'num' | 'letter'
  text?: string
}
const SCALE: Mark[] = []
for (let d = 0; d < 360; d += 15) {
  if (d % 90 === 0) SCALE.push({ deg: d, kind: 'letter', text: 'NESW'[d / 90] })
  else if (d % 30 === 0) SCALE.push({ deg: d, kind: 'num', text: String(d) })
  else SCALE.push({ deg: d, kind: d % 45 === 0 ? 'major' : 'tick' })
}

/** Where something at look yaw `yaw` sits on a strip `half` pixels either side of its middle, and whether it is
 *  behind (then held at the edge it is nearer: 'left' or 'right'). */
function place(yaw: number, half: number) {
  const rel = wrap(yaw - look.yaw)
  if (Math.abs(rel) <= SPAN) return { x: (-rel / SPAN) * half, behind: '', rel }
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
  const mode = useSettings((s) => s.hudMode)
  const strip = useRef<HTMLDivElement>(null)
  const scale = useRef<(HTMLSpanElement | null)[]>([])
  const heading = useRef<HTMLSpanElement>(null)
  const pins = useRef(new Map<string, HTMLButtonElement>())
  const shown = phase === 'playing' && outdoors && !occupied && mode !== 'clean'

  // the scale, the heading and the marks follow the view every frame, without React: only transforms change
  useEffect(() => {
    if (!shown) return
    let raf = 0
    let lastDeg = -1
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const el = strip.current
      if (!el) return
      // the scale runs to the strip's faded ends; a mark and its count stay inside it
      const half = el.clientWidth / 2 - 14
      const pinHalf = el.clientWidth / 2 - 24
      SCALE.forEach((m, k) => {
        const t = scale.current[k]
        if (!t) return
        const p = place(yawOf(m.deg), half)
        t.style.transform = `translateX(${p.x}px)`
        t.style.opacity = p.behind ? '0' : String(Math.min(1, 1.25 * (1 - Math.abs(p.rel) / SPAN)))
      })
      const deg = Math.round((((-look.yaw * 180) / Math.PI) % 360) + 360) % 360
      if (deg !== lastDeg && heading.current) {
        heading.current.textContent = `${deg}°`
        lastDeg = deg
      }
      // each mark where it lies, then spread so that none covers another (in the same order, within the strip)
      const from = playerState.position
      const laid: { pin: HTMLButtonElement; x: number; behind: string }[] = []
      for (const [id, pin] of pins.current) {
        const at = aimPointOf(id)
        if (!at) continue
        const p = place(Math.atan2(-(at.x - from.x), -(at.z - from.z)), pinHalf)
        laid.push({ pin, x: p.x, behind: p.behind })
      }
      laid.sort((a, b) => a.x - b.x)
      for (let k = 1; k < laid.length; k++) laid[k].x = Math.max(laid[k].x, laid[k - 1].x + GAP)
      if (laid.length) laid[laid.length - 1].x = Math.min(laid[laid.length - 1].x, pinHalf)
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
    <div className="compass" aria-label="Compass: what is ready to take elsewhere">
      <div className="compass-strip" ref={strip}>
        {SCALE.map((m, k) => (
          <span key={m.deg} className={`compass-${m.kind}${m.deg === 0 ? ' north' : ''}`} ref={(el) => void (scale.current[k] = el)}>
            {m.text}
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
            <span className="compass-pin">
              <ItemPic id={m.item} count={m.count} />
            </span>
          </button>
        ))}
      </div>
      <span className="compass-heading" ref={heading} aria-hidden="true" />
    </div>
  )
}
