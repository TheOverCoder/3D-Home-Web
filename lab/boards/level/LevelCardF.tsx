import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { produceById } from '../../../src/farm/data'
import { levelReward } from '../../../src/farm/xp'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { GarmentPic } from '../../../src/ui/GarmentPic'
import { Check, LockSimple, X } from '../../../src/ui/glyphs'
import { ItemPic } from '../../../src/ui/ItemPic'
import { CountUp, EASE, PRESS, SPRING } from '../../../src/ui/motion'
import { boxPrize, levelExtra, type Box, type Boxes, type Prize } from './gifts'
import { ITEM, LevelSheet } from './LevelSheet'
import { Count, type LevelState } from './progress'
import './LevelCardF.css'

// F · progress you can open, round 5: the one reference (D and E are gone), after the user's "one reference; the
// scrolling does not work; the gift's opening is unclear; past levels are not interesting; focus on progress and a
// clear feeling of achievement; a small prize to open at every 25 % of a level — four — and a gift button for what was
// not taken; what a level brings comes by itself, apart from those four; the random box the player opens, easily".
//
// The hero is the level's bar, cut into four quarters, a box standing on each quarter's end: grey and locked until
// the bar reaches it (the next one says how many XP it is away: a goal always near), then glowing, hopping and ready
// to open with one tap, then open — the prize it gave in its place with a ✓. Over the bar the big share and the words
// that matter (what is done below half, what is left past it); on the bar what you gained since you last looked, lit,
// and a striped ghost of what is ready on the farm. At its end the next level's star; under it what that level
// brings — its coins, its garment, a surprise — marked "Comes by itself": no Claim, it is the player's on reaching
// it. At the foot one press when boxes wait (this level's or any before): "Open 3 gifts", which opens them all at once.
//
// The opening is one clear moment, in the middle of the card: the box flies there from where it stood and grows; it
// shakes as light gathers behind it; it bursts open (a flash, the rays, a little confetti) and the prize comes up out
// of it, big, with its name and how many, counting; a tap or Collect sends it home (coins to the coin chip, goods up to
// the store) and the box on the bar turns to the prize with a ✓. Several open together, a row of boxes popping one
// after another into their prizes, then a total. Every box waits for the player: none is ever lost.
//
// Its one layout fits without scrolling upright and sideways (sideways: the bar and its boxes full width, the next
// level and the gift button side by side under it); on a small phone the card scrolls in its own body and only the
// title moves the sheet.

const pct = (n: number) => `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`

/** A prize's picture and words: coins, or a good with its count. */
function PrizePic({ p, big = false }: { p: Prize; big?: boolean }) {
  if ('coins' in p)
    return (
      <span className={`lf-prize-pic coins${big ? ' big' : ''}`}>
        <img className="art" src={art('coin')} alt="" />
        <b>+{p.coins}</b>
      </span>
    )
  return (
    <span className={`lf-prize-pic${big ? ' big' : ''}`}>
      <ItemPic id={p.item} count={p.n} />
    </span>
  )
}
const prizeWords = (p: Prize) => ('coins' in p ? `${p.coins} coins` : `${p.n} ${p.n === 1 ? produceById(p.item).name : produceById(p.item).plural}`)
const same = (a: Box, b: Box) => a.level === b.level && a.q === b.q

/** What a box shows on the bar. */
type BoxState = 'locked' | 'ready' | 'open'

