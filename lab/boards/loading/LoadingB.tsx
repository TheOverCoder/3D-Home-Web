import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { art } from '../../../src/ui/art'
import { Check, Clock, Play } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { loadView, TIPS, useLive, useTip, useWide, type LoadingState } from './load'
import './LoadingB.css'

// B · the road home: the bar is a road that winds from the top of the screen down to your house, by the thumb (sideways:
// from left to right). A tractor drives along it as the game loads, the road filling yellow behind it, past three
// stops that light up as it passes — the farm on its way, the house being built, the lights going on. The step's
// friendly line is under the logo; a tip waits by the thumb. Its moment: the tractor parks at the house, the house
// pops with a sparkle, and Play rises under it. A tap on the tractor makes it bounce.

/** The road, as drawn on each screen (its box keeps the same proportions, so a stop's place in % is its place). */
const ROADS = {
  tall: { w: 300, h: 380, d: 'M 44 24 C 190 4, 290 60, 224 120 C 162 176, 28 146, 50 226 C 70 300, 252 252, 246 316 C 242 356, 196 362, 150 358' },
  wide: { w: 640, h: 140, d: 'M 24 100 C 110 18, 196 22, 252 72 C 312 124, 384 124, 444 74 C 494 30, 566 34, 616 70' },
}
/** The tractor stops short of the house, which stands at the road's end. */
const END = 0.93
const STOPS = [
  { at: 0, pic: art('package'), home: false },
  { at: 0.7, pic: art('building-construction'), home: false },
  { at: 0.85, pic: art('sparkles'), home: false },
  { at: 1, pic: art('house-with-garden'), home: true },
]
const along = (at: number) => (at >= 1 ? 1 : at * END)

export function LoadingB({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const wide = useWide()
  const still = useReducedMotion()
  const [tip] = useTip()
  const road = wide ? ROADS.wide : ROADS.tall
  const path = useRef<SVGPathElement>(null)
  const [stops, setStops] = useState<{ x: number; y: number }[]>([])
  // the tractor's place on the road, 0..END: it drives from the start to where the game is, then follows it
  const go = useSpring(0, { stiffness: 80, damping: 19 })
  useEffect(() => {
    if (still) go.jump(v.p * END)
    else go.set(v.p * END)
  }, [v.p, still, go])
  useLayoutEffect(() => {
    const el = path.current
    if (!el) return
    const len = el.getTotalLength()
    setStops(STOPS.map((st) => el.getPointAtLength(along(st.at) * len)))
  }, [wide])
  const at = (f: number) => {
    const el = path.current
    if (!el) return { x: 0, y: 0 }
    return el.getPointAtLength(Math.max(0, Math.min(1, f)) * el.getTotalLength())
  }
  const left = useTransform(go, (f) => `${(at(f).x / road.w) * 100}%`)
  const top = useTransform(go, (f) => `${(at(f).y / road.h) * 100}%`)
  // it faces the way it drives (the picture faces left)
  const face = useTransform(go, (f) => (at(Math.min(1, f + 0.012)).x < at(Math.max(0, f - 0.012)).x ? 1 : -1))
  const fill = useTransform(go, (f) => Math.max(0.001, f))
  const [passed, setPassed] = useState(0)
  useMotionValueEvent(go, 'change', (f) => setPassed(STOPS.filter((st) => (st.at >= 1 ? v.ready && f >= END - 0.02 : f >= along(st.at) - 0.004)).length))
  useEffect(() => {
    if (v.ready && go.get() >= END - 0.02) setPassed(STOPS.length)
  }, [v.ready, go])
  const ready = v.ready && passed === STOPS.length
  const [toot, setToot] = useState(0)

  const enter = (i: number) => ({ initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING.sheet, delay: 0.04 + i * 0.05 } })

  return (
    <m.div
      className={`v-loading-b${wide ? ' wide' : ''}${ready ? ' ready' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22 }}
    >
      <m.h1 className="lb-logo" {...enter(0)}>
        3D Home
      </m.h1>
      <m.div className="lb-head" {...enter(1)}>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.strong key={ready ? 'ready' : v.line} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22, ease: EASE.out }}>
            {ready && <Check weight="bold" aria-hidden="true" />}
            {ready ? v.line : v.ready ? 'Lighting the lamps…' : v.line}
          </m.strong>
        </AnimatePresence>
        {!ready && (
          <span className="lb-chip">
            {v.left ? (
              <>
                <Clock weight="bold" aria-hidden="true" /> {v.left}
              </>
            ) : (
              `${v.pct}%`
            )}
          </span>
        )}
      </m.div>

      <div className="lb-road" style={{ aspectRatio: `${road.w} / ${road.h}` }} role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}>
        <svg viewBox={`0 0 ${road.w} ${road.h}`} aria-hidden="true">
          <path className="lb-edge" d={road.d} />
          <path className="lb-way" d={road.d} />
          <path ref={path} className="lb-mid" d={road.d} />
          <m.path className="lb-fill" d={road.d} style={{ pathLength: fill }} />
        </svg>
        {stops.map((p, i) => {
          const st = STOPS[i]
          const on = passed > i
          const next = !on && passed === i
          return (
            <m.span
              key={i}
              className={`lb-stop${st.home ? ' home' : ''}${on ? ' on' : ''}${next ? ' next' : ''}`}
              style={{ left: `${(p.x / road.w) * 100}%`, top: `${(p.y / road.h) * 100}%` }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={on ? { opacity: 1, scale: st.home ? [1, 0.86, 1.3, 1.12] : [1, 1.28, 1] } : { opacity: 1, scale: 1 }}
              transition={on ? { duration: st.home ? 0.6 : 0.4, ease: EASE.out } : { ...SPRING.pop, delay: 0.12 + i * 0.06 }}
            >
              <img className="art" src={st.pic} alt="" />
              {st.home && on && (
                <m.img
                  className="art lb-spark"
                  src={art('sparkles')}
                  alt=""
                  initial={{ opacity: 0, scale: 0.3, rotate: -40 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ ...SPRING.soft, delay: 0.22 }}
                />
              )}
            </m.span>
          )
        })}
        <m.button className="lb-tractor" style={{ left, top }} aria-label="The tractor" onClick={() => setToot((n) => n + 1)}>
          <m.span key={toot} className="lb-tractor-in" animate={toot && !still ? { y: [0, -14, 0, -5, 0], rotate: [0, -8, 0, -3, 0] } : undefined} transition={{ duration: 0.55, ease: EASE.out }}>
            <span className="lb-idle">
              <m.img className="art" src={art('tractor')} alt="" style={{ scaleX: face }} />
            </span>
          </m.span>
        </m.button>
      </div>

      <div className="lb-slot">
        <AnimatePresence mode="popLayout" initial={false}>
          {ready ? (
            // it comes in on its own spring; the button inside answers the finger on the press's
            <m.div key="play" initial={{ opacity: 0, y: -26, scale: 0.7 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...SPRING.soft, delay: 0.08 }}>
              <m.button className="primary lb-play" {...PRESS} onClick={onPlay}>
                <Play weight="fill" aria-hidden="true" />
                {v.press}
              </m.button>
            </m.div>
          ) : (
            <m.p
              key={v.again ? 'again' : tip}
              className={`lb-tip${v.again ? ' again' : ''}`}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.26, ease: EASE.out }}
            >
              <img className="art" src={v.again ? art('sparkles') : TIPS[tip].pic} alt="" />
              <span>{v.again ? 'Lighter graphics this time: they suit this phone.' : TIPS[tip].text}</span>
            </m.p>
          )}
        </AnimatePresence>
      </div>
    </m.div>
  )
}
