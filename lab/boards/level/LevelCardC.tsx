import { AnimatePresence, m, useAnimate, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { XP_FOR } from '../../../src/farm/data'
import { iconUrl } from '../../../src/farm/icons'
import { garmentAt } from '../../../src/farm/outfit'
import { levelReward } from '../../../src/farm/xp'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { Check, X } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { ClaimRow, ITEM, LevelSheet } from './LevelSheet'
import { chapter, Count, reach, type LevelState } from './progress'
import './LevelCardC.css'

// C · the road, round 3: the road now runs the whole chapter — from the last garment's level to the next garment's —
// so the far goal (the garment) and the near ones (each level, its coins) are on one line (lab/CRAFT.md, The feeling
// of progress: near sub-goals on the way to a far one). Levels behind you are gold stamps; the ones whose coins wait
// carry a coin that bobs (what is already yours, apart from what comes next). The stretch you are on is the widest,
// cut in four, what you gained since you last looked lit on it with "+N" off its head, and a striped ghost of what is
// ready on the farm. From the next stop hangs the card of what it brings. Its moment: the stamps light one by one up
// to your star, the stretch fills, the next stop rings, the card drops and swings. A claim sends the waiting coins up
// off the stamps and your star jumps with confetti. At the top level the road runs gold from level 1 to a trophy.

const STAMP = 0.05 // s between the stamps lighting
const QUARTERS = [0.25, 0.5, 0.75]

export function LevelCardC({ v, onClaim, onClose }: { v: LevelState; onClaim: (button: HTMLElement) => void; onClose: () => void }) {
  const next = v.level + 1
  const still = useReducedMotion()
  const [paid, setPaid] = useState(false)
  const [now, jump] = useAnimate<HTMLSpanElement>()
  const road = useRef<HTMLDivElement>(null)
  const hook = useRef<HTMLSpanElement>(null)
  const [hookAt, setHookAt] = useState<number>()
  // the card hangs from the next stop, wherever the road puts it
  useLayoutEffect(() => {
    const place = () => {
      if (!road.current || !hook.current) return
      const r = road.current.getBoundingClientRect()
      const h = hook.current.getBoundingClientRect()
      setHookAt(h.left + h.width / 2 - r.left)
    }
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [])
  const cheer = () => {
    setPaid(true)
    if (!now.current) return
    burst(now.current, { count: 60, spread: 80, power: 30 })
    if (!still) void jump(now.current, { scale: [1, 1.25, 1] }, { duration: 0.42, ease: EASE.out })
  }
  const { from, to } = chapter(v.level)
  const behind = v.top ? [] : Array.from({ length: v.level - from }, (_, i) => from + i)
  const ahead = v.top ? [] : Array.from({ length: Math.max(0, to - next) }, (_, i) => next + 1 + i)
  const tStar = behind.length * STAMP + 0.06
  const T_FILL = tStar + 0.12
  const BASE = 0.26
  const GAIN = 0.65
  const T_GAIN = T_FILL + BASE + 0.12
  const T_END = T_GAIN + GAIN
  const nowPart = v.top ? 1 : Math.min(1, v.into / v.need)
  const had = v.top ? 1 : Math.max(0, (v.into - v.gain) / v.need)
  const ghost = v.ready && !v.top ? Math.min(1, (v.into + v.ready.xp) / v.need) : nowPart
  const enough = !!v.ready && !v.top && v.into + v.ready.xp >= v.need
  const left = v.need - v.into
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const w = (a: number, b: number): CSSProperties => ({ left: pct(a), width: pct(Math.max(0, b - a)) })
  const passes = (p: number) => T_GAIN + GAIN * reach((p - had) / Math.max(0.0001, nowPart - had))
  // the levels whose coins wait to be claimed: the last ones reached, as many as the unpaid coins make
  const waiting = new Set<number>()
  for (let L = v.level, sum = 0; L > 1 && sum < v.unpaid; L--) {
    waiting.add(L)
    sum += levelReward(L)
  }
  const owed = (L: number) => !paid && waiting.has(L)

  // a level behind you: a gold stamp, its coins bobbing over it while they wait to be claimed
  const stamp = (L: number, i: number) => (
    <m.span key={L} className="lv-stamp" aria-hidden="true" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.pop, delay: 0.05 + i * STAMP }}>
      <Check weight="bold" />
      <small>{L}</small>
      <AnimatePresence>
        {owed(L) && (
          <m.img
            key="coin"
            className="art lv-owed"
            src={art('coin')}
            alt=""
            initial={{ y: 4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, x: -30, opacity: 0, scale: 0.6, transition: { duration: 0.45, ease: EASE.out } }}
            transition={{ ...SPRING.pop, delay: 0.2 + i * STAMP }}
          />
        )}
      </AnimatePresence>
    </m.span>
  )
  const star = (
    <m.span className="lv-stop lv-now" aria-hidden="true" initial={{ opacity: 0, scale: 1.6, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ ...SPRING.soft, delay: tStar }}>
      <span className="lv-now-in" ref={now}>
        <img className="art" src={art('glowing-star')} alt="" />
        <b className={v.level > 99 ? 'long' : undefined}>{v.level}</b>
      </span>
      <AnimatePresence>
        {!v.top && owed(v.level) && (
          <m.img key="coin" className="art lv-owed" src={art('coin')} alt="" exit={{ y: -60, x: -30, opacity: 0, scale: 0.6, transition: { duration: 0.45, ease: EASE.out } }} />
        )}
      </AnimatePresence>
      {v.top && (
        <m.img
          className="art lv-sign"
          src={art('trophy')}
          alt=""
          initial={{ opacity: 0, scale: 0.3, rotate: 30 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ ...SPRING.pop, delay: 0.7 }}
        />
      )}
    </m.span>
  )
  const stretch = (
    <span className={`lv-seg${nowPart >= 0.75 && !v.top ? ' warm' : ''}`}>
      {ghost > nowPart && <m.span className="lv-ghost" style={w(nowPart, ghost)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T_END + 0.1, duration: 0.3 }} />}
      <m.span
        className="lv-fill"
        initial={still ? false : { width: '0%' }}
        animate={{ width: [pct(0), pct(had), pct(had), pct(nowPart)] }}
        transition={{ delay: T_FILL, duration: T_END - T_FILL, times: [0, BASE / (T_END - T_FILL), (BASE + 0.12) / (T_END - T_FILL), 1], ease: [EASE.out, 'linear', EASE.out] }}
      />
      {nowPart > had && (
        <m.span
          className="lv-gain"
          style={w(had, nowPart)}
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: [0, 1, 0.7] }}
          transition={{ delay: T_GAIN, duration: GAIN + 0.4, times: [0, 0.3, 1] }}
        />
      )}
      {!v.top &&
        QUARTERS.map((q) => (
          <span key={q} className={`lv-notch${nowPart >= q ? ' passed' : q === QUARTERS.find((x) => x > nowPart) ? ' next' : ''}`} style={{ left: pct(q) }}>
            {nowPart >= q && q > had && (
              <m.i initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: [0.4, 2.2], opacity: [0.9, 0] }} transition={{ delay: passes(q), duration: 0.5, ease: EASE.out }} />
            )}
          </span>
        ))}
      {v.gain > 0 && !v.top && (
        <m.b
          className="lv-plus"
          style={{ left: pct(Math.max(0.2, Math.min(nowPart, 0.7))) }}
          initial={{ opacity: 0, y: 6, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1], y: [6, -4, -2], scale: [0.6, 1.1, 1] }}
          transition={{ delay: T_END - 0.15, duration: 0.5 }}
        >
          +{v.gain}
        </m.b>
      )}
    </span>
  )
  return (
    <LevelSheet name="v-level-c" label={`Level ${v.level}`} top={v.top} onClose={onClose}>
      <m.header className="lv-head" variants={ITEM}>
        <div className="lv-title">
          <h2>Level {v.level}</h2>
          <div className="farm-sub">
            {v.top ? (
              <span className="tag ok">The top level</span>
            ) : (
              <span className={`tag lv-to-go${nowPart >= 0.75 ? ' warm' : ''}`}>
                <b>
                  <Count from={Math.round(had * 100)} to={Math.round(nowPart * 100)} delay={T_GAIN} duration={GAIN} format={(n) => `${Math.round(n)}%`} />
                </b>
                {nowPart < 0.5 ? (
                  <>
                    {' '}
                    · {v.into} of {v.need} XP
                  </>
                ) : (
                  <>
                    {' '}
                    · {nowPart >= 0.75 ? 'only ' : ''}
                    {left} XP to go
                  </>
                )}
              </span>
            )}
          </div>
        </div>
        <m.button className="close" onClick={onClose} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.div className="lv-road" ref={road} variants={ITEM} role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
        {v.top ? (
          <>
            <span className="lv-stop lv-first" aria-hidden="true">
              <b>1</b>
            </span>
            {stretch}
            {star}
          </>
        ) : (
          <>
            {behind.map((L, i) => [stamp(L, i), <i key={`j${L}`} className="lv-join done" />])}
            {star}
            {stretch}
            <m.span
              ref={hook}
              className={`lv-stop lv-next${v.gift ? ' gift' : ''}`}
              aria-hidden="true"
              animate={!still && enough ? { rotate: [0, -8, 7, -4, 0], scale: [1, 1.1, 1] } : { scale: [1, 1.16, 1] }}
              transition={enough ? { delay: T_END, duration: 0.6, repeat: Infinity, repeatDelay: 2.2 } : { delay: T_END - 0.1, duration: 0.4, ease: EASE.out }}
            >
              <b>{next}</b>
              <i className="lv-ring" />
              <m.img
                className="art lv-sign"
                src={art(v.gift ? 'wrapped-gift' : 'coin')}
                alt=""
                initial={{ opacity: 0, scale: 0.2, rotate: -40 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ ...SPRING.pop, delay: T_END }}
              />
            </m.span>
            {ahead.map((L) => {
              const g = garmentAt(L)
              return [
                <i key={`j${L}`} className="lv-join" />,
                g ? (
                  <span key={L} className="lv-far gift" aria-hidden="true">
                    <GarmentPic g={g} />
                    <small>{L}</small>
                  </span>
                ) : (
                  <span key={L} className="lv-far" aria-hidden="true" title={`+${levelReward(L)}`}>
                    {L}
                  </span>
                ),
              ]
            })}
          </>
        )}
      </m.div>
      {!v.top && (
        <m.section
          className={`level-next lv-card${v.gift ? ' gift' : ''}`}
          aria-label={`What level ${next} brings`}
          style={hookAt === undefined ? undefined : ({ '--hook': `${hookAt}px` } as CSSProperties)}
          initial={{ opacity: 0, y: -22, rotate: -6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
          transition={{ ...SPRING.soft, delay: tStar + 0.22 }}
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
      {!v.top && (
        <m.p className={`lv-next-press${enough ? ' enough' : ''}`} variants={ITEM}>
          {v.ready ? (
            <>
              <span className="lv-ready-pic">
                <img src={iconUrl(v.ready.id)} alt="" />
                <b>{v.ready.n}</b>
              </span>
              <span>
                Ready on the farm: <b>+{v.ready.xp} XP</b>
                {enough && (
                  <>
                    {' '}
                    — <b className="lv-enough">enough for level {next}!</b>
                  </>
                )}
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
      <ClaimRow unpaid={v.unpaid} onClaim={onClaim} onClose={onClose} cheer={cheer} />
    </LevelSheet>
  )
}