export function LevelCardF({ v, boxes, onClose }: { v: LevelState; boxes: Boxes; onClose: () => void }) {
  const still = useReducedMotion()
  const share = v.into / v.need
  // the boxes of this level the bar has reached (the 100 % one comes with the next level: it is never reached here)
  const reached = v.top ? 3 : Math.min(3, Math.floor(share * 4 + 1e-9))
  const [opened, setOpened] = useState<number[]>(boxes.opened)
  const [missed, setMissed] = useState<Box[]>(boxes.missed)
  const [opening, setOpening] = useState<{ list: Box[]; from: DOMRect | null } | null>(null)
  const here = (q: number): Box => ({ level: v.level, q: q as Box['q'] })
  const stateOf = (q: number): BoxState => (v.top || opened.includes(q) ? 'open' : q < reached ? 'ready' : 'locked')
  const waiting: Box[] = [...missed, ...[0, 1, 2].filter((q) => stateOf(q) === 'ready').map(here)]
  const nextLocked = [0, 1, 2, 3].find((q) => stateOf(q) === 'locked')
  const xpTo = (q: number) => Math.max(0, Math.ceil(((q + 1) / 4) * v.need - v.into))

  const open = (list: Box[], from: HTMLElement | null) => {
    if (!list.length || opening) return
    setOpening({ list, from: from?.getBoundingClientRect() ?? null })
  }
  const collected = (list: Box[]) => {
    setOpened((o) => [...o, ...list.filter((b) => b.level === v.level).map((b) => b.q)])
    setMissed((ms) => ms.filter((x) => !list.some((b) => same(b, x))))
    setOpening(null)
  }

  const next = v.level + 1
  const prize = v.top ? null : { coins: v.nextCoins, garment: v.gift, extra: levelExtra(next) }
  const before = Math.max(0, v.into - v.gain) / v.need
  const left = v.need - v.into

  return (
    <LevelSheet name="v-level-f" label={`Level ${v.level}`} top={v.top} scrolls onClose={onClose}>
      <m.header className="lf-head" variants={ITEM}>
        <Star level={v.level} />
        <h2>Level {v.level}</h2>
        {boxes.reached && <Reached v={v} />}
        <m.button className="close" onClick={onClose} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <div className="lf-body" data-scroll>
        <m.section className={`lf-hero${share >= 0.75 && !v.top ? ' warm' : ''}`} variants={ITEM} aria-label="How far into the level">
          <div className="lf-count">
            <b className="lf-pct">
              <Count from={still ? share * 100 : before * 100} to={share * 100} delay={0.3} duration={0.9} format={(n) => `${Math.round(n)}%`} />
            </b>
            <span className="lf-say">
              {v.top ? (
                'Every level reached'
              ) : share < 0.5 ? (
                <>
                  <b>{v.into}</b> XP so far
                </>
              ) : (
                <>
                  <b>{left}</b> XP to level {next}
                </>
              )}
            </span>
            {v.gain > 0 && !v.top && (
              <m.span className="lf-gain" initial={{ opacity: 0, y: 8, scale: 0.7 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...SPRING.pop, delay: 1 }}>
                +{v.gain} new
              </m.span>
            )}
          </div>
          <div className="lf-track">
            <div className="lf-rail">
              {[0, 1, 2, 3].map((q) => (
                <GiftBox key={q} q={q} state={stateOf(q)} prize={boxPrize(here(q))} xp={nextLocked === q ? xpTo(q) : null} last={q === 3} onOpen={(el) => open([here(q)], el)} />
              ))}
              <Bar v={v} before={before} />
            </div>
            <span className="lf-goal" aria-label={v.top ? 'The top level' : `Level ${next}`}>
              {v.top ? <img className="art" src={art('trophy')} alt="" /> : <Star level={next} />}
            </span>
          </div>
        </m.section>
        <div className="lf-low">
          {prize ? <Next level={next} prize={prize} /> : <Top />}
          <AnimatePresence mode="popLayout" initial={false}>
            {waiting.length > 0 ? (
              <m.button
                key="open"
                className="btn primary lf-open"
                variants={ITEM}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.95, y: 3 }}
                onClick={(e) => open(waiting, e.currentTarget)}
                aria-label={`Open ${waiting.length} gift${waiting.length === 1 ? '' : 's'}`}
              >
                <span className="lf-open-pic" aria-hidden="true">
                  <img className="art" src={art('wrapped-gift')} alt="" />
                  <b>{waiting.length}</b>
                </span>
                <span className="lf-open-words">
                  Open {waiting.length === 1 ? 'your gift' : `${waiting.length} gifts`}
                  {missed.length > 0 && <small>{missed.length === waiting.length ? 'from earlier levels' : `${missed.length} from earlier levels`}</small>}
                </span>
              </m.button>
            ) : nextLocked !== undefined && !v.top ? (
              <m.p key="next" className="lf-hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: 0.2 }}>
                <img className="art" src={art('wrapped-gift')} alt="" />
                <span className="lf-hint-words">
                  {nextLocked === 3 ? `Last gift: level ${next}` : `Next gift: ${(nextLocked + 1) * 25}%`}
                  <small>{xpTo(nextLocked)} XP to go</small>
                </span>
                {v.ready && (
                  <span className="lf-ready" aria-label={`${v.ready.n} ready on the farm: ${v.ready.xp} XP`}>
                    <ItemPic id={v.ready.id} count={v.ready.n} />+{v.ready.xp} XP
                  </span>
                )}
              </m.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>{opening && <Opening key="opening" list={opening.list} from={opening.from} onDone={() => collected(opening.list)} />}</AnimatePresence>
    </LevelSheet>
  )
}

