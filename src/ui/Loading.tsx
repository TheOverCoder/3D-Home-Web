import { AnimatePresence, m } from 'motion/react'
import { useLessMotion } from './still'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { secondsLeft, useLoader } from '../lib/loader'
import { useHome } from '../store'
import { art } from './art'
import { burst } from './burst'
import { Check, Clock } from './glyphs'
import { EASE, SPRING } from './motion'
import { EASE_OUT_CSS, nextShown, type Glide } from './loadGlide'
import './Loading.css'
// three goods' pictures for the tips, by their files (src/farm/icons.ts has them all, and the farm's table with them:
// not part of the page shell)
import lemon from '../assets/items/lemon.webp?url'
import silo from '../assets/items/silo.webp?url'
import strawberryCake from '../assets/items/strawberry_cake.webp?url'

// The loading screen (the design lab's board "loading", B: the road home), from the moment the page opens until the
// game can take its first press; then the opening menu (./Intro.tsx) takes its place. One sky going from dawn to a warm
// day as the bar fills, specks of light rising; the game's name, its letters dropping in; a round window where a
// tractor drives home through a countryside in planes sliding past at their own speeds (far hills slow and pale, the
// grass at the front fast: parallax), the sun climbing, each step of the loading passing as a signpost on the verge;
// and by the thumb a card: one friendly line and the share, a bar whose ribs drift backwards and hurry near the end, the
// time left when a slow download makes it worth saying, and a tip that changes. Its moment: ready, the world comes to a
// stop as your house rolls in and the tractor parks at its gate with a hop, the rays behind open wide, a flash crosses
// the window and one burst of confetti. A tap on the tractor makes it hop. Upright: the name at the top, the window in
// the middle, the card at the bottom; sideways the window on the left, the name and the card on the right.
//
// Its numbers are the loader's own (src/lib/loader.ts, the scene's count, the attempt): downloads take the bar to 70 %,
// building the house to 85 %, warming up the graphics to 100 %. The bar never goes back, and through the two steps
// that count coarsely it glides on by itself (./loadGlide.ts), on the compositor, as does everything that moves here
// while the page builds the house (the hills, the clouds, the signposts, the ribs): none of it waits for the main thread.

export interface LoadView {
  /** 0..1, the whole way, as the bar shows it: never back */
  p: number
  /** the glide the bar is on by itself through a step that counts coarsely (none while the downloads count bytes) */
  glide: Glide | null
  pct: number
  /** which part of the way it is on */
  step: 'fetch' | 'build' | 'light' | 'ready'
  line: string
  /** "about 40 s": only for a download over the network with more than 8 s to go */
  left: string | null
  ready: boolean
  /** started again in light graphics */
  again: boolean
  offline: boolean
}

/** The loading as the screen tells it, from the loader, the scene's count and whether the game can be entered. */
export function useLoadView(ready: boolean, returning: boolean): LoadView {
  const s = useLoader()
  const attempt = useHome((st) => st.attempt)
  const fromDevice = s.total > 0 && s.fromDevice >= s.total
  // building the house has no count of its own worth showing (the scene's loading manager reaches its end long before
  // the house is built, and starts again from nothing): the bar glides through it by itself
  const way = s.phase === 'download' ? (s.total ? s.loaded / s.total : 0) * 0.7 : s.phase === 'prepare' ? 0.7 : s.phase === 'compile' ? 0.85 + s.compile * 0.15 : 1
  const step = ready ? 'ready' : s.phase === 'download' ? 'fetch' : s.phase === 'prepare' ? 'build' : 'light'
  const bar = useGlide(step, ready ? 1 : Math.min(0.99, way))
  const p = ready ? 1 : Math.min(0.99, bar.shown)
  const secs = s.phase === 'download' && !fromDevice ? (secondsLeft(s) ?? 0) : 0
  const again = attempt > 0 && !ready
  const line = again
    ? 'Starting again, lighter'
    : ready
      ? returning
        ? 'Your farm is waiting'
        : 'Your farm is ready'
      : step === 'fetch'
        ? fromDevice
          ? 'Opening your farm…'
          : 'Fetching the farm…'
        : step === 'build'
          ? 'Building the house…'
          : 'Lighting the lamps…'
  return {
    p,
    glide: bar.glide,
    pct: Math.round(p * 100),
    step,
    line,
    // rounded to 5 s, so it settles instead of ticking every second
    left: secs > 8 ? (secs < 60 ? `about ${Math.ceil(secs / 5) * 5} s` : `about ${Math.ceil(secs / 60)} min`) : null,
    ready,
    again,
    offline: s.offline,
  }
}

