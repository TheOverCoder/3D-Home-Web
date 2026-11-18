import { AnimatePresence, m, type Transition, type Variants } from 'motion/react'
import { useLessMotion } from '../ui/still'
import { useEffect, useRef, useState } from 'react'
import { flyCoins, flyItem, holdCoins } from '../fx/coins'
import { coinsToFly } from '../fx/fx'
import { haptic } from '../lib/device'
import { art } from '../ui/art'
import { burst } from '../ui/burst'
import { Check, Clock } from '../ui/glyphs'
import { ItemPic } from '../ui/ItemPic'
import { CountUp, EASE, ITEM, POP, SINK, SPRING } from '../ui/motion'
import { Road } from '../ui/Road'
import { PanelSheet } from '../ui/PanelSheet'
import { storeOf } from './data'
import { chanceWords, countdown, merged, WEEK, type Chance, type DailyView, type DayView, type Peek } from './daily'
import { prizeWords, type Prize } from './gifts'
import { iconUrl } from './icons'
import { stops } from './road'
import './DailyCard.css'

// How the daily gift's card looks (the design layer; the design lab's board "daily" shows it with no game round it).
// What it shows is ./daily.ts's view, made from the farm by ./DailyPanel.tsx.
//
// The hero is today's gift on a stage of light: a box with a lid of its own (the picture cut in two at its seam) that
// hops now and then, its lid lifting as it lands so the light inside peeks out, a tag on its lid with what is inside
// today (the coins, a building material, goods from the farm; the big one's three), its day on a ribbon. Under it the
// week as a road of seven stops — the days taken checked with what they gave, today's glowing, the days to come
// peeking, the seventh bigger with a crown, the big one; a stop touched says what it holds. The week is the season's,
// on days played: a day played whose gift was not claimed glows beside today's (it comes with it), and a return after
// days away brings a welcome-back gift with it. The days played ("Day 23 on the farm", never falling) are in the title,
// and a "?" on the stage says what today's box can hold and how likely. One press: Claim.
//
// Claiming tells the gift's story one step at a time. The box rattles, its lid jumping, the light gathering; it bursts
// open (a flash, confetti, its sound and a roll of the phone): the lid flies off with its tag, a beam of light comes
// up out of the box and the gift rises out of it, big, with its name, as the empty box sinks away. A moment later it
// flies to where it lives (coins to the coin chip, which counts them in as they land; goods to their building's chip),
// and only then does the road take it: today's stop is stamped with what it gave and the line runs on to it. The stage
// turns to tomorrow: its box, what it will bring and a digital clock counting down to
// the moment it opens (the device's midnight), so the visit ends looking forward. Done closes it. If the clock runs
// out with the card open, the new day's box drops in. What the gift gives is the farm's at the press (onClaim):
// closing the card at any moment loses nothing (what is still on the stage flies as it goes).

/** The rattle before it opens (ms): anticipation, short. */
const SHAKE_MS = 680
/** How long the gift stays on the stage, big, before it flies home (ms). */
const SHOW_MS = 1300

