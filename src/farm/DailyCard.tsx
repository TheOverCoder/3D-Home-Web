import { AnimatePresence, m, useReducedMotion, type Variants } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { flyCoins, flyItem, holdCoins } from '../fx/coins'
import { coinsToFly } from '../fx/fx'
import { art } from '../ui/art'
import { burst } from '../ui/burst'
import { Check, X } from '../ui/glyphs'
import { ItemPic } from '../ui/ItemPic'
import { CountUp, EASE, ITEM, POP, PRESS, SINK, SPRING } from '../ui/motion'
import { SwipeSheet } from '../ui/SwipeSheet'
import { storeOf } from './data'
import { WEEK, type DailyView, type DayView, type Peek } from './daily'
import { prizeWords, type Prize } from './gifts'
import { iconUrl } from './icons'
import './DailyCard.css'

// How the daily gift's card looks (the design layer; the design lab's board "daily" shows it with no game round it).
// What it shows is ./daily.ts's view, made from the farm by ./DailyPanel.tsx.
//
// The hero is today's gift, big on a stage of light, the week's day on its ribbon; under it the week as a road of seven
// stops — the days taken checked with what they gave, today's glowing, the days to come peeking (a coin with what it
// will give, a plank, a basket), the seventh bigger, the big one. The streak is a flame in the title. One press: Claim.
//
// Claiming is the card's one moment: the box shakes as the light gathers, bursts open (a burst of confetti, its sound
// and a roll of the phone), and the gift comes up out of it, big, with its name; on the road today's stop is stamped,
// the line runs on to it and the flame counts the streak up; a moment later the gift flies to where it lives (coins to
// the coin chip, which counts them in as they land; goods to their building's chip), and the stage turns to tomorrow:
// what it will bring, so the visit ends looking forward. Done closes it. What the gift gives is the farm's at the press
// (onClaim): closing the card at any moment loses nothing (what is still on the stage flies as it goes).

/** The shake before it opens (ms): anticipation, short. */
const SHAKE_MS = 560
/** How long the gift stays on the stage, big, before it flies home (ms). */
const SHOW_MS = 1150

/** The moment of a claim: what it gave, where it is, and the card's view from before it (shown until it opens). */
interface Moment {
  got: Prize[]
  phase: 'shake' | 'open' | 'flown'
  before: DailyView
}

