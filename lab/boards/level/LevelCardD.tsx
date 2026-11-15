import { AnimatePresence, m, useAnimate, useReducedMotion } from 'motion/react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { XP_FOR } from '../../../src/farm/data'
import { iconUrl } from '../../../src/farm/icons'
import { garmentAt } from '../../../src/farm/outfit'
import { levelReward } from '../../../src/farm/xp'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { Check, X } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { quarterGifts, type QuarterGift } from './gifts'
import { ClaimRow, ITEM, LevelSheet } from './LevelSheet'
import { chapter, Count, reach, type LevelState } from './progress'
import './LevelCardD.css'

// D · the stage and the road, round 4: B and C made one, as the user asked. From B: what the next level brings is the
// hero, on a sunny stage with the light behind it (the rays open as the prize lands), and the big number of how full.
// From C: the bar is the chapter's road — the levels behind you as gold stamps (their unclaimed coins bobbing over
// them), your star, the stretch you are on, the next stop with its prize in a halo of light, and the chapter's garment
// at the far end. The stretch is a bar as popular games draw them (lab/CRAFT.md, The feeling of progress): thick, with
// a dark track, a glossy striped fill that moves, a bright head, the numbers inside it, and smart marks — four
// quarters whose pips turn into stars as they are passed (near goals), what you gained since you last looked lit
// brighter (a small win seen), a striped ghost of what is ready on the farm (the next press), and warm colours in the
// last quarter (the goal gradient). One choreography: the prize falls and the light opens; the stamps light up to your
// star; the bar fills what you had, a beat, then what you gained, each quarter pinging as it is passed; the next stop
// rings. Claim: the coins leave the stamps for the coin chip, your star jumps, one burst.
//
// E is the same card with a feature the game does not have (`gifts`): each quarter of the bar carries a small gift
// that opens with a tap once the bar has passed it (./gifts.ts, sample data).

const DROP = 0.08 // s: the prize starts to fall
const LAND = DROP + 0.56 * 0.45 // s: it touches the stage
const STAMP = 0.05 // s between the stamps lighting
const QUARTERS = [0.25, 0.5, 0.75]
const BASE = 0.28 // s: what you had fills
const HOLD = 0.12 // a beat
const GAIN = 0.7 // s: what you gained fills

const pct = (n: number) => `${Math.round(n * 100)}%`
const span = (a: number, b: number): CSSProperties => ({ left: pct(a), width: pct(Math.max(0, b - a)) })

/** The prize falling onto the stage: it stretches as it falls, squashes as it lands, and settles; near the end of the
 *  bar it hops now and then (it can almost be had). */
function Drop({ eager, children }: { eager: boolean; children: ReactNode }) {
  const still = useReducedMotion()
  return (
    <m.div
      className="ld-drop"
      initial={{ opacity: 0, y: -110 }}
      animate={{ opacity: [0, 1, 1, 1], y: [-110, 0, -8, 0], scaleX: [0.92, 1.12, 0.97, 1], scaleY: [1.1, 0.86, 1.03, 1] }}
      transition={{ delay: DROP, duration: 0.56, times: [0, 0.45, 0.72, 1], ease: ['easeIn', 'easeOut', 'easeInOut'] }}
    >
      <m.div animate={eager && !still ? { y: [0, -10, 0], rotate: [0, -4, 3, 0] } : undefined} transition={{ delay: 2.2, duration: 0.55, repeat: Infinity, repeatDelay: 2.6 }}>
        {children}
      </m.div>
    </m.div>
  )
}

/** The light behind the prize: a flash as it lands, the rays opening behind it and turning slowly, its shadow. */
const Light = () => (
  <>
    <m.span className="ld-light" aria-hidden="true" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: LAND - 0.04, duration: 0.5, ease: EASE.out }}>
      <span className="ld-rays" />
    </m.span>
    <m.span className="ld-flash" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ delay: LAND - 0.04, duration: 0.45, times: [0, 0.25, 1] }} />
    <m.span
      className="ld-floor"
      aria-hidden="true"
      initial={{ opacity: 0, scaleX: 0.25 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay: DROP + 0.05, duration: LAND - DROP, ease: 'easeIn' }}
    />
  </>
)

/** A small halo of light behind a stop of the road (the next level, the chapter's garment). */
const Halo = ({ delay }: { delay: number }) => (
  <m.i className="ld-halo" aria-hidden="true" initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.5, ease: EASE.out }} />
)

