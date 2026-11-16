import { AnimatePresence, m } from 'motion/react'
import { art } from '../../../src/ui/art'
import { Check, PersonSimpleWalk, X } from '../../../src/ui/glyphs'
import { POP, PRESS, SPRING } from '../../../src/ui/motion'
import { coinsOf, picOf, STEPS, type StepsState } from './data'
import { Backdrop, Column, Finale, Others, StandIn, usePay, useSteps, WalkNote, type Steps } from './parts'
import './StepsA.css'

// A · a chip under the compass: one dark pill like the compass's own marks — the step's picture, its words, its reward
// — and a small ✕ beside it. A tap walks you there (the compass's walk: the chip ringed in sun, as a mark is while you
// go); done, a tick pops on its picture, its coins fly up to the coin chip and the next step slides in from below.
// Every rule of its CSS is under .v-first-steps-a.

function Chip({ st }: { st: Steps }) {
  const def = STEPS[st.k]
  const done = st.phase === 'done'
  return (
    <m.div
      className="v-first-steps-a-hint"
      layout="position"
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.18, ease: 'easeIn' } }}
      transition={SPRING.pop}
    >
      <m.button
        className={`v-first-steps-a-chip${st.walking ? ' going' : ''}${done ? ' done' : ''}`}
        whileTap={{ scale: 0.95 }}
        transition={SPRING.pop}
        onClick={st.walk}
        aria-label={`${def.say} — walk there`}
        aria-pressed={st.walking}
      >
        <span className="v-first-steps-a-pic">
          <img className="art" src={picOf(def)} alt="" draggable={false} />
          <AnimatePresence>
            {st.walking && (
              <m.i key="walk" className="v-first-steps-a-walk" variants={POP} initial="hidden" animate="show" exit="out">
                <PersonSimpleWalk weight="bold" />
              </m.i>
            )}
            {done && (
              <m.i key="tick" className="v-first-steps-a-tick" variants={POP} initial="hidden" animate="show" exit="out">
                <Check weight="bold" />
              </m.i>
            )}
          </AnimatePresence>
        </span>
        <span className="v-first-steps-a-say">{def.say}</span>
        <m.span ref={st.reward} className="v-first-steps-a-reward" animate={done ? { opacity: 0, scale: 0.5 } : { opacity: 1, scale: 1 }} transition={{ delay: done ? 0.26 : 0, duration: 0.18 }}>
          <img src={art('coin')} alt="" />+{coinsOf(def)}
        </m.span>
      </m.button>
      <m.button className="v-first-steps-a-x" {...PRESS} onClick={st.ask} aria-label="Skip the tips">
        <X weight="bold" />
      </m.button>
    </m.div>
  )
}

/** ✕ pressed: the chip asks in its place, Keep first, Skip last. */
function Ask({ st }: { st: Steps }) {
  return (
    <m.div
      className="v-first-steps-a-ask"
      layout="position"
      role="group"
      aria-label="Skip the tips?"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
      transition={SPRING.pop}
    >
      <span>Skip the tips?</span>
      <button className="btn small soft" onClick={st.keep}>
        Keep
      </button>
      <button className="btn small berry" onClick={st.skip}>
        Skip
      </button>
    </m.div>
  )
}

export function StepsA({ s, onClose }: { s: StepsState; onClose: () => void }) {
  const { payRef, pay } = usePay()
  const st = useSteps(s, onClose, pay)
  const shown = st.phase === 'show' || st.phase === 'done'
  return (
    <div className="v-first-steps-a">
      <Backdrop s={s} payRef={payRef} />
      <Column>
        {s.play === 'full' && <Others />}
        <AnimatePresence mode="popLayout">
          {shown && <Chip key={`s${st.k}`} st={st} />}
          {st.phase === 'ask' && <Ask key="ask" st={st} />}
          {st.phase === 'final' && <Finale key="final" />}
        </AnimatePresence>
      </Column>
      <StandIn st={st} />
      <WalkNote st={st} />
    </div>
  )
}
