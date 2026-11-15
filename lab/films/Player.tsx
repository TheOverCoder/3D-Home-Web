import { SpeakerSimpleHigh } from '@phosphor-icons/react/dist/csr/SpeakerSimpleHigh'
import { SpeakerSimpleSlash } from '@phosphor-icons/react/dist/csr/SpeakerSimpleSlash'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AgXToneMapping, Color, type PerspectiveCamera } from 'three'
import { audioGraph, farmSound } from '../../src/audio/sound'
import { art, type ArtId } from '../../src/ui/art'
import { burst } from '../../src/ui/burst'
import { ArrowCounterClockwise, SkipForward } from '../../src/ui/glyphs'
import { PRESS, SPRING } from '../../src/ui/motion'
import { lineAt, lint, timeline, type Film, type FxAt, type Line, type Timeline } from './format'
import { Score } from './score'
import { FilmStage, lookOf } from './stage3d'
import './Player.css'

// The film player: any film (./format.ts) played on the game's own models in a 3D view that fills the screen, with
// what wraps it in the game's own look — the letterbox, the lines in the game's paper bubbles (the speaker's name in
// the colour of their shirt, standing over where they are on the screen), a typed caption, the picture's effects (a flash, a
// glint, coins, confetti), Skip from the first second and, at the end, the card with what the player got. Sound is
// the game's: it starts with the film when the page has been touched (the game's Buy button is that touch);
// otherwise the 🔊 button starts the film again with it.

interface Beat {
  shot: number
  line: (Line & { key: number }) | null
  caption: string | null
  ended: boolean
}

type Burst = { fx: FxAt; key: number }

/** A look's colour as #rrggbb (a look may hold a hex string, a number or a three.js colour). */
const colourOf = (c: Color | number | string) => `#${new Color(c).getHexString()}`

const NAME_INK = (hex: string) => {
  const c = parseInt(hex.slice(1), 16)
  const l = 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)
  return l > 160 ? '#3b2a1e' : '#fff7e8'
}

