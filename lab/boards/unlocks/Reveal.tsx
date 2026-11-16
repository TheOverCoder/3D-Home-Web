import { m, type Variants } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { Check } from '../../../src/ui/glyphs'
import { SPRING } from '../../../src/ui/motion'
import './Reveal.css'

// The garment's card (src/farm/XpChip.tsx, Xp.css .garment-show) made general, as the plan's src/ui/Reveal.tsx: a
// paper card that pops out of a turning burst of light, a word in berry ("Unlocked!", "All set!"), a note beside it
// (the level), and pictures in a row that bounce in one after another, each with its name under it. It takes no
// touch (it stands over the scene in the top column while play goes on) and leaves by itself, rising a little.
// Variant A of "unlocks" is this card; the "first-steps" board ends on it ("All set!").

export interface RevealItem {
  pic: string
  name?: string
  /** a step done (the first steps' last card): a small green tick on the picture */
  done?: boolean
}

/** A picture bouncing in, as the garment does (scale from a fifth, a quarter turn back). */
const BOUNCE: Variants = {
  hidden: { opacity: 0, scale: 0.2, rotate: -25 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: SPRING.soft },
}
const ROW: Variants = { show: { transition: { delayChildren: 0.16, staggerChildren: 0.09 } } }

/** `cols`: how many pictures a row holds (the rest wrap, centred under them). `small`: pictures only, smaller. */
export function Reveal({
  word,
  note,
  items,
  cols,
  small,
  label,
  children,
}: {
  word: string
  note?: ReactNode
  items: RevealItem[]
  cols: number
  small?: boolean
  label: string
  children?: ReactNode
}) {
  return (
    <m.div
      className={`v-unlocks-reveal${small ? ' small' : ''}`}
      role="status"
      aria-label={label}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1, transition: SPRING.pop }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.3, ease: 'easeIn' } }}
    >
      <span className="v-unlocks-reveal-rays" aria-hidden="true" />
      <span className="v-unlocks-reveal-head">
        <span className="v-unlocks-reveal-word">{word}</span>
        {note}
      </span>
      <m.ul className="v-unlocks-reveal-row" style={{ '--cols': cols } as CSSProperties} initial="hidden" animate="show" variants={ROW} aria-hidden="true">
        {items.map((it, k) => (
          <m.li key={k} variants={BOUNCE}>
            <span className="v-unlocks-reveal-pic">
              <img className="art" src={it.pic} alt="" draggable={false} />
              {it.done && (
                <i className="v-unlocks-reveal-done">
                  <Check weight="bold" />
                </i>
              )}
            </span>
            {it.name && <b>{it.name}</b>}
          </m.li>
        ))}
      </m.ul>
      {children}
    </m.div>
  )
}
