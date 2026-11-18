import { m, type Variants } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { along, type Road as Stops } from '../farm/road'
import { EASE } from './motion'

// A road of stops (src/farm/road.ts) drawn: the stops in a row on a line that runs from the first one's middle to the
// last one's, filled as far as the count has come (up to a stop reached, then part of the way to the next) and striped
// on to the stop being worked on, if the card names one. Each stop is drawn by its card (`stop`): a stop touched says
// its words for a moment (`picked`), then they go. The daily gift's week is one; the season road and the album's pages
// draw theirs on it. Its look is the card's own: the class names are the card's stem (`cls`) and these parts' names,
// `${cls}-road`, `${cls}-line-track`, `${cls}-line-fill`, `${cls}-line-next`.

const ROAD: Variants = { show: { transition: { delayChildren: 0.08, staggerChildren: 0.04 } } }
/** How long a stop's words stay up after a touch (ms). */
const SAY_MS = 2800

export function Road({
  road,
  have,
  toward = 0,
  label,
  cls,
  stop,
}: {
  /** the count each stop is reached at */
  road: Stops
  /** the count now: the line is filled as far as it has come */
  have: number
  /** the stop being worked on (from 1), striped up to; 0: none */
  toward?: number
  /** what the road is, for a screen reader */
  label: string
  /** the stem of its class names (the card's look) */
  cls: string
  /** draws stop k (from 1) as a list item: `picked`, its words are up; `onPick` touches it */
  stop: (k: number, picked: boolean, onPick: () => void) => ReactNode
}) {
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => {
    if (picked === null) return
    const t = window.setTimeout(() => setPicked(null), SAY_MS)
    return () => window.clearTimeout(t)
  }, [picked])
  const n = road.length
  // (a share of the line: the stops' middles are 1 / n apart, half of that in from each end)
  const span = Math.max(1, n - 1)
  const share = (stops: number) => Math.min(1, Math.max(0, stops / span))
  return (
    <m.ol className={`${cls}-road`} variants={ROAD} aria-label={label} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      <span className={`${cls}-line-track`} aria-hidden="true" style={{ left: `calc(100% / ${2 * n})`, right: `calc(100% / ${2 * n})` }}>
        {toward > 1 && <i className={`${cls}-line-next`} style={{ width: `${share(toward - 1) * 100}%` }} />}
        <m.i className={`${cls}-line-fill`} initial={false} animate={{ scaleX: share(along(road, have)) }} transition={{ duration: 0.55, ease: EASE.out, delay: 0.12 }} />
      </span>
      {road.map((_, i) => stop(i + 1, picked === i + 1, () => setPicked((p) => (p === i + 1 ? null : i + 1))))}
    </m.ol>
  )
}
