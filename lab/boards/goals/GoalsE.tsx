import { PushPin } from '@phosphor-icons/react/dist/csr/PushPin'
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from 'motion/react'
import { useRef, useState, type CSSProperties } from 'react'
import type { GoalId } from '../../../src/farm/goals'
import { art } from '../../../src/ui/art'
import { Check, X } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { claim, GoalPic, howFar, Reward, Ring, type GoalRow, type GoalsState } from './data'
import './goals.css'
import './GoalsE.css'

// E · the spotlight over the sticker book, with a goal pinned to the top of the screen (chosen: ✓ E, and on D "put it
// in the game, only make the move when a goal is pressed to open bigger more natural to the eye, and more advanced").
// D is gone: E was D with a pin, so the two looked the same; this is the one reference.
//
// The goal nearest to done (or reached) is big at the top — its picture in a ring with a soft light, what to do, the
// words for how far, what it gives in pictures, a thick bar marking where this step began, and a pin that sends it to
// the top of the screen in play (✦). The others are stickers, two to a row, each with its ring, its words, its own bar
// and count, its coins on the corner; one reached lifts off the page, bobs, and has a Claim strip.
//
// Round 5, the move from a sticker to the spotlight is one shape that grows (a container transform): the sticker's
// card itself swells and slides up into the spotlight's place and shape — its picture flying ahead of it into the big
// ring, its words fading in as it settles — while the goal that was there shrinks back into the sticker's place in the
// same moment, the other stickers easing aside, and the page behind dimming a little and coming back (what moves is
// in front). The spotlight's light opens as it lands and its ring fills again. Reduced motion: the two simply
// change places with a fade. Its moment stays the claim: a stamp, the coins to the chip, confetti, and the card
// turning over to the next step, already part full ("40% there already!").

/** The move from a sticker to the spotlight and back: one spring for the shape, its picture and the others easing aside
 *  (a little slower than a press, no bounce: the eye follows one shape growing). */
const MOVE = { type: 'spring', stiffness: 300, damping: 34, mass: 0.9 } as const
/** What a card holds besides its picture keeps its own size while the card grows or shrinks round it (never a stretched
 *  word), slides to its place with the card, and fades in as the shape settles. */
const SETTLE = { layout: true, initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.14, duration: 0.2, layout: MOVE } } as const

const GRID = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } } }
const TILE = { hidden: { opacity: 0, scale: 0.8, y: 12 }, show: { opacity: 1, scale: 1, y: 0, transition: SPRING.pop } }

/** A bar with its count beside it: what is done fills from the left, a white mark where this step began. */
function Bar({ row, big, fresh, delay }: { row: GoalRow; big?: boolean; fresh?: boolean; delay: number }) {
  const still = useReducedMotion()
  const from = row.from / row.target
  return (
    <span className={`gd-barline${big ? ' big' : ''}`}>
      <span
        className={`gd-bar${row.done ? ' done' : row.part >= 0.75 ? ' warm' : ''}`}
        style={{ '--from': from } as CSSProperties}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={row.target}
        aria-valuenow={Math.min(row.have, row.target)}
      >
        <m.i
          initial={still ? false : { width: fresh ? `${from * 100}%` : '0%' }}
          animate={{ width: `${Math.max(row.part > 0 ? 4 : 0, row.part * 100)}%` }}
          transition={{ delay, duration: 0.8, ease: EASE.out }}
        >
          <span className="gd-bar-shine" />
        </m.i>
        {row.from > 0 && <b className="gd-bar-from" title="Where this step began" />}
      </span>
      <span className="gd-bar-count">
        {Math.min(row.have, row.target)}/{row.target}
      </span>
    </span>
  )
}

