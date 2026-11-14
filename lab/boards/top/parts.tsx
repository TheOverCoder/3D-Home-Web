import { animate, m, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { DAY, queuePlaces, storeCapacity, type DayPhase } from '../../../src/farm/data'
import { dayOf, hourOf, phaseDef, phaseOf } from '../../../src/farm/day'
import { levelView, type LevelView } from '../../../src/farm/levelView'
import { art, type ArtId } from '../../../src/ui/art'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE } from '../../../src/ui/motion'
import './parts.css'

// What every variant of the top board shares: the state (the farm's numbers the top shows, made by the game's own pure
// code), what they mean (topView), a compass drawn from a heading and bearings (the game's turns with the camera: here a
// finger dragged along it turns it), and the coins of a sale flying to the coin chip, counted in as each one lands.

export type HudView = 'all' | 'compass' | 'clean'

/** Something ready to take elsewhere (the game's CompassMark), with the bearing it lies at from where you stand. */
export interface Mark {
  item: string
  count: number
  /** its bearing, degrees clockwise from north */
  deg: number
  /** the silo or the barn full, goods waiting for room (count: how many wait) */
  alert?: boolean
}

/** What the top of the screen shows: only what the farm has. */
export interface TopState {
  coins: number
  /** every XP point gained, and the highest level paid for (src/farm/xp.ts) */
  xp: number
  paid: number
  /** the line at the gate (null before the first planting: no buyers come yet) */
  line: { n: number; level: number } | null
  /** goods in the silo and the barn, and each one's level (its room: storeCapacity) */
  silo: { n: number; level: number }
  barn: { n: number; level: number }
  /** goals reached, waiting to be claimed */
  goals: number
  /** the farm's clock: seconds since it began (src/farm/day.ts) */
  t: number
  /** where you look, degrees clockwise from north */
  heading: number
  marks: Mark[]
  hud: HudView
}

export interface Gauge {
  id: 'silo' | 'barn'
  n: number
  cap: number
  full: boolean
  k: number
}

/** Something on the farm that needs you now, most urgent first. */
export interface Need {
  id: 'silo' | 'barn' | 'line' | 'goals' | 'level'
  /** red: you are losing something (a store full); green: something waits to be taken (buyers, a claim) */
  tone: 'berry' | 'leaf' | 'sun'
  word: string
  pic: { item?: string; art?: ArtId }
  count?: number
}

const PHASE_NAME: Record<DayPhase, string> = { morning: 'Morning', noon: 'Noon', evening: 'Evening', night: 'Night' }

/** The hour as the game's clock shows it, to the farm's ten minutes (src/farm/DayChip.tsx). */
export function clock(hour: number): string {
  const tens = Math.floor(hour * 6 + 1e-6) % 144
  const h = Math.floor(tens / 6)
  return `${String(h).padStart(2, '0')}:${(tens % 6) * 10 || '00'}`
}

export interface TopView {
  lv: LevelView
  hour: string
  phase: DayPhase
  phaseName: string
  phaseArt: ArtId
  day: number
  silo: Gauge
  barn: Gauge
  line: { n: number; of: number; full: boolean } | null
  goals: number
  needs: Need[]
}

const gauge = (id: 'silo' | 'barn', s: { n: number; level: number }): Gauge => {
  const cap = storeCapacity(s.level)
  return { id, n: s.n, cap, full: s.n >= cap, k: Math.min(1, s.n / cap) }
}

/** What the state means, as the top shows it. */
export function topView(s: TopState): TopView {
  const lv = levelView(s.xp, s.paid)
  const phase = phaseOf(s.t)
  const silo = gauge('silo', s.silo)
  const barn = gauge('barn', s.barn)
  const line = s.line ? { n: s.line.n, of: queuePlaces(s.line.level), full: s.line.n >= queuePlaces(s.line.level) } : null
  const needs: Need[] = []
  for (const g of [silo, barn]) if (g.full) needs.push({ id: g.id, tone: 'berry', word: `${g.id === 'silo' ? 'Silo' : 'Barn'} full`, pic: { item: g.id } })
  if (line?.full) needs.push({ id: 'line', tone: 'leaf', word: 'Buyers waiting', pic: { art: 'people-queue' }, count: line.n })
  if (s.goals) needs.push({ id: 'goals', tone: 'leaf', word: s.goals === 1 ? 'Goal reached' : 'Goals reached', pic: { art: 'trophy' }, count: s.goals })
  return { lv, hour: clock(hourOf(s.t)), phase, phaseName: PHASE_NAME[phase], phaseArt: phaseDef(phase).art, day: dayOf(s.t) + 1, silo, barn, line, goals: s.goals, needs }
}

