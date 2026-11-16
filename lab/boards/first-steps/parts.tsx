import { AnimatePresence, m } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { iconUrl } from '../../../src/farm/icons'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { SPRING } from '../../../src/ui/motion'
import { TopC, type Behind } from '../top/TopC'
import { Reveal } from '../unlocks/Reveal'
import { ALL_COINS, coinsOf, DOES, picOf, STEPS, topFor, WALKS_TO, type StepsState } from './data'
import './parts.css'

// What every variant of the "first-steps" board shares: the game's top behind (the top board's D, live: the coin chip
// the rewards fly into, the compass the hint stands under), the top column under it (src/ui/TopStack.tsx: the
// toast, the level-up, the first hint and, in the plan, the step after them), the other slots for the column full,
// the steps' engine (which step, walking or not, a step passing, the skip question, the last card), the lab's
// stand-in for doing a step, its note of where a tap walks you, and the last card ("All set!", the unlocks board's
// Reveal: the garment's card made general).

/** Where a step stands: shown, just done (its tick, its coins flying), the skip question, the last card, gone. */
export type Phase = 'show' | 'done' | 'ask' | 'final' | 'gone'

export interface Steps {
  /** the step shown (FIRST_STEPS' index) */
  k: number
  phase: Phase
  walking: boolean
  /** where the reward is drawn: its coins take off from there */
  reward: RefObject<HTMLSpanElement | null>
  /** the hint tapped: walking there (the compass's walk), or, tapped again, stopped */
  walk: () => void
  /** the step done (the lab's stand-in for doing it) */
  pass: () => void
  ask: () => void
  keep: () => void
  skip: () => void
}

/** How long a step's tick shows before the next comes in; how long the last card stays. */
const DONE_MS = 1150
const FINAL_MS = 4200

/**
 * The steps as the plan's engine runs them (src/farm/firstSteps.ts: advance, skipped), on the lab's stand-in: a step
 * passed ticks, pays its coins (they fly from its reward to the coin chip) and the next comes in; after the last, the
 * card "All set!"; skipped (✕, then Skip), the hint goes. `pay` flies coins from a point of the screen to the coin chip.
 */
export function useSteps(s: StepsState, onClose: () => void, pay: (n: number, from: { x: number; y: number }) => void): Steps {
  const [k, setK] = useState(s.step)
  const [phase, setPhase] = useState<Phase>(s.play === 'skip' ? 'ask' : 'show')
  const [walking, setWalking] = useState(s.play === 'walk')
  const reward = useRef<HTMLSpanElement>(null)
  const timers = useRef<number[]>([])
  const now = useRef({ k, phase, pay, onClose })
  useEffect(() => {
    now.current = { k, phase, pay, onClose }
  })
  const later = useCallback((f: () => void, ms: number) => {
    timers.current.push(window.setTimeout(f, ms))
  }, [])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const pass = useCallback(() => {
    const { k: at, phase: was } = now.current
    if (was !== 'show') return
    setWalking(false)
    setPhase('done')
    const r = reward.current?.getBoundingClientRect()
    const coins = coinsOf(STEPS[at])
    // the coins take off a beat after the tick has popped
    later(() => r && coins && now.current.pay(coins, { x: r.left + r.width / 2, y: r.top + r.height / 2 }), 260)
    later(() => {
      if (at + 1 < STEPS.length) {
        setK(at + 1)
        setPhase('show')
      } else setPhase('final')
    }, DONE_MS)
  }, [later])

  // the last card stays a while, then goes (the lab opens the board again)
  useEffect(() => {
    if (phase === 'final') later(() => setPhase('gone'), FINAL_MS)
    if (phase === 'gone') later(() => now.current.onClose(), 700)
  }, [phase, later])
  // a state that shows a step passing plays it as it opens
  useEffect(() => {
    if (s.play === 'pass') later(pass, 1300)
  }, [s.play, later, pass])

  return {
    k,
    phase,
    walking,
    reward,
    walk: () => setWalking((w) => !w),
    pass,
    ask: () => {
      setWalking(false)
      setPhase('ask')
    },
    keep: () => setPhase('show'),
    skip: () => setPhase('gone'),
  }
}

/** The dashboard of the game's top (lab/boards/top, D) for a new farm at this step, standing still (it is the
 *  scene's, not the design's); `payRef` flies coins into its coin chip, which counts them as they land. */
export function Backdrop({ s, payRef }: { s: StepsState; payRef?: Behind['payRef'] }) {
  const [top, setTop] = useState(() => topFor(s))
  return (
    <AnimatePresence initial={false}>
      <TopC s={top} set={setTop} bare payRef={payRef} />
    </AnimatePresence>
  )
}