/** The moment of a claim: what it gave, where it is, and the card's view from before it (shown until it is home). */
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
  const still = useLessMotion()
  const [moment, setMoment] = useState<Moment | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const got = useRef<Prize[]>([])
  const held = useRef(0)
  const flown = useRef(false)
  const reveal = useRef(onReveal)
  reveal.current = onReveal
  const phase = moment?.phase
  // until the gift is home the card still shows the day as it was (the road, the streak): then they move on, one thing
  // after another (with less motion: at once)
  const settled = !moment || phase === 'flown' || still
  const shown = settled ? v : moment.before

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
    haptic('tick')
    got.current = list
    flown.current = false
    const coins = list.reduce((n, p) => n + ('coins' in p ? p.coins : 0), 0)
    if (!still && coins) {
      holdCoins(coins)
      held.current = coins
    }
    setMoment({ got: list, phase: still ? 'open' : 'shake', before: v })
    if (still) reveal.current?.()
  }

  // rattle → open (the burst) → home
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
    // (with less motion too: nothing flies, but the stage still turns to tomorrow and its clock)
    if (phase === 'open') {
      const t = window.setTimeout(() => {
        fly()
        setMoment((x) => x && { ...x, phase: 'flown' })
      }, SHOW_MS)
      return () => window.clearTimeout(t)
    }
    // (fly reads refs only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, still])

  // the day changed with the card open (its clock ran out): the new day's gift, ready to claim
  useEffect(() => {
    if (!moment || !v.ready || moment.phase === 'shake') return
    fly()
    got.current = []
    setMoment(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.ready, moment])

  const close = () => {
    fly()
    onClose()
  }
  const big = shown.ready && shown.day === WEEK
  const done = !!moment && phase !== 'shake'
  const box: Box = phase === 'shake' ? 'shake' : phase === 'open' ? 'open' : still ? 'rest' : 'idle'
  const showBox = (!moment && shown.ready) || phase === 'shake' || (phase === 'open' && !still)
  const showTomorrow = phase === 'flown' || (!moment && !shown.ready)

  return (
    // the sheet's head: the calendar, "Daily gift" and the streak's flame (src/ui/PanelSheet.tsx); its ✕, the shade, a
    // swipe or Esc send what is still on the stage home as it goes
    <PanelSheet label="Daily gift" title="Daily gift" pic={art('tear-off-calendar')} sub={<DaysPlayed n={shown.days} />} className="daily-card" onLeave={fly} onClose={onClose}>
      <div className="dg-body">
        {/* (over the stage's corner, outside it: its sheet is not cut off by the stage) */}
        {!moment && shown.ready && <Odds rows={shown.odds} label="What today’s gift can hold" className="dg-odds" />}
        <m.div className={`dg-stage${big ? ' big' : ''}${phase ? ` ${phase}` : ''}`} variants={ITEM} ref={stage}>
          <m.span
            className="dg-rays"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={phase === 'open' ? { opacity: 1, scale: 1.25 } : phase === 'shake' ? { opacity: 0.95, scale: 1.08 } : { opacity: shown.ready ? 0.7 : 0.35, scale: 1 }}
            transition={SPRING.soft}
          />
          <AnimatePresence>
            {showBox && <GiftBox key={`box-${shown.day}`} day={shown.day} big={big} peek={shown.week[shown.day - 1]?.peek} state={box} />}
            {phase === 'open' && <Prizes key="prizes" got={merged(got.current)} still={still} />}
            {showTomorrow && <Tomorrow key="tomorrow" v={v} />}
          </AnimatePresence>
          {phase === 'open' && !still && (
            <m.i className="dg-flash" aria-hidden="true" initial={{ opacity: 0.9, scale: 0.3 }} animate={{ opacity: 0, scale: 1.7 }} transition={{ duration: 0.5, ease: EASE.out }} />
          )}
          {!moment && shown.ready && shown.back !== null && <BackGift coins={shown.back} />}
          <span className="dg-say" role="status">
            {done ? `You got ${got.current.map(prizeWords).join(', ')}` : ''}
          </span>
        </m.div>

        <WeekRoad v={shown} stamped={moment && settled ? moment.before.day : null} />

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
      </div>
    </PanelSheet>
  )
}

/** The one line under the button, in kind words (nothing is ever lost or missed): what this day means (a return the
 *  week waited for, gifts that waited, how far the big gift is), or, once claimed, what the next day played brings. */
function lineOf(v: DailyView, done: boolean): string {
  if (done || !v.ready)
    return v.tomorrow === 1 ? 'A new week starts on your next day here.' : v.tomorrow === WEEK ? 'The big gift waits for your next day here!' : `Day ${v.tomorrow} waits for your next day here.`
  if (v.back !== null) return 'Welcome back! Your week waited.'
  if (v.owed > 0) return v.owed === 1 ? 'Your last day’s gift waited for you too.' : `Your last ${v.owed} days’ gifts waited for you too.`
  if (v.first) return 'A gift every day you play. Day 7 is a big one!'
  if (v.day === WEEK) return 'The big gift of the week!'
  return v.left === 1 ? '1 more day to the big gift.' : `${v.left} more days to the big gift.`
}

/** What a day holds, in words: its coins, or its kind. */
function peekWords(p: Peek): string {
  if (p.kind === 'coins') return `${p.coins.toLocaleString('en-US')} coins`
  if (p.kind === 'material') return 'A building material'
  if (p.kind === 'goods') return 'Goods from your farm'
  return `${p.coins.toLocaleString('en-US')} coins, a material and goods`
}

/** The days played: a flame (it flickers) and the farm's day ("Day 23 on the farm"). It never falls; a new day counts
 *  up. */
