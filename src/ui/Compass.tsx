import { useEffect, useRef } from 'react'
import { produceById, type ProduceId } from '../farm/data'
import { aimPointOf } from '../lib/interaction'
import { look } from '../lib/look'
import { playerState } from '../lib/playerState'
import { useWalk, walkTo } from '../lib/route/walking'
import { useSettings } from '../settings'
import { busy, useHome } from '../store'
import { ItemPic } from './ItemPic'
import './Compass.css'

// The compass: a thin, see-through strip across the top of the screen that turns as you turn — a fine scale every
// 15°, small degree numbers, N E S W, the heading you face under the middle — and on it a small mark for each thing
// ready to take that the action button cannot reach from here (a ripe bed, a nest with no room for another egg, a
// cow full of milk, a batch out of the oven): its picture, how many, and where it lies from where you look. What is
// behind you waits at the nearer edge, with an arrow; two or more there fold into one "+N" mark (more than the strip
// holds fold in too, the farthest off to the side first), which walks you to the nearest of them. Tap a mark and you
// walk there by yourself (src/lib/route): the way round the fences, pens and beds, out through the house's doorways and
// the garden door, an arrow over the thing until you get there, and the mark ringed in sun-yellow while you go; the
// stick, a key, a jump or the mark again takes over. Within reach a thing leaves the compass — the button takes it —
// and if you walk off without it, it comes back. The silo or the barn full while goods wait for room is a mark too,
// ringed in red: its picture and how many wait. Outdoors, and indoors while something outside is ready; not when the
// top of the screen is set clear (HudMode).

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

/** One mark as laid out on the strip this frame. */
interface Laid {
  id: string
  item: string
  pin: HTMLButtonElement
  x: number
  rel: number
  behind: string
}

/** The marks folded into one "+N" at an edge, nearest first. */
type Fold = { left: Laid[]; right: Laid[] }

/**
 * Which marks show and which fold into an edge's "+N": two or more behind you at one edge fold there, and while there
 * are more marks than the strip holds, the one farthest off to a side folds into that side's "+N" (with what was
 * there). `laid` is in the store's order, nearest first, so each fold keeps that order.
 */
function fold(laid: Laid[], room: number): { shown: Laid[]; folded: Fold } {
  const side: Fold = { left: laid.filter((l) => l.behind === 'left'), right: laid.filter((l) => l.behind === 'right') }
  const ahead = laid.filter((l) => !l.behind)
  const count = () => ahead.length + Math.min(side.left.length, 1) + Math.min(side.right.length, 1)
  while (count() > room && ahead.length) {
    const far = ahead.reduce((a, b) => (Math.abs(b.rel) > Math.abs(a.rel) ? b : a))
    ahead.splice(ahead.indexOf(far), 1)
    const into = far.rel > 0 ? side.left : side.right
    into.push(far)
    into.sort((a, b) => laid.indexOf(a) - laid.indexOf(b))
  }
  const shown = [...ahead]
  const folded: Fold = { left: [], right: [] }
  for (const s of ['left', 'right'] as const) {
    // one alone shows as itself; two or more fold into the edge's "+N"
    if (side[s].length === 1) shown.push(side[s][0])
    else folded[s] = side[s]
  }
  return { shown, folded }
}

const name = (item: string, n: number) => {
  const p = produceById(item as ProduceId)
  return p ? `${n} ${n === 1 ? p.name : p.plural}` : item
}

/** What a mark says to a screen reader: something ready to take, or a building that needs you; and what a tap does. */
const markLabel = (m: { item: string; count: number; alert?: boolean }, going: boolean) =>
  `${m.alert ? `The ${m.item} is full: ${m.count} waiting for room` : `${name(m.item, m.count)} ready`} — ${going ? 'walking there, tap to stop' : 'walk there'}`

