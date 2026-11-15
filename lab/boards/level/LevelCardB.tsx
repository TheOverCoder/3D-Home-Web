import { m, useAnimate, useReducedMotion } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { iconUrl } from '../../../src/farm/icons'
import { XP_FOR } from '../../../src/farm/data'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { X } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { ClaimRow, ITEM, LevelSheet } from './LevelSheet'
import { Count, reach, type LevelState } from './progress'
import './LevelCardB.css'

// B · the showcase, round 3: what the next level brings is the hero on a sunny stage, and right under it a bar made to
// be felt (lab/CRAFT.md, The feeling of progress). The bar is cut in four (near sub-goals: each quarter lights as it is
// passed); what you had fills first and what you gained since you last looked fills after it, brighter, with "+9 XP"
// rising off its head (a small win seen); past it a striped ghost shows what is ready on the farm now and how far
// collecting it takes you (the next press, in view); the next level waits at the bar's end. The big number says how
// full; the words under it say what is done while the bar is under half and what is left past it (the smaller part).
// Near the end the bar warms to sun and the prize hops now and then. A claim makes the level's star jump with confetti.

const DROP = 0.08 // s: when the prize starts to fall
const LAND = DROP + 0.56 * 0.45 // s: when it touches the stage
const T0 = 0.2 // s: the XP you had fills in
const BASE = 0.3
const HOLD = 0.14 // a beat, then what you gained
const GAIN = 0.8
const T_GAIN = T0 + BASE + HOLD
const T_END = T_GAIN + GAIN
const QUARTERS = [0.25, 0.5, 0.75]

/** The prize falling onto the stage: it stretches as it falls, squashes as it lands, and settles; near the end of the
 *  bar it hops now and then (it can almost be had). */
function Drop({ eager, children }: { eager: boolean; children: ReactNode }) {
  return (
    <m.div
      className={`lv-drop${eager ? ' eager' : ''}`}
      initial={{ opacity: 0, y: -110 }}
      animate={{ opacity: [0, 1, 1, 1], y: [-110, 0, -8, 0], scaleX: [0.92, 1.12, 0.97, 1], scaleY: [1.1, 0.86, 1.03, 1] }}
      transition={{ delay: DROP, duration: 0.56, times: [0, 0.45, 0.72, 1], ease: ['easeIn', 'easeOut', 'easeInOut'] }}
    >
      {children}
    </m.div>
  )
}

/** The stage's light: a flash as the prize lands, and the rays opening behind it (then turning slowly). */
const Light = () => (
  <>
    <m.span className="lv-light" aria-hidden="true" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: LAND - 0.04, duration: 0.5, ease: EASE.out }}>
      <span className="lv-rays" />
    </m.span>
    <m.span className="lv-flash" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ delay: LAND - 0.04, duration: 0.45, times: [0, 0.25, 1] }} />
    <m.span
      className="lv-floor"
      aria-hidden="true"
      initial={{ opacity: 0, scaleX: 0.25 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay: DROP + 0.05, duration: LAND - DROP, ease: 'easeIn' }}
    />
  </>
)

/** The bar: four cells, what you had, what you gained (brighter, "+N" off its head), the ghost of what is ready, the
 *  quarters lighting as they are passed, the next level at its end. */