export function GoalsE({ s, act }: { s: GoalsState; act: Act<GoalsState> }) {
  const still = useReducedMotion()
  const [pick, setPick] = useState<GoalId | null>(null)
  // a sticker pressed: the page behind sinks for the move, and the spotlight is brought into view
  const [moving, setMoving] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState<GoalId | null>(null)
  const [stamped, setStamped] = useState<GoalId | null>(null)
  const hero = s.rows.find((r) => r.id === pick) ?? s.rows[0]
  const rest = s.rows.filter((r) => r !== hero)
  const open = (id: GoalId) => {
    if (id === hero.id) return
    setPick(id)
    if (still) return
    setMoving(true)
    setTimeout(() => setMoving(false), 420)
    body.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const take = (row: GoalRow, el: HTMLElement) => {
    setPick(row.id)
    setStamped(row.id)
    claim(s, act, row, el, still ? 0 : 560)
    setTimeout(() => setStamped(null), still ? 0 : 600)
  }
  const pinnedRow = s.rows.find((r) => r.id === pinned)
  return (
    <>
      <LevelSheet name="v-goals v-goals-e" label="Goals" scrolls onClose={act.close}>
        <m.header className="gd-head" variants={ITEM}>
          <img className="art" src={art('trophy')} alt="" />
          <h2>Goals</h2>
          {s.ready ? <span className="tag ok">{s.ready} to claim</span> : <span className="tag">Next up</span>}
          <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
            <X weight="bold" />
          </m.button>
        </m.header>
        <LayoutGroup>
          <div className={`gd-body${moving ? ' moving' : ''}`} ref={body} data-scroll>
            <m.div variants={ITEM} className="gd-spot-wrap">
              <Spot
                key={`${hero.id}-${hero.step}`}
                row={hero}
                fresh={pick === hero.id && hero.step > 0 && !hero.done}
                stamp={stamped === hero.id}
                onClaim={take}
                pin={{ on: pinned === hero.id, toggle: () => setPinned(pinned === hero.id ? null : hero.id) }}
              />
            </m.div>
            <m.ul className="gd-grid" variants={GRID}>
              {rest.map((r, i) => (
                <m.li key={r.id} variants={TILE} layout="position" transition={MOVE}>
                  <Sticker row={r} i={i} pinned={pinned === r.id} onPick={() => open(r.id)} onClaim={(el) => take(r, el)} />
                </m.li>
              ))}
            </m.ul>
          </div>
        </LayoutGroup>
      </LevelSheet>
      <AnimatePresence>{pinnedRow && <Tracker key={pinnedRow.id} row={pinnedRow} />}</AnimatePresence>
    </>
  )
}

/** The goal in the spotlight. It turns over to its next step after a claim; a stamp comes down on it as it is claimed. */
function Spot({ row, fresh, stamp, onClaim, pin }: { row: GoalRow; fresh: boolean; stamp: boolean; onClaim: (row: GoalRow, el: HTMLElement) => void; pin?: { on: boolean; toggle: () => void } }) {
  // after a claim the card turns over to the next step (a new shape of its own); after a press on a sticker it is the
  // sticker's own card, grown: it comes from the sticker's place and shape (layoutId), its words fading in as it settles
  const turned = fresh
  return (
    <m.section
      className={`gd-spot${row.done ? ' done' : ''}${row.part >= 0.75 && !row.done ? ' warm' : ''}`}
      aria-label={`${row.words}: ${Math.min(row.have, row.target)} of ${row.target}`}
      layoutId={`gd-card-${row.id}-${row.step}`}
      initial={turned ? { opacity: 0, rotateX: -70, y: 10 } : false}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={turned ? { ...SPRING.soft, delay: 0.04 } : { layout: MOVE }}
      style={{ transformPerspective: 700, borderRadius: 24 }}
    >
      <m.div className="gd-spot-pic" layoutId={`gd-pic-${row.id}`} transition={MOVE}>
        <m.i className="gd-glow" aria-hidden="true" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.soft, delay: 0.18 }} />
        <Ring part={row.part} done={row.done} size={92} stroke={8} delay={0.2} />
        <GoalPic row={row} />
        {row.done && (
          <m.span className="gd-seal" initial={{ scale: 2.2, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={{ ...SPRING.pop, delay: 0.3 }}>
            <Check weight="bold" />
          </m.span>
        )}
      </m.div>
      <m.div className="gd-spot-text" {...SETTLE}>
        <small>Step {row.step + 1}</small>
        <h3>{row.words}</h3>
        <span className={`gd-say${row.done ? ' done' : ''}`}>{fresh ? `${Math.round(row.part * 100)}% there already!` : howFar(row)}</span>
      </m.div>
      <m.div className="gd-gives" {...SETTLE}>
        <span>Gives</span>
        <Reward row={row} />
      </m.div>
      {row.done ? (
        <m.button
          className="btn leaf gd-claim"
          onClick={(e) => onClaim(row, e.currentTarget)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.95, y: 3 }}
          transition={{ ...SPRING.pop, opacity: { delay: 0.22, duration: 0.18 } }}
          aria-label={`Claim ${row.reward.coins} coins`}
        >
          <Check weight="bold" /> Claim
        </m.button>
      ) : (
        <m.div className="gd-spot-bar" {...SETTLE}>
          <Bar row={row} big fresh={fresh} delay={0.3} />
          {pin && (
            <m.button
              className={`gd-pin${pin.on ? ' on' : ''}`}
              onClick={pin.toggle}
              aria-pressed={pin.on}
              aria-label={pin.on ? 'Unpin from the top of the screen' : 'Pin to the top of the screen'}
              {...PRESS}
            >
              <PushPin weight={pin.on ? 'fill' : 'bold'} />
            </m.button>
          )}
        </m.div>
      )}
      <AnimatePresence>
        {stamp && (
          <m.span
            key="stamp"
            className="gd-stamp"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 2.6, rotate: -24 }}
            animate={{ opacity: 1, scale: [2.6, 0.9, 1.04, 1], rotate: -10 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.4, times: [0, 0.55, 0.8, 1], ease: 'easeOut' }}
          >
            <Check weight="bold" />
          </m.span>
        )}
      </AnimatePresence>
    </m.section>
  )
}

