import { AnimatePresence, m } from 'motion/react'
import { art } from '../../../src/ui/art'
import { Check, PersonSimpleWalk, X } from '../../../src/ui/glyphs'
import { POP, SPRING } from '../../../src/ui/motion'
import { coinsOf, picOf, STEPS, type StepsState } from './data'
import { Backdrop, Column, Finale, Others, StandIn, usePay, useSteps, WalkNote, type Steps } from './parts'
import './StepsB.css'

// B · a small paper card under the compass: the steps as eight dots along its top (the ones done green and ticked,
// this one ringed in sun — "3 of 8"), the step's picture, words and reward, and a yellow "Show me" that walks you
// there (it says "Stop" while you go). Done: its dot fills with a pop, the coins fly, and the card turns to the next
// step (the old one slides out to the left, the new one in from the right). Every rule of its CSS is under
// .v-first-steps-b.

/** The eight steps as dots: done (green, ticked), this one (sun ring; filling as it is done), to come (empty). */
function Dots({ k, done }: { k: number; done: boolean }) {
  const passed = k + (done ? 1 : 0)
  return (
    <span className="v-first-steps-b-dots" aria-label={`${passed} of ${STEPS.length} done`}>
      {STEPS.map((d, i) => {
        const state = i < k || (i === k && done) ? 'done' : i === k ? 'now' : 'next'
        return (
          <m.i key={d.id} className={`v-first-steps-b-dot ${state}`} animate={i === k && done ? { scale: [1, 1.5, 1] } : { scale: 1 }} transition={{ duration: 0.35 }}>
            {state === 'done' && <Check weight="bold" />}
          </m.i>
        )
      })}
      <b>
        {passed} of {STEPS.length}
      </b>
    </span>
  )
}

function Card({ st }: { st: Steps }) {
  const def = STEPS[st.k]
  const done = st.phase === 'done'
  const asking = st.phase === 'ask'
  return (
    <m.div
      className={`v-first-steps-b-card${st.walking ? ' going' : ''}`}
      layout="position"
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={SPRING.sheet}
    >
      <div className="v-first-steps-b-top">
        <Dots k={st.k} done={done} />
        {!asking && (
          <button className="v-first-steps-b-x" onClick={st.ask} aria-label="Skip the tips">
            <X weight="bold" />
          </button>
        )}
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {asking ? (
          <m.div
            key="ask"
            className="v-first-steps-b-body ask"
            role="group"
            aria-label="Skip the tips?"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={SPRING.pop}
          >
            <b className="v-first-steps-b-say">Skip the tips?</b>
            <button className="btn small soft" onClick={st.keep}>
              Keep
            </button>
            <button className="btn small berry" onClick={st.skip}>
              Skip
            </button>
          </m.div>
        ) : (
          <m.div
            key={st.k}
            className="v-first-steps-b-body"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40, transition: { duration: 0.16 } }}
            transition={SPRING.pop}
          >
            <span className="v-first-steps-b-pic">
              <img className="art" src={picOf(def)} alt="" draggable={false} />
              <AnimatePresence>
                {done && (
                  <m.i key="tick" className="v-first-steps-b-tick" variants={POP} initial="hidden" animate="show" exit="out">
                    <Check weight="bold" />
                  </m.i>
                )}
              </AnimatePresence>
            </span>
            <span className="v-first-steps-b-text">
              <b className="v-first-steps-b-say">{def.say}</b>
              <m.span ref={st.reward} className="v-first-steps-b-reward" animate={done ? { opacity: 0, y: -6 } : { opacity: 1, y: 0 }} transition={{ delay: done ? 0.26 : 0, duration: 0.2 }}>
                <img src={art('coin')} alt="" />+{coinsOf(def)} coins
              </m.span>
            </span>
            <button className={`btn small ${st.walking ? 'soft' : ''} v-first-steps-b-go`} onClick={st.walk} disabled={done} aria-label={`${def.say} — walk there`} aria-pressed={st.walking}>
              {st.walking ? (
                <>
                  <PersonSimpleWalk weight="bold" />
                  Stop
                </>
              ) : (
                'Show me'
              )}
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  )
}

export function StepsB({ s, onClose }: { s: StepsState; onClose: () => void }) {
  const { payRef, pay } = usePay()
  const st = useSteps(s, onClose, pay)
  const shown = st.phase === 'show' || st.phase === 'done' || st.phase === 'ask'
  return (
    <div className="v-first-steps-b">
      <Backdrop s={s} payRef={payRef} />
      <Column>
        {s.play === 'full' && <Others />}
        <AnimatePresence mode="popLayout">
          {shown && <Card key="card" st={st} />}
          {st.phase === 'final' && <Finale key="final" />}
        </AnimatePresence>
      </Column>
      <StandIn st={st} />
      <WalkNote st={st} />
    </div>
  )
}
