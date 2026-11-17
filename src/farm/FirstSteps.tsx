import { AnimatePresence, animate, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { farmSound, uiClick } from '../audio/sound'
import { flyCoins, flyItem } from '../fx/coins'
import { coinsToFly } from '../fx/fx'
import { haptic } from '../lib/device'
import { useWalk, walkTo } from '../lib/route/walking'
import { useHome } from '../store'
import { art } from '../ui/art'
import { burst } from '../ui/burst'
import { Check, PersonSimpleWalk, X } from '../ui/glyphs'
import { NOPE, POP, SPRING } from '../ui/motion'
import { Reveal } from '../ui/Reveal'
import { TopSlot } from '../ui/TopStack'
import { useGameFree } from '../ui/useGameFree'
import { storeOf } from './data'
import { FIRST_STEPS, type StepDef } from './firstSteps'
import { iconUrl } from './icons'
import { farm, passedWaiting, skipSteps, stepNow, takePassed, useFarm } from './state'
import { stepTarget } from './walkTargets'
import './FirstSteps.css'

// A new farm's first steps (./firstSteps.ts; the design lab's board "first-steps", C, the user's choice): the farm's
// neighbour, a round portrait under the compass, says the step in a word bubble — its picture, its words typed in, its
// reward — and a tap on the bubble walks you there (the compass's own walk: walkTo, ./walkTargets.ts; again, it stops;
// nowhere to go, it shakes). Done (the farm passes it a frame later, src/farm/state.ts), a tick is stamped on the
// bubble, the reward flies to its chip, the farmer hops, and the next line comes; one done under a panel plays when
// the panel closes. After the last, "All set!" with every step's picture ticked and all the coins they gave, and
// confetti once. The ✕ on the bubble's corner asks "Skip the tips?" there in the bubble: Keep, or Skip (over for good).
// Shown on the farm while nothing is over the game; the clear view leaves it out.

/** How long a step's tick shows before the next comes in; how long the last card stays. */
const DONE_MS = 1150
const FINAL_MS = 4200

/** A step's picture: one of the farm's goods (its model), or a piece of interface art. */
export const picOf = (s: StepDef) => ('item' in s.pic ? iconUrl(s.pic.item) : art(s.pic.art))
/** Every step's coins together (the last card's sum). */
const ALL_COINS = FIRST_STEPS.reduce((n, s) => n + ('coins' in s.reward ? s.reward.coins : 0), 0)

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
    <span className="step-words">
      <span>{text.slice(0, shown)}</span>
      <span className="step-ghost">{text.slice(shown)}</span>
    </span>
  )
}

/** The farmer's face, a little round portrait; it hops as a step is done. */
function Face({ hop, small }: { hop?: boolean; small?: boolean }) {
  return (
    <m.span
      className={`step-face${small ? ' small' : ''}`}
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.4 }}
      animate={hop ? { opacity: 1, scale: 1, y: [0, -10, 0], rotate: [0, -10, 0] } : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
      transition={hop ? { duration: 0.45, ease: 'easeOut' } : SPRING.pop}
    >
      <img src={art('farmer')} alt="" draggable={false} />
    </m.span>
  )
}

/** The last card: "All set!", every step's picture ticked, and every coin they gave — confetti once, as it lands. */
function Finale() {
  const at = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = window.setTimeout(() => at.current && burst(at.current, { count: 70, spread: 80 }), 260)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <m.div ref={at} className="step-final" layout="position" exit={{ opacity: 0, transition: { duration: 0.3 } }} transition={SPRING.pop}>
      <Face small />
      <Reveal
        word="All set!"
        note={
          <span className="tag step-sum">
            <img src={art('coin')} alt="" />
            {ALL_COINS}
          </span>
        }
        items={FIRST_STEPS.map((d) => ({ pic: picOf(d), done: true }))}
        cols={FIRST_STEPS.length}
        small
        label={`All set: every first step done, ${ALL_COINS} coins in all`}
      />
    </m.div>
  )
}

type Phase = 'show' | 'done' | 'ask' | 'final'

