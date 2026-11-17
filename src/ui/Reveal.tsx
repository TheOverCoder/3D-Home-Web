import { m, type Variants } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { Check } from './glyphs'
import { SPRING } from './motion'
import './Reveal.css'

// The garment's card made general (the level-up's "New garment!", src/farm/Xp.css .garment-show; the design lab's
// boards "unlocks" and "first-steps"): a paper card that pops out of a turning burst of light, a word in berry ("All
// set!"), a note beside it, and pictures in a row that bounce in one after another, each with its name under it (or,
// small, a tick on it). It takes no touch and stands over the scene in the top column while play goes on.

export interface RevealItem {
  pic: string
  name?: string
  /** done (the first steps' last card): a small green tick on the picture */
  done?: boolean
}

/** A picture bouncing in, as the garment does (from a fifth of its size, a quarter turn back). */
const BOUNCE: Variants = {
  hidden: { opacity: 0, scale: 0.2, rotate: -25 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: SPRING.soft },
}
const ROW: Variants = { show: { transition: { delayChildren: 0.16, staggerChildren: 0.09 } } }

/** `cols`: how many pictures a row holds (the rest wrap, centred). `small`: pictures only, smaller. */
export function Reveal({ word, note, items, cols, small, label }: { word: string; note?: ReactNode; items: RevealItem[]; cols: number; small?: boolean; label: string }) {
  return (
    <m.div
      className={`reveal${small ? ' small' : ''}`}
      role="status"
      aria-label={label}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1, transition: SPRING.pop }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.3, ease: 'easeIn' } }}
    >
      <span className="reveal-rays" aria-hidden="true" />
      <span className="reveal-head">
        <span className="reveal-word">{word}</span>
        {note}
      </span>
      <m.ul className="reveal-row" style={{ '--cols': cols } as CSSProperties} initial="hidden" animate="show" variants={ROW} aria-hidden="true">
        {items.map((it, k) => (
          <m.li key={k} variants={BOUNCE}>
            <span className="reveal-pic">
              <img className="art" src={it.pic} alt="" draggable={false} />
              {it.done && (
                <i className="reveal-done">
                  <Check weight="bold" />
                </i>
              )}
            </span>
            {it.name && <b>{it.name}</b>}
          </m.li>
        ))}
      </m.ul>
    </m.div>
  )
}
