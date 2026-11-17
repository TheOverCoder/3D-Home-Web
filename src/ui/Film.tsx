import { AnimatePresence, animate, m, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { audioGraph, farmSound } from '../audio/sound'
import { levelProgress } from '../farm/xp'
import { storyControls, useStory, type FilmId, type StoryStep } from '../film/films'
import { lineAt, WORLD_FX, type EndCard, type FxAt, type Line, type Timeline, type WorldFx } from '../film/format'
import type { FilmRun, FrameInfo } from '../film/run'
import { wordsBy, type Speech } from '../film/voice'
import { lookOf } from '../film/cast'
import { art, type ArtId } from './art'
import { burst } from './burst'
import { ArrowCounterClockwise, Check, LockSimpleOpen, SkipForward, SpeakerSimpleHigh, SpeakerSimpleSlash } from './glyphs'
import { CountUp, MotionRoot, PRESS, SPRING } from './motion'
import './Film.css'

// What wraps a film (src/film): the letterbox, the lines in the game's paper bubbles (the speaker's name in the colour
// of their shirt, standing over where they are on the screen, the words coming up as their voice says them), a typed
// caption, the picture's effects (a flash, a glint, coins, confetti, an iris closing on the hero), the picture's grade
// (a wash of the time of day's light over it), Sound, Skip, and the end card — what the player
// got, as progress: the level bar filling with the XP it gave (a level reached is a show of its own), what is theirs
// now, and what it opens next. One overlay for the game (`StoryOverlay`: over the game's canvas, the film drawn on it
// by src/film/StoryFilm.tsx, a tap anywhere skipping) and the design lab (lab/films/Player.tsx: `FilmScreen` over its
// own view).

interface Beat {
  shot: number
  line: (Line & { key: number }) | null
  /** how many of the line's words have been said */
  said: number
  caption: string | null
  ended: boolean
}

type Burst = { fx: FxAt; key: number }

/** How open a film's iris is at t (its radius, as a share of the screen's diagonal: 1 all open), and where it closes:
 *  shut to a small round on its subject over 0.7 s from its moment, held there, shut the rest of the way in the film's
 *  last third of a second (a cartoon's end: the hero gets the last beat inside it). Null: no iris now. */
export function irisAt(tl: Timeline, t: number) {
  const f = tl.fx.find((x) => x.item.fx === 'iris')
  if (!f || t < f.t) return null
  const close = Math.min(1, (t - f.t) / 0.7)
  const small = 0.13
  const r = 1 - (1 - small) * (1 - (1 - close) ** 3)
  const shut = Math.max(0, Math.min(1, (t - (tl.length - 0.35)) / 0.35))
  return r * (1 - shut)
}

/** A look's colour as #rrggbb. */
const hex = (c: unknown) => {
  if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) return c
  if (typeof c === 'number') return `#${c.toString(16).padStart(6, '0')}`
  const h = (c as { getHexString?: () => string })?.getHexString?.()
  return h ? `#${h}` : '#fff7e8'
}

/** Ink that reads on a shirt's colour. */
const inkOn = (colour: string) => {
  const c = parseInt(colour.slice(1), 16)
  const l = 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)
  return l > 160 ? 'var(--ink)' : 'var(--paper)'
}

/** The overlay over a film playing: `run` its clock and sound; `card` the end card up (left out: once the film has
 *  reached its end); `playing` the picture up — bars, lines, Skip (left out: until the end card); `xp` the player's XP
 *  before and after the moment; `sound` whether it may start its sound by itself (the page touched already). */
