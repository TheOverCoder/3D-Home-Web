import { m } from 'motion/react'
import { type ReactNode } from 'react'
import { SPRING } from '../../../src/ui/motion'
import { loadView, useLive, type LoadingState } from './load'
import { LoadShell } from './Shell'
import './LoadingE.css'

// E · the emblem builds itself: motion design in the game's colours. Soft blobs of colour drift and melt behind; in the
// middle the house is put together from plain shapes flying in on curves as the game loads — the sun's circle, the
// square of the walls spinning in, the roof's triangle dropping, the door sliding up, the windows turning in, the
// chimney and its puffs, the green hill wiping under it. Round it a ring fills with eight marks that light as they are
// passed and a spark at its head. The name's letters pop in one by one and then ripple. Its moment: ready, every shape
// takes its ink outline at once (it becomes the logo), rays burst out, confetti, and Play. Round 5: on the shared stage
// (./Shell.tsx) — the emblem is drawn on the disc, its ring round the disc's rim; the blobs and its own name are gone
// (the shared sky and name are the same in every look), and the bar is the card's, as in the others.

const MARKS = 8
const R = 92 // the ring's radius in the 240 × 240 box

/** A shape that arrives once `on`: it flies in from (x, y) turning, overshoots and settles. */
function Arrive({ on, from, children }: { on: boolean; from: { x: number; y: number; r?: number; s?: number }; children: ReactNode }) {
  return (
    <m.g
      initial={{ x: from.x, y: from.y, rotate: from.r ?? 0, scale: from.s ?? 0.2, opacity: 0 }}
      animate={on ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 } : { x: from.x, y: from.y, rotate: from.r ?? 0, scale: from.s ?? 0.2, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, mass: 0.9 }}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      {children}
    </m.g>
  )
}

export function LoadingE({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const at = (x: number) => v.p >= x || v.ready
  const circ = 2 * Math.PI * R
  const head = -Math.PI / 2 + v.p * Math.PI * 2
  return (
    <LoadShell name="v-loading-e" v={v} onPlay={onPlay} away={s.away}>
      <div className="le-hero">
        <svg className="le-emblem" viewBox="0 0 240 240" aria-hidden="true">
          {/* rays, when ready */}
          {v.ready && (
            <m.g
              className="le-rays"
              initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ ...SPRING.soft, delay: 0.1 }}
              style={{ transformOrigin: '120px 120px' }}
            >
              {Array.from({ length: 16 }, (_, i) => (
                <rect key={i} x={117} y={2} width={6} height={22} rx={3} transform={`rotate(${i * 22.5} 120 120)`} />
              ))}
            </m.g>
          )}
          {/* the ring: its track, its fill, its marks and the spark at its head */}
          <circle className="le-track" cx={120} cy={120} r={R} />
          <m.circle
            className="le-fill"
            cx={120}
            cy={120}
            r={R}
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ * (1 - v.p) }}
            transition={{ type: 'spring', stiffness: 50, damping: 16 }}
            transform="rotate(-90 120 120)"
          />
          {Array.from({ length: MARKS }, (_, i) => {
            const k = (i + 1) / MARKS
            const a = -Math.PI / 2 + k * Math.PI * 2
            const lit = v.p >= k - 0.001
            return (
              <m.circle
                key={i}
                className={`le-mark${lit ? ' lit' : ''}`}
                cx={120 + Math.cos(a) * R}
                cy={120 + Math.sin(a) * R}
                r={lit ? 6 : 4}
                animate={lit ? { scale: [1, 1.6, 1] } : undefined}
                transition={{ duration: 0.4 }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
            )
          })}
          {!v.ready && <circle className="le-spark" cx={120 + Math.cos(head) * R} cy={120 + Math.sin(head) * R} r={7} />}
          {/* the house from shapes */}
          <g className="le-house">
            <Arrive on={at(0)} from={{ x: 60, y: -70, s: 0 }}>
              <circle className="le-sun" cx={158} cy={78} r={20} />
            </Arrive>
            <Arrive on={at(0.82)} from={{ x: 0, y: 60, s: 0.1 }}>
              <path className="le-hill" d="M 56 172 Q 120 140 184 172 Z" />
            </Arrive>
            <Arrive on={at(0.08)} from={{ x: -110, y: 90, r: -180 }}>
              <rect className="le-wall" x={82} y={112} width={76} height={58} rx={4} />
            </Arrive>
            <Arrive on={at(0.26)} from={{ x: 0, y: -120, r: 30 }}>
              <path className="le-roof" d="M 70 116 L 120 74 L 170 116 Z" />
            </Arrive>
            <Arrive on={at(0.42)} from={{ x: 0, y: 60, s: 0.3 }}>
              <rect className="le-door" x={110} y={136} width={20} height={34} rx={3} />
            </Arrive>
            <Arrive on={at(0.54)} from={{ x: -60, y: -20, r: 270 }}>
              <rect className="le-window" x={89} y={124} width={15} height={15} rx={2} />
            </Arrive>
            <Arrive on={at(0.6)} from={{ x: 60, y: -20, r: -270 }}>
              <rect className="le-window" x={136} y={124} width={15} height={15} rx={2} />
            </Arrive>
            <Arrive on={at(0.7)} from={{ x: 40, y: -80 }}>
              <rect className="le-chimney" x={140} y={80} width={12} height={22} rx={2} />
            </Arrive>
            {at(0.74) && (
              <g className="le-smoke">
                <circle cx={146} cy={70} r={5} />
                <circle cx={150} cy={58} r={7} />
              </g>
            )}
          </g>
        </svg>
      </div>
    </LoadShell>
  )
}