/** The farm seconds at which the clock reads this hour (a new farm starts at DAY.start). */
export const atHour = (h: number) => Math.round((((h - DAY.start + 24) % 24) * DAY.length) / 24)

// ── the compass ──

const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

const SCALE: { deg: number; kind: 'tick' | 'major' | 'num' | 'letter'; text?: string }[] = []
for (let d = 0; d < 360; d += 15) {
  if (d % 90 === 0) SCALE.push({ deg: d, kind: 'letter', text: 'NESW'[d / 90] })
  else if (d % 45 === 0) SCALE.push({ deg: d, kind: 'major', text: ['NE', 'SE', 'SW', 'NW'][(d - 45) / 90] })
  else if (d % 30 === 0) SCALE.push({ deg: d, kind: 'num', text: String(d) })
  else SCALE.push({ deg: d, kind: 'tick' })
}

/**
 * A compass strip turned to `heading`: the scale (what `scale` asks for: the four letters, the in-between letters, the
 * numbers), a notch over the middle, and a mark for each thing ready elsewhere; what is behind waits at the nearer edge
 * with an arrow. A mark tapped is "walking there" (ringed) until tapped again. A finger dragged along the strip turns it
 * (the lab's stand-in for turning round). Everything is placed in percentages of its width: no measuring.
 */
