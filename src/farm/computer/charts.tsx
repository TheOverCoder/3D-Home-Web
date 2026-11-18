import type { Channel } from '../ledger'

// The computer's charts, inline SVG drawn from the views' numbers: a week's sparkline with tomorrow's dot, a line round
// a baseline (the vegetable index round 100), a good's week with your own sales as dots, stacked bars (the sales
// book's days by place) and the shop's price against its wait. Their colours are the game's tokens, by class
// (./Computer.css). Each is a picture only: the numbers it draws are in words beside it, so it is hidden from screen
// readers.

const pts = (xs: number[], ys: number[]) => xs.map((x, k) => `${x.toFixed(1)},${ys[k].toFixed(1)}`).join(' ')

/** A scale from `lo`–`hi` to `bottom`–`top` (an empty range is drawn in the middle). */
const scale = (lo: number, hi: number, bottom: number, top: number) => (v: number) => (hi - lo < 1e-9 ? (bottom + top) / 2 : bottom - ((v - lo) / (hi - lo)) * (bottom - top))

/** A week's line and tomorrow's dot after it (dashed to it). */
export function Spark({ days, next, tone }: { days: number[]; next: number; tone: 'up' | 'down' | 'flat' }) {
  const W = 76
  const H = 30
  const all = [...days, next]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  // a still price is a flat line in the middle; a moving one fills the height
  const y = scale(lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1, H - 4, 4)
  const xs = all.map((_, k) => 3 + (k * (W - 10)) / (all.length - 1))
  const ys = all.map(y)
  const n = days.length
  return (
    <svg className={`pc-spark ${tone}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <polyline className="pc-spark-line" points={pts(xs.slice(0, n), ys.slice(0, n))} />
      <polyline className="pc-spark-next" points={pts(xs.slice(n - 1), ys.slice(n - 1))} />
      <circle className="pc-spark-dot" cx={xs[n]} cy={ys[n]} r={3.5} />
    </svg>
  )
}

/** A line over days round a baseline (the index round 100), tomorrow's dot after it; `dots`: points of a day of their
 *  own (your sales, by the day's place in `days`). */
export function LineChart({ days, next, base, dots = [] }: { days: number[]; next: number; base?: number; dots?: { at: number; v: number }[] }) {
  const W = 320
  const H = 120
  const all = [...days, next, ...(base === undefined ? [] : [base]), ...dots.map((d) => d.v)]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const pad = Math.max((hi - lo) * 0.12, 0.5)
  const y = scale(lo - pad, hi + pad, H - 8, 8)
  const step = (W - 24) / days.length
  const x = (k: number) => 8 + k * step
  const xs = [...days, next].map((_, k) => x(k))
  const ys = [...days, next].map(y)
  const n = days.length
  return (
    <svg className="pc-line" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {base !== undefined && <line className="pc-line-base" x1={0} x2={W} y1={y(base)} y2={y(base)} />}
      <polyline className="pc-line-days" points={pts(xs.slice(0, n), ys.slice(0, n))} />
      <polyline className="pc-line-next" points={pts(xs.slice(n - 1), ys.slice(n - 1))} />
      <circle className="pc-line-dot" cx={xs[n]} cy={ys[n]} r={5} />
      {dots.map((d, k) => (
        <circle key={k} className="pc-line-sale" cx={x(d.at)} cy={y(d.v)} r={4.5} />
      ))}
    </svg>
  )
}

/** Stacked bars, a day each: its coins by place, in `order`, the oldest day first. */
export function Bars({ days, order }: { days: Record<Channel, number>[]; order: readonly Channel[] }) {
  const W = 320
  const H = 110
  const most = Math.max(1, ...days.map((d) => order.reduce((n, c) => n + d[c], 0)))
  const step = W / days.length
  const bar = step * 0.7
  return (
    <svg className="pc-bars" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line className="pc-line-base" x1={0} x2={W} y1={H - 1} y2={H - 1} />
      {days.map((d, k) => {
        let top = H - 1
        return order.map((c) => {
          const h = (d[c] / most) * (H - 6)
          if (h <= 0) return null
          top -= h
          return <rect key={`${k}-${c}`} className={`pc-ch-${c}`} x={k * step + (step - bar) / 2} y={top} width={bar} height={h} rx={2} />
        })
      })}
    </svg>
  )
}

/** The shop's price against its wait: a point a step, from its lowest price to its highest; `at`: the price on the
 *  shelf now. */
export function Curve({ points, at }: { points: { pct: number; wait: number }[]; at: number | null }) {
  const W = 320
  const H = 100
  if (points.length < 2) return null
  const lo = points[0].pct
  const hi = points[points.length - 1].pct
  const x = (pct: number) => 8 + ((pct - lo) / (hi - lo)) * (W - 16)
  // the wait grows fast at the top: drawn on a root scale, so the cheap end is not a flat line
  const most = Math.sqrt(Math.max(...points.map((p) => p.wait)))
  const y = (w: number) => H - 8 - (Math.sqrt(w) / most) * (H - 16)
  const mark = at === null ? null : points.reduce((a, b) => (Math.abs(b.pct - at) < Math.abs(a.pct - at) ? b : a))
  return (
    <svg className="pc-curve" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line className="pc-line-base" x1={0} x2={W} y1={H - 8} y2={H - 8} />
      <polyline
        className="pc-line-days"
        points={pts(
          points.map((p) => x(p.pct)),
          points.map((p) => y(p.wait)),
        )}
      />
      {mark && <circle className="pc-line-dot" cx={x(mark.pct)} cy={y(mark.wait)} r={5} />}
    </svg>
  )
}
