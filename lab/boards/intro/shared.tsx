import { m } from 'motion/react'
import { useEffect, useState } from 'react'
import { CREDITS } from '../../../src/data/credits'
import { art } from '../../../src/ui/art'
import { EASE } from '../../../src/ui/motion'
import yardTall from '../../stills/yard-upright.jpg'
import yardWide from '../../stills/yard-sideways.jpg'
import './shared.css'

// What the opening screen (and today's pictures of other boards) share: the scene behind, whether the screen is
// wider than tall, the credits, a farm's star. Every rule of ./shared.css is under .v-intro-….

/** Wider than tall: two columns, sheets on the right. */
export function useWide() {
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  useEffect(() => {
    const fit = () => setWide(innerWidth > innerHeight)
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [])
  return wide
}

/** The scene behind: the farm, close and warm while the screen is open. Going out it pulls back to the view of play
 *  (the frame's own still, the HUD over it) and lets it through, so the press reads as walking into the farm. */
export function Backdrop() {
  const wide = useWide()
  return (
    <m.div className="v-intro-bg" aria-hidden="true" initial={false} exit={{ opacity: 0, transition: { delay: 0.42, duration: 0.18 } }}>
      <m.img
        className="v-intro-bg-pic"
        src={wide ? yardWide : yardTall}
        alt=""
        initial={{ scale: 1.46 }}
        animate={{ scale: 1.36 }}
        exit={{ scale: 1, transition: { duration: 0.55, ease: EASE.sheet } }}
        transition={{ duration: 1.6, ease: EASE.out }}
      />
      <m.div className="v-intro-bg-wash" exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } }} />
      <Motes />
    </m.div>
  )
}

/** A few specks of light rising slowly through the warm air: the screen is alive while it waits (none for reduced
 *  motion). */
const Motes = () => (
  <div className="v-intro-motes">
    {Array.from({ length: 7 }, (_, i) => (
      <i key={i} style={{ left: `${8 + i * 13}%`, animationDelay: `${-i * 1.9}s`, animationDuration: `${11 + (i % 3) * 3}s` }} />
    ))}
  </div>
)

/** Who made what the game is built from (src/data/credits.ts): a short list, each with its licence. */
export function CreditsBody() {
  return (
    <div className="v-intro-credit-list">
      <p className="v-intro-credit-lead">Made with love, and with the work of these people:</p>
      <ul>
        {CREDITS.map((c) => (
          <li key={c.what}>
            <b>{c.what}</b>
            <span>
              {c.by} · {c.license}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A farm's level: the game's star with the number on it. */
export const Star = ({ level, className = '' }: { level: number; className?: string }) => (
  <span className={`v-intro-star ${className}`} aria-label={`Level ${level}`}>
    <img className="art" src={art('glowing-star')} alt="" />
    <b>{level}</b>
  </span>
)
