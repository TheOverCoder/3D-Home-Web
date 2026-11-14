import { AnimatePresence, m, useReducedMotion, type PanInfo } from 'motion/react'
import { useState } from 'react'
import { Check, Play } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { loadView, TIPS, useLive, useTip, useWide, type LoadingState } from './load'
import poster from './poster.jpg'
import './LoadingC.css'

// C · a window onto the house: the screen is the house itself, out of focus at first and coming into focus as it loads
// (a picture of the game, sharper the further the bar has come), with the logo over it. A paper sheet at the bottom
// (sideways: on the right) holds what is coming, as cards you can swipe, and a slim bar with its friendly line. Its
// moment: ready, the house is sharp and the bar itself grows into the Play button.

export function LoadingC({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const wide = useWide()
  const still = useReducedMotion()
  const [tip, turn] = useTip(6000)
  const [dir, setDir] = useState(1)
  const swipe = (_: unknown, info: PanInfo) => {
    const d = info.offset.x < -36 || info.velocity.x < -300 ? 1 : info.offset.x > 36 || info.velocity.x > 300 ? -1 : 0
    if (!d) return
    setDir(d)
    turn((n) => n + d)
    // the cards turn on by themselves forwards again
    setTimeout(() => setDir(1), 500)
  }
  const ready = v.ready
  // the house comes into focus over the last part of the way, and the last of it is the moment it is ready
  const sharp = ready ? 1 : Math.max(0, Math.min(1, (v.p - 0.35) / 0.65)) ** 2.5 * 0.6
  const t = TIPS[tip]

  return (
    <m.div
      className={`v-loading-c${wide ? ' wide' : ''}${ready ? ' ready' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.3 }}
    >
      <div className="lc-view" aria-hidden="true">
        <img className="lc-soft" src={poster} alt="" />
        <img className="lc-sharp" src={poster} alt="" style={{ opacity: sharp }} />
        <span className="lc-shade" />
      </div>

      <m.header className="lc-logo" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING.soft, delay: 0.05 }}>
        <h1>3D Home</h1>
        <p>A cosy house and farm</p>
      </m.header>

      <m.section className="lc-sheet paper" initial={wide ? { x: 60, opacity: 0 } : { y: 80, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ ...SPRING.sheet, delay: 0.08 }}>
        <m.div className="lc-cards" drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.35} onDragEnd={swipe} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <m.div
              key={tip}
              className="lc-card"
              custom={dir}
              variants={{ in: (d: number) => ({ opacity: 0, x: 60 * d }), on: { opacity: 1, x: 0 }, out: (d: number) => ({ opacity: 0, x: -60 * d }) }}
              initial="in"
              animate="on"
              exit="out"
              transition={{ ...SPRING.sheet }}
            >
              <img className="art" src={t.pic} alt="" draggable={false} />
              <div>
                <strong>{t.title}</strong>
                <p>{t.text}</p>
              </div>
            </m.div>
          </AnimatePresence>
        </m.div>
        <div className="lc-dots" aria-hidden="true">
          {TIPS.map((_, i) => (
            <i key={i} className={i === tip ? 'on' : undefined} />
          ))}
        </div>

        <div className="lc-head">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.strong key={v.line} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: EASE.out }}>
              {ready && <Check weight="bold" aria-hidden="true" />}
              {v.line}
            </m.strong>
          </AnimatePresence>
          {!ready && <span className="lc-pct">{v.left ?? `${v.pct}%`}</span>}
        </div>
        {v.again && <p className="lc-again">Lighter graphics this time: they suit this phone.</p>}

        {/* the bar itself grows into the button once the game can be played: its box opens from the bar's height to the
            button's, the sheet rising with it, and the word pops in */}
        <m.div className="lc-go" initial={false} animate={{ height: ready ? 60 : 12 }} transition={still ? { duration: 0 } : SPRING.soft}>
          {ready ? (
            <m.button className="primary lc-play" {...PRESS} onClick={onPlay} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}>
              <m.span className="lc-play-in" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING.pop, delay: 0.16 }}>
                <Play weight="fill" aria-hidden="true" />
                {v.press}
              </m.span>
            </m.button>
          ) : (
            <div className="lc-bar" role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}>
              <span style={{ width: `${Math.max(3, v.p * 100)}%` }} />
            </div>
          )}
        </m.div>
      </m.section>
    </m.div>
  )
}
