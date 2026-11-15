import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { EASE, SPRING } from '../../../src/ui/motion'
import { Chrome, Logo } from './Chrome'
import { loadView, useLive, useTip, useWide, type LoadingState } from './load'
import './LoadingB.css'

// B · the road home, round 3: a journey in layers. The tractor drives home through a countryside drawn in six planes
// that slide past at their own speeds (far hills slow and pale, the fence and the grass at the front fast and sharp:
// parallax, so the flat screen has depth), under a sky that goes from dawn to day as the bar fills, the sun climbing
// along its arc. Dust puffs off the back wheel; the tractor rocks on the bumps. Each step of the loading passes as a
// signpost on the verge (the farm on its way, building the house, the lights). Its moment: ready, the world slows to a
// stop as your house rolls in from the right, the tractor parks at its gate with a hop, a burst of confetti, and Play.
// A tap on the tractor makes it hop.

/** The signpost for each step, as it passes. */
const SIGN = { fetch: art('package'), build: art('building-construction'), light: art('sparkles'), ready: art('house-with-garden') } as const

/** A plane of hills: a ridge of two waves laid on each other, whole periods across, so two copies side by side loop
 *  without a seam. */
const ridge = (h: number, waves: number, amp: number, seed: number) => {
  const W = 800
  const pts = Array.from({ length: 65 }, (_, i) => {
    const x = (i / 64) * W
    const t = (x / W) * Math.PI * 2
    const y = h - amp * (0.55 + 0.3 * Math.sin(t * waves + seed) + 0.15 * Math.sin(t * waves * 2 + seed * 2))
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `M 0 200 L ${pts.join(' L ')} L ${W} 200 Z`
}

const Plane = ({ cls, d, speed, children }: { cls: string; d?: string; speed: number; children?: ReactNode }) => (
  <div className={`lb-plane ${cls}`} style={{ '--speed': `${speed}s` } as CSSProperties} aria-hidden="true">
    {[0, 1].map((k) => (
      <svg key={k} viewBox="0 0 800 200" preserveAspectRatio="none">
        {d && <path d={d} />}
        {children}
      </svg>
    ))}
  </div>
)

/** Trees on a ridge: round crowns on short trunks. */
const Trees = ({ y, n, seed }: { y: number; n: number; seed: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const x = ((i + 0.5) / n) * 800 + Math.sin(i * 3.1 + seed) * 30
      const r = 16 + ((i * 7 + seed) % 3) * 5
      return (
        <g key={i} className="lb-tree">
          <rect x={x - 3} y={y - 6} width={6} height={18} rx={2} />
          <circle cx={x} cy={y - r} r={r} />
        </g>
      )
    })}
  </>
)

export function LoadingB({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const wide = useWide()
  const still = useReducedMotion()
  const [tip] = useTip()
  const [hop, setHop] = useState(0)
  const tractor = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!v.ready) return
    const t = setTimeout(() => {
      setHop((n) => n + 1)
      if (tractor.current && !still) burst(tractor.current, { count: 60, spread: 80, power: 30 })
    }, 900)
    return () => clearTimeout(t)
  }, [v.ready, still])
  // the sun climbs an arc as the bar fills: from the left horizon to high in the middle
  const a = Math.PI * (0.95 - v.p * 0.5)
  const sun = { left: `${50 + Math.cos(a) * 40}%`, top: `${72 - Math.sin(a) * 38}%` }
  return (
    <m.div
      className={`v-loading-b${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      style={{ '--day': v.p } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: '-8%', transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.25 }}
    >
      <div className="lb-world">
        <span className="lb-sky" aria-hidden="true" />
        <m.img className="art lb-sun" src={art('sun')} alt="" style={sun} initial={false} animate={sun} transition={{ type: 'spring', stiffness: 30, damping: 14 }} />
        <div className="lb-clouds" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <Plane cls="far" d={ridge(150, 3, 70, 1)} speed={90} />
        <Plane cls="mid" d={ridge(160, 4, 46, 4)} speed={46}>
          <Trees y={128} n={7} seed={2} />
        </Plane>
        <Plane cls="near" d={ridge(172, 6, 22, 7)} speed={22}>
          <Trees y={160} n={4} seed={5} />
        </Plane>
        <div className="lb-road" aria-hidden="true">
          <i />
        </div>
        {/* each step passes as a signpost on the verge */}
        <AnimatePresence>
          {!v.ready && (
            <m.span key={v.step} className="lb-sign" aria-hidden="true" initial={{ left: '112%' }} animate={{ left: '-20%' }} transition={{ duration: still ? 0 : 6.5, ease: 'linear' }}>
              <img className="art" src={SIGN[v.step]} alt="" />
            </m.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {v.ready && (
            <m.img
              key="home"
              className="art lb-home"
              src={art('house-with-garden')}
              alt=""
              initial={{ left: '118%' }}
              animate={{ left: wide ? '62%' : '70%' }}
              transition={{ duration: still ? 0 : 1.1, ease: EASE.out }}
            />
          )}
        </AnimatePresence>
        <m.button
          ref={tractor}
          className="lb-tractor"
          aria-label="The tractor"
          onClick={() => setHop((n) => n + 1)}
          initial={{ left: '-30%' }}
          animate={{ left: v.ready ? (wide ? '44%' : '40%') : wide ? '24%' : '18%' }}
          transition={v.ready ? { duration: still ? 0 : 1.1, ease: EASE.out } : { ...SPRING.soft, delay: 0.15 }}
        >
          <m.span
            key={hop}
            className="lb-tractor-in"
            animate={hop && !still ? { y: [0, -26, 0, -6, 0], rotate: [0, -6, 2, 0, 0] } : undefined}
            transition={{ duration: 0.7, times: [0, 0.35, 0.65, 0.82, 1], ease: EASE.out }}
          >
            <img className="art" src={art('tractor')} alt="" />
          </m.span>
          <span className="lb-dust" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </m.button>
        <Plane cls="front" speed={9}>
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M ${i * 58 + 8} 200 q 6 -34 10 -46 q 2 18 4 26 q 6 -22 12 -30 q -2 22 0 50 Z`} />
          ))}
        </Plane>
      </div>
      <m.header className="lb-logo" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.sheet, delay: 0.05 }}>
        <Logo small={wide} />
      </m.header>
      <m.div className="lb-low" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.sheet, delay: 0.12 }}>
        <Chrome v={v} tip={tip} onPlay={onPlay} tone="card" />
      </m.div>
    </m.div>
  )
}