function DaysPlayed({ n }: { n: number }) {
  // the number it counts from: the one before the last change (kept across the card's other changes)
  const seen = useRef({ n, from: n })
  if (seen.current.n !== n) seen.current = { n, from: seen.current.n }
  const from = Math.min(seen.current.from, n)
  return (
    <AnimatePresence initial={false}>
      {n > 0 && (
        <m.span key="days" className="dg-streak dg-day-count" aria-label={`Day ${n} on the farm`} title="Days on the farm" variants={POP} initial="hidden" animate="show" exit="out">
          <m.img
            key={n}
            className="art"
            src={art('fire')}
            alt=""
            initial={from < n ? { scale: 0.5, rotate: -16 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...SPRING.pop, delay: 0.12 }}
          />
          <small>Day</small>
          <b>{from < n ? <CountUp from={from} to={n} duration={0.6} /> : n}</b>
        </m.span>
      )}
    </AnimatePresence>
  )
}

/** Where today's box is in its story: waiting (it hops now and then), still (less motion: it only stands), rattling,
 *  bursting open. */
type Box = 'idle' | 'rest' | 'shake' | 'open'

/** The wait between two hops (s), and the hop's beats: crouch, up, land (the lid still rising: the light peeks), settle. */
const HOP_EVERY = 2.2
const HOP_T: Transition = { duration: 1.5, delay: 0.9, repeat: Infinity, repeatDelay: HOP_EVERY, ease: 'easeInOut', times: [0, 0.16, 0.42, 0.66, 0.82, 1] }
const SHAKE_T: Transition = { duration: SHAKE_MS / 1000, ease: 'easeInOut' }
const STILL: Transition = { duration: 0 }

/** The box as a whole: it drops onto the stage, hops (squash and stretch), grows and rattles before it opens. */
const HOP: Variants = {
  enter: { y: 0, scaleX: 1, scaleY: 1, rotate: 0 },
  rest: { y: 0, scaleX: 1, scaleY: 1, rotate: 0, transition: STILL },
  idle: {
    y: [0, 3, -16, 0, -2, 0],
    scaleX: [1, 1.08, 0.95, 1.06, 1, 1],
    scaleY: [1, 0.88, 1.07, 0.93, 1.01, 1],
    rotate: 0,
    transition: HOP_T,
  },
  shake: {
    y: [0, -3, 0, -4, 0, -5, 0, -6, -3],
    rotate: [0, -6, 6, -9, 9, -11, 11, -7, 0],
    scaleX: 1.12,
    scaleY: 1.12,
    transition: { default: SHAKE_T, scaleX: SPRING.pop, scaleY: SPRING.pop },
  },
  open: { y: 0, rotate: 0, scaleX: 1.12, scaleY: 1.12, transition: { duration: 0.12 } },
}
/** Its first landing, before the hops begin. */
const LAND: Transition = { type: 'spring', stiffness: 260, damping: 15, delay: 0.12 }
const DROP: Variants = {
  enter: { y: -46, scale: 0.6, opacity: 0 },
  idle: { y: 0, scale: 1, opacity: 1, transition: { ...LAND, opacity: { duration: 0.18, delay: 0.12 } } },
  rest: { y: 0, scale: 1, opacity: 1, transition: STILL },
  shake: { y: 0, scale: 1, opacity: 1 },
  open: { y: 0, scale: 1, opacity: 1 },
}
/** The lid: it lifts as the box lands (the light inside peeks out), jumps as it rattles, flies off as it opens. */
const LID: Variants = {
  rest: { x: 0, y: 0, rotate: 0, opacity: 1, transition: STILL },
  idle: { x: 0, y: [0, 0, -3, -11, 1, 0], rotate: [0, 0, -2, -8, 1, 0], opacity: 1, transition: HOP_T },
  shake: { x: 0, y: [0, -4, 0, -7, -1, -10, -3, -13, -9], rotate: [0, 3, -3, 5, -4, 6, -6, 4, -3], opacity: 1, transition: SHAKE_T },
  open: { x: 38, y: -128, rotate: 40, opacity: 0, transition: { duration: 0.62, ease: EASE.out, opacity: { duration: 0.62, ease: 'easeIn' } } },
}
/** The light in the box, seen through the gap under the lid. */
const LEAK: Variants = {
  rest: { opacity: 0, transition: STILL },
  idle: { opacity: [0, 0, 0.35, 1, 0.1, 0], transition: HOP_T },
  shake: { opacity: [0.3, 0.8, 0.4, 0.9, 0.5, 1, 0.7, 1, 1], transition: SHAKE_T },
  open: { opacity: 0, transition: { duration: 0.2 } },
}
/** The box itself: open, it shows its mouth, and sinks away once the gift is out. */
const BODY: Variants = {
  open: { y: 18, scale: 0.8, opacity: 0, transition: { delay: 0.34, duration: 0.34, ease: 'easeIn' } },
}
const MOUTH: Variants = { rest: { opacity: 0 }, idle: { opacity: 0 }, shake: { opacity: 0 }, open: { opacity: 1, transition: { duration: 0.06 } } }
/** The beam of light out of the open box. */
const BEAM: Variants = {
  rest: { scaleY: 0, opacity: 0 },
  idle: { scaleY: 0, opacity: 0 },
  shake: { scaleY: 0, opacity: 0 },
  open: { scaleY: [0.1, 1, 1.1], opacity: [0.9, 1, 0], transition: { duration: 0.95, ease: 'easeOut', times: [0, 0.3, 1] } },
}
/** Its shadow on the stage: smaller while it is in the air. */
const SHADOW: Variants = {
  enter: { opacity: 0, scale: 0.4 },
  rest: { opacity: 1, scale: 1, transition: STILL },
  idle: { opacity: [1, 1, 0.5, 1, 1, 1], scale: [1, 1.08, 0.68, 1.06, 1, 1], transition: { default: HOP_T, opacity: HOP_T } },
  shake: { opacity: 1, scale: 1.14, transition: SPRING.pop },
  open: { opacity: 0, scale: 0.6, transition: { delay: 0.3, duration: 0.3 } },
}
/** The ribbon with its day: it goes as the box opens. */
const RIBBON: Variants = {
  enter: { opacity: 0, y: 8 },
  rest: { opacity: 1, y: 0, transition: STILL },
  idle: { opacity: 1, y: 0, transition: { ...SPRING.pop, delay: 0.3 } },
  shake: { opacity: 1, y: 0 },
  open: { opacity: 0, y: 10, scale: 0.8, transition: { duration: 0.2 } },
}
const TODAY: Variants = { enter: {}, rest: {}, idle: {}, shake: {}, open: {}, gone: { opacity: 0, transition: { duration: 0.12 } } }

