import { LazyMotion, MotionConfig, animate, m, useMotionValue, useReducedMotion, useTransform, type Transition, type Variants } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

// The interface's motion: Motion for React (motion.dev) — springs, gestures (a press, a drag, a swipe), elements coming
// in and going out (AnimatePresence), layout changes — with the game's own feel kept in one place. Components animate
// with `m.div`, `m.button`… (never `motion.div`: the root is strict, so the bundle carries only what it loads once);
// they take their springs and curves from here, so every screen moves the same way. Whoever prefers less motion
// (prefers-reduced-motion) gets the end of each move at once: MotionConfig does it for transforms and layout,
// `CountUp` and `burst` (./burst.ts) for themselves.

const features = () => import('./motionFeatures').then((f) => f.default)

/** Round the interface (the game's, or a lab frame): Motion's features, loaded once, and reduced motion respected. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={features} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}

/** The game's springs. */
export const SPRING = {
  /** a press, a badge, a chip coming in: quick, a little bounce */
  pop: { type: 'spring', stiffness: 620, damping: 32, mass: 0.7 },
  /** a sheet coming in or going out: no bounce, settles fast */
  sheet: { type: 'spring', stiffness: 420, damping: 42 },
  /** a big picture landing: slower, a soft overshoot */
  soft: { type: 'spring', stiffness: 220, damping: 20 },
} satisfies Record<string, Transition>

/** The game's curves (the same as the CSS tokens --ease-pop and --ease-sheet). */
export const EASE = {
  out: [0.22, 1, 0.36, 1],
  pop: [0.34, 1.56, 0.64, 1],
  sheet: [0.05, 0.7, 0.1, 1],
} as const

// The micro-interactions (the designer's checklist, .claude/agents/ui-designer.md): every one quick, never in the way of
// the next press, and nothing for whoever prefers less motion (MotionConfig, above; the CSS ones in src/styles.css stop
// under prefers-reduced-motion). The game's shared pieces — .btn, cards, chips, tags, the switch, the action button —
// do the same in CSS (src/styles.css, "micro-interactions"): use these where a piece moves with Motion.

/** A press: `<m.button {...PRESS}>` sinks a little under the finger and springs back (a round or flat button). */
export const PRESS = { whileTap: { scale: 0.94 }, transition: SPRING.pop } as const
/** A press of a button on its lip (.btn, .primary): it goes down onto the lip and springs back up. */
export const SINK = { whileTap: { scale: 0.97, y: 3 }, transition: SPRING.pop } as const
/** On a computer's pointer only (Motion's hover never answers a touch): a target lifts a little to say it can be
 *  pressed. */
export const HOVER = { whileHover: { y: -2, transition: SPRING.pop } } as const

/** A block of a sheet that comes in a moment after the one before (its container: STAGGER). */
export const ITEM: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: SPRING.pop },
}
/** A container whose blocks (ITEM) come in one by one: the container first, the hero last. */
export const STAGGER: Variants = { show: { transition: { delayChildren: 0.06, staggerChildren: 0.045 } } }
/** Something that appears in place (a badge, a chip, a ✓): it pops up; it leaves quicker, shrinking (`exit="out"`). */
export const POP: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: SPRING.pop },
  out: { opacity: 0, scale: 0.8, transition: { duration: 0.12 } },
}
/** It worked: a little pop, bigger and home (`animate(el, DID.keyframes, DID.options)`). */
export const DID = { keyframes: { scale: [1, 1.14, 1] }, options: { duration: 0.32, ease: EASE.out } } as const
/** Not now: a short shake from side to side (an error; a press that cannot do anything yet). */
export const NOPE = { keyframes: { x: [0, -7, 6, -4, 2, 0] }, options: { duration: 0.32, ease: 'easeOut' } } as const

// A face's moves (the farmer's moods, src/farm/FarmerFace.tsx): each from rest and home again, played over the whole
// portrait as its face comes (`animate(el, HOP.keyframes, HOP.options)`); whoever prefers less motion gets none.
/** Happy: a little hop, leaning back as it goes up. */
export const HOP = { keyframes: { y: [0, -10, 0], rotate: [0, -10, 0] }, options: { duration: 0.45, ease: 'easeOut' } } as const
/** Curious (a question, a wink): the head tilts to one side, stays a moment, and comes back. */
export const TILT = { keyframes: { rotate: [0, -13, -13, 0] }, options: { duration: 0.9, ease: 'easeInOut' } } as const
/** Encouraging: a nod, twice. */
export const NOD = { keyframes: { y: [0, 4, 0, 3, 0], rotate: [0, 3, 0, 2, 0] }, options: { duration: 0.7, ease: 'easeInOut' } } as const
/** Surprised: squashed flat, stretched up, and home. */
export const SQUASH = { keyframes: { scaleX: [1, 1.16, 0.92, 1.03, 1], scaleY: [1, 0.82, 1.1, 0.98, 1] }, options: { duration: 0.5, ease: 'easeOut' } } as const
/** A laugh: a quick little shake from side to side, bobbing (NOPE says no; this one giggles). */
export const GIGGLE = { keyframes: { rotate: [0, -7, 7, -6, 6, -3, 0], y: [0, -2, 0, -2, 0, -1, 0] }, options: { duration: 0.6, ease: 'easeInOut' } } as const
/** A sigh: sinks a little, slowly, and comes back up. */
export const SIGH = { keyframes: { y: [0, 5, 5, 0], scaleY: [1, 0.94, 0.94, 1] }, options: { duration: 1.1, ease: 'easeInOut' } } as const
/** A long press: how long a finger rests before it counts as a hold (shorter is a tap). */
export const HOLD_MS = 450

/** A number that counts to `to` (from `from`, 0 at first): the XP into a level, the coins of a claim. */
export function CountUp({ to, from = 0, duration = 0.9, format = whole }: { to: number; from?: number; duration?: number; format?: (n: number) => string }) {
  const still = useReducedMotion()
  const value = useMotionValue(still ? to : from)
  const text = useTransform(value, format)
  useEffect(() => {
    if (still) {
      value.set(to)
      return
    }
    const run = animate(value, to, { duration, ease: EASE.out })
    return () => run.stop()
  }, [to, still, duration, value])
  return <m.span>{text}</m.span>
}

const whole = (n: number) => Math.round(n).toLocaleString('en-US')
