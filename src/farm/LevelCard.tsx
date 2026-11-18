import { AnimatePresence, m } from 'motion/react'
import { lessMotion, useLessMotion } from '../ui/still'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { flyCoins, flyItem } from '../fx/coins'
import { coinsToFly } from '../fx/fx'
import { art } from '../ui/art'
import { burst } from '../ui/burst'
import { GarmentPic } from '../ui/GarmentPic'
import { Check, LockSimple } from '../ui/glyphs'
import { ItemPic } from '../ui/ItemPic'
import { CountUp, EASE, ITEM, POP, SINK, SPRING } from '../ui/motion'
import { PanelSheet } from '../ui/PanelSheet'
import { storeOf, type ProduceId } from './data'
import { boxOdds } from './daily'
import { Odds } from './DailyCard'
import { isBox, prizeWords, type Opened, type Prize } from './gifts'
import { iconUrl } from './icons'
import type { BoxView, LevelView } from './levelView'
import { UnlockRow } from './Unlocked'
import './LevelCard.css'

// How the level's card looks (the design layer: the design lab, lab/boards/level, shows it with no game round it; the
// user chose its look F). What it shows is ./levelView.ts, made from the farm by ./LevelPanel.tsx.
//
// The hero is the level's bar, cut into four quarters, a gift box standing on each quarter's end: grey and locked until
// the bar reaches it (the next one says how many XP it is away: a goal always near), then glowing, hopping and ready
// to open with one tap, then open — what it gave in its place with a ✓. Over the bar the big share and the words that
// matter (what is done below half, what is left past it); on the bar what was gained since the card was last open, lit,
// and a striped ghost of what is ready on the farm. At its end the next level's star; under it what that level brings:
// its coins, its garment every fifth level (else when the next one comes), and a gift that comes by itself. At the foot
// one press when boxes wait (this level's or any before): "Open 3 gifts", which opens them all. A level reached says so
// at the top, with the gift it brought and its coins to claim.
//
// Opening is one clear moment in the middle of the card: the box flies there from where it stood and grows; it shakes
// as light gathers behind it; it bursts open (the rays, a little confetti) and the prize comes up out of it, big, with
// its name; Collect (or a tap) sends it home — coins to the coin chip, goods to their building's chip. Several open
// together: a row of boxes shaking, then their prizes popping one after another, the coins together and each good
// together. What a box gives is the farm's at the
// tap (onOpen): closing the card at any moment loses nothing.

const pct = (n: number) => `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`
const quiet = lessMotion

/** A prize's picture: coins with their count, or a good with its count. */
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

/** Many prizes as few pictures: the coins together, each good together (several boxes opened at once). */
function together(list: Prize[]): Prize[] {
  const coins = list.reduce((n, p) => n + ('coins' in p ? p.coins : 0), 0)
  const goods = new Map<ProduceId, number>()
  for (const p of list) if (!('coins' in p)) goods.set(p.item, (goods.get(p.item) ?? 0) + p.n)
  return [...(coins ? [{ coins }] : []), ...[...goods].map(([item, n]) => ({ item, n }))]
}

/** What a gift box can hold and how likely (src/farm/gifts.ts, GIFT_ODDS): the "?" in the bar's row. */
const BOX_ODDS = boxOdds()