export function FilmPlayer({ film, from = 0, sound = true, onClose }: { film: Film; from?: number; sound?: boolean; onClose: () => void }) {
  const tl = useMemo(() => timeline(film), [film])
  const reduced = !!useReducedMotion()
  const clock = useRef({ origin: null as number | null, base: from, paused: false })
  const score = useMemo(() => new Score(tl), [tl])
  const [beat, setBeat] = useState<Beat>({ shot: -1, line: null, caption: null, ended: false })
  const [fx, setFx] = useState<Burst[]>([])
  const [soundOn, setSoundOn] = useState(false)
  const heardOnce = useRef(false)
  // the effects still to come (a film started part-way has passed the earlier ones)
  const fxNext = useRef(-1)
  if (fxNext.current < 0)
    fxNext.current =
      Math.max(
        0,
        tl.fx.findIndex((f) => f.t >= from),
      ) + (tl.fx.every((f) => f.t < from) ? tl.fx.length : 0)
  const bubble = useRef<HTMLDivElement>(null)
  const bubbleBox = useRef<{ left: number; width: number } | null>(null)
  const now = () => {
    const c = clock.current
    const t = c.origin === null || c.paused ? c.base : c.base + (performance.now() - c.origin) / 1000
    return Math.min(t, tl.length)
  }
  const restart = (t: number) => {
    clock.current = { origin: performance.now(), base: t, paused: false }
    fxNext.current = tl.fx.findIndex((f) => f.t >= t)
    if (fxNext.current < 0) fxNext.current = tl.fx.length
    setBeat({ shot: -1, line: null, caption: null, ended: false })
    setFx([])
  }

  // sound with the film, when the page has been touched already (in the game: the Buy button); a film that cannot
  // start its sound shows the 🔊 button instead
  useEffect(() => {
    const touched = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive
    if (!sound || !touched) return
    score.start(now())
    const id = setTimeout(() => {
      if (audioGraph()?.ac.state === 'running') {
        heardOnce.current = true
        setSoundOn(true)
      } else score.stop()
    }, 250)
    return () => {
      clearTimeout(id)
      score.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, sound])
  useEffect(() => () => score.stop(), [score])

  // what scripts and the lab's checks may ask of it
  useEffect(() => {
    const w = window as unknown as { __filmPlayer?: unknown }
    w.__filmPlayer = {
      length: tl.length,
      timeline: tl,
      lint: lint(film),
      now,
      seek: (t: number) => {
        restart(t)
        clock.current.paused = true
      },
      play: () => restart(now()),
    }
    if (import.meta.env.DEV) for (const problem of lint(film)) console.warn(`[film ${film.id}] ${problem}`)
    return () => void delete w.__filmPlayer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl])

  // the bubble's place, for its tail to point at the speaker
  useLayoutEffect(() => {
    const r = bubble.current?.getBoundingClientRect()
    bubbleBox.current = r ? { left: r.left, width: r.width } : null
  }, [beat.line])

  /** Every frame, from the 3D view: the moment's shot and line, the effects passed, the stings, the bubble's tail. */
  const onFrame = (t: number, speaker: { x: number; y: number } | null, shot: number) => {
    if (clock.current.origin === null) clock.current.origin = performance.now()
    const line = lineAt(tl, t)
    const caption = tl.captions.find((c) => t >= c.t && t < c.end)?.item ?? null
    const ended = t >= tl.length - 1e-3
    const key = line ? tl.lines.indexOf(line) : -1
    setBeat((b) => (b.shot === shot && (b.line?.key ?? -1) === key && b.caption === caption && b.ended === ended ? b : { shot, line: line ? { ...line.item, key } : null, caption, ended }))
    while (fxNext.current < tl.fx.length && tl.fx[fxNext.current].t <= t) {
      const key = fxNext.current
      const f = tl.fx[fxNext.current++].item
      if (f.fx === 'confetti') {
        if (!reduced) burst({ x: innerWidth / 2, y: innerHeight * 0.38 }, { count: 110, spread: 90, power: 1.15 })
      } else setFx((list) => [...list.slice(-4), { fx: f, key }])
    }
    score.tick(t)
    const el = bubble.current
    const box = bubbleBox.current
    if (el && box) {
      if (speaker) {
        el.style.setProperty('--tail', `${Math.max(44, Math.min(box.width - 44, speaker.x - box.left))}px`)
        el.dataset.tail = 'on'
      } else el.dataset.tail = 'off'
    }
  }

  const skip = () => {
    restart(tl.length)
    if (score.on) score.skip(tl.length)
  }
  const again = () => {
    restart(0)
    if (score.on) score.start(0)
  }
  const toggleSound = () => {
    if (score.on) {
      score.stop()
      setSoundOn(false)
      return
    }
    // the first time: from the start, so the music is heard as it was written
    const first = !heardOnce.current
    if (first) restart(0)
    heardOnce.current = true
    score.start(first ? 0 : now())
    setSoundOn(true)
  }

  // the end: the card, a burst, the game's level flourish
  useEffect(() => {
    if (!beat.ended) return
    if (score.on) farmSound('level')
  }, [beat.ended, score])

  const who = beat.line ? film.cast[beat.line.who] : null
  const shirt = who ? colourOf(lookOf(who.look).shirt) : '#fff7e8'
  return (
    <m.div className="film" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <Canvas
        className="film-canvas"
        shadows
        dpr={[1, 2]}
        camera={{ fov: 40, near: 0.05, far: 160, position: [8, 2, 12] }}
        onCreated={({ gl }) => {
          gl.toneMapping = AgXToneMapping
        }}
      >
        <Stage tl={tl} now={now} reduced={reduced} onFrame={onFrame} />
      </Canvas>
      <div className={`film-bars${beat.ended ? ' out' : ''}`} aria-hidden="true">
        <i />
        <i />
      </div>
      <AnimatePresence>
        {beat.caption && !beat.ended && (
          <m.p className="film-caption" key={beat.caption} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {Array.from(beat.caption).map((ch, i) => (
              <m.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.15 + i * 0.045, duration: 0.01 }}>
                {ch}
              </m.span>
            ))}
          </m.p>
        )}
      </AnimatePresence>
      <div className="film-say" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {beat.line && who && !beat.ended && (
            <m.div
              ref={bubble}
              key={beat.line.key}
              className={`film-bubble paper mood-${beat.line.mood ?? 'flat'}`}
              initial={{ opacity: 0, y: 14, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
              transition={SPRING.pop}
            >
              <span className="film-name" style={{ background: shirt, color: NAME_INK(shirt) }}>
                {who.name}
              </span>
              <span className="film-text">{beat.line.text}</span>
            </m.div>
          )}
        </AnimatePresence>
      </div>
      {fx.map((f) => (
        <Effect key={f.key} at={f.fx} reduced={reduced} />
      ))}
      <m.button className={`btn soft small film-sound${soundOn ? ' on' : ''}`} onClick={toggleSound} aria-label={soundOn ? 'Sound off' : 'Sound on'} {...PRESS}>
        {soundOn ? <SpeakerSimpleHigh weight="fill" /> : <SpeakerSimpleSlash weight="fill" />}
        {!soundOn && <span>Sound</span>}
      </m.button>
      {!beat.ended && (
        <m.button className="btn soft small film-skip" onClick={skip} aria-label="Skip" {...PRESS}>
          Skip
          <SkipForward weight="fill" />
        </m.button>
      )}
      <AnimatePresence>{beat.ended && <EndCard film={film} onAgain={again} onClose={onClose} />}</AnimatePresence>
    </m.div>
  )
}

/** The 3D view: the stage, played at the film's time every frame. */
function Stage({ tl, now, reduced, onFrame }: { tl: Timeline; now: () => number; reduced: boolean; onFrame: (t: number, speaker: { x: number; y: number } | null, shot: number) => void }) {
  const { camera, size, scene } = useThree()
  const stage = useMemo(() => new FilmStage(tl), [tl])
  useEffect(() => {
    scene.background = stage.background
    scene.fog = stage.fog
    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene, stage])
  useEffect(() => () => stage.dispose(), [stage])
  useFrame(() => {
    const t = now()
    const info = stage.frame(t, camera as PerspectiveCamera, size, reduced)
    onFrame(t, info.speaker, info.shot)
  })
  return <primitive object={stage.root} />
}

/** An effect over the picture, once. */
function Effect({ at, reduced }: { at: FxAt; reduced: boolean }) {
  const fx = at.fx
  if (fx === 'tag')
    return (
      <m.div
        className="film-tag"
        initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
        animate={{ scale: [0.3, 1.12, 1, 1, 0.9], opacity: [0, 1, 1, 1, 0], rotate: [-8, 3, 0, 0, 0] }}
        transition={{ duration: 1.5, times: [0, 0.18, 0.3, 0.85, 1] }}
      >
        {at.art && <img src={art(at.art as ArtId)} alt="" />}
        {at.text}
      </m.div>
    )
  if (fx === 'flash') return <m.div className="film-flash" initial={{ opacity: reduced ? 0.4 : 0.95 }} animate={{ opacity: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }} />
  if (fx === 'glow') return <m.div className="film-glow" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 2.2, times: [0, 0.15, 0.7, 1] }} />
  if (fx === 'glint') return reduced ? null : <div className="film-glint" />
  if (fx === 'coins')
    return reduced ? null : (
      <div className="film-coins" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <img key={i} src={art('coin')} alt="" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.09 + (i % 3) * 0.05}s`, animationDuration: `${1.1 + (i % 4) * 0.18}s` }} />
        ))}
      </div>
    )
  if (fx === 'sparkle')
    return (
      <div className="film-sparkles" aria-hidden="true">
        {[
          [22, 18],
          [74, 14],
          [86, 34],
          [12, 40],
          [55, 9],
          [40, 30],
        ].map(([x, y], i) => (
          <img key={i} src={art('sparkles')} alt="" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.11}s` }} />
        ))}
      </div>
    )
  return null
}

