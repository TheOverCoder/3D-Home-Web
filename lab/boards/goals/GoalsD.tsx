import { PushPin } from '@phosphor-icons/react/dist/csr/PushPin'
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from 'motion/react'
import { useState, type CSSProperties } from 'react'
import type { GoalId } from '../../../src/farm/goals'
import { art } from '../../../src/ui/art'
import { Check, X } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { claim, GoalPic, howFar, Reward, Ring, type GoalRow, type GoalsState } from './data'
import './goals.css'
import './GoalsD.css'

// D · the spotlight over the sticker book, round 4: A and B made one, as the user asked. From A: the goal nearest to
// done (or reached) is big at the top — its picture in a ring, what to do, the count, the words for how far, what it
// gives in pictures, and a bar that marks where this step began. From B: the others are stickers, now two to a row,
// each its picture in a ring, its words, a sticker of its coins on the corner — and now a bar of its own with its count
// (the user's "progress bar"). A sticker reached lifts off the page, bobs, and has a Claim strip. A touch on a sticker
// flies its picture up into the spotlight (and the one there back down to its place). Its moment: Claim — a stamp comes
// down on the spotlight with a squash, the coins fly to the coin chip, confetti, and the card turns over to the goal's
// next step, already part full ("40% there already!": what you did counts on).
//
// E is the same board with a feature the game does not have (`pin`): a goal pinned goes to the top of the screen in
// play, a small tracker under the compass that fills as you play (lab/boards/top's D shows it there).

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

export function GoalsD({ s, act, pin = false }: { s: GoalsState; act: Act<GoalsState>; pin?: boolean }) {
  const still = useReducedMotion()
  const [pick, setPick] = useState<GoalId | null>(null)
  const [pinned, setPinned] = useState<GoalId | null>(null)
  const [stamped, setStamped] = useState<GoalId | null>(null)
  const hero = s.rows.find((r) => r.id === pick) ?? s.rows[0]
  const rest = s.rows.filter((r) => r !== hero)
  const take = (row: GoalRow, el: HTMLElement) => {
    setPick(row.id)
    setStamped(row.id)
    claim(s, act, row, el, still ? 0 : 560)
    setTimeout(() => setStamped(null), still ? 0 : 600)
  }
  const pinnedRow = s.rows.find((r) => r.id === pinned)
  return (
    <>
      <LevelSheet name={`v-goals v-goals-d${pin ? ' v-goals-e' : ''}`} label="Goals" onClose={act.close}>
        <m.header className="gd-head" variants={ITEM}>
          <img className="art" src={art('trophy')} alt="" />
          <h2>Goals</h2>
          {s.ready ? <span className="tag ok">{s.ready} to claim</span> : <span className="tag">Next up</span>}
          <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
            <X weight="bold" />
          </m.button>
        </m.header>
        <LayoutGroup>
          <div className="gd-body">
            <m.div variants={ITEM} className="gd-spot-wrap">
              <AnimatePresence mode="popLayout" initial={false}>
                <Spot
                  key={`${hero.id}-${hero.step}`}
                  row={hero}
                  fresh={pick === hero.id && hero.step > 0 && !hero.done}
                  stamp={stamped === hero.id}
                  onClaim={take}
                  pin={pin ? { on: pinned === hero.id, toggle: () => setPinned(pinned === hero.id ? null : hero.id) } : undefined}
                />
              </AnimatePresence>
            </m.div>
            <m.ul className="gd-grid" variants={GRID}>
              {rest.map((r, i) => (
                <m.li key={r.id} variants={TILE} layout transition={SPRING.sheet}>
                  <Sticker row={r} i={i} pinned={pin && pinned === r.id} onPick={() => setPick(r.id)} onClaim={(el) => take(r, el)} />
                </m.li>
              ))}
            </m.ul>
          </div>
        </LayoutGroup>
      </LevelSheet>
      {pin && <AnimatePresence>{pinnedRow && <Tracker key={pinnedRow.id} row={pinnedRow} />}</AnimatePresence>}
    </>
  )
}