export function FilmScreen({
  run,
  card,
  playing,
  xp,
  sound = true,
  onSkip,
  onAgain,
  onClose,
}: {
  run: FilmRun
  card?: boolean
  playing?: boolean
  xp: [number, number]
  sound?: boolean
  onSkip: () => void
  onAgain: () => void
  onClose: () => void
}) {
  const tl = run.tl
  const film = run.film
  const reduced = !!useReducedMotion()
  const vignette = useRef<HTMLDivElement>(null)
  const grade = useRef<HTMLDivElement>(null)
  const iris = useRef<HTMLDivElement>(null)
  // (a film opened at its end shows its end card at once, before its first frame)
  const [beat, setBeat] = useState<Beat>(() => ({ shot: -1, line: null, said: 0, caption: null, ended: run.ended }))
  const [fx, setFx] = useState<Burst[]>([])
  const [soundOn, setSoundOn] = useState(run.sound)
  const byLine = useRef(new Map<number, Speech>())
  // the effects still to come (a film started part-way has passed the earlier ones)
  const fxNext = useRef(-1)
  const bubble = useRef<HTMLDivElement>(null)
  const bubbleBox = useRef<{ left: number; width: number } | null>(null)
  const started = useRef(false)

  useEffect(() => {
    byLine.current = new Map(run.speech.flatMap((s) => (s.line === null ? [] : [[s.line, s] as const])))
    const from = (t: number) => {
      const i = tl.fx.findIndex((f) => f.t >= t)
      return i < 0 ? tl.fx.length : i
    }
    fxNext.current = from(run.now())
    const offRestart = run.onRestart((t) => {
      fxNext.current = from(t)
      setBeat({ shot: -1, line: null, said: 0, caption: null, ended: t >= tl.length - 1e-3 })
      setFx([])
    })
    /** Every frame drawn: the moment's shot and line (and how much of it has been said), the effects passed, the
     *  stings, the bubble's tail, the vignette. */
    const offFrame = run.onFrame((t: number, info: FrameInfo) => {
      // its sound starts with its first frame where the page has been touched (in the game: the Buy button)
      if (!started.current) {
        started.current = true
        const touched = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive
        if (sound && touched && !run.sound) {
          run.startSound(t)
          window.setTimeout(() => {
            if (audioGraph()?.ac.state === 'running') setSoundOn(true)
            else run.stopSound()
          }, 250)
        }
      }
      const line = lineAt(tl, t)
      const caption = tl.captions.find((c) => t >= c.t && t < c.end)?.item ?? null
      const ended = t >= tl.length - 1e-3
      const key = line ? tl.lines.indexOf(line) : -1
      const spoken = line ? byLine.current.get(key) : undefined
      // (the words its speech voice has reached, or by the film's clock when none reads it)
      const said = !line ? 0 : reduced || !spoken ? 99 : (run.score.words(spoken) ?? wordsBy(spoken.u, t - line.t))
      setBeat((b) =>
        b.shot === info.shot && (b.line?.key ?? -1) === key && b.said === said && b.caption === caption && b.ended === ended
          ? b
          : { shot: info.shot, line: line ? { ...line.item, key } : null, said, caption, ended },
      )
      while (fxNext.current < tl.fx.length && tl.fx[fxNext.current].t <= t) {
        const k = fxNext.current
        const f = tl.fx[fxNext.current++].item
        // (the world's effects are the stage's, drawn in the scene; the iris is drawn below, every frame)
        if (WORLD_FX.includes(f.fx as WorldFx) || f.fx === 'iris') continue
        if (f.fx === 'confetti') burst({ x: innerWidth / 2, y: innerHeight * 0.38 }, { count: 110, spread: 90, power: 34 })
        else setFx((list) => [...list.slice(-4), { fx: f, key: k }])
      }
      run.score.tick(t)
      if (vignette.current) vignette.current.style.opacity = info.portrait.toFixed(2)
      if (grade.current && grade.current.dataset.light !== info.light) grade.current.dataset.light = info.light
      const el0 = iris.current
      if (el0) {
        const r = irisAt(tl, t)
        el0.style.visibility = r === null || ended ? 'hidden' : 'visible'
        if (r !== null) {
          const w = el0.clientWidth || innerWidth
          const h = el0.clientHeight || innerHeight
          const at = info.focus ?? { x: w / 2, y: h / 2 }
          el0.style.setProperty('--ix', `${at.x.toFixed(0)}px`)
          el0.style.setProperty('--iy', `${at.y.toFixed(0)}px`)
          el0.style.setProperty('--ir', `${(r * Math.hypot(w, h)).toFixed(1)}px`)
        }
      }
      const el = bubble.current
      const box = bubbleBox.current
      if (el && box) {
        if (info.speaker) {
          el.style.setProperty('--tail', `${Math.max(44, Math.min(box.width - 44, info.speaker.x - box.left))}px`)
          el.dataset.tail = 'on'
        } else el.dataset.tail = 'off'
      }
    })
    return () => {
      offRestart()
      offFrame()
    }
  }, [run, tl, reduced, sound])

  // the bubble's place, for its tail to point at the speaker
  useLayoutEffect(() => {
    const r = bubble.current?.getBoundingClientRect()
    bubbleBox.current = r ? { left: r.left, width: r.width } : null
  }, [beat.line])

  const toggleSound = () => {
    if (run.sound) {
      run.stopSound()
      setSoundOn(false)
      return
    }
    // (in this tap: a phone lets the page speak and play from it)
    run.talker.unlock()
    run.startSound(run.now())
    setSoundOn(true)
  }

  const showCard = card ?? beat.ended
  const showFilm = playing ?? !beat.ended
  const who = beat.line ? film.cast[beat.line.who] : null
  const shirt = who ? hex(lookOf(who.look).shirt) : '#fff7e8'
  return (
    <>
      <div ref={grade} className="film-grade" aria-hidden="true" />
      <div ref={vignette} className="film-vignette" aria-hidden="true" />
      <div ref={iris} className="film-iris" aria-hidden="true" />
      <div className={`film-bars${showFilm ? '' : ' out'}`} aria-hidden="true">
        <i />
        <i />
      </div>
      <AnimatePresence>
        {showFilm && beat.caption && !beat.ended && (
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
          {showFilm && beat.line && who && !beat.ended && (
            <m.div
              ref={bubble}
              key={beat.line.key}
              className={`film-bubble paper mood-${beat.line.mood ?? 'flat'}`}
              initial={{ opacity: 0, y: 14, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
              transition={SPRING.pop}
            >
              <span className="film-name" style={{ background: shirt, color: inkOn(shirt) }}>
                {who.name}
              </span>
              <span className="film-text">
                {beat.line.text.split(/\s+/).map((word, i, all) => (
                  <span key={i} className={i < beat.said ? undefined : 'film-unsaid'}>
                    {word}
                    {i < all.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </span>
            </m.div>
          )}
        </AnimatePresence>
      </div>
      {showFilm && fx.map((f) => <Effect key={f.key} at={f.fx} reduced={reduced} />)}
      {showFilm && (
        <m.button
          className={`btn soft small film-sound${soundOn ? ' on' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleSound}
          aria-label={soundOn ? 'Sound off' : 'Sound on'}
          {...PRESS}
        >
          {soundOn ? <SpeakerSimpleHigh weight="fill" /> : <SpeakerSimpleSlash weight="fill" />}
          {!soundOn && <span>Sound</span>}
        </m.button>
      )}
      {showFilm && (
        <m.button className="btn soft small film-skip" onPointerDown={(e) => e.stopPropagation()} onClick={onSkip} aria-label="Skip" {...PRESS}>
          Skip
          <SkipForward weight="fill" />
        </m.button>
      )}
      <AnimatePresence>{showCard && <FilmEndCard end={film.end} xp={xp} sound={run.sound} onAgain={onAgain} onClose={onClose} />}</AnimatePresence>
    </>
  )
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

// ───────────────────────────── the end card ─────────────────────────────

/** When each part of the card comes in (s after it lands): the picture, the ribbon, the bar, what is yours, what is
 *  next — one after another, the eye led down the card. */
const AT = { art: 0.12, ribbon: 0.35, bar: 0.55, owns: 0.95, next: 1.45 }

/** What the player got, as progress (lab/FILM.md, achievement): the picture in a burst of light with the film's ribbon
 *  over it, the title, the level bar filling with the XP it gave (a level reached flashes the bar and pops the new
 *  number: a show of its own), what is theirs now (each stamped as it comes in), and what it opens next. Watch again,
 *  Continue. */
export function FilmEndCard({ end, xp, sound, onAgain, onClose }: { end: EndCard; xp: [number, number]; sound: boolean; onAgain: () => void; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (sound) farmSound('level')
    const id = window.setTimeout(() => hero.current && burst(hero.current, { count: 90, spread: 100, power: 34 }), 260)
    return () => window.clearTimeout(id)
  }, [sound])
  return (
    <m.div className="film-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <m.div
        ref={card}
        className="film-card paper"
        role="dialog"
        aria-label={end.title}
        initial={{ scale: 0.9, y: 60, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.18 } }}
        transition={SPRING.soft}
      >
        <div className="film-card-head">
          <div ref={hero} className="film-card-hero">
            <span className="film-card-rays" aria-hidden="true" />
            <m.img
              className="art film-card-art"
              src={art(end.art as ArtId)}
              alt=""
              initial={{ rotate: -18, scale: 0.2 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ ...SPRING.soft, delay: AT.art }}
            />
            {end.ribbon && (
              <m.span className="film-ribbon" initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ ...SPRING.pop, delay: AT.ribbon }}>
                {end.ribbon}
              </m.span>
            )}
          </div>
          <h2>{end.title}</h2>
        </div>
        <div className="film-card-body">
          <XpGain from={xp[0]} to={xp[1]} gained={end.xp} />
          <section className="film-card-part" aria-label="Yours now">
            <h3>Yours now</h3>
            <ul className="film-owns">
              {end.owns.map((o, i) => (
                <m.li key={o.text} className="film-own" initial={{ opacity: 0, scale: 0.5, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...SPRING.pop, delay: AT.owns + i * 0.16 }}>
                  <img className="art" src={art(o.art as ArtId)} alt="" />
                  <span>{o.text}</span>
                  <m.i className="film-own-check" aria-hidden="true" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.pop, delay: AT.owns + 0.2 + i * 0.16 }}>
                    <Check weight="bold" />
                  </m.i>
                </m.li>
              ))}
            </ul>
          </section>
          <m.section className="film-card-part" aria-label="Next" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.sheet, delay: AT.next }}>
            <h3>
              <LockSimpleOpen weight="bold" />
              Next
            </h3>
            <div className="film-next">
              {end.next.map((n) => (
                <span key={n.text} className="tag film-next-tag">
                  <img src={art(n.art as ArtId)} alt="" />
                  {n.text}
                </span>
              ))}
            </div>
          </m.section>
          <div className="film-card-buttons">
            <m.button className="btn soft" onClick={onAgain} {...PRESS}>
              <ArrowCounterClockwise weight="bold" />
              Watch again
            </m.button>
            <m.button className="btn" onClick={onClose} autoFocus {...PRESS}>
              Continue
            </m.button>
          </div>
        </div>
      </m.div>
    </m.div>
  )
}

/** The level bar filling with the XP a moment gave, from where it was: the badge with the level, the bar, `+n XP`
 *  counting up. Past a level, the bar fills to its end and flashes, the badge pops to the new level ("Level n!"), and
 *  the bar fills on from nothing. With less motion: where it ends, at once. */
function XpGain({ from, to, gained }: { from: number; to: number; gained: number }) {
  const still = !!useReducedMotion()
  const a = levelProgress(from)
  const b = levelProgress(to)
  const ups = b.level - a.level
  const frac = (p: ReturnType<typeof levelProgress>) => Math.max(0, Math.min(1, p.into / Math.max(1, p.need)))
  const fill = useMotionValue(still ? frac(b) : frac(a))
  const width = useTransform(fill, (v) => `${(v * 100).toFixed(2)}%`)
  const [level, setLevel] = useState(still ? b.level : a.level)
  const [flash, setFlash] = useState(0)
  const badge = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (still) return
    let off = false
    const run = async () => {
      await new Promise((r) => window.setTimeout(r, AT.bar * 1000))
      for (let l = a.level; l < b.level && !off; l++) {
        await animate(fill, 1, { duration: 0.55, ease: [0.22, 1, 0.36, 1] })
        if (off) return
        setLevel(l + 1)
        setFlash((n) => n + 1)
        farmSound('xp')
        if (badge.current) burst(badge.current, { count: 50, spread: 70, power: 26 })
        fill.set(0)
      }
      if (!off) await animate(fill, frac(b), { duration: ups ? 0.5 : 0.8, ease: [0.22, 1, 0.36, 1] })
    }
    void run()
    return () => {
      off = true
    }
    // (once, as the card comes in)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className={`film-xp${flash ? ' up' : ''}`}>
      <m.span ref={badge} key={`star-${level}`} className="film-xp-star" initial={flash ? { scale: 1.6 } : false} animate={{ scale: 1 }} transition={SPRING.pop}>
        <img src={art('glowing-star')} alt="" />
        <b>{level}</b>
      </m.span>
      <span className="film-xp-bar" role="progressbar" aria-label={`Level ${b.level}`} aria-valuemin={0} aria-valuemax={b.need} aria-valuenow={b.into}>
        <m.span className="film-xp-fill" style={{ width }} />
        {flash > 0 && <span key={flash} className="film-xp-flash" aria-hidden="true" />}
      </span>
      <m.b className="film-xp-gain" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.pop, delay: still ? 0 : AT.bar }}>
        <img src={art('gem-stone')} alt="" />+<CountUp to={gained} duration={0.8} /> XP
      </m.b>
      {/* a level reached: stamped over the bar, a show of its own */}
      {(flash > 0 || (still && ups > 0)) && (
        <m.b key={`level-${level}`} className="film-xp-level" initial={{ scale: 0.3, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -3 }} transition={SPRING.pop}>
          Level {level}!
        </m.b>
      )}
    </div>
  )
}

// ───────────────────────────── in the game ─────────────────────────────

/** The film a moment of play opened (src/film/films.ts), over the game's canvas where src/film/StoryFilm.tsx draws it:
 *  a veil that fades the picture out and in between the game and the film, the film's overlay, a tap anywhere to skip
 *  it, and its end card over the game once it is over. The rest of the interface is hidden meanwhile (<html
 *  data-film>, once the veil is dark). */
export function StoryOverlay() {
  const on = useStory((s) => s.on)
  const step = on?.step ?? null
  const veiled = step === 'dark' || step === 'out'
  const [dark, setDark] = useState(false)
  // the rest of the page hidden once the veil is dark (and back as the film goes)
  useEffect(() => {
    if (!on) return
    const id = window.setTimeout(() => setDark(true), 420)
    return () => window.clearTimeout(id)
  }, [on])
  useLayoutEffect(() => {
    if (!on || !dark) return
    const root = document.documentElement
    root.dataset.film = 'story'
    return () => {
      delete root.dataset.film
    }
  }, [on, dark])
  useEffect(() => {
    if (!on) setDark(false)
  }, [on])
  if (!on) return null
  const tap = () => {
    if (step === 'film' || step === 'dark') storyControls.skip()
  }
  return (
    <MotionRoot>
      <div className={`film game step-${step}${on.still ? ' still' : ''}`} onPointerDown={tap} role="presentation">
        {on.run && <FilmScreen run={on.run} card={step === 'card'} playing={step === 'film'} xp={on.ask.xp} onSkip={storyControls.skip} onAgain={storyControls.again} onClose={storyControls.close} />}
        {!on.run && step === 'card' && <FilmFallbackCard id={on.ask.id} xp={on.ask.xp} />}
        <div className={`film-veil${veiled ? ' on' : ''}`} aria-hidden="true" />
      </div>
    </MotionRoot>
  )
}

/** The end card when the film could not be made (its words come with it: a failure never loses the reward). */
function FilmFallbackCard({ id, xp }: { id: FilmId; xp: [number, number] }) {
  const [end, setEnd] = useState<EndCard | null>(null)
  useEffect(() => {
    let live = true
    import('../film/story').then((f) => live && setEnd(f.FILMS[id].end)).catch(() => storyControls.close())
    return () => {
      live = false
    }
  }, [id])
  return end ? <FilmEndCard end={end} xp={xp} sound={false} onAgain={storyControls.close} onClose={storyControls.close} /> : null
}

export type { StoryStep }
