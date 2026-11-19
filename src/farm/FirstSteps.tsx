import { AnimatePresence, m } from 'motion/react'
import { useLessMotion } from '../ui/still'
import { useEffect, useRef, useState } from 'react'
import { uiClick } from '../audio/sound'
import { flyCoins, flyItem } from '../fx/coins'
import { coinsToFly } from '../fx/fx'
import { celebrate } from '../fx/reward'
import { useWalk, walkTo } from '../lib/route/walking'
import { tierRank, type Tier } from '../lib/tier'
import { useHome } from '../store'
import { art } from '../ui/art'
import { Check, PersonSimpleWalk, X } from '../ui/glyphs'
import { POP, SPRING, nope } from '../ui/motion'
import { Reveal } from '../ui/Reveal'
import { TopSlot } from '../ui/TopStack'
import { useGameFree } from '../ui/useGameFree'
import { storeOf } from './data'
import { FarmerFace } from './FarmerFace'
import { FIRST_STEPS, MOMENT_MOODS, lineFor, moodFor, type Line, type Moment, type Pic, type StepDef } from './firstSteps'
import { iconUrl } from './icons'
import type { Prize } from './prize'
import { farm, holdReveal, passedWaiting, skipSteps, stepNow, takePassed, useFarm } from './state'
import { walkTarget } from './walkTargets'
import { rewardTier } from './worth'
import { levelOf } from './xp'
import './FirstSteps.css'

// A new farm's first steps (./firstSteps.ts; the design lab's board "first-steps", C, the user's choice): the farm's
// neighbour, a round portrait under the compass, says the step in a word bubble — its picture, its words typed in, its
// reward — and a tap on the bubble walks you there (the compass's own walk: walkTo, ./walkTargets.ts; again, it stops;
// nowhere to go, it shakes). What he says follows the farm (lineFor: the step's turns, "Water it once it's dry",
// "Now fetch eggs"); a new line types in again, and the tick stamps the last line he said, whole. His face is the mood
// of what he says (./FarmerFace.tsx: each line's own, and the moments': a nod as you walk, a sigh with nowhere to go,
// a kind nod at the skip question), changing as the line types in. Done (the farm passes it a frame later, src/farm/state.ts), a tick is stamped on the bubble, the reward flies to
// its chip, the farmer beams and hops, and the next line comes; one done under a panel plays when the panel closes.
// After the last, "All set!" with every step's picture ticked and all the coins they gave, stars in his eyes, and
// confetti once. The ✕ on the bubble's corner asks "Skip the tips?" there in the bubble: Keep, or Skip (over for good).
// Shown on the farm while nothing is over the game; the clear view leaves it out.

/** How long a step's tick shows before the next comes in; how long the last card stays; how long he sighs. */
const DONE_MS = 1150
const FINAL_MS = 4200
const NOWHERE_MS = 1400

/** A line's picture: one of the farm's goods (its model), or a piece of interface art. */
export const picOf = (s: { pic: Pic }) => ('item' in s.pic ? iconUrl(s.pic.item) : art(s.pic.art))
/** Every step's coins together (the last card's sum). */
const ALL_COINS = FIRST_STEPS.reduce((n, s) => n + ('coins' in s.reward ? s.reward.coins : 0), 0)
/** How big rewards are at the farm's level now (src/farm/worth.ts): the biggest of `each` (steps done together, each
 *  counted as it passed), its show's tier. */
const tierOf = (each: readonly (readonly Prize[])[]): Tier =>
  each.map((p) => rewardTier(p, farm.xp ? levelOf(farm.xp.points) : 1)).reduce((a, b) => (tierRank(b) > tierRank(a) ? b : a), 'small' as Tier)

/** The words typed in a letter at a time (all at once for whoever prefers less motion, and the whole line at once
 *  when it is done: the tick stamps a line that can be read); the rest of the line is kept, unseen, so the bubble is
 *  its full size from the start and nothing moves as the letters come. A new line types in again. */
function Typed({ text, whole }: { text: string; whole?: boolean }) {
  const still = useLessMotion()
  const [n, setN] = useState(still ? text.length : 0)
  useEffect(() => {
    setN(still ? text.length : 0)
    if (still) return
    const t = window.setInterval(() => setN((k) => (k >= text.length ? k : k + 1)), 26)
    return () => window.clearInterval(t)
  }, [text, still])
  const shown = still || whole ? text.length : n
  return (
    <span className="step-words">
      <span>{text.slice(0, shown)}</span>
      <span className="step-ghost">{text.slice(shown)}</span>
    </span>
  )
}

