import { m, useAnimate, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { LevelView } from '../../../src/farm/levelView'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { X } from '../../../src/ui/glyphs'
import { CountUp, EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { ClaimRow, ITEM, LevelSheet, plain } from './LevelSheet'
import './LevelCardB.css'

// B · the showcase: what the next level brings is the hero — the garment big on a sunny stage under a ribbon "At level
// N", its coins a sticker beside it — and right under the stage the XP still needed to get it. The level itself is
// the small title above. Its moment: the ribbon unfurls, the garment drops onto the stage and lands with a squash, the
// stage light comes on as it lands, the sticker slaps on, and the bar fills as the XP still needed counts down. A
// claim makes the level's star jump and throws confetti from it. At the top level a trophy lands there instead.

const DROP = 0.1 // s: when the prize starts to fall
const LAND = DROP + 0.62 * 0.45 // s: when it touches the stage

/** The prize falling onto the stage: it stretches as it falls, squashes as it lands, and settles. */
function Drop({ children }: { children: ReactNode }) {
  return (
    <m.div
      className="lv-drop"
      initial={{ opacity: 0, y: -120 }}
      animate={{ opacity: [0, 1, 1, 1], y: [-120, 0, -9, 0], scaleX: [0.92, 1.12, 0.97, 1], scaleY: [1.1, 0.86, 1.03, 1] }}
      transition={{ delay: DROP, duration: 0.62, times: [0, 0.45, 0.72, 1], ease: ['easeIn', 'easeOut', 'easeInOut'] }}
    >
      {children}
    </m.div>
  )
}

/** The stage's light: a flash as the prize lands, and the rays opening behind it (then turning slowly). */
const Light = () => (
  <>
    <m.span className="lv-light" aria-hidden="true" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: LAND - 0.04, duration: 0.55, ease: EASE.out }}>
      <span className="lv-rays" />
    </m.span>
    <m.span className="lv-flash" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ delay: LAND - 0.04, duration: 0.5, times: [0, 0.25, 1] }} />
    <m.span
      className="lv-floor"
      aria-hidden="true"
      initial={{ opacity: 0, scaleX: 0.25 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay: DROP + 0.05, duration: LAND - DROP, ease: 'easeIn' }}
    />
  </>
)

export function LevelCardB({ v, onClaim, onClose }: { v: LevelView; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  const part = v.top ? 1 : Math.min(1, v.into / v.need)
  const still = useReducedMotion()
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
              <Drop>
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
                  <Drop>
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
                  <Drop>
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
        <div className="lv-meter">
          <div className="lv-bar" role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
            <m.span initial={still ? false : { width: '0%' }} animate={{ width: `${part * 100}%` }} transition={{ delay: 0.2, duration: 0.8, ease: EASE.out }} />
          </div>
          <div className="farm-sub">
            {v.top ? (
              <span className="tag ok">The top level</span>
            ) : (
              <span className="tag">
                <CountUp from={v.need} to={v.need - v.into} duration={1} format={plain} /> XP to level {next}
              </span>
            )}
          </div>
        </div>
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