/** Today's gift on its stage: a box of two halves (the picture cut at the lid's seam), the light inside, a tag on its
 *  lid with what is in it, and its day on a ribbon. The big one is bigger, with a crown and sparkles. */
function GiftBox({ day, big, peek, state }: { day: number; big: boolean; peek: Peek | undefined; state: Box }) {
  const gift = art('wrapped-gift')
  return (
    <m.div className={`dg-today${big ? ' big' : ''}`} variants={TODAY} initial="enter" animate={state} exit="gone">
      {big && (
        <>
          <img className="art dg-sparkles left" src={art('sparkles')} alt="" />
          <img className="art dg-sparkles right" src={art('sparkles')} alt="" />
        </>
      )}
      <m.span className="dg-gift" variants={DROP}>
        <m.i className="dg-gift-shadow" variants={SHADOW} />
        <m.span className="dg-gift-hop" variants={HOP}>
          {/* (behind the box: seen only through the gap under the lid, and round its edges) */}
          <m.i className="dg-gift-leak" variants={LEAK} />
          <span className="dg-gift-body">
            <m.span className="dg-gift-box" variants={BODY}>
              <img src={gift} alt="" draggable={false} />
              <m.i className="dg-gift-mouth" variants={MOUTH} />
            </m.span>
          </span>
          <m.i className="dg-gift-beam" variants={BEAM} />
          <m.span className="dg-gift-lid" variants={LID}>
            <img src={gift} alt="" draggable={false} />
            {big && <img className="dg-crown" src={art('crown')} alt="" draggable={false} />}
            {peek && <Tag peek={peek} />}
          </m.span>
        </m.span>
      </m.span>
      <m.b className="dg-ribbon ribbon" variants={RIBBON}>
        {big ? 'Day 7 · Big gift' : `Day ${day}`}
      </m.b>
    </m.div>
  )
}

/** The tag on today's lid: what is inside (the coins, a building material, goods from the farm; the big one's three). */
function Tag({ peek }: { peek: Peek }) {
  return (
    <span className={`dg-tag ${peek.kind}`} role="img" aria-label={`Inside: ${peekWords(peek)}`}>
      {(peek.kind === 'coins' || peek.kind === 'big') && <img src={art('coin')} alt="" />}
      {(peek.kind === 'material' || peek.kind === 'big') && <img src={iconUrl('plank')} alt="" />}
      {(peek.kind === 'goods' || peek.kind === 'big') && <img src={art('basket')} alt="" />}
      {peek.kind === 'coins' && <b>{peek.coins.toLocaleString('en-US')}</b>}
    </span>
  )
}

