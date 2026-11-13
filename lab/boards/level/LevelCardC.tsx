import { m, useAnimate, useReducedMotion } from 'motion/react'
import type { LevelView } from '../../../src/farm/levelView'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { X } from '../../../src/ui/glyphs'
import { CountUp, EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { ClaimRow, ITEM, LevelSheet, plain } from './LevelSheet'
import './LevelCardC.css'

// C · the road: a short road from your level (the chip's star) to the next one, filled as far as the XP has come; the
// next stop carries a small sign of what waits there (a present, or a coin), and from it hangs a card with what it
// brings. Its moment: your star lands, the road fills from it behind a glowing head while the XP still needed counts
// down, the next stop rings once, its sign pops on, and its card drops and swings on its hook. A claim makes your star
// jump and throws confetti from it. At the top level the road runs gold from level 1 to your star, a trophy on it.

const FILL = { delay: 0.12, duration: 0.7, ease: EASE.out }
const AT = FILL.delay + FILL.duration * 0.7 // s: when the next stop answers the road
const DROP = 0.24 // s: when its card drops from it (as the sheet comes to rest)

export function LevelCardC({ v, onClaim, onClose }: { v: LevelView; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  const part = v.top ? 1 : Math.min(1, v.into / v.need)
  const still = useReducedMotion()
  const [now, jump] = useAnimate<HTMLSpanElement>()
  const cheer = () => {
    if (!now.current) return
    burst(now.current, { count: 60, spread: 80, power: 30 })
    if (!still) void jump(now.current, { scale: [1, 1.25, 1] }, { duration: 0.42, ease: EASE.out })
  }
  const star = (
    <m.span className="lv-stop lv-now" aria-hidden="true" initial={{ opacity: 0, scale: 1.6, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ ...SPRING.soft, delay: 0.04 }}>
      <span className="lv-now-in" ref={now}>
        <img className="art" src={art('glowing-star')} alt="" />
        <b className={v.level > 99 ? 'long' : undefined}>{v.level}</b>
      </span>
      {v.top && (
        <m.img
          className="art lv-sign"
          src={art('trophy')}
          alt=""
          initial={{ opacity: 0, scale: 0.3, rotate: 30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ ...SPRING.pop, delay: AT + 0.1 }}
        />
      )}
    </m.span>
  )
  const fill = <m.span className="lv-fill" initial={still ? false : { width: '0%' }} animate={{ width: `${part * 100}%` }} transition={FILL} />
  return (
    <LevelSheet name="v-level-c" label={`Level ${v.level}`} top={v.top} onClose={onClose}>
      <m.header className="lv-head" variants={ITEM}>
        <div className="lv-title">
          <h2>Level {v.level}</h2>
          <div className="farm-sub">
            {v.top ? (
              <span className="tag ok">The top level</span>
            ) : (
              <span className="tag">
                <CountUp from={v.need} to={v.need - v.into} duration={FILL.delay + FILL.duration} format={plain} /> XP to level {next}
              </span>
            )}
          </div>
        </div>
        <m.button className="close" onClick={onClose} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.div className="lv-road" variants={ITEM} role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
        {v.top ? (
          <>
            <span className="lv-stop lv-first" aria-hidden="true">
              <b>1</b>
            </span>
            <span className="lv-seg">{fill}</span>
            {star}
          </>
        ) : (
          <>
            {star}
            <span className="lv-seg">{fill}</span>
            <m.span
              className={`lv-stop lv-next${v.gift ? ' gift' : ''}`}
              aria-hidden="true"
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.16, 1] }}
              transition={{ delay: AT, duration: 0.4, ease: EASE.out }}
            >
              <b>{next}</b>
              <i className="lv-ring" />
              <m.img
                className="art lv-sign"
                src={art(v.gift ? 'wrapped-gift' : 'coin')}
                alt=""
                initial={{ opacity: 0, scale: 0.2, rotate: -40 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ ...SPRING.pop, delay: AT + 0.06 }}
              />
            </m.span>
            <span className="lv-tail" aria-hidden="true" />
          </>
        )}
      </m.div>
      {!v.top && (
        <m.section
          className={`level-next lv-card${v.gift ? ' gift' : ''}`}
          aria-label={`What level ${next} brings`}
          initial={{ opacity: 0, y: -22, rotate: -6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
          transition={{ ...SPRING.soft, delay: DROP }}
        >
          <h3>Level {next} brings</h3>
          <div className="lv-items">
            {v.gift && (
              <div className="lv-gift">
                <GarmentPic g={v.gift} />
                <span>
                  <b>{v.gift.name}</b>
                  <span className="tag ok">New garment</span>
                </span>
              </div>
            )}
            <div className="lv-coins">
              <img className="art" src={art('coin')} alt="" />
              <span>
                <b>+{v.nextCoins}</b>
                <small>coins</small>
              </span>
            </div>
          </div>
        </m.section>
      )}
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