/** What the player got, in the game's own words and pictures: Watch again, Continue. */
function EndCard({ film, onAgain, onClose }: { film: Film; onAgain: () => void; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = setTimeout(() => card.current && burst(card.current, { count: 70, spread: 75, power: 0.9 }), 260)
    return () => clearTimeout(id)
  }, [])
  return (
    <m.div className="film-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <m.div
        ref={card}
        className="film-card paper"
        role="dialog"
        aria-label={film.end.title}
        initial={{ scale: 0.7, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={SPRING.soft}
      >
        <m.img
          className="art film-card-art"
          src={art(film.end.art as ArtId)}
          alt=""
          initial={{ rotate: -12, scale: 0.4 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ ...SPRING.soft, delay: 0.12 }}
        />
        <h2>{film.end.title}</h2>
        <div className="film-chips">
          {film.end.chips.map((c, i) => (
            <m.span key={c.text} className="tag" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.pop, delay: 0.35 + i * 0.12 }}>
              <img src={art(c.art as ArtId)} alt="" />
              {c.text}
            </m.span>
          ))}
        </div>
        <div className="film-card-buttons">
          <m.button className="btn soft" onClick={onAgain} {...PRESS}>
            <ArrowCounterClockwise weight="bold" />
            Watch again
          </m.button>
          <m.button className="btn" onClick={onClose} {...PRESS}>
            Continue
          </m.button>
        </div>
      </m.div>
    </m.div>
  )
}