/** The game's star with a level on it. */
const Star = ({ level }: { level: number }) => (
  <span className="lf-star" aria-hidden="true">
    <img className="art" src={art('glowing-star')} alt="" />
    <b className={level > 99 ? 'long' : ''}>{level}</b>
  </span>
)

/** The bar of the level: a dark track, a glossy fill that runs from where it was to where it is (what was gained lit),
 *  the quarters marked, the numbers inside, a ghost of what is ready on the farm. */
function Bar({ v, before }: { v: LevelState; before: number }) {
  const still = useReducedMotion()
  const share = v.top ? 1 : v.into / v.need
  const ghost = v.ready && !v.top ? Math.min(1, (v.into + v.ready.xp) / v.need) : share
  return (
    <span
      className={`lf-bar${share >= 0.75 && !v.top ? ' warm' : ''}${v.top ? ' done' : ''}`}
      role="progressbar"
      aria-label={v.top ? 'The top level' : `Level ${v.level}: XP to level ${v.level + 1}`}
      aria-valuemin={0}
      aria-valuemax={v.need}
      aria-valuenow={v.into}
    >
      <span className="lf-track-in">
        {ghost > share && <m.i className="lf-ghost" style={{ left: pct(share), width: pct(ghost - share) }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} />}
        <m.span className="lf-fill" initial={{ width: still ? pct(share) : pct(before) }} animate={{ width: pct(Math.max(share, 0.04)) }} transition={{ delay: 0.35, duration: 0.9, ease: EASE.out }}>
          <i className="lf-stripes" />
          <i className="lf-tip" />
        </m.span>
        {v.gain > 0 && !v.top && (
          <m.i className="lf-gained" style={{ left: pct(before), width: pct(share - before) }} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.55] }} transition={{ delay: 1, duration: 0.9 }} />
        )}
        {[0.25, 0.5, 0.75].map((q) => (
          <i key={q} className={`lf-notch${share >= q ? ' passed' : ''}`} style={{ left: pct(q) }} />
        ))}
      </span>
      <span className="lf-nums">
        {v.top ? (
          'MAX'
        ) : (
          <>
            <Count from={still ? v.into : Math.max(0, v.into - v.gain)} to={v.into} delay={0.35} duration={0.9} /> / {v.need}
          </>
        )}
      </span>
    </span>
  )
}

/** A box on the bar, at its quarter's end: locked (grey, how far when it is the next), ready (it glows and hops; a tap
 *  opens it), or open (what it gave, with a ✓). */