/** The bar as it shows, a few times a second until ready (./loadGlide.ts): the loader's count, never back, and on
 *  through the coarse steps by itself. */
function useGlide(step: LoadView['step'], real: number) {
  const [bar, setBar] = useState<{ shown: number; glide: Glide | null }>({ shown: 0, glide: null })
  const now = useRef({ step, real })
  now.current = { step, real }
  const ready = step === 'ready'
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      if (t - last >= 100) {
        last = t
        setBar((b) => {
          const n = nextShown(b.shown, now.current.step, now.current.real, b.glide, performance.now())
          return n.shown === b.shown && n.glide === b.glide ? b : n
        })
      }
      if (now.current.step !== 'ready') raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready])
  return ready ? { shown: 1, glide: null } : bar
}

/** The bar's fill, slid in from the left: by a transition while the downloads count, and on a glide (an animation the
 *  compositor runs, so it goes on while the main thread builds the house) through the coarse steps. */
function BarFill({ p, glide }: { p: number; glide: Glide | null }) {
  const el = useRef<HTMLSpanElement>(null)
  const running = useRef<Animation | null>(null)
  const at = (v: number) => `${(Math.max(0.04, v) - 1) * 100}% 0`
  useEffect(() => {
    const s = el.current
    if (!s || typeof s.animate !== 'function') return
    // from wherever the bar is now (a glide under way included), a moment's catch-up to the glide's start, then the glide
    const from = getComputedStyle(s).translate || at(p)
    running.current?.cancel()
    running.current = null
    if (!glide) return
    const catchUp = 300
    const ms = catchUp + glide.ms
    running.current = s.animate([{ translate: from, easing: 'ease-out' }, { translate: at(glide.from), offset: catchUp / ms, easing: EASE_OUT_CSS }, { translate: at(glide.to) }], {
      duration: ms,
      fill: 'forwards',
    })
    // (`p` is only where it starts: the glide moves it on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glide])
  useEffect(() => () => running.current?.cancel(), [])
  return (
    <span ref={el} style={{ translate: at(p) }}>
      <i />
    </span>
  )
}

/** One tip or teaser of the farm while it loads: a picture and one line, each true of the game. */
const TIPS: { pic: string; text: string }[] = [
  { pic: lemon, text: 'Your farm keeps growing while you are away.' },
  { pic: art('people-queue'), text: 'Buyers wait at the gate with coins in hand.' },
  { pic: silo, text: 'Crops go to the silo, eggs and milk to the barn.' },
  { pic: art('wrapped-gift'), text: 'Every fifth level brings something new to wear.' },
  { pic: strawberryCake, text: 'The oven turns your eggs and milk into cakes.' },
  { pic: art('running-shoe'), text: 'Tap a mark on the compass and you walk to it.' },
]

/** The tip shown now: the next one every few seconds. */
function useTip(every = 5200) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setI((n) => n + 1), every)
    return () => clearTimeout(t)
  }, [i, every])
  return i % TIPS.length
}

/** Wider than tall (a phone on its side), as it turns. */
export function useWide() {
  const [wide, setWide] = useState(() => innerWidth > innerHeight)
  useEffect(() => {
    const turned = () => setWide(innerWidth > innerHeight)
    addEventListener('resize', turned)
    return () => removeEventListener('resize', turned)
  }, [])
  return wide
}

