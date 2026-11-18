import { AnimatePresence, animate, m } from 'motion/react'
import { useLessMotion } from '../ui/still'
import { useEffect, useRef } from 'react'
import { art } from '../ui/art'
import { GIGGLE, HOP, NOD, SIGH, SPRING, SQUASH, TILT } from '../ui/motion'
import type { FarmerMood } from './firstSteps'
import './FarmerFace.css'

// The farmer who walks a new farm through its first steps (./FirstSteps.tsx; the design lab's board "first-steps"
// draws this same face): a round portrait whose face is the mood of what he says (./firstSteps.ts: each line's mood,
// and the hint's moments). As a mood comes his face changes — the new one pops in over the old — and he moves as it
// says: a hop for joy, a tilt for a question or a wink, a nod to say go on, a squash for surprise, a little shake for
// a laugh, a slow sink for a sigh. Whoever prefers less motion sees only the face change.

/** How he moves with each mood (src/ui/motion.tsx). */
export const MOOD_MOVES = {
  cheerful: HOP,
  proud: HOP,
  excited: HOP,
  curious: TILT,
  pleading: TILT,
  winking: TILT,
  encouraging: NOD,
  surprised: SQUASH,
  laughing: GIGGLE,
  sighing: SIGH,
} satisfies Record<FarmerMood, { keyframes: object; options: object }>

/** His face in a mood (src/assets/art/farmer-<mood>.webp, made by scripts/render-farmer-faces.mjs). */
export const faceOf = (mood: FarmerMood) => art(`farmer-${mood}` as const)

/** The portrait: `mood` his face; `beat` names what he is saying, so a new line in the same mood moves him again. */
export function FarmerFace({ mood, beat = mood, small }: { mood: FarmerMood; beat?: string; small?: boolean }) {
  const still = useLessMotion()
  const face = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (still || !face.current) return
    const move = MOOD_MOVES[mood]
    const run = animate(face.current, move.keyframes, move.options)
    return () => run.stop()
  }, [beat, mood, still])
  return (
    <m.span className={`farmer${small ? ' small' : ''}`} aria-hidden="true" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.pop}>
      <span ref={face} className="farmer-face" data-mood={mood}>
        <AnimatePresence initial={false}>
          <m.img
            key={mood}
            src={faceOf(mood)}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={SPRING.pop}
          />
        </AnimatePresence>
      </span>
    </m.span>
  )
}
