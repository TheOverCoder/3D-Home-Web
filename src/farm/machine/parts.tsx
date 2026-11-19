import { animate, m, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { clock } from './queue'
import { SPRING } from '../../ui/motion'

// Small parts of the machine panel: a clock that runs down on its own between the
// views the game gives, and the progress of a job as a motion value (the ring round its place, its time left).

/** A job's progress 0 … 1, running on by itself from what the view said (`left` of `seconds`), straight (a timer). */
export function useJobProgress(seconds: number, left: number, running: boolean): MotionValue<number> {
  const p = useMotionValue(seconds > 0 ? 1 - left / seconds : 1)
  useEffect(() => {
    p.set(seconds > 0 ? 1 - left / seconds : 1)
    if (!running || left <= 0) return
    const run = animate(p, 1, { duration: left, ease: 'linear' })
    return () => run.stop()
  }, [p, seconds, left, running])
  return p
}

/** The time left of a job, as its progress runs down (no redraw of the panel for each second). */
export function TimeLeft({ p, seconds }: { p: MotionValue<number>; seconds: number }) {
  const text = useTransform(p, (v) => clock(seconds * (1 - v)))
  return <m.span className="mp-time">{text}</m.span>
}

/** Seconds that run down from `left` (re-set whenever the view gives a new figure). */
export function useCountdown(left: number): number {
  const [now, setNow] = useState(() => performance.now())
  const [at, setAt] = useState(() => ({ left, t: performance.now() }))
  if (at.left !== left) setAt({ left, t: performance.now() })
  useEffect(() => {
    if (left <= 0) return
    const id = window.setInterval(() => setNow(performance.now()), 250)
    return () => window.clearInterval(id)
  }, [left])
  return Math.max(0, Math.min(at.left, at.left - (now - at.t) / 1000))
}

/** A round progress ring (SVG): a track, the fill, and a lighter piece after it (what the queue will add). */
export function Ring({ size, stroke, value, ghost = 0, className }: { size: number; stroke: number; value: MotionValue<number> | number; ghost?: number; className?: string }) {
  const r = (size - stroke) / 2
  const c = size / 2
  // a number is drawn through a motion value too (Motion draws an SVG's pathLength from one)
  const own = useMotionValue(typeof value === 'number' ? value : 0)
  if (typeof value === 'number' && own.get() !== value) own.set(value)
  const fill = typeof value === 'number' ? own : value
  const v = fill.get()
  return (
    <svg className={`mp-ring${className ? ` ${className}` : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="mp-ring-track" cx={c} cy={c} r={r} strokeWidth={stroke} fill="none" />
      {ghost > 0 && (
        <circle
          className="mp-ring-ghost"
          cx={c}
          cy={c}
          r={r}
          strokeWidth={stroke}
          fill="none"
          pathLength={1}
          strokeDasharray={`${Math.min(ghost, 1 - v)} 1`}
          strokeDashoffset={-v}
          transform={`rotate(-90 ${c} ${c})`}
        />
      )}
      <m.circle className="mp-ring-fill" cx={c} cy={c} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`} style={{ pathLength: value }} />
    </svg>
  )
}

/** A number that hops as it changes (not as it first shows). */
export function Bump({ n }: { n: number }) {
  const shown = useRef(false)
  useEffect(() => {
    shown.current = true
  }, [])
  return (
    <m.b key={n} initial={shown.current ? { scale: 1.6, y: -3 } : false} animate={{ scale: 1, y: 0 }} transition={SPRING.pop}>
      {n}
    </m.b>
  )
}