/** The game's name as the opening screen draws it: white letters in a thick ink line, dropping in one by one. */
export function GameName({ line, className = '' }: { line: string; className?: string }) {
  return (
    <m.header
      className={`game-name ${className}`}
      initial="hidden"
      animate="shown"
      exit="gone"
      variants={{ shown: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } }, gone: { transition: { staggerChildren: 0.02 } } }}
    >
      <h1 aria-label="3D Home">
        {LETTERS.map((c, i) => (
          <m.span key={i} variants={LETTER} aria-hidden="true">
            {c}
          </m.span>
        ))}
      </h1>
      <m.p variants={{ hidden: { opacity: 0, y: 6 }, shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE.out } }, gone: { opacity: 0 } }}>{line}</m.p>
    </m.header>
  )
}
const LETTERS = '3D Home'.split('')
const LETTER = {
  hidden: { opacity: 0, y: -40, scale: 0.6 },
  shown: { opacity: 1, y: 0, scale: 1, transition: SPRING.pop },
  gone: { opacity: 0, y: -24, transition: { duration: 0.16, ease: 'easeIn' } },
} as const

/** The loading screen. */
export function Loading({ v }: { v: LoadView }) {
  const wide = useWide()
  const still = useLessMotion()
  const tip = useTip()
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!v.ready || still) return
    const t = setTimeout(() => stage.current && burst(stage.current, { count: 80, spread: 100, power: 32 }), 420)
    return () => clearTimeout(t)
  }, [v.ready, still])
  const near = !v.ready && v.p >= 0.8
  return (
    <m.div
      className={`loading-screen load${wide ? ' wide' : ''}${v.ready ? ' ready' : ''}`}
      data-phase={v.step}
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
      <GameName line="A cosy house and farm" className="ls-name" />
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
        <m.div className="ls-hero" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING.soft, delay: 0.14 }}>
          <Road v={v} />
        </m.div>
      </div>
      <m.div
        className="ls-low"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30, transition: { duration: 0.2 } }}
        transition={{ ...SPRING.sheet, delay: 0.12 }}
      >
        <div className={`load-card${v.ready ? ' ready' : ''}${near ? ' near' : ''}`}>
          <div className="load-head">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.strong key={v.line} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: EASE.out }}>
                {v.ready && <Check weight="bold" aria-hidden="true" />}
                {v.line}
              </m.strong>
            </AnimatePresence>
            <span className="load-pct">{v.pct}%</span>
          </div>
          <div className="load-bar" role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}>
            <BarFill p={v.p} glide={v.glide} />
          </div>
          {v.left && (
            <p className="load-left">
              <Clock weight="bold" aria-hidden="true" /> {v.left}
            </p>
          )}
          <div className="load-slot">
            <AnimatePresence mode="popLayout" initial={false}>
              {v.again || v.offline ? (
                <m.div
                  key={v.again ? 'again' : 'offline'}
                  className="load-tip again"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <img className="art" src={art(v.again ? 'sparkles' : 'house-with-garden')} alt="" />
                  <p className="load-note">{v.again ? 'Lighter graphics this time: they suit this phone.' : 'You are offline: playing from the copy kept on this device.'}</p>
                </m.div>
              ) : (
                <m.div key={tip} className="load-tip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: EASE.out }}>
                  <img className="art" src={TIPS[tip].pic} alt="" />
                  <p>{TIPS[tip].text}</p>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </m.div>
    </m.div>
  )
}

/** The signpost for each step, as it passes. */
const SIGN = { fetch: art('package'), build: art('building-construction'), light: art('sparkles'), ready: art('house-with-garden') } as const

/** A plane of hills: a ridge of two waves laid on each other, whole periods across, so two copies side by side loop
 *  without a seam. */
