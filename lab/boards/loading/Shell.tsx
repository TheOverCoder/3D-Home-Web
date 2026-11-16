import { m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { burst } from '../../../src/ui/burst'
import { EASE, SPRING } from '../../../src/ui/motion'
import { Chrome, type Away } from './Chrome'
import { useTip, useWide, type LoadView } from './load'
import './shell.css'

// What every look of the loading screen shares, round 5 ("improve them all, in one matching style: the game will show
// a different one each time"). The six differ only in the little world on the round stage; everything round it is one
// design, so whichever one the game picks, the screen is the same screen:
//
// - one sky, the same for all, going from dawn (lilac and peach) to a warm day as the bar fills, specks of light rising;
// - the game's name as the opening screen draws it, its letters dropping in one by one, the same line under it;
// - a round stage in the middle: a sun-coloured disc with a white rim and slow rays behind it, warming with the bar;
//   each look's world stands on it, inside it or in front of it, at the same size and place;
// - the same card by the thumb (./Chrome.tsx): the friendly line, the share, the bar, the tip (or, for a returning
//   player, what waits on the farm: ✦), then Play;
// - one moment, the same for all: ready, the rays open wide behind the disc, a flash crosses it, one burst of confetti
//   from it, and Play springs into the card — while each world does its own small "ta-da" in the middle.
//
// Upright: the name at the top, the stage in the middle, the card at the bottom. Sideways: the stage on the left, the
// name and the card on the right.

export function LoadShell({ name, v, onPlay, away, children }: { name: string; v: LoadView; onPlay: () => void; away?: Away; children: ReactNode }) {
  const wide = useWide()
  const still = useReducedMotion()
  const [tip] = useTip()
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!v.ready || still) return
    const t = setTimeout(() => stage.current && burst(stage.current, { count: 80, spread: 100, power: 32 }), 420)
    return () => clearTimeout(t)
  }, [v.ready, still])
  return (
    <m.div
      className={`v-loading-shell ${name}${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      style={{ '--p': v.p } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.22 }}
    >
      <span className="ls-sky" aria-hidden="true">
        <i className="ls-dawn" />
        <i className="ls-day" />
      </span>
      <span className="ls-motes" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ left: `${6 + i * 12}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${10 + (i % 3) * 3}s` }} />
        ))}
      </span>
      <Name />
      <div className="ls-stage" ref={stage}>
        <m.span
          className="ls-rays"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={v.ready ? { opacity: 1, scale: 1.45 } : { opacity: 0.55, scale: 1 }}
          transition={v.ready ? { ...SPRING.soft, delay: 0.25 } : { duration: 0.8, ease: EASE.out }}
        />
        <m.span className="ls-disc" aria-hidden="true" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.soft, delay: 0.08 }}>
          <m.i
            className="ls-flash"
            initial={false}
            animate={v.ready ? { opacity: [0, 0.95, 0], x: ['-120%', '0%', '120%'] } : { opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          />
        </m.span>
        <m.div
          className="ls-hero"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.3, ease: 'easeIn' } }}
          transition={{ ...SPRING.soft, delay: 0.14 }}
        >
          {children}
        </m.div>
      </div>
      <m.div
        className="ls-low"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30, transition: { duration: 0.2 } }}
        transition={{ ...SPRING.sheet, delay: 0.12 }}
      >
        <Chrome v={v} tip={tip} onPlay={onPlay} tone="card" away={away} />
      </m.div>
    </m.div>
  )
}

const LETTERS = '3D Home'.split('')
const letter = {
  hidden: { opacity: 0, y: -40, scale: 0.6 },
  shown: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop },
  gone: { opacity: 0, y: -24, transition: { duration: 0.16, ease: 'easeIn' } },
} as const

/** The game's name as the opening screen draws it: white letters in a thick ink line, dropping in one by one. */
const Name = () => (
  <m.header
    className="ls-name"
    initial="hidden"
    animate="shown"
    exit="gone"
    variants={{ shown: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } }, gone: { transition: { staggerChildren: 0.02 } } }}
  >
    <h1 aria-label="3D Home">
      {LETTERS.map((c, i) => (
        <m.span key={i} variants={letter} aria-hidden="true">
          {c}
        </m.span>
      ))}
    </h1>
    <m.p variants={{ hidden: { opacity: 0, y: 6 }, shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE.out } }, gone: { opacity: 0 } }}>A cosy house and farm</m.p>
  </m.header>
)