export function LevelCard({
  v,
  onOpen,
  onClose,
  onReveal,
}: {
  v: LevelView
  onOpen: (boxes: number[]) => Opened[]
  onClose: () => void
  /** the moment a gift bursts open (its sound and touch) */
  onReveal?: () => void
}) {
  const still = useLessMotion()
  const share = v.top ? 1 : v.into / v.need
  const before = Math.max(0, v.into - v.gain) / v.need
  const next = v.level + 1
  const left = v.need - v.into
  const [opening, setOpening] = useState<{ got: Opened[]; from: DOMRect | null } | null>(null)
  const nextLocked = v.boxes.find((b) => b.state === 'locked')

  const open = (boxes: number[], from: HTMLElement | null) => {
    if (!boxes.length || opening) return
    const got = onOpen(boxes)
    if (got.length) setOpening({ got, from: from?.getBoundingClientRect() ?? null })
  }

  return (
    // the sheet's head: the star with the level on it and "Level N" (src/ui/PanelSheet.tsx); a level just reached says
    // so in a row of its own at the top of the sheet
    <PanelSheet label={`Level ${v.level}`} title={`Level ${v.level}`} pic={<Star level={v.level} />} className="level-card" onClose={onClose}>
      {v.arrived && <Reached level={v.level} came={v.arrived} />}
      <m.section className={`lf-hero${share >= 0.75 && !v.top ? ' warm' : ''}`} variants={ITEM} aria-label="How far into the level">
        <div className="lf-count">
          <b className="lf-pct">{v.top ? '100%' : <Count from={still ? share * 100 : before * 100} to={share * 100} delay={0.3} duration={0.9} format={(n) => `${Math.round(n)}%`} />}</b>
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
          {!v.top && <Odds rows={BOX_ODDS} label="What a gift box can hold" className="lf-odds end" />}
        </div>
        <div className="lf-track">
          <div className="lf-rail">
            {/* (the first levels have one box, half way: src/farm/gifts.ts, quartersOf) */}
            {v.boxes
              .filter((b) => isBox(b.box))
              .map((b) => (
                <GiftBox key={b.q} b={b} next={nextLocked?.q === b.q} onOpen={(el) => open([b.box], el)} />
              ))}
            <Bar v={v} before={before} />
          </div>
          <span className="lf-goal" aria-label={v.top ? 'The top level' : `Level ${next}`}>
            {v.top ? <img className="art" src={art('trophy')} alt="" /> : <Star level={next} />}
          </span>
        </div>
      </m.section>
      <div className="lf-low">
        {v.top ? <Top /> : <Next v={v} />}
        <AnimatePresence mode="popLayout" initial={false}>
          {v.waiting.length > 0 ? (
            <m.button
              key="open"
              className="btn primary lf-open"
              variants={ITEM}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              {...SINK}
              onClick={(e) => open(v.waiting, e.currentTarget)}
              aria-label={`Open ${v.waiting.length} gift${v.waiting.length === 1 ? '' : 's'}`}
            >
              <span className="lf-open-pic" aria-hidden="true">
                <img className="art" src={art('wrapped-gift')} alt="" />
                <b>{v.waiting.length}</b>
              </span>
              <span className="lf-open-words">
                Open {v.waiting.length === 1 ? 'your gift' : `${v.waiting.length} gifts`}
                {v.earlier > 0 && <small>{v.earlier === v.waiting.length ? 'from earlier levels' : `${v.earlier} from earlier levels`}</small>}
              </span>
            </m.button>
          ) : nextLocked && !v.top ? (
            <m.p key="next" className="lf-hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: 0.2 }}>
              <img className="art" src={art('wrapped-gift')} alt="" />
              <span className="lf-hint-words">
                {nextLocked.q === 3 ? `Last gift: level ${next}` : `Next gift: ${(nextLocked.q + 1) * 25}%`}
                <small>{nextLocked.xp} XP to go</small>
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
      <AnimatePresence>{opening && <Opening key="opening" got={opening.got} from={opening.from} onReveal={onReveal} onDone={() => setOpening(null)} />}</AnimatePresence>
    </PanelSheet>
  )
}

/** A number that counts from `from` to `to`, starting after `delay` s (the bar's share and its XP fill together). */
function Count({ from, to, delay = 0, duration = 0.8, format }: { from: number; to: number; delay?: number; duration?: number; format?: (n: number) => string }) {
  const [go, setGo] = useState(delay <= 0)
  useEffect(() => {
    if (delay <= 0) return
    const t = setTimeout(() => setGo(true), delay * 1000)
    return () => clearTimeout(t)
  }, [delay])
  return go ? <CountUp from={from} to={to} duration={duration} format={format ?? ((n) => String(Math.round(n)))} /> : <span>{(format ?? ((n: number) => String(Math.round(n))))(from)}</span>
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
function Bar({ v, before }: { v: LevelView; before: number }) {
  const still = useLessMotion()
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

/** A box on the bar, at its quarter's end: locked (grey; the next one says how far), ready (it glows and hops; a tap
 *  opens it), or open (what it gave, with a ✓). */
function GiftBox({ b, next, onOpen }: { b: BoxView; next: boolean; onOpen: (el: HTMLElement) => void }) {
  const still = useLessMotion()
  const style = { '--at': `${(b.q + 1) * 25}%` } as CSSProperties
  if (b.state === 'open')
    return (
      <m.span
        className={`lf-box open${b.prize ? '' : ' plain'}`}
        style={style}
        variants={POP}
        initial="hidden"
        animate="show"
        aria-label={b.prize ? `Gift ${b.q + 1}: ${prizeWords(b.prize)}, taken` : `Gift ${b.q + 1}: taken`}
      >
        {b.prize ? <PrizePic p={b.prize} /> : <img className="art" src={art('wrapped-gift')} alt="" />}
        <i className="lf-box-check">
          <Check weight="bold" />
        </i>
      </m.span>
    )
  if (b.state === 'ready')
    return (
      <m.button
        className="lf-box ready"
        style={style}
        onClick={(e) => onOpen(e.currentTarget)}
        aria-label={`Open gift ${b.q + 1}`}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={still ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, y: [0, -7, 0, -3, 0], rotate: [0, -6, 5, -2, 0] }}
        transition={{
          scale: SPRING.pop,
          opacity: { duration: 0.2 },
          y: { delay: 1.4 + b.q * 0.25, duration: 0.7, repeat: Infinity, repeatDelay: 1.8 },
          rotate: { delay: 1.4 + b.q * 0.25, duration: 0.7, repeat: Infinity, repeatDelay: 1.8 },
        }}
        whileTap={{ scale: 0.86 }}
        whileHover={{ scale: 1.08 }}
      >
        <i className="lf-box-glow" aria-hidden="true" />
        <img className="art" src={art('wrapped-gift')} alt="" />
        <i className="lf-box-dot" aria-hidden="true" />
      </m.button>
    )
  return (
    <span className={`lf-box locked${b.q === 3 ? ' last' : ''}`} style={style} aria-label={next ? `Gift ${b.q + 1}: ${b.xp} XP away` : `Gift ${b.q + 1}: locked`}>
      <img className="art" src={art('wrapped-gift')} alt="" />
      <i className="lf-box-lock">
        <LockSimple weight="fill" />
      </i>
      {next && <small className="lf-box-xp">{b.xp} XP</small>}
    </span>
  )
}

/** What the next level brings, all of it by itself as it is reached: its coins, its garment every fifth level (else a
 *  small picture of the next garment and its level), and a gift; and under them, what it opens, a small card each. */
function Next({ v }: { v: LevelView }) {
  const next = v.level + 1
  return (
    <m.section className={`level-next lf-next${v.gift ? ' gift' : ''}`} variants={ITEM} aria-label={`What level ${next} brings`}>
      <span className="lf-next-light" aria-hidden="true" />
      <h3 className="ribbon">At level {next}</h3>
      <div className="lf-next-row">
        {v.gift && (
          <span className="lf-next-garment">
            <GarmentPic g={v.gift} />
          </span>
        )}
        <span className="lf-next-coins">
          <img className="art" src={art('coin')} alt="" />+{v.nextCoins}
        </span>
        <span className="lf-next-extra" aria-label="and a gift">
          <img className="art" src={art('wrapped-gift')} alt="" />
          <b>?</b>
        </span>
        {!v.gift && v.later && (
          <span className="level-later">
            <GarmentPic g={v.later} />
            <span>
              at <b>level {v.later.level}</b>
            </span>
          </span>
        )}
      </div>
      {v.gift && <b className="lf-next-name">{v.gift.name}</b>}
      <span className="tag ok lf-auto">
        <Check weight="bold" /> Comes by itself
      </span>
      {v.opens.length > 0 && <UnlockRow ids={v.opens} />}
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

/** The level just reached: what came in by itself (no Claim) — its coins, counting up, and its gift — told once. */
function Reached({ level, came }: { level: number; came: NonNullable<LevelView['arrived']> }) {
  return (
    <m.section
      className="lf-reached"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING.pop, delay: 0.15 }}
      aria-label={`Level ${level} reached: ${came.coins} coins and ${prizeWords(came.prize)} came in`}
    >
      <span className="lf-reached-badge">
        <Check weight="bold" />
      </span>
      <span className="lf-reached-words">
        <b>Level {level} reached!</b>
        <small>Came in by itself</small>
      </span>
      <span className="lf-reached-got">
        <span className="farm-coins">
          <img src={art('coin')} alt="" />+<CountUp to={came.coins} duration={0.8} />
        </span>
        <PrizePic p={came.prize} />
      </span>
    </m.section>
  )
}

/**
 * Opening: in the middle of the card the box (or the boxes) grow from where they stood, shake as the light gathers,
 * burst into their prizes, and wait for a tap: Collect sends them home.
 */
function Opening({ got, from, onReveal, onDone }: { got: Opened[]; from: DOMRect | null; onReveal?: () => void; onDone: () => void }) {
  const still = useLessMotion()
  const [phase, setPhase] = useState<'shake' | 'open'>(still ? 'open' : 'shake')
  const stage = useRef<HTMLDivElement>(null)
  const one = got.length === 1
  // several boxes at once show as their coins together and each good together (two boxes of bricks: one picture)
  const prizes = together(got.map((o) => o.prize))
  const boxes = Math.min(got.length, 6)
  // where the box flew from, as an offset from the middle of the stage (it grows from its place on the bar)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const r = stage.current?.getBoundingClientRect()
    if (r && from) setOffset({ x: from.left + from.width / 2 - (r.left + r.width / 2), y: from.top + from.height / 2 - (r.top + r.height * 0.42) })
  }, [from])
  // the reveal: at once for whoever prefers less motion, else after the shake
  const reveal = useRef(onReveal)
  useEffect(() => {
    if (still) {
      reveal.current?.()
      return
    }
    const t = setTimeout(() => {
      setPhase('open')
      reveal.current?.()
      if (stage.current) burst(stage.current, { count: one ? 46 : 70, spread: 80, power: 26 })
    }, 820)
    return () => clearTimeout(t)
  }, [still, one])
  // once: the Collect button's press would reach the stage's too
  const gone = useRef(false)
  const collect = () => {
    if (phase !== 'open' || gone.current) return
    gone.current = true
    const r = stage.current?.getBoundingClientRect()
    if (r && !quiet()) {
      const x = r.left + r.width / 2
      const y = r.top + r.height * 0.42
      prizes.forEach((p, k) => ('coins' in p ? flyCoins(x, y, coinsToFly(p.coins)) : flyItem(x, y, iconUrl(p.item), k, storeOf(p.item))))
    }
    onDone()
  }
  return (
    <m.div
      className="lf-opening"
      role="dialog"
      aria-label={one ? 'Your gift' : `${got.length} gifts`}
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
              {Array.from({ length: boxes }, (_, i) => (
                <m.img
                  key={i}
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
            <m.button className="btn primary lf-collect" onClick={collect} {...SINK}>
              {one ? 'Collect' : 'Collect all'}
            </m.button>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  )
}