function GiftBox({ q, state, prize, xp, last, onOpen }: { q: number; state: BoxState; prize: Prize; xp: number | null; last: boolean; onOpen: (el: HTMLElement) => void }) {
  const still = useReducedMotion()
  const style = { '--at': `${(q + 1) * 25}%` } as CSSProperties
  if (state === 'open')
    return (
      <m.span
        className="lf-box open"
        style={style}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.pop}
        aria-label={`Gift ${q + 1}: ${prizeWords(prize)}, taken`}
      >
        <PrizePic p={prize} />
        <i className="lf-box-check">
          <Check weight="bold" />
        </i>
      </m.span>
    )
  if (state === 'ready')
    return (
      <m.button
        className="lf-box ready"
        style={style}
        onClick={(e) => onOpen(e.currentTarget)}
        aria-label={`Open gift ${q + 1}`}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={still ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, y: [0, -7, 0, -3, 0], rotate: [0, -6, 5, -2, 0] }}
        transition={{
          scale: SPRING.pop,
          opacity: { duration: 0.2 },
          y: { delay: 1.4 + q * 0.25, duration: 0.7, repeat: Infinity, repeatDelay: 1.8 },
          rotate: { delay: 1.4 + q * 0.25, duration: 0.7, repeat: Infinity, repeatDelay: 1.8 },
        }}
        whileTap={{ scale: 0.88 }}
      >
        <i className="lf-box-glow" aria-hidden="true" />
        <img className="art" src={art('wrapped-gift')} alt="" />
        <i className="lf-box-dot" aria-hidden="true" />
      </m.button>
    )
  return (
    <span className={`lf-box locked${last ? ' last' : ''}`} style={style} aria-label={xp !== null ? `Gift ${q + 1}: ${xp} XP away` : `Gift ${q + 1}: locked`}>
      <img className="art" src={art('wrapped-gift')} alt="" />
      <i className="lf-box-lock">
        <LockSimple weight="fill" />
      </i>
      {xp !== null && <small className="lf-box-xp">{xp} XP</small>}
    </span>
  )
}

/** What the next level brings, by itself: its coins, its garment every fifth level, and a small surprise. */
function Next({ level, prize }: { level: number; prize: { coins: number; garment?: LevelState['gift']; extra: Prize } }) {
  return (
    <m.section className={`level-next lf-next${prize.garment ? ' gift' : ''}`} variants={ITEM} aria-label={`What level ${level} brings`}>
      <span className="lf-next-light" aria-hidden="true" />
      <h3>At level {level}</h3>
      <div className="lf-next-row">
        {prize.garment && (
          <span className="lf-next-garment">
            <GarmentPic g={prize.garment} />
          </span>
        )}
        <span className="lf-next-coins">
          <img className="art" src={art('coin')} alt="" />+{prize.coins}
        </span>
        <span className="lf-next-extra" aria-label="and a surprise">
          <img className="art" src={art('wrapped-gift')} alt="" />
          <b>?</b>
        </span>
      </div>
      {prize.garment && <b className="lf-next-name">{prize.garment.name}</b>}
      <span className="tag ok lf-auto">
        <Check weight="bold" /> Comes by itself
      </span>
    </m.section>
  )
}

const Top = () => (
  <m.section className="lf-next top" variants={ITEM}>
    <span className="lf-next-light" aria-hidden="true" />
    <img className="art lf-trophy" src={art('trophy')} alt="" />
    <b className="lf-next-name">The top level</b>
    <span className="tag ok">Every level reached</span>
  </m.section>
)

/** The level just reached by play: what it brought came in by itself (no Claim), said once at the top of the card. */
function Reached({ v }: { v: LevelState }) {
  const extra = levelExtra(v.level)
  const coins = levelReward(v.level)
  return (
    <m.section
      className="lf-reached"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING.pop, delay: 0.15 }}
      aria-label={`Level ${v.level} reached: ${coins} coins came in`}
    >
      <span className="lf-reached-badge">
        <Check weight="bold" />
      </span>
      <span className="lf-reached-words">
        <b>Level {v.level} reached!</b>
        <small>Came in by itself</small>
      </span>
      <span className="lf-reached-got">
        <span className="farm-coins">
          <img src={art('coin')} alt="" />+<CountUp to={coins} duration={0.8} />
        </span>
        <PrizePic p={extra} />
      </span>
    </m.section>
  )
}