/** The last card: "All set!", every step's picture ticked, and every coin they gave — confetti once, as it lands. */
function Finale() {
  const at = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // (as big as every coin they gave, together; no sound of its own: each step's played as it was done)
    const t = window.setTimeout(() => celebrate('step', tierOf([FIRST_STEPS.map((s) => s.reward)]), at.current, { sound: false }), 260)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <m.div ref={at} className="step-final" layout="position" exit={{ opacity: 0, transition: { duration: 0.3 } }} transition={SPRING.pop}>
      <FarmerFace mood={MOMENT_MOODS.final} small />
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
  // a tap with nowhere to walk to yet: the farmer sighs a moment (a timer of its own: a step passing clears the others)
  const [nowhere, setNowhere] = useState(false)
  const sigh = useRef(0)
  // the bubble on the screen now and its reward (each kept as it comes in: one going out leaves them be)
  const reward = useRef<HTMLSpanElement | null>(null)
  const bubble = useRef<HTMLButtonElement | null>(null)
  const timers = useRef<number[]>([])
  const later = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms))
  // the last line said for the step on the bubble: what the tick stamps once it is done
  const said = useRef<{ step: StepDef; line: Line } | null>(null)
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      window.clearTimeout(sigh.current)
    },
    [],
  )

  // the steps the farm passed (a frame after it did them), shown while the hint is: the tick, the reward flying to its
  // chip, the farmer beaming and hopping, then the next step — or, after the last, the card "All set!"
  useEffect(() => {
    if (!active) return
    const passed = takePassed()
    if (!passed.length) return
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    window.clearTimeout(sigh.current)
    setNowhere(false)
    setShown((s) => (s && passed.includes(s) ? s : passed[passed.length - 1]))
    setPhase('done')
    // its sting and its touch, as big as the reward (no confetti here: the bubble's tick is the moment)
    celebrate('step', tierOf(passed.map((s) => [s.reward])), null)
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
  // the last card stays a while, then the slot is free; what the steps held back at the top (src/farm/reveal.ts) waits
  // for it to go, then comes in a part at a time
  useEffect(() => {
    if (phase !== 'final') return
    holdReveal(true)
    const t = window.setTimeout(() => setPhase('show'), FINAL_MS)
    return () => {
      window.clearTimeout(t)
      holdReveal(false)
    }
  }, [phase])

  // (a step the farm has just passed is still the one shown until the hint takes it: the bubble ticks, then moves on)
  const waiting = passedWaiting()
  const def = shown ?? waiting[waiting.length - 1] ?? now
  const done = phase === 'done'
  // what he says: the line the farm is at now (the step's own, or one of its turns); done, the last he said for it (kept
  // as each frame is drawn)
  const kept = said.current?.step === def ? said.current.line : null
  const line: Line | null = !def ? null : done || def !== now ? (kept ?? { say: def.say, mood: def.mood, pic: def.pic, target: def.target, turn: -1 }) : lineFor(def, farm)
  useEffect(() => {
    if (def && line && !done && def === now) said.current = { step: def, line }
  })
  const going = goingTo !== null && walking === goingTo && phase === 'show'
  // what the farmer feels besides the line he says (./firstSteps.ts, MOMENT_MOODS)
  const moment: Moment | null = done ? 'passed' : phase === 'ask' ? 'ask' : nowhere ? 'nowhere' : going ? 'walk' : null

  const walk = () => {
    if (!def || !line || phase !== 'show') return
    const id = walkTarget(line.target)
    if (!id) {
      nope(bubble.current)
      window.clearTimeout(sigh.current)
      setNowhere(true)
      sigh.current = window.setTimeout(() => setNowhere(false), NOWHERE_MS)
      return
    }
    uiClick()
    window.clearTimeout(sigh.current)
    setNowhere(false)
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
                <FarmerFace mood={moodFor(line, moment)} beat={`${def.id}:${line?.turn ?? -1}:${moment ?? 'says'}`} />
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
                        aria-label={`${line?.say ?? def.say} — walk there`}
                        aria-pressed={going}
                        data-step={def.id}
                        data-turn={line?.turn ?? -1}
                      >
                        <img className="art step-pic" src={picOf(line ?? def)} alt="" draggable={false} />
                        <Typed text={line?.say ?? def.say} whole={done} />
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
                          {/* the walker on its corner from the start (a tap walks you there), in sun while you go */}
                          {!done && (
                            <m.i key="walk" className="step-walk" style={going ? undefined : { background: 'var(--paper)' }} variants={POP} initial="hidden" animate="show" exit="out">
                              <PersonSimpleWalk weight={going ? 'fill' : 'bold'} />
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