/** A way to pay the dashboard's coin chip from a variant. */
export function usePay() {
  const payRef = useRef<((amount: number, from: { x: number; y: number }) => void) | null>(null)
  const pay = useCallback((n: number, from: { x: number; y: number }) => payRef.current?.(n, from), [])
  return { payRef, pay }
}

/** The top column under the dashboard (src/ui/TopStack.tsx): the step's slot comes after the toast, the level-up and
 *  the first hint (the plan's ORDER: steps 5). */
export const Column = ({ children }: { children: ReactNode }) => <div className="v-first-steps-col">{children}</div>

const coarse = () => matchMedia('(pointer: coarse)').matches
const HINT_WORDS = 'Walk with the stick · drag anywhere to look · the round button does what is near you'

/** Today's first hint (src/ui/Hud.tsx FirstHint): seven seconds of the controls, a touch screen's first entry — in
 *  the top column on a touch screen, along the bottom on a computer. */
export function FirstHint() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setOn(false), 7000)
    return () => window.clearTimeout(t)
  }, [])
  if (!on) return null
  return coarse() ? (
    <m.div className="top-slot" layout="position">
      <div className="first-hint touch" aria-hidden="true">
        {HINT_WORDS}
      </div>
    </m.div>
  ) : (
    <div className="first-hint" aria-hidden="true">
      Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> · look with the mouse · <kbd>Esc</kbd> for settings
    </div>
  )
}

const slot = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0.2 } } }

/** The rest of the column at its fullest: a toast of what came in, the level's show (the game's markup), the first
 *  hint — each going at its own time (2.2 s, 2.4 s, 7 s), the slots under them moving up. */
export function Others() {
  const [toast, setToast] = useState(true)
  const [level, setLevel] = useState(true)
  useEffect(() => {
    const a = window.setTimeout(() => setToast(false), 2200)
    const b = window.setTimeout(() => setLevel(false), 2400)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [])
  return (
    <>
      <AnimatePresence>
        {toast && (
          <m.div key="toast" className="top-slot top-slot-toast" layout="position" {...slot}>
            <div className="toast">
              <img className="toast-item" src={iconUrl('lettuce')} alt="" />+ 8 lettuces
            </div>
          </m.div>
        )}
        {level && (
          <m.div key="level" className="top-slot" layout="position" {...slot}>
            <div className="level-up">
              <div className="level-up-show">
                <span className="level-up-flash" aria-hidden="true" />
                <span className="level-up-ring" aria-hidden="true" />
                <span className="level-up-ring late" aria-hidden="true" />
                <span className="level-up-word">Level</span>
                <b className="level-up-number">2</b>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <FirstHint />
    </>
  )
}

/** The lab's stand-in for doing the step (the action button, where the step's thing is): a press passes it. */
export function StandIn({ st }: { st: Steps }) {
  const def = STEPS[st.k]
  if (st.phase === 'final' || st.phase === 'gone') return null
  return (
    <button className="top-lab-sale v-first-steps-do" onClick={st.pass} disabled={st.phase !== 'show'} aria-label={`Do the step: ${def.say} (a stand-in for the action)`}>
      <span className="top-lab-sale-tag">דוגמה</span>
      <img className="art" src={picOf(def)} alt="" />
      {DOES[def.id]}
    </button>
  )
}

/** The lab's note while walking: where the game's walk takes you (the arrow over the thing, the stick taking over). */
export function WalkNote({ st }: { st: Steps }) {
  const def = STEPS[st.k]
  return (
    <AnimatePresence>
      {st.walking && st.phase === 'show' && (
        <m.div key={def.id} className="top-lab-opens v-first-steps-note" role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          במשחק: הולכים {WALKS_TO[def.id]} · נגיעה נוספת עוצרת
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** The last card: "All set!", the eight steps' pictures ticked, and every coin they gave — a burst of confetti once,
 *  as it lands (the one celebration of the first ten minutes). */
export function Finale({ face }: { face?: ReactNode }) {
  const at = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = window.setTimeout(() => at.current && burst(at.current, { count: 70, spread: 80 }), 260)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <m.div ref={at} className="v-first-steps-final" layout="position" exit={{ opacity: 0, transition: { duration: 0.3 } }} transition={SPRING.pop}>
      {face}
      <Reveal
        word="All set!"
        note={
          <span className="tag v-first-steps-sum">
            <img src={art('coin')} alt="" />
            {ALL_COINS}
          </span>
        }
        items={STEPS.map((d) => ({ pic: picOf(d), done: true }))}
        cols={STEPS.length}
        small
        label={`All set: every first step done, ${ALL_COINS} coins in all`}
      />
    </m.div>
  )
}