/**
 * Opening: in the middle of the card the box (or the boxes) grow from where they stood, shake as the light gathers,
 * burst into their prizes, and wait for a tap: Collect sends them home.
 */
function Opening({ list, from, onDone }: { list: Box[]; from: DOMRect | null; onDone: () => void }) {
  const still = useReducedMotion()
  const [phase, setPhase] = useState<'shake' | 'open'>(still ? 'open' : 'shake')
  const stage = useRef<HTMLDivElement>(null)
  const prizes = list.map(boxPrize)
  const coins = prizes.reduce((n, p) => n + ('coins' in p ? p.coins : 0), 0)
  const one = list.length === 1
  // where the box flew from, as an offset from the middle of the stage (the box grows from its place on the bar)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const r = stage.current?.getBoundingClientRect()
    if (r && from) setOffset({ x: from.left + from.width / 2 - (r.left + r.width / 2), y: from.top + from.height / 2 - (r.top + r.height * 0.42) })
  }, [from])
  useEffect(() => {
    if (still) return
    const t = setTimeout(() => {
      setPhase('open')
      if (stage.current) burst(stage.current, { count: one ? 46 : 70, spread: 80, power: 26 })
    }, 820)
    return () => clearTimeout(t)
  }, [still, one])
  const collect = () => {
    if (phase !== 'open') return
    const r = stage.current?.getBoundingClientRect()
    if (r && coins > 0 && !still) flyCoins(r.left + r.width / 2, r.top + r.height * 0.42, coinsToFly(coins))
    onDone()
  }
  return (
    <m.div
      className="lf-opening"
      role="dialog"
      aria-label={one ? 'Your gift' : `${list.length} gifts`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={collect}
    >
      <div className="lf-opening-stage" ref={stage}>
        <m.span
          className="lf-opening-rays"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={phase === 'open' ? { opacity: 1, scale: 1 } : { opacity: 0.35, scale: 0.55 }}
          transition={SPRING.soft}
        />
        <AnimatePresence mode="popLayout">
          {phase === 'shake' ? (
            <m.div key="boxes" className={`lf-opening-row${one ? ' one' : ''}`} exit={{ opacity: 0, scale: 1.25, transition: { duration: 0.12 } }}>
              {list.map((b, i) => (
                <m.img
                  key={`${b.level}-${b.q}`}
                  className="art lf-opening-box"
                  src={art('wrapped-gift')}
                  alt=""
                  initial={offset && one ? { x: offset.x, y: offset.y, scale: 0.35 } : { scale: 0.3, opacity: 0 }}
                  animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: [0, 0, -9, 9, -11, 11, -6, 0] }}
                  transition={{ x: SPRING.sheet, y: SPRING.sheet, scale: { ...SPRING.soft, delay: i * 0.05 }, opacity: { duration: 0.15 }, rotate: { delay: 0.32, duration: 0.48, ease: 'easeInOut' } }}
                />
              ))}
            </m.div>
          ) : (
            <m.div key="prizes" className={`lf-opening-row${one ? ' one' : ''}`} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: still ? 0 : 0.12 } } }}>
              {prizes.map((p, i) => (
                <m.span key={i} className="lf-opening-prize" variants={{ hidden: { opacity: 0, scale: 0.2, y: 30 }, show: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } }}>
                  <PrizePic p={p} big={one} />
                  {one && <b className="lf-opening-name">{prizeWords(p)}</b>}
                </m.span>
              ))}
            </m.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {phase === 'open' && (
          <m.div className="lf-opening-foot" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: still ? 0 : 0.18 + prizes.length * 0.1 }}>
            {!one && coins > 0 && (
              <span className="lf-opening-total">
                <img className="art" src={art('coin')} alt="" />+<CountUp to={coins} duration={0.6} />
              </span>
            )}
            <m.button className="btn primary lf-collect" onClick={collect} {...PRESS}>
              {one ? 'Collect' : 'Collect all'}
            </m.button>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  )
}
