import { m, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { burst } from '../../../src/ui/burst'
import { EASE, SPRING } from '../../../src/ui/motion'
import { Chrome, Logo } from './Chrome'
import { loadView, useLive, useTip, useWide, type LoadingState } from './load'
import './LoadingD.css'

// D · from seed to flower: the bar is a plant growing. A seed drops into the soil and its roots draw themselves; the
// stem rises with the share, and at each quarter of the way a pair of leaves unfolds (near goals you can see: lab/
// CRAFT.md, The feeling of progress); near the end a bud swells at the top. Clouds race over in time-lapse and pollen
// drifts. Its moment: ready, the bud bursts into a sunflower — its petals spring out one after another, pollen bursts
// round it and confetti flies — and Play. Drawn lines and shapes only (SVG), light for any phone.

const LEAVES = [
  { at: 0.2, y: 0.28, side: -1 },
  { at: 0.38, y: 0.44, side: 1 },
  { at: 0.56, y: 0.6, side: -1 },
  { at: 0.72, y: 0.74, side: 1 },
]
const PETALS = 14
/** The stem's path in the 300 × 400 box: from the soil (y 330) up a gentle S, room above it for the flower. */
const STEM = 'M 150 330 C 140 290, 166 256, 150 216 C 136 180, 162 152, 150 120'

export function LoadingD({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const wide = useWide()
  const still = useReducedMotion()
  const [tip] = useTip()
  const flower = useRef<SVGGElement>(null)
  const grow = v.ready ? 1 : Math.min(0.97, 0.06 + v.p * 0.9)
  useEffect(() => {
    if (!v.ready || still) return
    const t = setTimeout(() => flower.current && burst(flower.current, { count: 70, spread: 110, power: 30 }), 520)
    return () => clearTimeout(t)
  }, [v.ready, still])
  // where on the stem a share of its length is (the leaves and the bud ride on it)
  const stemAt = (k: number) => {
    // the same curve sampled: good enough for where a leaf sits
    const y = 330 - k * 210
    const x = 150 + Math.sin(k * Math.PI * 2) * 8
    return { x, y }
  }
  const top = stemAt(grow)
  return (
    <m.div
      className={`v-loading-d${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.25 }}
    >
      <span className="ld-sky" aria-hidden="true" />
      <div className="ld-clouds" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <m.header className="ld-logo" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.sheet, delay: 0.05 }}>
        <Logo small={wide} />
      </m.header>
      <div className="ld-stage">
        <svg viewBox="0 10 300 400" className="ld-svg" aria-hidden="true">
          <defs>
            <radialGradient id="ld-glow">
              <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* the soil */}
          <path className="ld-soil" d="M 34 340 Q 150 320 266 340 Q 288 372 248 394 Q 150 412 52 394 Q 12 372 34 340 Z" />
          <path className="ld-grass" d="M 34 340 Q 150 320 266 340" />
          {/* the seed drops in */}
          <m.ellipse
            className="ld-seed"
            cx={150}
            cy={336}
            rx={9}
            ry={6}
            initial={{ y: -260, opacity: 0 }}
            animate={{ y: [-260, 0, -8, 0], opacity: 1 }}
            transition={{ duration: 0.7, times: [0, 0.6, 0.8, 1], ease: 'easeIn' }}
          />
          {/* the roots draw themselves */}
          {['M 150 338 C 140 352, 120 360, 110 376', 'M 150 338 C 154 356, 160 370, 156 392', 'M 150 338 C 166 348, 184 352, 196 366'].map((d, i) => (
            <m.path key={i} className="ld-root" d={d} initial={{ pathLength: 0 }} animate={{ pathLength: Math.min(1, v.p * 3 + 0.2) }} transition={{ duration: 0.8 + i * 0.1, ease: EASE.out }} />
          ))}
          {/* the plant sways from its foot */}
          <g className="ld-plant">
            <m.path className="ld-stem" d={STEM} initial={{ pathLength: 0 }} animate={{ pathLength: grow }} transition={{ type: 'spring', stiffness: 40, damping: 14 }} />
            {LEAVES.map((l, i) => {
              const at = stemAt(l.y)
              const open = v.p >= l.at || v.ready
              return (
                <g key={i} transform={`translate(${at.x} ${at.y})`}>
                  <m.path
                    className="ld-leaf"
                    d={l.side < 0 ? 'M 0 0 C -18 -24, -52 -22, -64 -6 C -46 6, -16 10, 0 0 Z' : 'M 0 0 C 18 -24, 52 -22, 64 -6 C 46 6, 16 10, 0 0 Z'}
                    style={{ transformOrigin: '0px 0px' }}
                    initial={{ scale: 0, rotate: l.side * 40 }}
                    animate={open ? { scale: 1, rotate: 0 } : { scale: 0, rotate: l.side * 40 }}
                    transition={{ ...SPRING.soft, delay: 0.7 }}
                  />
                  {open && !v.ready && <m.circle r={8} fill="url(#ld-glow)" initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 3.4, opacity: 0 }} transition={{ duration: 0.7, delay: 0.75 }} />}
                </g>
              )
            })}
            {/* the bud near the end, the flower when ready */}
            <g transform={`translate(${top.x} ${top.y})`} ref={flower}>
              {v.p >= 0.84 && !v.ready && (
                <m.g initial={{ scale: 0 }} animate={{ scale: [0, 1, 1.08, 1] }} transition={{ duration: 0.8, times: [0, 0.6, 0.8, 1] }}>
                  <ellipse className="ld-bud" rx={13} ry={17} cy={-10} />
                </m.g>
              )}
              {v.ready && (
                <g transform="scale(1.35)">
                  {Array.from({ length: PETALS }, (_, i) => (
                    <m.ellipse
                      key={i}
                      className="ld-petal"
                      rx={9}
                      ry={26}
                      cy={-30}
                      style={{ transformOrigin: '0px 0px', rotate: (360 / PETALS) * i }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ ...SPRING.pop, delay: 0.1 + i * 0.03 }}
                    />
                  ))}
                  <m.circle className="ld-heart" r={20} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.soft, delay: 0.05 }} />
                  <m.circle r={30} fill="url(#ld-glow)" initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 0.9, delay: 0.4 }} />
                </g>
              )}
            </g>
          </g>
        </svg>
        <div className="ld-pollen" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ left: `${10 + ((i * 41) % 80)}%`, animationDelay: `${-i * 1.3}s`, animationDuration: `${9 + (i % 3) * 3}s` }} />
          ))}
        </div>
      </div>
      <m.div className="ld-low" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.sheet, delay: 0.12 }}>
        <Chrome v={v} tip={tip} onPlay={onPlay} tone="card" />
      </m.div>
    </m.div>
  )
}