/** The stage: what the next level brings, under a ribbon, in its light. */
function Stage({ v, eager }: { v: LevelState; eager: boolean }) {
  const next = v.level + 1
  if (v.top)
    return (
      <div className="ld-stage">
        <div className="ld-prize">
          <Light />
          <Drop eager={false}>
            <img className="art ld-trophy" src={art('trophy')} alt="" />
          </Drop>
        </div>
        <m.div className="ld-caption" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: LAND }}>
          <b>The top level</b>
          <span className="tag ok">Every level reached</span>
        </m.div>
      </div>
    )
  return (
    <section className={`level-next ld-stage${v.gift ? ' gift' : ' coins'}`} aria-label={`What level ${next} brings`}>
      <m.h3 className="ld-ribbon" initial={{ opacity: 0, scaleX: 0.15 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ ...SPRING.pop, delay: 0.1 }}>
        At level {next}
      </m.h3>
      <div className="ld-prize">
        <Light />
        <Drop eager={eager}>{v.gift ? <GarmentPic g={v.gift} /> : <img className="art ld-coin" src={art('coin')} alt="" />}</Drop>
      </div>
      {v.gift ? (
        <>
          <m.div className="ld-caption" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: LAND }}>
            <b>{v.gift.name}</b>
            <span className="tag ok">New garment</span>
          </m.div>
          <m.span className="ld-sticker" initial={{ opacity: 0, scale: 1.9, rotate: -24 }} animate={{ opacity: 1, scale: 1, rotate: 6 }} transition={{ ...SPRING.pop, delay: LAND + 0.12 }}>
            <img className="art" src={art('coin')} alt="" />
            <b>+{v.nextCoins}</b>
          </m.span>
        </>
      ) : (
        <m.div className="ld-caption" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: LAND }}>
          <b className="ld-big-coins">+{v.nextCoins}</b>
          <span className="tag">coins</span>
        </m.div>
      )}
    </section>
  )
}

/** A quarter's gift on the bar (E): grey until the bar passes it, then it bobs and glows; a tap shakes it open and what
 *  was in it rises off it (coins fly on to the coin chip). Once open, a small check stays in its place. */
function Gift({ g, passed, open, delay, onOpen }: { g: QuarterGift; passed: boolean; open: boolean; delay: number; onOpen: () => void }) {
  const still = useReducedMotion()
  const [scope, animate] = useAnimate<HTMLButtonElement>()
  const [shown, setShown] = useState(false)
  const what = g.coins ? `${g.coins} coins` : `a ${g.item}`
  const tap = async () => {
    if (!passed || open || shown) return
    if (!still && scope.current) await animate(scope.current, { rotate: [0, -14, 12, -8, 6, 0], scale: [1, 1.08, 1.08, 1.12, 1.15, 1.3] }, { duration: 0.34, ease: 'easeInOut' })
    setShown(true)
    const r = scope.current?.getBoundingClientRect()
    if (r && g.coins && !still) flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(g.coins))
    onOpen()
  }
  return (
    <span className="ld-gift-at" style={{ left: pct(g.at) }}>
      <m.button
        ref={scope}
        className={`ld-gift${passed ? (open ? ' open' : ' ready') : ' shut'}`}
        onClick={() => void tap()}
        disabled={!passed || open}
        aria-label={open ? `Opened: ${what}` : passed ? `Open the gift: ${what}` : `A gift at ${Math.round(g.at * 100)}% of the bar`}
        initial={{ opacity: 0, y: 8, scale: 0.6 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...SPRING.pop, delay }}
        whileTap={passed && !open ? { scale: 0.9 } : undefined}
      >
        {open ? (
          <span className="ld-gift-done">
            <Check weight="bold" />
          </span>
        ) : (
          <img className="art" src={art('wrapped-gift')} alt="" />
        )}
        {passed && !open && <i className="ld-gift-dot" aria-hidden="true" />}
      </m.button>
      <AnimatePresence>
        {shown && (
          <m.span
            key="got"
            className="ld-gift-got"
            role="status"
            initial={{ opacity: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], y: [0, -30, -38, -52], scale: [0.4, 1.15, 1, 0.9] }}
            transition={{ duration: 1.5, times: [0, 0.2, 0.75, 1], ease: EASE.out }}
            onAnimationComplete={() => setShown(false)}
          >
            {g.coins ? (
              <>
                <img className="art" src={art('coin')} alt="" />+{g.coins}
              </>
            ) : (
              <ItemPic id={g.item!} count={1} />
            )}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  )
}

