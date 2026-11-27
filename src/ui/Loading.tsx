import { AnimatePresence, m } from 'motion/react'
import { useLessMotion } from './still'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { secondsLeft, useLoader } from '../lib/loader'
import { useHome } from '../store'
import { art } from './art'
import { burst } from './burst'
import { Check, Clock } from './glyphs'
import { EASE, SPRING } from './motion'
import { CREEP_MS, EASE_OUT_CSS, EVEN, FINISH_MS, LAST, RATE_EVERY_MS, finishAt, keepTimes, paceFrom, pastTimes, rateFor, shareAt, tick, tookTimes, worthChanging, type Pace } from './loadPace'
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
// and by the thumb a card: one friendly line, a bar whose ribs drift backwards and hurry near the end, the time left
// when a slow download makes it worth saying, and a tip that changes. Its moment: ready, the world slows to a stop as
// your house rolls in and the tractor parks at its gate with a hop, the rays behind open wide, a flash crosses the
// window and one burst of confetti. A tap on the tractor makes it hop. Upright: the name at the top, the window in the
// middle, the card at the bottom; sideways the window on the left, the name and the card on the right.
//
// The bar goes at one even pace from nothing to full over the time this load will take, as this device's last loads
// took (./loadPace.ts: each step's time kept), planned again from where it is whenever a step ends sooner or later, never
// back; once ready it fills in a moment. It shows no number: a number can only change when the page is free to draw,
// while the bar moves on the compositor, as does everything that moves here (the hills, the road, the clouds, the
// signposts, the ribs, the tractor's wheels, its puffs and its dust): none of it waits for the main thread.

