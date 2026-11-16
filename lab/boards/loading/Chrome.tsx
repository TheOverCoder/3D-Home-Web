import { AnimatePresence, m } from 'motion/react'
import { ItemPic } from '../../../src/ui/ItemPic'
import { art } from '../../../src/ui/art'
import { Check, Clock, Play } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { TIPS, type LoadView } from './load'
import './chrome.css'

// What every look of the loading screen keeps the same (round 3), so the six differ in their motion, not in what they
// say: one friendly line and the share, one bar whose ribs drift backwards (a bar that seems faster: Harrison, Yeo &
// Hudson 2010) and whose glow quickens near the end, the time left only when a slow download makes it worth saying,
// and under the thumb a tip that changes (occupied time feels shorter: Maister 1985) — Play in its place the moment the
// game can take the press. `tone`: plain on a light scene, a paper card, frosted glass on a busy one, light words on a dark sky. Every rule is under .v-loading-chrome.

export function Chrome({
  v,
  tip,
  onPlay,
  tone = 'plain',
  bar = true,
  className = '',
  away,
}: {
  v: LoadView
  tip: number
  onPlay: () => void
  tone?: 'plain' | 'card' | 'glass' | 'ink'
  bar?: boolean
  className?: string
  /** SAMPLE (the state "back", a feature the game does not have): a returning player's away report, shown while loading in the
   *  tip's place — what is waiting on the farm, as pictures with counts */
  away?: Away
}) {
  const near = !v.ready && v.p >= 0.8
  return (
    <div className={`v-loading-chrome ${tone}${v.ready ? ' ready' : ''}${near ? ' near' : ''} ${className}`}>
      <div className="lc-head">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.strong key={v.line} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: EASE.out }}>
            {v.ready && <Check weight="bold" aria-hidden="true" />}
            {v.line}
          </m.strong>
        </AnimatePresence>
        <span className="lc-pct">{v.pct}%</span>
      </div>
      {bar && (
        <div className="lc-bar" role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}>
          <span style={{ width: `${Math.max(4, v.p * 100)}%` }}>
            <i />
          </span>
        </div>
      )}
      {v.left && (
        <p className="lc-left">
          <Clock weight="bold" aria-hidden="true" /> {v.left}
        </p>
      )}
      <div className="lc-slot">
        <AnimatePresence mode="popLayout" initial={false}>
          {v.ready ? (
            <m.div key="play" className="lc-play-in" initial={{ opacity: 0, y: 30, scale: 0.86 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...SPRING.soft, delay: 0.1 }}>
              <m.button className="primary lc-play" {...PRESS} onClick={onPlay}>
                <Play weight="fill" aria-hidden="true" />
                {v.press}
              </m.button>
            </m.div>
          ) : away ? (
            <m.div key="away" className="lc-away" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: EASE.out }}>
              <p>
                Waiting on your farm <small>· {away.ago} away</small>
              </p>
              <m.span className="lc-away-goods" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } } }}>
                {away.goods.map((g) => (
                  <m.span key={g.item} variants={{ hidden: { opacity: 0, scale: 0.3, y: 10 }, shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } }}>
                    <ItemPic id={g.item} count={g.count} />
                  </m.span>
                ))}
                {away.buyers > 0 && (
                  <m.span
                    className="item-pic"
                    variants={{ hidden: { opacity: 0, scale: 0.3, y: 10 }, shown: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } }}
                    aria-label={`${away.buyers} buyers at the gate`}
                  >
                    <img className="art" src={art('people-queue')} alt="" />
                    <b className="qty">{away.buyers}</b>
                  </m.span>
                )}
              </m.span>
            </m.div>
          ) : v.again ? (
            <m.div key="again" className="lc-tip again" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
              <img className="art" src={art('sparkles')} alt="" />
              <p>Lighter graphics this time: they suit this phone.</p>
            </m.div>
          ) : (
            <m.div key={tip} className="lc-tip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: EASE.out }}>
              <img className="art" src={TIPS[tip].pic} alt="" />
              <p>{TIPS[tip].text}</p>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** A returning player's away report, as the loading screen shows it (variant G). */
export interface Away {
  ago: string
  goods: { item: string; count: number }[]
  buyers: number
}

/** The game's name, as the logo is drawn everywhere (white letters in a thick ink line). */
export const Logo = ({ className = '', small = false }: { className?: string; small?: boolean }) => (
  <h1 className={`v-loading-logo${small ? ' small' : ''} ${className}`} aria-label="3D Home">
    3D Home
  </h1>
)