export function LevelCardD({ v, onClaim, onClose, gifts = false }: { v: LevelState; onClaim: (button: HTMLElement) => void; onClose: () => void; gifts?: boolean }) {
  const next = v.level + 1
  const still = useReducedMotion()
  const [paid, setPaid] = useState(false)
  const [star, jump] = useAnimate<HTMLSpanElement>()
  const [opened, setOpened] = useState(v.opened ?? 0)
  const { from, to } = chapter(v.level)
  const behind = v.top ? [] : Array.from({ length: v.level - from }, (_, i) => from + i)
  const ahead = v.top ? [] : Array.from({ length: Math.max(0, to - next) }, (_, i) => next + 1 + i)
  // one choreography: the stamps light up to your star, then the bar fills (what you had, a beat, what you gained)
  const tStar = 0.16 + behind.length * STAMP + 0.02
  const T0 = tStar + 0.12
  const T_GAIN = T0 + BASE + HOLD
  const T_END = T_GAIN + GAIN
  const now = v.top ? 1 : Math.min(1, v.into / v.need)
  const had = v.top ? 1 : Math.max(0, (v.into - v.gain) / v.need)
  const ghost = v.ready && !v.top ? Math.min(1, (v.into + v.ready.xp) / v.need) : now
  const enough = !!v.ready && !v.top && v.into + v.ready.xp >= v.need
  const warm = !v.top && now >= 0.75
  const left = v.need - v.into
  const passes = (p: number) => (p <= had ? T0 + BASE * reach(p / Math.max(0.0001, had)) : T_GAIN + GAIN * reach((p - had) / Math.max(0.0001, now - had)))
  const list = gifts && !v.top ? quarterGifts(v.level) : []
  const waiting = new Set<number>()
  for (let L = v.level, sum = 0; L > 1 && sum < v.unpaid; L--) {
    waiting.add(L)
    sum += levelReward(L)
  }
  const owed = (L: number) => !paid && waiting.has(L)
  const cheer = () => {
    setPaid(true)
    if (!star.current) return
    burst(star.current, { count: 60, spread: 80, power: 30 })
    if (!still) void jump(star.current, { scale: [1, 1.3, 1], rotate: [0, -12, 0] }, { duration: 0.45, ease: EASE.out })
  }
  const coinOff = { y: -70, x: -40, opacity: 0, scale: 0.6, transition: { duration: 0.45, ease: EASE.out } }

  const stamp = (L: number, i: number) => (
    <m.span key={L} className="ld-stamp" aria-hidden="true" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.pop, delay: 0.16 + i * STAMP }}>
      <Check weight="bold" />
      <small>{L}</small>
      <AnimatePresence>
        {owed(L) && (
          <m.img
            key="coin"
            className="art ld-owed"
            src={art('coin')}
            alt=""
            initial={{ y: 4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={coinOff}
            transition={{ ...SPRING.pop, delay: 0.3 + i * STAMP }}
          />
        )}
      </AnimatePresence>
    </m.span>
  )

  // the stretch you are on: a bar as popular games draw it
  const bar = (
    <span className={`ld-bar${warm ? ' warm' : ''}${v.top ? ' done' : ''}${list.length ? ' with-gifts' : ''}`}>
      <span className="ld-track">
        {ghost > now && <m.span className="ld-ghost" style={span(now, ghost)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T_END + 0.1, duration: 0.35 }} />}
        <m.span
          className="ld-fill"
          initial={still ? false : { width: '0%' }}
          animate={{ width: [pct(0), pct(had), pct(had), pct(now)] }}
          transition={{ delay: T0, duration: T_END - T0, times: [0, BASE / (T_END - T0), (BASE + HOLD) / (T_END - T0), 1], ease: [EASE.out, 'linear', EASE.out] }}
        >
          <i className="ld-stripes" />
          <i className="ld-tip" />
        </m.span>
        {now > had && (
          <m.span
            className="ld-gain"
            style={span(had, now)}
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: [0, 1, 0.75] }}
            transition={{ delay: T_GAIN, duration: GAIN + 0.4, times: [0, 0.3, 1] }}
          />
        )}
        <b className="ld-nums">
          {v.top ? (
            'MAX'
          ) : (
            <>
              <Count from={Math.max(0, v.into - v.gain)} to={v.into} delay={T_GAIN} duration={GAIN} /> / {v.need}
            </>
          )}
        </b>
      </span>
      {/* the quarters: a pip on the bar that turns into a star as the fill passes it (and pings), the next one pulsing */}
      {!v.top &&
        !list.length &&
        QUARTERS.map((q) => (
          <span key={q} className={`ld-pip${now >= q ? ' passed' : q === QUARTERS.find((x) => x > now) ? ' next' : ''}`} style={{ left: pct(q) }}>
            {now >= q && <m.i className="ld-pip-star" initial={still ? false : { scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.pop, delay: passes(q) }} />}
            {now >= q && q > had && (
              <m.i className="ld-ping" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 2.4], opacity: [0.9, 0] }} transition={{ delay: passes(q), duration: 0.5, ease: EASE.out }} />
            )}
          </span>
        ))}
      {list.map((g, i) => (
        <Gift key={g.at} g={g} passed={now >= g.at} open={i < opened} delay={now >= g.at ? passes(g.at) : T_END} onOpen={() => setOpened((n) => Math.max(n, i + 1))} />
      ))}
    </span>
  )

  return (
    <LevelSheet name={`v-level-d${gifts ? ' v-level-e' : ''}`} label={`Level ${v.level}`} top={v.top} onClose={onClose}>
      <m.header className="ld-head" variants={ITEM}>
        <span className="ld-star-badge" aria-hidden="true">
          <img className="art" src={art('glowing-star')} alt="" />
          <b>{v.level}</b>
        </span>
        <h2>Level {v.level}</h2>
        <m.button className="close" onClick={onClose} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.div className="ld-show" variants={ITEM}>
        <Stage v={v} eager={warm || enough} />
        <div className="ld-meter">
          <div className="ld-read">
            <b className="ld-pct">{v.top ? '100%' : <Count from={Math.round(had * 100)} to={Math.round(now * 100)} delay={T_GAIN} duration={GAIN} format={(n) => `${Math.round(n)}%`} />}</b>
            <span className="ld-say">
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
              <m.span className="ld-new" initial={{ opacity: 0, scale: 0.6, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...SPRING.pop, delay: T_END - 0.1 }}>
                <img className="art" src={art('sparkles')} alt="" />+{v.gain} new
              </m.span>
            )}
          </div>
          <div className="ld-road" role="progressbar" aria-label={`Level ${v.level}: XP to level ${next}`} aria-valuemin={0} aria-valuemax={v.need} aria-valuenow={v.into}>
            {v.top ? (
              <span className="ld-stop ld-first" aria-hidden="true">
                <b>1</b>
              </span>
            ) : (
              behind.map((L, i) => [stamp(L, i), <i key={`j${L}`} className="ld-join done" />])
            )}
            <m.span
              className="ld-stop ld-now"
              aria-hidden="true"
              initial={{ opacity: 0, scale: 1.6, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ ...SPRING.soft, delay: tStar }}
            >
              <span className="ld-now-in" ref={star}>
                <img className="art" src={art('glowing-star')} alt="" />
                <b className={v.level > 99 ? 'long' : undefined}>{v.level}</b>
              </span>
              <AnimatePresence>{!v.top && owed(v.level) && <m.img key="coin" className="art ld-owed" src={art('coin')} alt="" exit={coinOff} />}</AnimatePresence>
            </m.span>
            {/* upright, the bar has a line of its own under the road; the road keeps a thin copy of it in its place */}
            <span className="ld-thin" aria-hidden="true">
              <m.i initial={still ? false : { width: '0%' }} animate={{ width: pct(now) }} transition={{ delay: T0, duration: T_END - T0, ease: EASE.out }} />
            </span>
            {bar}
            {v.top ? (
              <span className="ld-stop ld-end" aria-hidden="true">
                <Halo delay={0.6} />
                <img className="art" src={art('trophy')} alt="" />
              </span>
            ) : (
              <m.span
                className={`ld-stop ld-next${v.gift ? ' gift' : ''}`}
                aria-hidden="true"
                animate={!still && (warm || enough) ? { rotate: [0, -8, 7, -4, 0], scale: [1, 1.1, 1] } : { scale: [1, 1.16, 1] }}
                transition={warm || enough ? { delay: T_END, duration: 0.6, repeat: Infinity, repeatDelay: 2.2 } : { delay: T_END - 0.1, duration: 0.4, ease: EASE.out }}
              >
                {v.gift && <Halo delay={T_END - 0.2} />}
                <b>{next}</b>
                <i className="ld-ring" />
                <m.img
                  className="art ld-sign"
                  src={art(v.gift ? 'wrapped-gift' : 'coin')}
                  alt=""
                  initial={{ opacity: 0, scale: 0.2, rotate: -40 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ ...SPRING.pop, delay: T_END }}
                />
              </m.span>
            )}
            {ahead.map((L) => {
              const g = garmentAt(L)
              return [
                <i key={`j${L}`} className="ld-join" />,
                g ? (
                  <span key={L} className="ld-far gift" aria-hidden="true">
                    <Halo delay={T_END} />
                    <GarmentPic g={g} />
                    <small>{L}</small>
                  </span>
                ) : (
                  <span key={L} className="ld-far" aria-hidden="true">
                    {L}
                  </span>
                ),
              ]
            })}
          </div>
          {!v.top && (
            <m.p className={`ld-next-press${enough ? ' enough' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T_END, duration: 0.3 }}>
              {v.ready ? (
                <>
                  <span className="ld-ready-pic">
                    <img src={iconUrl(v.ready.id)} alt="" />
                    <b>{v.ready.n}</b>
                  </span>
                  <span>
                    Ready on the farm: <b>+{v.ready.xp} XP</b>
                    {enough && (
                      <>
                        {' '}
                        — <b className="ld-enough">level {next}!</b>
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
        </div>
      </m.div>
      <ClaimRow unpaid={v.unpaid} onClaim={onClaim} onClose={onClose} cheer={cheer} />
    </LevelSheet>
  )
}
