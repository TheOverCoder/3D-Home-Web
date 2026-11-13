import { LazyMotion, MotionConfig, animate, m, useMotionValue, useReducedMotion, useTransform, type Transition } from 'motion/react'
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

/** A button's press: `<m.button {...PRESS}>` sinks a little under the finger and springs back. */
export const PRESS = { whileTap: { scale: 0.94 }, transition: SPRING.pop } as const

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