const ridge = (h: number, waves: number, amp: number, seed: number) => {
  const W = 800
  const pts = Array.from({ length: 65 }, (_, i) => {
    const x = (i / 64) * W
    const t = (x / W) * Math.PI * 2
    const y = h - amp * (0.55 + 0.3 * Math.sin(t * waves + seed) + 0.15 * Math.sin(t * waves * 2 + seed * 2))
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `M 0 200 L ${pts.join(' L ')} L ${W} 200 Z`
}
const FAR = ridge(150, 3, 70, 1)
const MID = ridge(160, 4, 46, 4)
const NEAR = ridge(172, 6, 22, 7)

const Plane = ({ cls, d, speed, children }: { cls: string; d?: string; speed: number; children?: ReactNode }) => (
  <div className={`lb-plane ${cls}`} style={{ '--speed': `${speed}s` } as CSSProperties} aria-hidden="true">
    {[0, 1].map((k) => (
      <svg key={k} viewBox="0 0 800 200" preserveAspectRatio="none">
        {d && <path d={d} />}
        {children}
      </svg>
    ))}
  </div>
)

/** Trees on a ridge: round crowns on short trunks. */
const Trees = ({ y, n, seed }: { y: number; n: number; seed: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const x = ((i + 0.5) / n) * 800 + Math.sin(i * 3.1 + seed) * 30
      const r = 16 + ((i * 7 + seed) % 3) * 5
      return (
        <g key={i} className="lb-tree">
          <rect x={x - 3} y={y - 6} width={6} height={18} rx={2} />
          <circle cx={x} cy={y - r} r={r} />
        </g>
      )
    })}
  </>
)

/** The road home, through the round window. */
function Road({ v }: { v: LoadView }) {
  const still = useLessMotion()
  const [hop, setHop] = useState(0)
  useEffect(() => {
    if (!v.ready) return
    const t = setTimeout(() => setHop((n) => n + 1), 900)
    return () => clearTimeout(t)
  }, [v.ready])
  // the sun climbs an arc as the bar fills: from the left horizon to high in the middle
  const a = Math.PI * (0.95 - v.p * 0.5)
  const sun = { left: `${50 + Math.cos(a) * 40}%`, top: `${72 - Math.sin(a) * 38}%` }
  return (
    <div className="lb-world" style={{ '--day': v.p } as CSSProperties}>
      <span className="lb-sky" aria-hidden="true" />
      <m.img className="art lb-sun" src={art('sun')} alt="" style={sun} initial={false} animate={sun} transition={{ type: 'spring', stiffness: 30, damping: 14 }} />
      <div className="lb-clouds" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <Plane cls="far" d={FAR} speed={90} />
      <Plane cls="mid" d={MID} speed={46}>
        <Trees y={128} n={7} seed={2} />
      </Plane>
      <Plane cls="near" d={NEAR} speed={22}>
        <Trees y={160} n={4} seed={5} />
      </Plane>
      <div className="lb-road" aria-hidden="true">
        <i />
      </div>
      {/* each step passes as a signpost on the verge (a CSS animation: it goes on while the house is built) */}
      {!v.ready && (
        <span key={v.step} className="lb-sign" aria-hidden="true">
          <img className="art" src={SIGN[v.step]} alt="" />
        </span>
      )}
      <AnimatePresence>
        {v.ready && (
          <m.img
            key="home"
            className="art lb-home"
            src={art('house-with-garden')}
            alt=""
            initial={{ left: '118%' }}
            animate={{ left: '68%' }}
            transition={{ duration: still ? 0 : 1.1, ease: EASE.out }}
          />
        )}
      </AnimatePresence>
      <m.button
        className="lb-tractor"
        aria-label="The tractor"
        onClick={() => setHop((n) => n + 1)}
        initial={{ left: '-30%' }}
        animate={{ left: v.ready ? '40%' : '30%' }}
        transition={v.ready ? { duration: still ? 0 : 1.1, ease: EASE.out } : { ...SPRING.soft, delay: 0.15 }}
      >
        <m.span
          key={hop}
          className="lb-tractor-in"
          animate={hop && !still ? { y: [0, -26, 0, -6, 0], rotate: [0, -6, 2, 0, 0] } : undefined}
          transition={{ duration: 0.7, times: [0, 0.35, 0.65, 0.82, 1], ease: EASE.out }}
        >
          <img className="art" src={art('tractor')} alt="" />
        </m.span>
        <span className="lb-dust" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </m.button>
      <Plane cls="front" speed={9}>
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M ${i * 58 + 8} 200 q 6 -34 10 -46 q 2 18 4 26 q 6 -22 12 -30 q -2 22 0 50 Z`} />
        ))}
      </Plane>
    </div>
  )
}