export function Compass() {
  const phase = useHome((s) => s.phase)
  const outdoors = useHome((s) => s.outdoors)
  const occupied = useHome(busy)
  const marks = useHome((s) => s.compass)
  const mode = useSettings((s) => s.hudMode)
  // the good of the mark walked to now (its mark is ringed while you go)
  const going = useWalk((s) => s.item)
  const strip = useRef<HTMLDivElement>(null)
  const scale = useRef<(HTMLSpanElement | null)[]>([])
  const heading = useRef<HTMLSpanElement>(null)
  const pins = useRef(new Map<string, HTMLButtonElement>())
  // the "+N" marks at each edge, and the nearest of what each holds (what a tap turns you to)
  const more = useRef<Record<'left' | 'right', HTMLButtonElement | null>>({ left: null, right: null })
  const moreTo = useRef<Record<'left' | 'right', { id: string; item: string } | null>>({ left: null, right: null })
  const shown = phase === 'playing' && (outdoors || marks.length > 0) && !occupied && mode !== 'clean'

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
      // each mark where it lies; behind you (or beyond what the strip holds) folded into one "+N" at an edge; then
      // spread so that none covers another (in the same order, within the strip)
      const from = playerState.position
      const laid: Laid[] = []
      for (const m of marks) {
        const pin = pins.current.get(m.id)
        const at = aimPointOf(m.id)
        if (!pin || !at) continue
        const p = place(Math.atan2(-(at.x - from.x), -(at.z - from.z)), pinHalf)
        laid.push({ id: m.id, item: m.item, pin, x: p.x, rel: p.rel, behind: p.behind })
      }
      const { shown: visible, folded } = fold(laid, Math.floor((2 * pinHalf) / GAP) + 1)
      const row: { el: HTMLButtonElement; x: number; behind: string }[] = visible.map((l) => ({ el: l.pin, x: l.x, behind: l.behind }))
      for (const s of ['left', 'right'] as const) {
        const chip = more.current[s]
        const group = folded[s]
        moreTo.current[s] = group[0] ? { id: group[0].id, item: group[0].item } : null
        if (!chip) continue
        chip.style.display = group.length ? '' : 'none'
        if (!group.length) continue
        // the mark walked to folded in here: the "+N" is ringed instead
        chip.classList.toggle(
          'going',
          group.some((l) => l.item === going),
        )
        const text = `+${group.length}`
        if (chip.dataset.n !== text) {
          chip.dataset.n = text
          chip.firstElementChild!.textContent = text
          chip.setAttribute('aria-label', `${group.length} more ready ${s === 'left' ? 'to your left' : 'to your right'} — walk to the nearest`)
        }
        row.push({ el: chip, x: s === 'left' ? -pinHalf : pinHalf, behind: s })
      }
      for (const l of laid) l.pin.style.display = visible.includes(l) ? '' : 'none'
      row.sort((a, b) => a.x - b.x)
      for (let k = 1; k < row.length; k++) row[k].x = Math.max(row[k].x, row[k - 1].x + GAP)
      if (row.length) row[row.length - 1].x = Math.min(row[row.length - 1].x, pinHalf)
      for (let k = row.length - 2; k >= 0; k--) row[k].x = Math.min(row[k].x, row[k + 1].x - GAP)
      for (const l of row) {
        l.el.style.transform = `translateX(${l.x}px)`
        if (l.el.dataset.side !== l.behind) l.el.dataset.side = l.behind
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [shown, marks, going])

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
            className={`compass-mark${m.alert ? ' alert' : ''}${going === m.item ? ' going' : ''}`}
            ref={(el) => {
              if (el) pins.current.set(m.id, el)
              else pins.current.delete(m.id)
            }}
            onClick={() => walkTo(m.id, m.item)}
            aria-label={markLabel(m, going === m.item)}
            aria-pressed={going === m.item}
          >
            <span className="compass-pin">
              <ItemPic id={m.item} count={m.count} />
            </span>
          </button>
        ))}
        {(['left', 'right'] as const).map((s) => (
          <button
            key={s}
            className="compass-mark compass-more"
            style={{ display: 'none' }}
            ref={(el) => void (more.current[s] = el)}
            onClick={() => {
              const to = moreTo.current[s]
              if (to) walkTo(to.id, to.item)
            }}
          >
            <span className="compass-pin" />
          </button>
        ))}
      </div>
      <span className="compass-heading" ref={heading} aria-hidden="true" />
    </div>
  )
}
