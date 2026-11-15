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
import './GoalsA.css'

// A · the next goal, in the spotlight: the goal nearest to done (or reached) is big at the top — its picture in a ring
// that fills, what to do, the count, the words for how far (what is done under half, what is left past it, "Only 3
// more!" in the last quarter), and what it gives, as pictures. Its bar marks where this step began: the part before
// the mark was already yours when it began. The others are short rows under it; a touch on one brings it into the
// spotlight. Its moment: Claim — the coins fly to the coin chip, confetti, and the card turns over to the goal's next
// step, already part full ("40% there already": what you did counts on).

export function GoalsA({ s, act }: { s: GoalsState; act: Act<GoalsState> }) {
  const still = useReducedMotion()
  const [pick, setPick] = useState<GoalId | null>(null)
  const hero = s.rows.find((r) => r.id === pick) ?? s.rows[0]
  const rest = s.rows.filter((r) => r !== hero)
  const take = (row: GoalRow, el: HTMLElement) => {
    setPick(row.id)
    claim(s, act, row, el, still ? 0 : 420)
  }
  return (
    <LevelSheet name="v-goals v-goals-a" label="Goals" onClose={act.close}>
      <m.header className="ga-head" variants={ITEM}>
        <img className="art" src={art('trophy')} alt="" />
        <h2>Goals</h2>
        {s.ready ? <span className="tag ok">{s.ready} to claim</span> : <span className="tag">Next up</span>}
        <m.button className="close" onClick={act.close} aria-label="Close (Esc)" {...PRESS}>
          <X weight="bold" />
        </m.button>
      </m.header>
      <LayoutGroup>
        <div className="ga-body">
          <AnimatePresence mode="popLayout" initial={false}>
            <Hero key={`${hero.id}-${hero.step}`} row={hero} fresh={pick === hero.id && hero.step > 0} onClaim={take} />
          </AnimatePresence>
          <m.div className="ga-more" variants={ITEM}>
            <h3>Also on the way</h3>
            <ul>
              {rest.map((r) => (
                <m.li key={r.id} layout transition={SPRING.sheet}>
                  <m.button className={`ga-row${r.done ? ' done' : ''}`} onClick={() => setPick(r.id)} aria-label={`${r.words}: ${Math.min(r.have, r.target)} of ${r.target}`} {...PRESS}>
                    <GoalPic row={r} />
                    <span className="ga-row-text">
                      <b>{r.words}</b>
                      <span className="goal-bar small" style={{ '--from': r.from / r.target } as CSSProperties}>
                        <i style={{ width: `${r.part * 100}%` }} />
                      </span>
                    </span>
                    {r.done ? (
                      <span className="ga-row-ready">
                        <Check weight="bold" />
                      </span>
                    ) : (
                      <span className="ga-row-count">
                        {r.have}/{r.target}
                      </span>
                    )}
                  </m.button>
                </m.li>
              ))}
            </ul>
          </m.div>
        </div>
      </LayoutGroup>
    </LevelSheet>
  )
}

/** The goal in the spotlight. It turns over (out, and in as its next step) after a claim. */
function Hero({ row, fresh, onClaim }: { row: GoalRow; fresh: boolean; onClaim: (row: GoalRow, el: HTMLElement) => void }) {
  return (
    <m.section
      className={`ga-hero${row.done ? ' done' : ''}${row.part >= 0.75 && !row.done ? ' warm' : ''}`}
      aria-label={`${row.words}: ${Math.min(row.have, row.target)} of ${row.target}`}
      initial={{ opacity: 0, rotateX: -70, y: 10 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      exit={{ opacity: 0, rotateX: 70, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={{ ...SPRING.soft, delay: 0.06 }}
      style={{ transformPerspective: 700 }}
    >
      <div className="ga-pic">
        <Ring part={row.part} done={row.done} size={96} stroke={8} />
        <GoalPic row={row} />
        {row.done && (
          <m.span className="ga-seal" initial={{ scale: 2.2, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={{ ...SPRING.pop, delay: 0.3 }}>
            <Check weight="bold" />
          </m.span>
        )}
      </div>
      <div className="ga-text">
        <small>Step {row.step + 1}</small>
        <h3>{row.words}</h3>
        <p className="ga-count">
          <b>{Math.min(row.have, row.target)}</b> / {row.target}
        </p>
        <span className={`ga-say${row.done ? ' done' : ''}`}>{fresh ? `${Math.round(row.part * 100)}% there already!` : howFar(row)}</span>
      </div>
      <div className="ga-gives">
        <span>Gives</span>
        <Reward row={row} />
      </div>
      {row.done ? (
        <m.button className="btn leaf ga-claim" onClick={(e) => onClaim(row, e.currentTarget)} whileTap={{ scale: 0.95, y: 3 }} transition={SPRING.pop} aria-label={`Claim ${row.reward.coins} coins`}>
          <Check weight="bold" /> Claim
        </m.button>
      ) : (
        <div className="goal-bar big" style={{ '--from': row.from / row.target } as CSSProperties} role="progressbar" aria-valuemin={0} aria-valuemax={row.target} aria-valuenow={row.have}>
          <m.i initial={{ width: fresh ? `${(row.from / row.target) * 100}%` : '0%' }} animate={{ width: `${row.part * 100}%` }} transition={{ delay: 0.25, duration: 0.8, ease: EASE.out }} />
          {row.from > 0 && <b className="goal-bar-from" title="Where this step began" />}
        </div>
      )}
    </m.section>
  )
}
