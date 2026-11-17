import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { FarmerFace } from '../../../src/farm/FarmerFace'
import { MOMENT_MOODS, moodFor, type Moment } from '../../../src/farm/firstSteps'
import { art } from '../../../src/ui/art'
import { Check, PersonSimpleWalk, X } from '../../../src/ui/glyphs'
import { POP, SPRING } from '../../../src/ui/motion'
import { coinsOf, picOf, STEPS, type StepsState } from './data'
import { Backdrop, Column, Finale, Others, StandIn, usePay, useSteps, WalkNote, type Steps } from './parts'
import './StepsC.css'

// C · a word bubble from a farmer's face, as the game has it (src/farm/FirstSteps.tsx): the farm's neighbour says each
// step in a bubble — its picture, its words typed in, its reward — and a tap on the bubble walks you there. His face is
// the game's own (src/farm/FarmerFace.tsx), in the mood of what he says: each line's, and the moments' (the walk, a step
// done, the skip question, "All set!"). Done, a tick is stamped on the bubble, the coins fly, he beams and hops, and
// the next line comes. The ✕ sits on the bubble's corner. Every rule of its CSS is under .v-first-steps-c.

/** The words typed in a letter at a time (all at once for whoever prefers less motion); the rest of the line is kept,
 *  unseen, so the bubble is its full size from the start and nothing moves as the letters come. */
function Typed({ text }: { text: string }) {
  const still = useReducedMotion()
  const [n, setN] = useState(still ? text.length : 0)
  useEffect(() => {
    if (still) return
    const t = window.setInterval(() => setN((k) => (k >= text.length ? k : k + 1)), 26)
    return () => window.clearInterval(t)
  }, [text, still])
  const shown = still ? text.length : n
  return (
    <span className="v-first-steps-c-words" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <span className="v-first-steps-c-ghost" aria-hidden="true">
        {text.slice(shown)}
      </span>
    </span>
  )
}

function Talk({ st }: { st: Steps }) {
  const def = STEPS[st.k]
  const done = st.phase === 'done'
  const asking = st.phase === 'ask'
  const moment: Moment | null = done ? 'passed' : asking ? 'ask' : st.walking ? 'walk' : null
  return (
    <m.div className="v-first-steps-c-talk" layout="position" exit={{ opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}>
      <FarmerFace mood={moodFor(def, moment)} beat={`${def.id}:${moment ?? 'says'}`} />
      <AnimatePresence mode="popLayout" initial={false}>
        {asking ? (
          <m.div
            key="ask"
            className="v-first-steps-c-bubble ask"
            role="group"
            aria-label="Skip the tips?"
            style={{ originX: 0, originY: 0.5 }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.14 } }}
            transition={SPRING.pop}
          >
            <span className="v-first-steps-c-words">Skip the tips?</span>
            <span className="v-first-steps-c-answers">
              <button className="btn small soft" onClick={st.keep}>
                Keep
              </button>
              <button className="btn small berry" onClick={st.skip}>
                Skip
              </button>
            </span>
          </m.div>
        ) : (
          <m.div
            key={st.k}
            className="v-first-steps-c-said"
            style={{ originX: 0, originY: 0.5 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.14 } }}
            transition={{ ...SPRING.pop, delay: 0.12 }}
          >
            <m.button
              className={`v-first-steps-c-bubble${st.walking ? ' going' : ''}${done ? ' done' : ''}`}
              whileTap={{ scale: 0.96 }}
              transition={SPRING.pop}
              onClick={st.walk}
              aria-label={`${def.say} — walk there`}
              aria-pressed={st.walking}
            >
              <img className="art v-first-steps-c-pic" src={picOf(def)} alt="" draggable={false} />
              <Typed text={def.say} />
              <m.span ref={st.reward} className="v-first-steps-c-reward" animate={done ? { opacity: 0, scale: 0.5 } : { opacity: 1, scale: 1 }} transition={{ delay: done ? 0.26 : 0, duration: 0.18 }}>
                <img src={art('coin')} alt="" />+{coinsOf(def)}
              </m.span>
              <AnimatePresence>
                {st.walking && (
                  <m.i key="walk" className="v-first-steps-c-walk" variants={POP} initial="hidden" animate="show" exit="out">
                    <PersonSimpleWalk weight="bold" />
                  </m.i>
                )}
                {done && (
                  <m.i key="tick" className="v-first-steps-c-tick" initial={{ opacity: 0, scale: 2.2, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: -12 }} transition={SPRING.pop}>
                    <Check weight="bold" />
                  </m.i>
                )}
              </AnimatePresence>
            </m.button>
            <button className="v-first-steps-c-x" onClick={st.ask} aria-label="Skip the tips">
              <i>
                <X weight="bold" />
              </i>
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  )
}

export function StepsC({ s, onClose }: { s: StepsState; onClose: () => void }) {
  const { payRef, pay } = usePay()
  const st = useSteps(s, onClose, pay)
  const shown = st.phase === 'show' || st.phase === 'done' || st.phase === 'ask'
  return (
    <div className="v-first-steps-c">
      <Backdrop s={s} payRef={payRef} />
      <Column>
        {s.play === 'full' && <Others />}
        <AnimatePresence mode="popLayout">
          {shown && <Talk key="talk" st={st} />}
          {st.phase === 'final' && <Finale key="final" face={<FarmerFace mood={MOMENT_MOODS.final} small />} />}
        </AnimatePresence>
      </Column>
      <StandIn st={st} />
      <WalkNote st={st} />
    </div>
  )
}