/** How far, in the few words a sticker has room for (the small-area rule: what is done under half, what is left past it). */
const tileFar = (row: GoalRow) => (row.done ? 'Reached!' : row.part >= 0.5 ? `${row.target - row.have} more${row.part >= 0.75 ? '!' : ''}` : `${row.have} of ${row.target}`)

/** A sticker of the book: two to a row. Reached, it lifts off the page and bobs, a Claim strip across its foot. */
function Sticker({ row, i, pinned, onPick, onClaim }: { row: GoalRow; i: number; pinned: boolean; onPick: () => void; onClaim: (el: HTMLElement) => void }) {
  const still = useReducedMotion()
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <m.div
        key={`${row.id}-${row.step}`}
        className={`gd-tile${row.done ? ' done' : ''}${row.part >= 0.75 && !row.done ? ' warm' : ''}`}
        layoutId={`gd-card-${row.id}-${row.step}`}
        exit={{ rotateY: 90, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
        transition={{ layout: MOVE }}
        style={{ transformPerspective: 600, borderRadius: 18 }}
      >
        <m.button className="gd-tile-main" onClick={onPick} aria-label={`${row.words}: ${Math.min(row.have, row.target)} of ${row.target}`} {...PRESS}>
          <m.span
            className="gd-tile-pic"
            layoutId={`gd-pic-${row.id}`}
            animate={row.done && !still ? { y: [0, -4, 0] } : undefined}
            // the bob of a reached sticker is a loop of its own; the flight to and from the spotlight is the layout's
            transition={row.done && !still ? { y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, layout: MOVE } : MOVE}
          >
            <Ring part={row.part} done={row.done} size={52} stroke={6} delay={0.3 + i * 0.05} />
            <GoalPic row={row} />
          </m.span>
          <m.span className="gd-tile-text" {...SETTLE}>
            <b>{row.words}</b>
            <span className={`gd-far${row.done ? ' done' : ''}`}>{tileFar(row)}</span>
          </m.span>
        </m.button>
        {!row.done && (
          <m.div className="gd-tile-bar" {...SETTLE}>
            <Bar row={row} delay={0.32 + i * 0.05} />
          </m.div>
        )}
        <m.span className="gd-sticker" aria-hidden="true" {...SETTLE}>
          <img src={art('coin')} alt="" />
          {row.reward.coins}
        </m.span>
        {pinned && (
          <span className="gd-tile-pinned" aria-label="Pinned">
            <PushPin weight="fill" />
          </span>
        )}
        {row.done && (
          <m.button
            className="gd-tile-claim"
            onClick={(e) => onClaim(e.currentTarget)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.95, y: 2 }}
            transition={{ ...SPRING.pop, opacity: { delay: 0.2, duration: 0.18 } }}
            aria-label={`Claim ${row.reward.coins} coins`}
          >
            <Check weight="bold" /> Claim
          </m.button>
        )}
      </m.div>
    </AnimatePresence>
  )
}

/** The pinned goal at the top of the screen in play, in the column under the compass (src/ui/TopStack.tsx: a slot of
 *  its own). It flies up there as it is pinned; in play it would fill as you play and pop "+1" with each one counted. */
function Tracker({ row }: { row: GoalRow }) {
  return (
    <m.div
      className="v-goals-e-tracker"
      role="status"
      aria-label={`Pinned: ${row.words}, ${Math.min(row.have, row.target)} of ${row.target}`}
      initial={{ opacity: 0, y: 260, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.9, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={SPRING.soft}
    >
      <PushPin weight="fill" className="v-goals-e-tracker-pin" />
      <GoalPic row={row} />
      <span className="v-goals-e-tracker-text">
        <b>{row.words}</b>
        <span className="v-goals-e-tracker-bar">
          <m.i initial={{ width: 0 }} animate={{ width: `${row.part * 100}%` }} transition={{ delay: 0.3, duration: 0.7, ease: EASE.out }} />
        </span>
      </span>
      <span className="v-goals-e-tracker-n">
        {Math.min(row.have, row.target)}/{row.target}
      </span>
    </m.div>
  )
}