export function DailyCard({
  v,
  onClaim,
  onClose,
  onReveal,
}: {
  v: DailyView
  /** claims today's gift: what it gave (null: nothing to claim) */
  onClaim: () => Prize[] | null
  onClose: () => void
  /** the moment it bursts open (its sound and touch) */
  onReveal?: () => void
}) {
  const still = useReducedMotion()
  const [moment, setMoment] = useState<Moment | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const got = useRef<Prize[]>([])
  const held = useRef(0)
  const flown = useRef(false)
  const reveal = useRef(onReveal)
  reveal.current = onReveal
  // until it bursts open the card still shows the day as it was (the road, the streak): then they move on
  const shown = moment?.phase === 'shake' ? moment.before : v

  /** The gift home: coins to the coin chip (counted in as they land), goods to their building's chip. Once. */
  const fly = () => {
    if (flown.current || !got.current.length) return
    flown.current = true
    const r = stage.current?.getBoundingClientRect()
    if (r && r.width && !still) {
      const x = r.left + r.width / 2
      const y = r.top + r.height * 0.42
      got.current.forEach((p, k) => ('coins' in p ? flyCoins(x, y, coinsToFly(p.coins)) : flyItem(x, y, iconUrl(p.item), k, storeOf(p.item))))
    }
    holdCoins(-held.current)
    held.current = 0
  }
  // gone before they flew (closed, the farm changed): the coins held back are the chip's again
  useEffect(
    () => () => {
      if (held.current) holdCoins(-held.current)
      held.current = 0
    },
    [],
  )

  const claim = () => {
    if (moment || !v.ready) return
    const list = onClaim()
    if (!list?.length) return
    got.current = list
    const coins = list.reduce((n, p) => n + ('coins' in p ? p.coins : 0), 0)
    if (!still && coins) {
      holdCoins(coins)
      held.current = coins
    }
    setMoment({ got: list, phase: still ? 'open' : 'shake', before: v })
    if (still) reveal.current?.()
  }

  // shake → open (the burst) → home
  const phase = moment?.phase
  useEffect(() => {
    if (phase === 'shake') {
      const t = window.setTimeout(() => {
        setMoment((x) => x && { ...x, phase: 'open' })
        reveal.current?.()
        const big = got.current.length > 1
        if (stage.current) burst(stage.current, { count: big ? 110 : 54, spread: big ? 110 : 80, power: big ? 34 : 27 })
      }, SHAKE_MS)
      return () => window.clearTimeout(t)
    }
    if (phase === 'open' && !still) {
      const t = window.setTimeout(() => {
        fly()
        setMoment((x) => x && { ...x, phase: 'flown' })
      }, SHOW_MS)
      return () => window.clearTimeout(t)
    }
    // (fly reads refs only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, still])

  const close = () => {
    fly()
    onClose()
  }
  const big = shown.ready && shown.day === WEEK
  const streak = shown.ready ? shown.was : shown.streak
  const done = !!moment && moment.phase !== 'shake'

  return (
    <SwipeSheet name="daily-card" label="Daily gift" onClose={close}>
      <m.header className="dg-head" variants={ITEM}>
        <img className="art dg-head-art" src={art('tear-off-calendar')} alt="" />
        <h2>Daily gift</h2>
        <Streak n={streak} />
        <m.button className="close" onClick={close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>

      <m.div className={`dg-stage${big ? ' big' : ''}${phase ? ` ${phase}` : ''}`} variants={ITEM} ref={stage}>
        <m.span
          className="dg-rays"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={phase === 'open' ? { opacity: 1, scale: 1.25 } : phase === 'shake' ? { opacity: 0.95, scale: 1.08 } : { opacity: shown.ready ? 0.7 : 0.35, scale: 1 }}
          transition={SPRING.soft}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          {phase === 'open' ? (
            <Prizes key="prizes" got={got.current} still={!!still} />
          ) : phase === 'flown' || (!moment && !shown.ready) ? (
            <Tomorrow key="tomorrow" v={v} />
          ) : (
            <TodayBox key="box" day={shown.day} big={big} shaking={phase === 'shake'} />
          )}
        </AnimatePresence>
        {phase === 'open' && !still && (
          <m.i className="dg-flash" aria-hidden="true" initial={{ opacity: 0.9, scale: 0.3 }} animate={{ opacity: 0, scale: 1.7 }} transition={{ duration: 0.5, ease: EASE.out }} />
        )}
        <span className="dg-say" role="status">
          {done ? `You got ${got.current.map(prizeWords).join(', ')}` : ''}
        </span>
      </m.div>

      <Road v={shown} today={moment ? moment.before.day : null} />

      <m.div className="dg-act" variants={ITEM}>
        <AnimatePresence mode="popLayout" initial={false}>
          {!done && shown.ready ? (
            <m.button
              key="claim"
              className={`btn primary dg-claim${phase === 'shake' ? ' opening' : ''}`}
              aria-label={big ? 'Claim the big gift' : 'Claim today’s gift'}
              aria-disabled={phase === 'shake' || undefined}
              onClick={claim}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.14 } }}
              {...SINK}
            >
              <img className="art" src={art('wrapped-gift')} alt="" />
              Claim
            </m.button>
          ) : (
            <m.button
              key="done"
              className="btn primary dg-done"
              onClick={close}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING.pop, delay: still ? 0 : 0.18 }}
              whileTap={SINK.whileTap}
            >
              Done
            </m.button>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={lineOf(shown, done)}
            className="dg-line"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.22, ease: EASE.out }}
          >
            {lineOf(shown, done)}
          </m.p>
        </AnimatePresence>
      </m.div>
    </SwipeSheet>
  )
}

/** The one line under the button: what this day means (a streak that waited, a new week, how far the big gift is),
 *  or, once claimed, what tomorrow brings. */
function lineOf(v: DailyView, done: boolean): string {
  if (done || !v.ready) return v.tomorrow === 1 ? 'A new week starts tomorrow.' : v.tomorrow === WEEK ? 'Tomorrow: the big gift!' : `Come back tomorrow for day ${v.tomorrow}.`
  if (v.kept) return 'You missed a day: your streak waited.'
  if (v.broke) return 'A new week begins.'
  if (v.first) return 'A gift every day. Day 7 is a big one!'
  if (v.day === WEEK) return 'The big gift of the week!'
  const left = WEEK - v.day
  return left === 1 ? '1 more day to the big gift.' : `${left} more days to the big gift.`
}