function Meter({ v }: { v: LevelState }) {
  const still = useReducedMotion()
  const next = v.level + 1
  const now = v.top ? 1 : Math.min(1, v.into / v.need)
  const had = v.top ? 1 : Math.max(0, (v.into - v.gain) / v.need)
  const left = v.need - v.into
  const ghost = v.ready && !v.top ? Math.min(1, (v.into + v.ready.xp) / v.need) : now
  const enough = !!v.ready && !v.top && v.into + v.ready.xp >= v.need
  const warm = !v.top && now >= 0.75
  /** when the fill passes a point of the bar (s) */
  const passes = (p: number) => (p <= had ? 0 : T_GAIN + GAIN * reach((p - had) / Math.max(0.0001, now - had)))
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const w = (a: number, b: number): CSSProperties => ({ left: pct(a), width: pct(Math.max(0, b - a)) })
  return (
    <div className={`lv-meter${warm ? ' warm' : ''}${v.top ? ' done' : ''}`}>
      <div className="lv-read">
        <b className="lv-pct">{v.top ? '100%' : <Count from={Math.round(had * 100)} to={Math.round(now * 100)} delay={T_GAIN} duration={GAIN} format={(n) => `${Math.round(n)}%`} />}</b>
        <span className="lv-say">
          {v.top ? (
            <>All the way</>
          ) : now < 0.5 ? (
            <>
              <b>{v.into}</b> of {v.need} XP
            </>
          ) : warm ? (
            <>
              Only <b>{left}</b> XP to go!
            </>
          ) : (
            <>
              <b>{left}</b> XP to go
            </>
          )}
        </span>
        {v.gain > 0 && !v.top && (
          <m.span className="lv-new" initial={{ opacity: 0, scale: 0.6, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...SPRING.pop, delay: T_END - 0.1 }}>
            <img className="art" src={art('sparkles')} alt="" />+{v.gain} XP new
          </m.span>
        )}
      </div>
      <div className="lv-track-row">
        <div className="lv-track" role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
          {/* what is ready on the farm: how far collecting it would take you */}
          {ghost > now && <m.span className="lv-ghost" style={w(now, ghost)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T_END + 0.1, duration: 0.35 }} />}
          {/* what you had, then what you gained since you last looked */}
          <m.span
            className="lv-fill"
            initial={still ? false : { width: '0%' }}
            animate={{ width: [pct(0), pct(had), pct(had), pct(now)] }}
            transition={{ delay: T0, duration: T_END - T0, times: [0, BASE / (T_END - T0), (BASE + HOLD) / (T_END - T0), 1], ease: [EASE.out, 'linear', EASE.out] }}
          >
            <i className="lv-tip" />
          </m.span>
          {now > had && (
            <m.span
              className="lv-gain"
              style={w(had, now)}
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: [0, 1, 0.7] }}
              transition={{ delay: T_GAIN, duration: GAIN + 0.4, times: [0, 0.3, 1] }}
            />
          )}
          {/* the four cells' joins; each lights as the fill passes it */}
          {QUARTERS.map((q) => (
            <span key={q} className={`lv-notch${now >= q ? ' passed' : q === QUARTERS.find((x) => x > now) ? ' next' : ''}`} style={{ left: pct(q) }}>
              {now >= q && q > had && (
                <m.i initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: [0.4, 2.2], opacity: [0.9, 0] }} transition={{ delay: passes(q), duration: 0.5, ease: EASE.out }} />
              )}
            </span>
          ))}
        </div>
        <m.span
          className={`lv-goal${v.gift ? ' gift' : ''}`}
          aria-hidden="true"
          animate={still || !(warm || enough) ? undefined : { rotate: [0, -10, 8, -5, 0], scale: [1, 1.08, 1] }}
          transition={{ delay: T_END, duration: 0.6, repeat: Infinity, repeatDelay: 2.4 }}
        >
          {v.top ? <img className="art" src={art('trophy')} alt="" /> : <b>{next}</b>}
        </m.span>
      </div>
      {!v.top && (
        <m.p className={`lv-next-press${enough ? ' enough' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T_END, duration: 0.3 }}>
          {v.ready ? (
            <>
              <span className="lv-ready-pic">
                <img src={iconUrl(v.ready.id)} alt="" />
                <b>{v.ready.n}</b>
              </span>
              <span>
                ready on the farm: <b>+{v.ready.xp} XP</b>
                {enough ? (
                  <>
                    {' '}
                    — <b className="lv-enough">level {next}!</b>
                  </>
                ) : null}
              </span>
            </>
          ) : (
            <>
              <img className="art" src={art('basket')} alt="" />
              <span>
                A harvest <b>+{XP_FOR.harvest} XP</b> · an order <b>+{XP_FOR.order} XP</b>
              </span>
            </>
          )}
        </m.p>
      )}
    </div>
  )
}

export function LevelCardB({ v, onClaim, onClose }: { v: LevelState; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  const still = useReducedMotion()
  const eager = !v.top && v.into / v.need >= 0.75
  const [star, jump] = useAnimate<HTMLSpanElement>()
  const cheer = () => {
    if (!star.current) return
    burst(star.current, { count: 60, spread: 80, power: 30 })
    if (!still) void jump(star.current, { scale: [1, 1.3, 1], rotate: [0, -12, 0] }, { duration: 0.45, ease: EASE.out })
  }
  return (
    <LevelSheet name="v-level-b" label={`Level ${v.level}`} top={v.top} onClose={onClose}>
      <m.header className="lv-head" variants={ITEM}>
        <span className="lv-star" ref={star} aria-hidden="true">
          <img className="art" src={art('glowing-star')} alt="" />
          <b>{v.level}</b>
        </span>
        <h2>Level {v.level}</h2>
        <m.button className="close" onClick={onClose} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.div className="lv-show" variants={ITEM}>
        {v.top ? (
          <div className="lv-stage">
            <div className="lv-prize">
              <Light />
              <Drop eager={false}>
                <img className="art lv-trophy" src={art('trophy')} alt="" />
              </Drop>
            </div>
          </div>
        ) : (
          <section className={`level-next lv-stage${v.gift ? ' gift' : ''}`} aria-label={`What level ${next} brings`}>
            <m.h3 className="lv-ribbon" initial={{ opacity: 0, scaleX: 0.15 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ ...SPRING.pop, delay: 0.1 }}>
              At level {next}
            </m.h3>
            {v.gift ? (
              <>
                <div className="lv-prize">
                  <Light />
                  <Drop eager={eager}>
                    <GarmentPic g={v.gift} />
                  </Drop>
                </div>
                <m.div className="lv-caption" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: LAND }}>
                  <b>{v.gift.name}</b>
                  <span className="tag ok">New garment</span>
                </m.div>
                <m.span className="lv-sticker" initial={{ opacity: 0, scale: 1.9, rotate: -24 }} animate={{ opacity: 1, scale: 1, rotate: 6 }} transition={{ ...SPRING.pop, delay: LAND + 0.12 }}>
                  <img className="art" src={art('coin')} alt="" />
                  <b>+{v.nextCoins}</b>
                </m.span>
              </>
            ) : (
              <div className="lv-coins">
                <div className="lv-prize">
                  <Light />
                  <Drop eager={eager}>
                    <img className="art" src={art('coin')} alt="" />
                  </Drop>
                </div>
                <m.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.pop, delay: LAND }}>
                  <b>+{v.nextCoins}</b>
                  <small>coins</small>
                </m.span>
              </div>
            )}
          </section>
        )}
        <Meter v={v} />
      </m.div>
      {v.later && (
        <m.p className="level-later" variants={ITEM}>
          <GarmentPic g={v.later} />
          <span>
            Next garment at <b>level {v.later.level}</b>
          </span>
        </m.p>
      )}
      <ClaimRow unpaid={v.unpaid} onClaim={onClaim} onClose={onClose} cheer={cheer} />
    </LevelSheet>
  )
}
