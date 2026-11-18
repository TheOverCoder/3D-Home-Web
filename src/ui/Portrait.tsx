import { AnimatePresence, animate, m } from 'motion/react'
import { useLessMotion } from './still'
import { useEffect, useRef, type CSSProperties } from 'react'
import { personById, type PersonId } from '../data/people'
import { faceOf, MOOD_MOVES } from '../farm/FarmerFace'
import type { FarmerMood } from '../farm/firstSteps'
import { SPRING } from './motion'

// Anyone's round portrait (update-v1/CONTRACTS.md §1.13): the farmer's face in the mood of what he says (his faces,
// src/ui/art.ts), anyone else's picture drawn from their own model (src/assets/people/<id>.webp, made by
// scripts/render-item-art.mjs --people: the face in a letter is the face at the gate). As a mood comes the portrait
// moves as it says (src/farm/FarmerFace.tsx, MOOD_MOVES: a hop for joy, a tilt for a question, a nod to say go on…),
// and the farmer's face changes with it — the new one pops in over the old. Whoever prefers less motion sees only the
// face change. It looks as the farmer's round portrait does (src/farm/FarmerFace.css): the face fills a circle on the
// paper's light, ringed in white.

const files = import.meta.glob('../assets/people/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** A person's picture in a mood (only the farmer's changes with it); '' while a new row has none drawn yet. */
export const pictureOf = (who: PersonId, mood: FarmerMood = 'cheerful'): string => (who === 'farmer' ? faceOf(mood) : (files[`../assets/${personById(who).pic}.webp`] ?? ''))

/** The circle (it is what moves with the mood) and the face that fills it. */
const circle = (size: number): CSSProperties => ({
  position: 'relative',
  display: 'block',
  width: size,
  height: size,
  overflow: 'hidden',
  borderRadius: '50%',
  background: 'radial-gradient(circle at 50% 30%, #fff, var(--paper-2) 70%)',
  boxShadow: '0 0 0 3px #fff, 0 4px 10px rgba(40, 24, 10, 0.35)',
})
const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

/** The portrait: `mood` their face and how they move; `size` its width in px (56, the farmer's hint's); `move` false
 *  holds it still; `beat` names what they are saying, so a new line in the same mood moves them again. */
export function Portrait({ who, mood = 'cheerful', size = 56, move = true, beat = mood }: { who: PersonId; mood?: FarmerMood; size?: number; move?: boolean; beat?: string }) {
  const still = useLessMotion()
  const face = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!move || still || !face.current) return
    const moves = MOOD_MOVES[mood]
    const run = animate(face.current, moves.keyframes, moves.options)
    return () => run.stop()
  }, [beat, mood, move, still])
  const src = pictureOf(who, mood)
  return (
    <m.span className="portrait" style={{ display: 'block', flex: 'none' }} aria-hidden="true" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING.pop}>
      <span ref={face} className="portrait-face" data-who={who} data-mood={mood} style={circle(size)}>
        <AnimatePresence initial={false}>
          <m.img
            key={src}
            src={src}
            alt=""
            draggable={false}
            style={fill}
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
