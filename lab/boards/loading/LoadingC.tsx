import { m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { burst } from '../../../src/ui/burst'
import { SPRING } from '../../../src/ui/motion'
import { Chrome, Logo } from './Chrome'
import { loadView, useLive, useTip, useWide, type LoadingState } from './load'
import poster from './poster.jpg'
import './LoadingC.css'

// C · a window onto the house, round 3: a film's first shot. The house itself fills the screen (a picture of the game),
// out of focus and coming into focus as it loads, the camera pushing in slowly; beams of afternoon light fall through
// the window and turn, dust floats in them at three depths (far specks sharp and slow, near ones big, soft and quick: a
// lens's depth of field), the edges breathe dark, and black bars top and bottom say "the film is about to start". A
// shine runs across the logo now and then. Its moment: ready, the picture snaps into focus, a flare crosses the light,
// the black bars slide away as the curtain does, a burst of confetti, and Play. The bar and the tip are frosted glass.

/** Dust in the light, at three depths: how many, how big (px), how soft (blur px), how long one rise takes (s). */
const DUST = [
  { n: 14, size: 3, blur: 0, time: 26, depth: 'far' },
  { n: 9, size: 6, blur: 1.5, time: 18, depth: 'mid' },
  { n: 5, size: 16, blur: 5, time: 11, depth: 'near' },
] as const

export function LoadingC({ s: start, onPlay }: { s: LoadingState; onPlay: () => void }) {
  const s = useLive(start)
  const v = loadView(s)
  const wide = useWide()
  const still = useReducedMotion()
  const [tip] = useTip(6000)
  const box = useRef<HTMLDivElement>(null)
  // the picture comes into focus over the way, the last of it the moment it is ready
  const blur = v.ready ? 0 : 3 + (1 - v.p) * 13
  useEffect(() => {
    if (!v.ready || still) return
    const t = setTimeout(() => box.current && burst(box.current, { count: 60, spread: 100, power: 28 }), 650)
    return () => clearTimeout(t)
  }, [v.ready, still])
  return (
    <m.div
      className={`v-loading-c${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.4 }}
    >
      <div className="lc3-shot" aria-hidden="true">
        <img className="lc3-pic" src={poster} alt="" style={{ filter: `blur(${blur}px) saturate(${0.75 + v.p * 0.35})` }} />
      </div>
      {/* beams of light through the window, turning slowly */}
      <div className="lc3-beams" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      {/* dust in the light, at three depths */}
      <div className="lc3-dust" aria-hidden="true">
        {DUST.map((d) =>
          Array.from({ length: d.n }, (_, i) => (
            <i
              key={`${d.depth}${i}`}
              className={d.depth}
              style={
                {
                  left: `${(i * 37 + d.size * 11) % 100}%`,
                  top: `${(i * 53 + d.size * 7) % 100}%`,
                  width: d.size,
                  height: d.size,
                  filter: d.blur ? `blur(${d.blur}px)` : undefined,
                  animationDuration: `${d.time + (i % 4) * 2}s`,
                  animationDelay: `${-((i * 3.7) % d.time)}s`,
                } as CSSProperties
              }
            />
          )),
        )}
      </div>
      {/* the flare as the picture comes sharp */}
      {v.ready && (
        <div className="lc3-flare" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
      <span className="lc3-vignette" aria-hidden="true" />
      {/* the black bars of a film, until it starts */}
      <m.span
        className="lc3-bar top"
        aria-hidden="true"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: v.ready ? 0 : 1 }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay: v.ready ? 0.25 : 0 }}
      />
      <m.span
        className="lc3-bar bottom"
        aria-hidden="true"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: v.ready ? 0 : 1 }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay: v.ready ? 0.25 : 0 }}
      />
      <m.header
        className="lc3-logo"
        ref={box}
        initial={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      >
        <Logo />
        <span className="lc3-shine" aria-hidden="true">
          3D Home
        </span>
        <p>A cosy house and farm</p>
      </m.header>
      <m.div className="lc3-low" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.sheet, delay: 0.35 }}>
        <Chrome v={v} tip={tip} onPlay={onPlay} tone="glass" />
      </m.div>
    </m.div>
  )
}