/** The goal in the spotlight. It turns over to its next step after a claim; a stamp comes down on it as it is claimed. */
function Spot({ row, fresh, stamp, onClaim, pin }: { row: GoalRow; fresh: boolean; stamp: boolean; onClaim: (row: GoalRow, el: HTMLElement) => void; pin?: { on: boolean; toggle: () => void } }) {
  return (
    <m.section
      className={`gd-spot${row.done ? ' done' : ''}${row.part >= 0.75 && !row.done ? ' warm' : ''}`}
      aria-label={`${row.words}: ${Math.min(row.have, row.target)} of ${row.target}`}
      initial={{ opacity: 0, rotateX: -70, y: 10 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      exit={{ opacity: 0, rotateX: 70, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={{ ...SPRING.soft, delay: 0.04 }}
      style={{ transformPerspective: 700 }}
    >
      <m.div className="gd-spot-pic" layoutId={`gd-pic-${row.id}`} transition={SPRING.soft}>
        <i className="gd-glow" aria-hidden="true" />
        <Ring part={row.part} done={row.done} size={92} stroke={8} delay={0.2} />
        <GoalPic row={row} />
        {row.done && (
          <m.span className="gd-seal" initial={{ scale: 2.2, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={{ ...SPRING.pop, delay: 0.3 }}>
            <Check weight="bold" />
          </m.span>
        )}
      </m.div>
      <div className="gd-spot-text">
        <small>Step {row.step + 1}</small>
        <h3>{row.words}</h3>
        <span className={`gd-say${row.done ? ' done' : ''}`}>{fresh ? `${Math.round(row.part * 100)}% there already!` : howFar(row)}</span>
      </div>
      <div className="gd-gives">
        <span>Gives</span>
        <Reward row={row} />
      </div>
      {row.done ? (
        <m.button className="btn leaf gd-claim" onClick={(e) => onClaim(row, e.currentTarget)} whileTap={{ scale: 0.95, y: 3 }} transition={SPRING.pop} aria-label={`Claim ${row.reward.coins} coins`}>
          <Check weight="bold" /> Claim
        </m.button>
      ) : (
        <div className="gd-spot-bar">
          <Bar row={row} big fresh={fresh} delay={0.28} />
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
        </div>
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
        initial={{ rotateY: -90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ rotateY: 90, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }}
        transition={{ ...SPRING.soft, delay: 0.05 }}
        style={{ transformPerspective: 600 }}
      >
        <m.button className="gd-tile-main" onClick={onPick} aria-label={`${row.words}: ${Math.min(row.have, row.target)} of ${row.target}`} {...PRESS}>
          <m.span
            className="gd-tile-pic"
            layoutId={`gd-pic-${row.id}`}
            animate={row.done && !still ? { y: [0, -4, 0] } : undefined}
            // the bob of a reached sticker is a loop of its own; the flight to and from the spotlight is the layout's
            transition={row.done && !still ? { y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, layout: SPRING.soft } : SPRING.soft}
          >
            <Ring part={row.part} done={row.done} size={52} stroke={6} delay={0.3 + i * 0.05} />
            <GoalPic row={row} />
          </m.span>
          <span className="gd-tile-text">
            <b>{row.words}</b>
            <span className={`gd-far${row.done ? ' done' : ''}`}>{tileFar(row)}</span>
          </span>
        </m.button>
        {!row.done && <Bar row={row} delay={0.32 + i * 0.05} />}
        <span className="gd-sticker" aria-hidden="true">
          <img src={art('coin')} alt="" />
          {row.reward.coins}
        </span>
        {pinned && (
          <span className="gd-tile-pinned" aria-label="Pinned">
            <PushPin weight="fill" />
          </span>
        )}
        {row.done && (
          <m.button className="gd-tile-claim" onClick={(e) => onClaim(e.currentTarget)} whileTap={{ scale: 0.95, y: 2 }} transition={SPRING.pop} aria-label={`Claim ${row.reward.coins} coins`}>
            <Check weight="bold" /> Claim
          </m.button>
        )}
      </m.div>
    </AnimatePresence>
  )
}

/** E: the pinned goal at the top of the screen in play, in the column under the compass (src/ui/TopStack.tsx: a slot of
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