export function StepHint() {
  const rev = useFarm((s) => s.rev)
  const onFarm = useHome((s) => s.map === 'farm')
  const active = useGameFree() && onFarm
  const now = stepNow()
  // what the bubble says while a step just done shows its tick (else the step on now), and where it stands
  const [shown, setShown] = useState<StepDef | null>(null)
  const [phase, setPhase] = useState<Phase>('show')
  // the walk a tap started (the bubble glows while it goes on)
  const [goingTo, setGoingTo] = useState<string | null>(null)
  const walking = useWalk((s) => s.id)
  // the bubble on the screen now and its reward (each kept as it comes in: one going out leaves them be)
  const reward = useRef<HTMLSpanElement | null>(null)
  const bubble = useRef<HTMLButtonElement | null>(null)
  const timers = useRef<number[]>([])
  const later = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms))
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // the steps the farm passed (a frame after it did them), shown while the hint is: the tick, the reward flying to its
  // chip, the farmer's hop, then the next step — or, after the last, the card "All set!"
  useEffect(() => {
    if (!active) return
    const passed = takePassed()
    if (!passed.length) return
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setShown((s) => (s && passed.includes(s) ? s : passed[passed.length - 1]))
    setPhase('done')
    haptic('sale')
    farmSound('coins')
    const coins = passed.reduce((n, s) => n + ('coins' in s.reward ? s.reward.coins : 0), 0)
    const goods = passed.flatMap((s) => ('item' in s.reward ? [s.reward.item] : []))
    // the coins take off a beat after the tick has popped
    later(() => {
      const r = reward.current?.getBoundingClientRect()
      if (!r || !r.width) return
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      if (coins) flyCoins(x, y, coinsToFly(coins))
      goods.forEach((g, k) => flyItem(x, y, iconUrl(g), k, storeOf(g)))
    }, 260)
    later(() => {
      setShown(null)
      // all done (not skipped, nor grown past them): the last card
      setPhase(farm.firstSteps.over && farm.firstSteps.step >= FIRST_STEPS.length ? 'final' : 'show')
    }, DONE_MS)
    // (each change of the farm is a look at what passed; the timers are the hint's own)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, active])
  // the last card stays a while, then the slot is free
  useEffect(() => {
    if (phase !== 'final') return
    const t = window.setTimeout(() => setPhase('show'), FINAL_MS)
    return () => window.clearTimeout(t)
  }, [phase])

  // (a step the farm has just passed is still the one shown until the hint takes it: the bubble ticks, then moves on)
  const waiting = passedWaiting()
  const def = shown ?? waiting[waiting.length - 1] ?? now
  const done = phase === 'done'
  const going = goingTo !== null && walking === goingTo && phase === 'show'

  const walk = () => {
    if (!def || phase !== 'show') return
    const id = stepTarget(def.target)
    if (!id) {
      if (bubble.current) void animate(bubble.current, NOPE.keyframes, NOPE.options)
      return
    }
    uiClick()
    walkTo(id)
    setGoingTo(id)
  }
  const ask = () => {
    uiClick()
    setPhase('ask')
  }
  const keep = () => {
    uiClick()
    setPhase('show')
  }
  const skip = () => {
    uiClick()
    skipSteps()
    setPhase('show')
  }

  if (!active) return null
  const final = phase === 'final'
  if (!final && !def) return null
  return (
    <TopSlot name="steps">
      <div className="step-hint">
        <AnimatePresence mode="popLayout">
          {final ? (
            <Finale key="final" />
          ) : (
            def && (
              <m.div key="talk" className="step-talk" layout="position" exit={{ opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } }}>
                <Face hop={done} />
                <AnimatePresence mode="wait" initial={false}>
                  {phase === 'ask' ? (
                    <m.div
                      key="ask"
                      className="step-bubble ask"
                      role="group"
                      aria-label="Skip the tips?"
                      style={{ originX: 0, originY: 0.5 }}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.14 } }}
                      transition={SPRING.pop}
                    >
                      <span className="step-words">Skip the tips?</span>
                      <span className="step-answers">
                        <button className="btn small soft" onClick={keep}>
                          Keep
                        </button>
                        <button className="btn small berry" onClick={skip}>
                          Skip
                        </button>
                      </span>
                    </m.div>
                  ) : (
                    <m.div
                      key={def.id}
                      className="step-said"
                      style={{ originX: 0, originY: 0.5 }}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.14 } }}
                      transition={SPRING.pop}
                    >
                      <m.button
                        ref={(el) => {
                          if (el) bubble.current = el
                        }}
                        className={`step-bubble${going ? ' going' : ''}${done ? ' done' : ''}`}
                        whileTap={{ scale: 0.96 }}
                        transition={SPRING.pop}
                        onClick={walk}
                        aria-label={`${def.say} — walk there`}
                        aria-pressed={going}
                      >
                        <img className="art step-pic" src={picOf(def)} alt="" draggable={false} />
                        <Typed text={def.say} />
                        <m.span
                          ref={(el) => {
                            if (el) reward.current = el
                          }}
                          className="step-reward"
                          animate={done ? { opacity: 0, scale: 0.5 } : { opacity: 1, scale: 1 }}
                          transition={{ delay: done ? 0.26 : 0, duration: 0.18 }}
                        >
                          {'coins' in def.reward ? (
                            <>
                              <img src={art('coin')} alt="" />+{def.reward.coins}
                            </>
                          ) : (
                            <>
                              <img src={iconUrl(def.reward.item)} alt="" />+{def.reward.n}
                            </>
                          )}
                        </m.span>
                        <AnimatePresence>
                          {going && (
                            <m.i key="walk" className="step-walk" variants={POP} initial="hidden" animate="show" exit="out">
                              <PersonSimpleWalk weight="bold" />
                            </m.i>
                          )}
                          {done && (
                            <m.i key="tick" className="step-tick" initial={{ opacity: 0, scale: 2.2, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: -12 }} transition={SPRING.pop}>
                              <Check weight="bold" />
                            </m.i>
                          )}
                        </AnimatePresence>
                      </m.button>
                      {!done && (
                        <button className="step-x" onClick={ask} aria-label="Skip the tips">
                          <i>
                            <X weight="bold" />
                          </i>
                        </button>
                      )}
                    </m.div>
                  )}
                </AnimatePresence>
              </m.div>
            )
          )}
        </AnimatePresence>
      </div>
    </TopSlot>
  )
}