/** The streak: a flame and the days in a row. It counts up as the gift opens; a new streak pops in. */
function Streak({ n }: { n: number }) {
  // the number it counts from: the one before the last change (kept across the card's other changes)
  const seen = useRef({ n, from: n })
  if (seen.current.n !== n) seen.current = { n, from: seen.current.n }
  const from = Math.min(seen.current.from, n)
  return (
    <AnimatePresence initial={false}>
      {n > 0 && (
        <m.span key="streak" className="dg-streak" aria-label={`Streak: ${n} day${n === 1 ? '' : 's'} in a row`} title="Days in a row" variants={POP} initial="hidden" animate="show" exit="out">
          <m.img
            key={n}
            className="art"
            src={art('fire')}
            alt=""
            initial={from < n ? { scale: 0.5, rotate: -16 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...SPRING.pop, delay: 0.12 }}
          />
          <b>{from < n ? <CountUp from={from} to={n} duration={0.6} /> : n}</b>
          <small>{n === 1 ? 'day' : 'days'}</small>
        </m.span>
      )}
    </AnimatePresence>
  )
}

/** Today's gift on its stage: it drops in and wobbles now and then; it shakes before it opens. The big one is bigger,
 *  with sparkles. */
function TodayBox({ day, big, shaking }: { day: number; big: boolean; shaking: boolean }) {
  return (
    <m.div className="dg-today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.35, transition: { duration: 0.14 } }}>
      {big && (
        <>
          <img className="art dg-sparkles left" src={art('sparkles')} alt="" />
          <img className="art dg-sparkles right" src={art('sparkles')} alt="" />
        </>
      )}
      <m.span
        className="dg-drop"
        initial={{ y: -40, scale: 0.5, opacity: 0 }}
        animate={{ y: 0, scale: shaking ? 1.14 : 1, opacity: 1 }}
        transition={{ y: { ...SPRING.soft, delay: 0.1 }, scale: shaking ? SPRING.pop : { ...SPRING.soft, delay: 0.1 }, opacity: { duration: 0.18, delay: 0.1 } }}
      >
        <m.img
          className="art dg-box"
          src={art('wrapped-gift')}
          alt=""
          animate={shaking ? { y: 0, rotate: [0, -9, 9, -12, 12, -9, 7, 0] } : { y: [0, -10, 0, -4, 0], rotate: [0, -7, 6, -3, 0] }}
          transition={
            shaking
              ? { y: { duration: 0.1 }, rotate: { duration: SHAKE_MS / 1000, ease: 'easeInOut' } }
              : { duration: 0.9, delay: 1, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut', times: [0, 0.3, 0.55, 0.8, 1] }
          }
        />
      </m.span>
      <b className="dg-ribbon">{big ? 'Day 7 · Big gift' : `Day ${day}`}</b>
    </m.div>
  )
}

const RISE: Variants = { hidden: { opacity: 0, scale: 0.2, y: 26 }, show: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } }

/** What came out of the box, big: coins with how many, a good with its count; one prize says its name. */
function Prizes({ got, still }: { got: Prize[]; still: boolean }) {
  const one = got.length === 1
  return (
    <m.div
      className={`dg-prizes${one ? ' one' : ''}`}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.7, y: -18, transition: { duration: 0.22, ease: EASE.out } }}
      variants={{ show: { transition: { staggerChildren: still ? 0 : 0.11 } } }}
    >
      {got.map((p, i) => (
        <m.span key={i} className="dg-prize" variants={RISE}>
          {'coins' in p ? (
            <span className="dg-coins">
              <img className="art" src={art('coin')} alt="" />
              <b>+{p.coins}</b>
            </span>
          ) : (
            <ItemPic id={p.item} count={p.n} />
          )}
          {one && <b className="dg-prize-name">{prizeWords(p)}</b>}
        </m.span>
      ))}
    </m.div>
  )
}