export interface LoadView {
  /** 0..1, the whole way, as the bar shows it now: never back */
  p: number
  /** the bar's fill: given its element, the bar runs on it as one animation (./loadPace.ts) */
  bar: (el: HTMLSpanElement | null) => void
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

/** The loading as the screen tells it, from the loader and whether the game can be entered (`ready`: settled, see
 *  `useSettled`). */
export function useLoadView(ready: boolean, returning: boolean): LoadView {
  const s = useLoader()
  const attempt = useHome((st) => st.attempt)
  const fromDevice = s.total > 0 && s.fromDevice >= s.total
  const step = ready ? 'ready' : s.phase === 'download' ? 'fetch' : s.phase === 'prepare' ? 'build' : 'light'
  const pace = usePace(step, s, fromDevice ? 'device' : 'network', attempt)
  const p = ready ? 1 : Math.min(LAST, pace.shown)
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
    bar: pace.bar,
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

/** True a couple of frames after `on` is: the first frames once the game is ready are its heaviest (the scene drawn for
 *  the first time), so the bar's last moment and the ready show wait for them to pass and play smoothly. */
export function useSettled(on: boolean, frames = 2): boolean {
  const [settled, setSettled] = useState(on)
  useEffect(() => {
    if (!on) {
      setSettled(false)
      return
    }
    let n = 0
    let raf = 0
    const next = () => (++n >= frames ? setSettled(true) : (raf = requestAnimationFrame(next)))
    raf = requestAnimationFrame(next)
    return () => cancelAnimationFrame(raf)
  }, [on, frames])
  return on && settled
}

/** A translate for the bar's fill showing `v` of it (the fill is the whole bar, slid in from the left). */
const barAt = (v: number) => `${(Math.max(0.02, v) - 1) * 100}% 0`

/** The bar, a few times a second until ready (./loadPace.ts): one run planned when the load begins, its rate aimed again
 *  at when the load will end as each step ends (from this device's kept times), on the page one animation of the bar's
 *  fill whose rate changes; once ready, the rest fills in a moment, and this load's step times are kept for the next one
 *  (not a restart's in light graphics: it is no measure of the next). */
function usePace(step: LoadView['step'], s: ReturnType<typeof useLoader.getState>, from: 'device' | 'network', attempt: number) {
  const [shown, setShown] = useState(0)
  // when each step began (the downloads with the page)
  const began = useRef<{ step: LoadView['step']; at: number }>({ step: 'fetch', at: s.startedAt })
  if (began.current.step !== step) began.current = { step, at: performance.now() }
  const now = useRef({ step, s, from })
  now.current = { step, s, from }
  const ctl = useRef<{ pace: Pace | null; anim: Animation | null; el: HTMLSpanElement | null; last: number; rated: number }>({ pace: null, anim: null, el: null, last: 0, rated: 0 })
  const until = () => {
    const { step, s, from } = now.current
    const share = step === 'fetch' && from === 'network' && s.total ? s.loaded / s.total : null
    return finishAt(step, began.current.at, performance.now(), pastTimes(from), share)
  }
  // the bar's one animation, on its element, from where the run is
  const attach = () => {
    const c = ctl.current
    if (!c.el || !c.pace || c.anim || typeof c.el.animate !== 'function') return
    const { d0 } = c.pace
    const ms = d0 + CREEP_MS
    c.anim = c.el.animate([{ translate: barAt(0), easing: 'linear' }, { translate: barAt(EVEN), offset: d0 / ms, easing: EASE_OUT_CSS }, { translate: barAt(LAST) }], {
      duration: ms,
      fill: 'forwards',
    })
    c.anim.currentTime = c.pace.c
    c.anim.playbackRate = c.pace.rate
  }
  const bar = useCallback((el: HTMLSpanElement | null) => {
    ctl.current.el = el
    if (!el) {
      ctl.current.anim?.cancel()
      ctl.current.anim = null
    } else attach()
    // (attach reads the refs: it never goes stale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const ready = step === 'ready'
  useEffect(() => {
    if (ready) return
    let raf = 0
    const go = (t: number) => {
      const c = ctl.current
      if (t - c.last >= 100) {
        const at = performance.now()
        const end = until()
        if (!c.pace) {
          c.pace = paceFrom(at, end)
          attach()
        } else if (c.anim) {
          // the animation is the clock: where it is, and the rate that brings it to EVEN when the load ends
          const pc = Number(c.anim.currentTime ?? c.pace.c)
          let rate = c.anim.playbackRate
          const next = rateFor({ ...c.pace, c: pc }, at, end)
          if (worthChanging(rate, next) && at - c.rated >= RATE_EVERY_MS) {
            c.anim.updatePlaybackRate(next)
            c.rated = at
            rate = next
          }
          c.pace = { ...c.pace, c: pc, rate }
        } else c.pace = tick(c.pace, at - (c.last || at), at, end)
        c.last = t
        const v = shareAt(c.pace.c, c.pace.d0)
        setShown((was) => (v - was >= 0.004 ? v : was))
      }
      raf = requestAnimationFrame(go)
    }
    raf = requestAnimationFrame(go)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  // ready: the rest of the bar in a moment, and this load's times kept
  const kept = useRef(false)
  useEffect(() => {
    if (!ready) return
    const c = ctl.current
    if (c.el && typeof c.el.animate === 'function') {
      const from = getComputedStyle(c.el).translate || barAt(shown)
      c.anim?.cancel()
      c.anim = c.el.animate([{ translate: from }, { translate: barAt(1) }], { duration: FINISH_MS, easing: 'ease-out', fill: 'forwards' })
    }
    if (kept.current || attempt > 0) return
    kept.current = true
    const took = tookTimes(useLoader.getState())
    if (took) keepTimes(now.current.from, took)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, attempt])
  return { shown: ready ? 1 : shown, bar }
}

/** The bar's fill: the whole bar slid in from the left, moved by its one animation (`usePace`); where it rests without
 *  one, by `p`. */
function BarFill({ p, bar }: { p: number; bar: LoadView['bar'] }) {
  return (
    <span ref={bar} style={{ translate: barAt(p) }}>
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
      exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.32, ease: [0.4, 0, 1, 1] } }}
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
          </div>
          <div className="load-bar" role="progressbar" aria-label={v.line} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}>
            <BarFill p={v.p} bar={v.bar} />
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

/** How long the world takes to slow to a stop once ready (ms). */
const STOP_MS = 1000

/** The tractor, drawn: a red body on its springs with the farmer in his straw hat in the cab, a big back wheel and a
 *  small front one turning at the road's speed (the small one faster, as a smaller wheel turns), puffs from its pipe
 *  and a shadow on the road that breathes with the bounce. Every move a CSS animation of a transform, on the compositor. */
function Tractor() {
  return (
    <svg className="lb-tractor-svg" viewBox="0 0 132 96" aria-hidden="true">
      <defs>
        <linearGradient id="lt-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2735a" />
          <stop offset="0.5" stopColor="#d9412f" />
          <stop offset="1" stopColor="#9e2b20" />
        </linearGradient>
        <linearGradient id="lt-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe07a" />
          <stop offset="1" stopColor="#e5a91f" />
        </linearGradient>
        <linearGradient id="lt-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eaf7ff" />
          <stop offset="1" stopColor="#9fd0ef" />
        </linearGradient>
        <radialGradient id="lt-rim" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffe9a3" />
          <stop offset="1" stopColor="#e0a21a" />
        </radialGradient>
      </defs>
      <ellipse className="lt-shadow" cx="68" cy="91.5" rx="52" ry="4.5" />
      <g className="lt-puffs">
        <circle cx="98" cy="17" r="5" />
        <circle cx="98" cy="17" r="5" />
        <circle cx="98" cy="17" r="5" />
      </g>
      <g className="lt-body">
        {/* the pipe, its cap */}
        <rect x="95" y="20" width="6" height="30" rx="2" fill="#5b4a3d" />
        <rect x="93.5" y="17.5" width="9" height="4.5" rx="1.8" fill="#3b2a1e" />
        {/* the cab's back and the hood */}
        <path d="M14 42 h46 v28 h-46 z" fill="url(#lt-red)" />
        <path d="M56 46 h42 q9 0 10.5 9 l1.5 15 h-54 z" fill="url(#lt-red)" />
        <path d="M60 49 h36 q5 0 6.5 4" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />
        {/* the grille and the lamp */}
        <rect x="105" y="56" width="5.5" height="13" rx="2" fill="#7c2419" />
        <circle className="lt-lamp" cx="107" cy="52.5" r="3.4" fill="#fff4b8" />
        {/* the cab: its posts, its glass with the farmer behind it, its yellow roof */}
        <rect x="24" y="18" width="30" height="24" rx="2.5" fill="url(#lt-glass)" />
        <circle cx="40" cy="33" r="5.6" fill="#f0c19a" />
        <path d="M33 29.5 q7 -9 14 0 z" fill="#e8b84a" />
        <ellipse cx="40" cy="29.5" rx="9.5" ry="2.2" fill="#d9a334" />
        <path d="M27 21 l9 0 l-7 16 l-2 0 z" fill="#ffffff" opacity="0.45" />
        <rect x="20" y="14" width="4.5" height="30" rx="1.5" fill="#3b2a1e" />
        <rect x="53.5" y="14" width="4.5" height="34" rx="1.5" fill="#3b2a1e" />
        <rect x="14" y="9" width="50" height="7.5" rx="3.5" fill="url(#lt-roof)" />
        {/* the mudguard over the back wheel */}
        <path d="M11 70 a29 29 0 0 1 58 0 h-6.5 a22.5 22.5 0 0 0 -45 0 z" fill="#b8362a" />
      </g>
      <g className="lt-wheel lt-back">
        <circle cx="40" cy="68" r="22" fill="#2f221a" />
        <circle cx="40" cy="68" r="20.2" fill="none" stroke="#4d3c30" strokeWidth="4" strokeDasharray="4.3 3.4" />
        <circle cx="40" cy="68" r="12.5" fill="url(#lt-rim)" />
        <circle cx="40" cy="68" r="12.5" fill="none" stroke="#b9800f" strokeWidth="1.4" />
        {[0, 72, 144, 216, 288].map((deg) => (
          <circle key={deg} cx={40 + 8 * Math.cos((deg * Math.PI) / 180)} cy={68 + 8 * Math.sin((deg * Math.PI) / 180)} r="1.4" fill="#8a5d0c" />
        ))}
        <circle cx="40" cy="68" r="4.2" fill="#f6ead2" />
      </g>
      <g className="lt-wheel lt-front">
        <circle cx="100" cy="78" r="13" fill="#2f221a" />
        <circle cx="100" cy="78" r="11.8" fill="none" stroke="#4d3c30" strokeWidth="2.8" strokeDasharray="3 2.4" />
        <circle cx="100" cy="78" r="7.2" fill="url(#lt-rim)" />
        {[0, 90, 180, 270].map((deg) => (
          <circle key={deg} cx={100 + 4.6 * Math.cos((deg * Math.PI) / 180)} cy={78 + 4.6 * Math.sin((deg * Math.PI) / 180)} r="1" fill="#8a5d0c" />
        ))}
        <circle cx="100" cy="78" r="2.4" fill="#f6ead2" />
      </g>
    </svg>
  )
}

/** The road home, through the round window. */
function Road({ v }: { v: LoadView }) {
  const still = useLessMotion()
  const [hop, setHop] = useState(0)
  useEffect(() => {
    if (!v.ready) return
    const t = setTimeout(() => setHop((n) => n + 1), 900)
    return () => clearTimeout(t)
  }, [v.ready])
  // ready: the world slows to a stop (every hill, the road, the wheels, the bounce), as a tractor pulling up would
  const world = useRef<HTMLDivElement>(null)
  const [stopped, setStopped] = useState(false)
  useEffect(() => {
    const w = world.current
    if (!v.ready || !w) return
    if (still || typeof w.getAnimations !== 'function') {
      setStopped(true)
      return
    }
    const going = w.getAnimations({ subtree: true }).filter((an) => an instanceof CSSAnimation && an.animationName !== 'lb-pass')
    const t0 = performance.now()
    let raf = 0
    const slow = () => {
      const k = Math.min(1, (performance.now() - t0) / STOP_MS)
      // eased: the speed falls fast at first, then settles to nothing
      const rate = (1 - k) ** 2
      for (const an of going) an.updatePlaybackRate(rate)
      if (k < 1) raf = requestAnimationFrame(slow)
      else {
        for (const an of going) an.pause()
        setStopped(true)
      }
    }
    raf = requestAnimationFrame(slow)
    return () => cancelAnimationFrame(raf)
  }, [v.ready, still])
  // the sun climbs an arc as the bar fills: from the left horizon to high in the middle
  const a = Math.PI * (0.95 - v.p * 0.5)
  const sun = { left: `${50 + Math.cos(a) * 40}%`, top: `${72 - Math.sin(a) * 38}%` }
  return (
    <div ref={world} className={`lb-world${stopped ? ' stopped' : ''}`} style={{ '--day': v.p } as CSSProperties}>
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
          <Tractor />
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
