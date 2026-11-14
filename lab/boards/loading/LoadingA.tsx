import { AnimatePresence, m, useAnimate, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { iconUrl } from '../../../src/farm/icons'
import { art } from '../../../src/ui/art'
import { Check, Clock, Play } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { loadView, TIPS, useLive, useTip, useWide, type LoadingState } from './load'
import './LoadingA.css'

// A · the farm on a stage: the house stands on a little island of grass in the middle, and the farm gathers round it
// as it loads — a seedling, wheat, a hen, a cow… each pops onto the island when the bar passes its mark, while the sun
// rises behind the house. The bar and its friendly line are under the stage; under them, by the thumb, a tip that
// changes. Its moment: ready, the sun is up and its rays turn, the house hops, and Play springs up where the tip was.
// A tap on the house makes it hop while you wait.

/** What comes onto the island, and at what share of the way (left / top: its place on the stage, in %). */
const FARM = [
  { pic: art('seedling'), at: 0.04, x: 12, y: 71, big: false },
  { pic: iconUrl('wheat'), at: 0.16, x: 27, y: 85, big: false },
  { pic: art('chicken'), at: 0.32, x: 77, y: 84, big: true },
  { pic: iconUrl('lemon'), at: 0.5, x: 89, y: 69, big: false },
  { pic: art('cow'), at: 0.68, x: 15, y: 56, big: true },
  { pic: art('ewe'), at: 0.8, x: 85, y: 52, big: true },
  { pic: iconUrl('pumpkin'), at: 0.92, x: 56, y: 92, big: false },
]

export function LoadingA({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const wide = useWide()
  const still = useReducedMotion()
  const [tip] = useTip()
  const [house, animate] = useAnimate<HTMLSpanElement>()
  const hop = () => {
    if (still || !house.current) return
    // a wind-up, a hop, a landing that squashes a little, and settled
    void animate(house.current, { y: [0, 3, -22, 0, 0], scaleX: [1, 1.08, 0.94, 1.06, 1], scaleY: [1, 0.9, 1.08, 0.94, 1] }, { duration: 0.62, times: [0, 0.18, 0.5, 0.78, 1], ease: EASE.out })
  }
  useEffect(() => {
    if (v.ready) {
      const t = setTimeout(hop, 260)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.ready])

  const ready = v.ready
  const enter = (i: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING.sheet, delay: 0.08 + i * 0.05 } })

  return (
    <m.div
      className={`v-loading-a${wide ? ' wide' : ''}${ready ? ' ready' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, transition: { duration: 0.3, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22 }}
    >
      <m.header className="la-logo" {...enter(0)}>
        <h1>3D Home</h1>
        <p>A cosy house and farm</p>
      </m.header>

      <div className="la-stage">
        {/* the sun rises behind the house as it loads; ready, its rays turn */}
        <m.span className="la-rays" aria-hidden="true" initial={false} animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.6 }} transition={SPRING.soft} />
        <m.img className="art la-sun" src={art('sun')} alt="" initial={{ y: 90, opacity: 0 }} animate={{ y: 70 - v.p * 105, opacity: 1 }} transition={{ type: 'spring', stiffness: 50, damping: 18 }} />
        <m.span className="la-island" aria-hidden="true" initial={{ y: 30, opacity: 0, scaleX: 0.8 }} animate={{ y: 0, opacity: 1, scaleX: 1 }} transition={{ ...SPRING.soft, delay: 0.06 }} />
        {FARM.map((f, i) =>
          v.p >= f.at ? (
            <m.span
              key={i}
              className={`la-thing${f.big ? ' big' : ''}`}
              style={{ left: `${f.x}%`, top: `${f.y}%` }}
              initial={{ opacity: 0, scale: 0.2, y: -26 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...SPRING.soft, delay: 0.2 + i * 0.04 }}
            >
              <img className="art" src={f.pic} alt="" style={{ animationDelay: `${-i * 0.37}s` }} />
            </m.span>
          ) : null,
        )}
        <m.button className="la-house" aria-label="The house" onClick={hop} initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.1 }}>
          <span ref={house} className="la-house-in">
            <img className="art" src={art('house-with-garden')} alt="" />
          </span>
        </m.button>
      </div>

      <div className="la-low">
        <m.div className="la-progress" {...enter(2)}>
          <div className="la-head">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.strong key={v.line} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: EASE.out }}>
                {ready && <Check weight="bold" aria-hidden="true" />}
                {v.line}
              </m.strong>
            </AnimatePresence>
            <span className="la-pct">{v.pct}%</span>
          </div>
          <div className="la-bar" role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}>
            <span style={{ width: `${Math.max(4, v.p * 100)}%` }}>
              <i />
            </span>
          </div>
          {v.left && (
            <p className="la-left">
              <Clock weight="bold" aria-hidden="true" /> {v.left}
            </p>
          )}
        </m.div>

        <div className="la-slot">
          <AnimatePresence mode="popLayout" initial={false}>
            {ready ? (
              // it comes in on its own spring; the button inside answers the finger on the press's
              <m.div key="play" className="la-play-in" initial={{ opacity: 0, y: 34, scale: 0.86 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...SPRING.soft, delay: 0.08 }}>
                <m.button className="primary la-play" {...PRESS} onClick={onPlay}>
                  <Play weight="fill" aria-hidden="true" />
                  {v.press}
                </m.button>
              </m.div>
            ) : v.again ? (
              <m.div key="again" className="la-tip la-again" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                <img className="art" src={art('sparkles')} alt="" />
                <p>Lighter graphics this time: they suit this phone.</p>
              </m.div>
            ) : (
              <m.div key={tip} className="la-tip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: EASE.out }}>
                <img className="art" src={TIPS[tip].pic} alt="" />
                <p>{TIPS[tip].text}</p>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </m.div>
  )
}