export function Compass({
  heading: start,
  marks,
  span = 75,
  scale = { letters: true, mid: false, nums: false },
  className = '',
  children,
}: {
  heading: number
  marks: Mark[]
  span?: number
  scale?: { letters: boolean; mid: boolean; nums: boolean }
  className?: string
  children?: ReactNode
}) {
  const [heading, setHeading] = useState(start)
  const [going, setGoing] = useState<string | null>(null)
  const [width, setWidth] = useState(0)
  const strip = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; h: number; moved: boolean } | null>(null)
  useLayoutEffect(() => {
    const el = strip.current
    if (!el) return
    const fit = () => setWidth(el.clientWidth)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const at = (deg: number) => {
    const rel = wrap(deg - heading)
    const behind = Math.abs(rel) > span
    const x = behind ? (rel < 0 ? -1 : 1) : rel / span
    return { x, rel, behind: behind ? (rel < 0 ? 'left' : 'right') : '' }
  }
  const pct = (x: number, inset: number) => `calc(50% + ${x} * (50% - ${inset}px))`
  // the marks spread apart as the game's are (in order, none covering another, all inside the strip)
  const GAP = 36
  const half = width / 2 - 20
  const laid = marks.map((mk) => ({ mk, ...at(mk.deg) })).map((l) => ({ ...l, px: l.x * half }))
  const row = [...laid].sort((a, b) => a.px - b.px)
  for (let k = 1; k < row.length; k++) row[k].px = Math.max(row[k].px, row[k - 1].px + GAP)
  if (row.length) row[row.length - 1].px = Math.min(row[row.length - 1].px, half)
  for (let k = row.length - 2; k >= 0; k--) row[k].px = Math.min(row[k].px, row[k + 1].px - GAP)
  return (
    <div className={`top-compass ${className}`}>
      <div
        className="top-compass-strip"
        ref={strip}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, h: heading, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          const w = strip.current?.clientWidth ?? 1
          if (!d) return
          const dx = e.clientX - d.x
          if (Math.abs(dx) > 6) d.moved = true
          if (d.moved) setHeading(Math.round(d.h - (dx / w) * 2 * span + 360) % 360)
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <span className="top-compass-glass" aria-hidden="true" />
        {SCALE.map((t) => {
          const p = at(t.deg)
          if (p.behind) return null
          const show = t.kind === 'tick' || (t.kind === 'letter' && scale.letters) || (t.kind === 'major' && scale.mid) || (t.kind === 'num' && scale.nums)
          const kind = show ? t.kind : t.kind === 'letter' || t.kind === 'major' ? 'major-tick' : 'tick'
          const fade = Math.min(1, 1.3 * (1 - Math.abs(p.rel) / span))
          return (
            <span key={t.deg} className={`top-compass-${kind}${t.deg === 0 ? ' north' : ''}`} style={{ left: pct(p.x, 10), opacity: fade }} aria-hidden="true">
              {show && kind !== 'tick' ? t.text : null}
            </span>
          )
        })}
        <span className="top-compass-ahead" aria-hidden="true" />
        {laid.map(({ mk, behind, px, x }) => {
          const p = { behind }
          const on = going === mk.item
          return (
            <button
              key={mk.item}
              className={`top-compass-mark${mk.alert ? ' alert' : ''}${on ? ' going' : ''}`}
              data-side={p.behind || undefined}
              style={{ left: width ? `calc(50% + ${px}px)` : pct(x, 20) }}
              onClick={() => !drag.current?.moved && setGoing(on ? null : mk.item)}
              aria-label={mk.alert ? `The ${mk.item} is full: ${mk.count} waiting for room — walk there` : `${mk.count} ${mk.item} ready — walk there`}
              aria-pressed={on}
            >
              <span className="top-compass-pin">
                <ItemPic id={mk.item} count={mk.count} />
              </span>
            </button>
          )
        })}
      </div>
      {children}
    </div>
  )
}

// ── coins arriving ──

const FLIGHT = 0.62 // s, each coin
const STAGGER = 0.08 // s between coins

/**
 * The coin chip's number, and coins flying into it. `pay(amount, from)` flies a few coins from the screen point
 * `from` on arcs to the element marked [data-coin-target] inside `root`, and the number counts on by its share as each
 * one lands (`onLand` is called then, for the chip's own answer). With less motion, the number is the new one at once.
 */
export function usePurse(start: number, onLand: (last: boolean) => void) {
  const still = useReducedMotion()
  const value = useMotionValue(start)
  const target = useRef(start)
  const text = useTransform(value, (n) => Math.round(n).toLocaleString('en-US'))
  useEffect(() => {
    value.set(start)
    target.current = start
  }, [start, value])
  const land = (to: number, last: boolean) => {
    animate(value, to, { duration: 0.28, ease: EASE.out })
    onLand(last)
  }
  const pay = (amount: number, from: { x: number; y: number }, root: HTMLElement | null) => {
    const end = target.current + amount
    target.current = end
    const coin = root?.querySelector('[data-coin-target]')
    const to = coin?.getBoundingClientRect()
    if (still || !to || !to.width) {
      value.set(end)
      onLand(true)
      return
    }
    const n = Math.max(3, Math.min(7, Math.round(amount / 6)))
    const base = value.get()
    for (let i = 0; i < n; i++) {
      const img = document.createElement('img')
      img.src = art('coin')
      img.alt = ''
      img.className = 'coin-fly'
      img.setAttribute('aria-hidden', 'true')
      img.style.left = `${from.x - 15}px`
      img.style.top = `${from.y - 15}px`
      document.body.appendChild(img)
      const dx = to.left + to.width / 2 - from.x
      const dy = to.top + to.height / 2 - from.y
      const side = (i % 2 ? 1 : -1) * (20 + 9 * i)
      const lift = 46 + 12 * (i % 3)
      const share = Math.round(base + ((i + 1) / n) * (end - base))
      const run = img.animate(
        [
          { transform: 'translate(0px, 0px) scale(0.4)', opacity: 0 },
          { transform: `translate(${side}px, ${-lift}px) scale(1.1)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.75)`, opacity: 1 },
        ],
        { duration: FLIGHT * 1000, delay: i * STAGGER * 1000, easing: 'cubic-bezier(0.5, 0, 0.75, 1)', fill: 'both' },
      )
      run.onfinish = () => {
        img.remove()
        land(share, i === n - 1)
      }
      run.oncancel = () => img.remove()
    }
  }
  return { text, value, pay }
}

/** The number a MotionValue holds, as text (the purse's count). */
export const Num = ({ v }: { v: MotionValue<string> }) => <m.span>{v}</m.span>

/**
 * The lab's stand-in for a sale (not part of the design): the action button's prompt as it would sell 8 lettuces for
 * 24 coins. A press sends the coins to the top.
 */
export function SaleStandIn({ onSell }: { onSell: (from: { x: number; y: number }) => void }) {
  return (
    <button
      className="top-lab-sale"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onSell({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      }}
      aria-label="Sell 8 lettuces for 24 coins (a stand-in for a sale)"
    >
      <span className="top-lab-sale-tag">דוגמה</span>
      <ItemPic id="lettuce" count={8} />
      <span className="top-lab-sale-coins">
        <img src={art('coin')} alt="" />
        +24
      </span>
    </button>
  )
}

/** The lab's note of what a tap would open in the game (the panel itself is another board). */
export function Opens({ what, onDone }: { what: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!what) return
    const t = setTimeout(onDone, 1600)
    return () => clearTimeout(t)
  }, [what, onDone])
  return what ? (
    <m.div className="top-lab-opens" key={what} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status">
      נפתח: {what}
    </m.div>
  ) : null
}
