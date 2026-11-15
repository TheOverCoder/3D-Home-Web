import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import { art } from '../../../src/ui/art'
import { Check, X } from '../../../src/ui/glyphs'
import { EASE, PRESS, SPRING } from '../../../src/ui/motion'
import type { Act } from '../../board'
import { ITEM, LevelSheet } from '../level/LevelSheet'
import { claim, GoalPic, type GoalRow, type GoalsState } from './data'
import './goals.css'
import './GoalsC.css'

// C · ladders: each goal is a short track of its counts — the count behind you (stamped ✓), the one you are climbing to
// (its prize over it), and the one after (faint: there is always a next) — so the near goal and the long way are on
// one line. The stretch you are on fills, its head where the farm has come to, the number of what is left over it in
// the last quarter. A reached count turns into a round green button on the track itself: press the milestone to take
// its prize. Its moment: the stamp comes down on it, the coins fly to the coin chip, confetti, and the track slides one
// count on — the new stretch already part full.

const AT = 0.6 // where the count you are climbing to stands on the track (0..1)

const ROWS = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } } }
const ROW = { hidden: { opacity: 0, x: 18 }, show: { opacity: 1, x: 0, transition: SPRING.pop } }

export function GoalsC({ s, act }: { s: GoalsState; act: Act<GoalsState> }) {
  return (
    <LevelSheet name="v-goals v-goals-c" label="Goals" onClose={act.close}>
      <m.header className="gc-head" variants={ITEM}>
        <img className="art" src={art('trophy')} alt="" />
        <h2>Goals</h2>
        {s.ready ? <span className="tag ok">{s.ready} to claim</span> : <span className="tag">Climb each one</span>}
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <m.ul className="gc-list" variants={ROWS}>
        {s.rows.map((r) => (
          <m.li key={r.id} className={`gc-row${r.done ? ' done' : ''}${r.stepPart >= 0.75 && !r.done ? ' warm' : ''}`} variants={ROW} layout transition={SPRING.sheet}>
            <GoalPic row={r} />
            <div className="gc-main">
              <b className="gc-words">{r.words}</b>
              <AnimatePresence mode="popLayout" initial={false}>
                <Track key={`${r.id}-${r.step}`} row={r} onClaim={(el) => claim(s, act, r, el, 480)} />
              </AnimatePresence>
            </div>
          </m.li>
        ))}
      </m.ul>
    </LevelSheet>
  )
}

/** One goal's track: the count behind, the stretch to the next count, the one after. */
function Track({ row, onClaim }: { row: GoalRow; onClaim: (el: HTMLElement) => void }) {
  const still = useReducedMotion()
  const fill = (row.done ? 1 : row.stepPart) * AT
  const left = row.target - row.have
  return (
    <m.div
      className="gc-track"
      aria-label={`${Math.min(row.have, row.target)} of ${row.target}`}
      initial={{ x: '40%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-40%', opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }}
      transition={{ ...SPRING.sheet, delay: 0.05 }}
      style={{ '--at': AT } as CSSProperties}
    >
      <span className="gc-rail" />
      <m.span
        className="gc-fill"
        initial={{ width: still ? `${fill * 100}%` : `${(row.step > 0 ? 0.12 : 0) * 100}%` }}
        animate={{ width: `${fill * 100}%` }}
        transition={{ delay: 0.25, duration: 0.7, ease: EASE.out }}
      />
      {/* the count behind you, stamped (or the start) */}
      <span className={`gc-stop behind${row.step > 0 ? ' won' : ''}`} style={{ left: 0 }}>
        {row.step > 0 ? <Check weight="bold" /> : null}
        <small>{row.from}</small>
      </span>
      {/* where the farm has come to: what is left, over the head, in the last quarter */}
      {!row.done && row.stepPart >= 0.75 && (
        <m.b className="gc-left" style={{ left: `${fill * 100}%` }} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: 0.9 }}>
          {left} more
        </m.b>
      )}
      {/* the count you are climbing to: its prize over it; reached, the button that takes it */}
      <span className="gc-prize" style={{ left: `${AT * 100}%` }}>
        <img src={art('coin')} alt="" />
        {row.reward.coins}
      </span>
      {row.done ? (
        <m.button
          className="gc-stop goal claim"
          style={{ left: `${AT * 100}%` }}
          onClick={(e) => onClaim(e.currentTarget)}
          aria-label={`Claim ${row.reward.coins} coins`}
          initial={{ scale: 0.6 }}
          animate={still ? { scale: 1 } : { scale: [1, 1.08, 1] }}
          transition={still ? SPRING.pop : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          whileTap={{ scale: 0.9 }}
        >
          <Check weight="bold" />
          <small>{row.target}</small>
        </m.button>
      ) : (
        <span className="gc-stop goal" style={{ left: `${AT * 100}%` }}>
          <b>{row.target}</b>
        </span>
      )}
      {/* the one after: there is always a next */}
      <span className="gc-stop then" style={{ left: '100%' }}>
        <small>{row.after.target}</small>
      </span>
    </m.div>
  )
}