/** Tomorrow on the stage once today's is home: its day, and what it will be (a peek). */
function Tomorrow({ v }: { v: DailyView }) {
  const day = v.week[v.tomorrow - 1]
  const big = v.tomorrow === WEEK
  return (
    <m.div className={`dg-tomorrow${big ? ' big' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ...SPRING.pop, delay: 0.25 }}>
      <span className="dg-tomorrow-box">
        <img className="art" src={art('wrapped-gift')} alt="" />
        {day && <PeekBadge peek={day.peek} />}
      </span>
      <span className="dg-tomorrow-words">
        <b>Tomorrow</b>
        <small>{big ? 'Day 7 · the big gift' : `Day ${v.tomorrow}`}</small>
      </span>
    </m.div>
  )
}

/** A day to come, peeking: what it will give — coins (how many), a building material, goods from the farm, or the big
 *  one. */
function PeekBadge({ peek }: { peek: Peek }) {
  if (peek.kind === 'coins')
    return (
      <i className="dg-peek coins" aria-label={`${peek.coins} coins`}>
        <img src={art('coin')} alt="" />
      </i>
    )
  if (peek.kind === 'material')
    return (
      <i className="dg-peek" aria-label="A building material">
        <img src={iconUrl('plank')} alt="" />
      </i>
    )
  if (peek.kind === 'goods')
    return (
      <i className="dg-peek" aria-label="Goods from your farm">
        <img src={art('basket')} alt="" />
      </i>
    )
  return (
    <i className="dg-peek big" aria-label="The big gift">
      <img src={art('sparkles')} alt="" />
    </i>
  )
}

const ROAD: Variants = { show: { transition: { delayChildren: 0.08, staggerChildren: 0.04 } } }
const STOP: Variants = { hidden: { opacity: 0, y: 10, scale: 0.7 }, show: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop } }

/** The week as a road: seven stops on a line that fills up to the last day taken (and runs on to today's as it is
 *  claimed: `today`, the day the moment is about). */
function Road({ v, today }: { v: DailyView; today: number | null }) {
  const past = v.week.filter((d) => d.state === 'past').length
  const now = v.week.find((d) => d.state === 'today')?.day ?? 0
  // the line from the first stop's middle to the last's: filled to the last day taken; striped on to today's
  const at = (day: number) => (day <= 1 ? 0 : (day - 1) / (WEEK - 1))
  return (
    <m.ol className="dg-road" variants={ROAD} aria-label={`This week: day ${v.day} of ${WEEK}`}>
      <span className="dg-line-track" aria-hidden="true">
        {now > 1 && <i className="dg-line-next" style={{ width: `${at(now) * 100}%` }} />}
        <m.i className="dg-line-fill" initial={false} animate={{ scaleX: at(past) }} transition={{ duration: 0.55, ease: EASE.out, delay: 0.12 }} />
      </span>
      {v.week.map((d) => (
        <Stop key={d.day} d={d} now={d.day === today && d.state === 'past'} />
      ))}
    </m.ol>
  )
}

/** A stop of the road: a day taken (what it gave, with a ✓), today's (glowing), or one to come (its peek). */
function Stop({ d, now }: { d: DayView; now: boolean }) {
  const big = d.day === WEEK
  const pic = d.got?.[0]
  const words = d.state === 'past' ? `Day ${d.day}: ${d.got ? d.got.map(prizeWords).join(', ') : 'taken'}` : d.state === 'today' ? `Day ${d.day}: today` : `Day ${d.day}`
  return (
    <m.li className={`dg-stop ${d.state}${big ? ' big' : ''}${now ? ' now' : ''}`} variants={STOP} aria-label={words}>
      <span className="dg-disc">
        <AnimatePresence mode="popLayout" initial={false}>
          {d.state === 'past' ? (
            <m.span key="past" className="dg-disc-in" variants={POP} initial="hidden" animate="show" transition={{ delay: now ? 0.05 : 0 }}>
              {big && d.got && d.got.length > 1 ? (
                <img className="art" src={art('sparkles')} alt="" />
              ) : pic ? (
                <img className="art" src={'coins' in pic ? art('coin') : iconUrl(pic.item)} alt="" />
              ) : (
                <img className="art faded" src={art('wrapped-gift')} alt="" />
              )}
            </m.span>
          ) : (
            <m.span key="box" className="dg-disc-in" exit={{ opacity: 0, scale: 1.4, transition: { duration: 0.12 } }}>
              <img className="art" src={art('wrapped-gift')} alt="" />
              {d.state === 'next' && <PeekBadge peek={d.peek} />}
            </m.span>
          )}
        </AnimatePresence>
        {d.state === 'past' && (
          <m.i className="dg-check" variants={POP} initial={now ? 'hidden' : false} animate="show" transition={{ ...SPRING.pop, delay: now ? 0.2 : 0 }}>
            <Check weight="bold" />
          </m.i>
        )}
      </span>
      <small className="dg-day">{d.state === 'today' ? 'Today' : d.day}</small>
    </m.li>
  )
}
