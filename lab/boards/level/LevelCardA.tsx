import { m, useAnimate, useReducedMotion } from 'motion/react'
import type { LevelView } from '../../../src/farm/levelView'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { X } from '../../../src/ui/glyphs'
import { CountUp, EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { ClaimRow, GROUP, ITEM, LevelSheet, TILE, plain } from './LevelSheet'
import './LevelCardA.css'

// A · the medal: the level's star from the chip, big, in a ring that is the XP into this level, everything centred;
// what the next level brings as tiles side by side, the garment the big one. Its moment: the star lands in the ring
// and the ring fills behind a glowing head while the XP still needed counts down; a claim makes the medal jump and
// throws confetti from it. At the top level the medal turns gold, with a trophy, in a turning light.
// Sideways, the medal on the left and what the next level brings beside it, the buttons across under both.

const FILL = { delay: 0.14, duration: 0.8, ease: EASE.out }

export function LevelCardA({ v, onClaim, onClose }: { v: LevelView; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  const part = v.top ? 1 : Math.min(1, v.into / v.need)
  const still = useReducedMotion()
  const [medal, jump] = useAnimate<HTMLDivElement>()
  const cheer = () => {
    if (!medal.current) return
    burst(medal.current, { count: 70, spread: 90, power: 34 })
    if (!still) void jump(medal.current, { scale: [1, 1.16, 1] }, { duration: 0.42, ease: EASE.out })
  }
  return (
    <LevelSheet name="v-level-a" label={`Level ${v.level}`} top={v.top} onClose={onClose}>
      <m.button className="close" onClick={onClose} aria-label="Close (Esc)" {...PRESS}>
        <X weight="bold" />
      </m.button>
      <m.div className="lv-hero" variants={ITEM}>
        <div className="lv-medal" ref={medal} role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
          {v.top && (
            <m.span className="lv-light" aria-hidden="true" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.6, ease: EASE.out }}>
              <span />
            </m.span>
          )}
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="v-level-a-xp" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#a48bff" />
                <stop offset="1" stopColor="#6a4be6" />
              </linearGradient>
            </defs>
            <circle className="lv-track" cx="60" cy="60" r="54" />
            <m.circle className="lv-fill" cx="60" cy="60" r="54" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: part }} transition={FILL} />
          </svg>
          {!v.top && <m.span className="lv-head" aria-hidden="true" initial={still ? false : { rotate: 0 }} animate={{ rotate: part * 360 }} transition={FILL} />}
          <m.img
            className="art lv-star"
            src={art('glowing-star')}
            alt=""
            initial={{ opacity: 0, scale: 1.7, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ ...SPRING.soft, delay: 0.04 }}
          />
          <m.b className={v.level > 99 ? 'long' : undefined} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING.pop, delay: 0.2 }}>
            {v.level}
          </m.b>
          {v.top && (
            <m.img
              className="art lv-trophy"
              src={art('trophy')}
              alt=""
              initial={{ opacity: 0, scale: 0.3, rotate: 25 }}
              animate={{ opacity: 1, scale: 1, rotate: -8 }}
              transition={{ ...SPRING.pop, delay: 0.5 }}
            />
          )}
        </div>
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
      </m.div>
      {!v.top && (
        <m.div className="lv-side" variants={GROUP}>
          <section className={`level-next${v.gift ? ' gift' : ''}`} aria-label={`What level ${next} brings`}>
            <h3>Level {next} brings</h3>
            <div className={`lv-tiles${v.gift ? '' : ' solo'}`}>
              {v.gift && (
                <m.div className="lv-tile lv-gift" variants={TILE}>
                  <GarmentPic g={v.gift} />
                  <b>{v.gift.name}</b>
                  <span className="tag ok">New garment</span>
                </m.div>
              )}
              <m.div className="lv-tile lv-coins" variants={TILE}>
                <img className="art" src={art('coin')} alt="" />
                <span>
                  <b>+{v.nextCoins}</b>
                  <small>coins</small>
                </span>
              </m.div>
            </div>
          </section>
          {v.later && (
            <m.p className="level-later" variants={TILE}>
              <GarmentPic g={v.later} />
              <span>
                Next garment at <b>level {v.later.level}</b>
              </span>
            </m.p>
          )}
        </m.div>
      )}
      <ClaimRow unpaid={v.unpaid} onClaim={onClaim} onClose={onClose} cheer={cheer} />
    </LevelSheet>
  )
}