/** The odds of a gift on screen (update-v1/missions/02-meta-collections.md, change 2): a "?" that opens what it can hold
 *  and how likely, a line each ("Coins · 55 %"; "Which material: each of 6 alike · 1 in 6"); touched again, or
 *  anywhere else, it closes. Nothing here is a bet: the odds are the farm's own, the same for everyone. The level's
 *  boxes and the lucky draw show theirs with it too. */
export function Odds({ rows, label, className }: { rows: readonly Chance[]; label: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [open])
  return (
    <span className={`odds${className ? ` ${className}` : ''}`} ref={box}>
      <button type="button" className="odds-btn" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">?</span>
      </button>
      <AnimatePresence>
        {open && (
          <m.span
            className="odds-sheet"
            role="note"
            initial={{ opacity: 0, y: -6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={SPRING.pop}
          >
            <b className="odds-title">{label}</b>
            {rows.map((r) => (
              <span key={r.what} className="odds-row">
                <span>{r.what}</span>
                <b>{chanceWords(r.share)}</b>
              </span>
            ))}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** The welcome-back gift, waiting on the stage beside today's box: a wave and its coins (they come with today's). */
function BackGift({ coins }: { coins: number }) {
  return (
    <m.span
      className="dg-back"
      role="img"
      aria-label={`Welcome back: ${coins} coins come with today’s gift`}
      initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ ...SPRING.pop, delay: 0.5 }}
    >
      <img className="art" src={art('waving-hand')} alt="" />
      <img src={art('coin')} alt="" />
      <b>+{coins.toLocaleString('en-US')}</b>
    </m.span>
  )
}

/** What came out of the box: it rises from the box's mouth, big, coins with how many, a good with its count; one prize
 *  says its name. Then it shrinks into its flight home. */
const RISE: Variants = { hidden: { opacity: 0, scale: 0.2, y: 30 }, show: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } }

function Prizes({ got, still }: { got: Prize[]; still: boolean }) {
  const one = got.length === 1
  return (
    <m.div
      className={`dg-prizes${one ? ' one' : ''}`}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.5, y: -26, transition: { duration: 0.22, ease: EASE.out } }}
      variants={{ show: { transition: { delayChildren: still ? 0 : 0.1, staggerChildren: still ? 0 : 0.12 } } }}
    >
      {got.map((p, i) => (
        <m.span key={i} className="dg-prize" variants={RISE}>
          {'coins' in p ? (
            <span className="dg-coins">
              <img className="art" src={art('coin')} alt="" />
              <b>+{p.coins.toLocaleString('en-US')}</b>
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

/** Seconds left of a countdown that was `secs` when it was given, ticking on by the device's clock (null: none). A
 *  new value from the farm sets it again; the same one again (a clock held still) does not. */
function useLeft(secs: number | null): number | null {
  const [left, setLeft] = useState(secs)
  const from = useRef({ secs: Number.NaN, at: 0 })
  useEffect(() => {
    if (secs === null) {
      setLeft(null)
      return
    }
    if (from.current.secs !== secs) from.current = { secs, at: Date.now() }
    const read = () => setLeft(Math.max(0, from.current.secs - (Date.now() - from.current.at) / 1000))
    read()
    const id = window.setInterval(read, 250)
    return () => window.clearInterval(id)
  }, [secs])
  return left
}

/** How long, in words (for a screen reader). */
function waitWords(s: number): string {
  const h = Math.floor(s / 3600)
  const min = Math.floor((s % 3600) / 60)
  const hours = `${h} hour${h === 1 ? '' : 's'}`
  const mins = `${min} minute${min === 1 ? '' : 's'}`
  return h ? (min ? `${hours} ${mins}` : hours) : min ? mins : 'less than a minute'
}

/** Tomorrow on the stage once today's is home (or taken): its box, what it will be (a peek), its day, and a digital
 *  clock counting down to the moment it opens. In its last minute the box can hardly wait. */
function Tomorrow({ v }: { v: DailyView }) {
  const day = v.week[v.tomorrow - 1]
  const big = v.tomorrow === WEEK
  const left = useLeft(v.opensIn)
  const soon = left !== null && left <= 60
  return (
    <m.div
      className={`dg-tomorrow${big ? ' big' : ''}${soon ? ' soon' : ''}`}
      initial={{ opacity: 0, y: 14, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
      transition={{ ...SPRING.pop, delay: 0.25 }}
    >
      <span className="dg-tomorrow-box">
        <img className="art" src={art('wrapped-gift')} alt="" />
        {day && <PeekBadge peek={day.peek} />}
      </span>
      <span className="dg-tomorrow-words">
        <span className="dg-tomorrow-title">
          <b>Tomorrow</b>
          <small>{big ? 'Day 7 · Big gift' : `Day ${v.tomorrow}`}</small>
        </span>
        {left !== null && <Countdown left={left} />}
      </span>
    </m.div>
  )
}

/** The wait as a small digital clock: each digit rolls over as it changes, the colons blink with the seconds. */
function Countdown({ left }: { left: number }) {
  const text = countdown(left)
  return (
    <span className="dg-clock" role="timer" aria-label={`Opens in ${waitWords(Math.ceil(left))}`}>
      <small aria-hidden="true">Opens in</small>
      <span className="dg-clock-face" aria-hidden="true">
        <Clock weight="fill" />
        {text.split('').map((c, i) => (/\d/.test(c) ? <Digit key={`${text.length}-${i}`} c={c} /> : <i key={`${text.length}-${i}`}>{c}</i>))}
      </span>
    </span>
  )
}

function Digit({ c }: { c: string }) {
  return (
    <span className="dg-digit">
      <AnimatePresence initial={false} mode="popLayout">
        <m.span key={c} initial={{ y: '-75%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '75%', opacity: 0 }} transition={{ duration: 0.26, ease: EASE.out }}>
          {c}
        </m.span>
      </AnimatePresence>
    </span>
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

const STOP: Variants = { hidden: { opacity: 0, y: 10, scale: 0.7 }, show: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop } }
/** The week as a road of seven stops, one a day's gift claimed (./road.ts). */
const WEEK_ROAD = stops(WEEK, (k) => k)

/** The week as a road (../ui/Road.tsx): seven stops on a line that fills up to the last day taken (and runs on to
 *  today's once its gift is home: `stamped`, the day the claim was about), striped on to today's past the days whose
 *  gifts waited for it. A stop touched says what it holds or gave. */
function WeekRoad({ v, stamped }: { v: DailyView; stamped: number | null }) {
  const past = v.week.filter((d) => d.state === 'past').length
  const now = v.week.find((d) => d.state === 'today')?.day ?? 0
  return (
    <Road
      road={WEEK_ROAD}
      have={past}
      toward={now}
      label={`This week: day ${v.day} of ${WEEK}`}
      cls="dg"
      stop={(k, picked, onPick) => {
        const d = v.week[k - 1]
        return <Stop key={d.day} d={d} now={d.day === stamped && d.state === 'past'} picked={picked} onPick={onPick} />
      }}
    />
  )
}

/** A stop's words: its day, and what it gave (taken) or holds (today's, one that waited for it, to come). */
function stopWords(d: DayView): [string, string] {
  if (d.state === 'past') return [`Day ${d.day}`, d.got ? d.got.map(prizeWords).join(', ') : 'Taken']
  if (d.state === 'owed') return [`Day ${d.day}`, `${peekWords(d.peek)}, waiting with today’s`]
  return [d.state === 'today' ? 'Today' : `Day ${d.day}`, peekWords(d.peek)]
}

/** A stop of the road: a day taken (what it gave, with a ✓), today's (glowing), one that waited for it (glowing too:
 *  it comes with today's), or one to come (its peek); touched, its words in a bubble over it. */
function Stop({ d, now, picked, onPick }: { d: DayView; now: boolean; picked: boolean; onPick: () => void }) {
  const big = d.day === WEEK
  const pic = d.got?.[0]
  const [title, words] = stopWords(d)
  const edge = d.day <= 1 ? ' start' : d.day >= WEEK ? ' end' : ''
  return (
    <m.li className={`dg-stop ${d.state}${big ? ' big' : ''}${now ? ' now' : ''}`} variants={STOP}>
      <button type="button" className="dg-stop-btn" aria-label={`${title}: ${words}`} aria-expanded={picked} onClick={onPick}>
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
                {big && <img className="dg-stop-crown" src={art('crown')} alt="" />}
                <PeekBadge peek={d.peek} />
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
      </button>
      <AnimatePresence>
        {picked && (
          <m.span
            className={`dg-bubble${edge}`}
            aria-hidden="true"
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95, transition: { duration: 0.12 } }}
            transition={SPRING.pop}
          >
            <b>{title}</b> · {words}
          </m.span>
        )}
      </AnimatePresence>
    </m.li>
  )
}
