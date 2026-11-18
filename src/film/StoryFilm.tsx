import { useEffect } from 'react'
import { useThree, type RootState } from '@react-three/fiber'
import { AgXToneMapping, PerspectiveCamera, Scene, Vector2, type WebGLRenderer } from 'three'
import { pauseMusic, playMusic, useMusic } from '../audio/music'
import { duckAmbient } from '../audio/sound'
import { farm } from '../farm/state'
import { debugSet } from '../lib/debug'
import { loadSolids } from '../lib/sculpt'
import { envIntensity } from '../scene/Lighting'
import { loadFilmOverlay } from '../ui/FilmLayer'
import { lessMotion } from '../ui/still'
import { askFilm, filmAsked, onFilmAsked, storyControls, storyStep, takeFilm, useStory, type FilmAsk, type FilmId, type StoryEvent } from './films'
import type { FilmRun, FrameInfo } from './run'
import type { FilmStage } from './stage3d'

// A moment's film (./films.ts: buying the shop opens "Under New Management"), played in the game's own canvas the way
// the drive's film is (./DriveFilm.tsx): the screen fades to dark over the game, the film is made — its stage
// (./stage3d.ts: the market from the game's own models and rows, the cast on the people engine's rigs, the player in
// what they wear) and its clock and sound (./run.ts) — and its shaders compiled; then the game's frame loop is held
// (nothing of the farm is drawn, nothing moves; the farm's clock catches up after, as it does after a drive) and the
// film draws on the same renderer, one WebGL context, frame by frame on its own clock. The overlay (src/ui/Film.tsx)
// lies over it: the lines, Sound, Skip (a tap anywhere, Esc). At its end, or skipped, the screen fades to dark again,
// the game's frames come back and the end card pops over the game: Continue, or Watch again. Whatever fails lands on
// the end card and gives the game back; nothing the moment did waits for the film, and nothing changes when it ends.

/** How long the veil takes to fade out or in (src/ui/Film.css, .film-veil, takes as long). */
export const STORY_FADE_MS = 400

const reduced = lessMotion
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
const size = new Vector2()

interface Playing {
  ask: FilmAsk
  run: FilmRun | null
  stage: FilmStage | null
  scene: Scene
  camera: PerspectiveCamera
  raf: number
  /** frames drawn since the film last started from the dark */
  frames: number
  /** the game's frame loop as it was when the film held it (null: not held) */
  held: RootState['frameloop'] | null
  /** the game's music was playing (it plays again once the film is closed) */
  music: boolean
  timer: number
  /** counts each start from the dark: what is still loading for an older one gives up */
  token: number
  still: boolean
  shot: number
}

/** The film up now, or null. */
let playing: Playing | null = null
/** Where the next film's clock is held from its start (?debug: a picture of a moment). */
let holdNext: number | null = null
/** How long the last film took to start (ms from being asked: its code loaded, its stage made, its first frame). */
const timing = { loaded: 0, made: 0, ready: 0 }
/** The most draws and triangles a frame of each shot took, in the last film (?debug). */
let cost: { draws: number; triangles: number }[] = []

/** Draws the film `t` seconds in on the game's renderer, as the screen is now; what it drew. */
function draw(gl: WebGLRenderer, p: Playing, t: number): FrameInfo {
  gl.getSize(size)
  const aspect = size.x / Math.max(1, size.y)
  if (Math.abs(p.camera.aspect - aspect) > 1e-4) {
    p.camera.aspect = aspect
    p.camera.updateProjectionMatrix()
  }
  const info = p.stage!.frame(t, p.camera, { width: size.x, height: size.y }, p.still)
  // the game's look tone-maps in its effects; the film is drawn straight to the screen, tone-mapped as it is drawn, its
  // sun's shadow drawn afresh every frame (its people move)
  const before = gl.toneMapping
  const counting = gl.info.autoReset
  gl.toneMapping = AgXToneMapping
  gl.shadowMap.needsUpdate = true
  gl.info.autoReset = false
  gl.info.reset()
  gl.setRenderTarget(null)
  gl.render(p.scene, p.camera)
  gl.toneMapping = before
  gl.info.autoReset = counting
  const most = (cost[info.shot] ??= { draws: 0, triangles: 0 })
  most.draws = Math.max(most.draws, gl.info.render.calls)
  most.triangles = Math.max(most.triangles, gl.info.render.triangles)
  return info
}

/** In the game's canvas: plays the films moments ask for (./films.ts), from the scene's start (and takes them away with
 *  it). */
export function StoryFilm() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    /** Moves the film on (./films.ts, storyStep). */
    const go = (e: StoryEvent) => {
      const p = playing
      const on = useStory.getState().on
      if (!p || !on) return
      const next = storyStep(on.step, e)
      if (next === null) return close()
      if (next === on.step) return
      useStory.setState({ on: { ...on, step: next } })
      window.clearTimeout(p.timer)
      if (next === 'out') {
        // (skipped: its sound cut at once; at its end its last notes ring under the fade)
        if (e === 'skip') p.run?.score.stop()
        p.timer = window.setTimeout(() => {
          release(p)
          go('dark')
        }, STORY_FADE_MS + 20)
      } else if (next === 'card') {
        // skipped while it was being made, or something failed: whatever is loading gives up, the game's frames back
        p.token++
        release(p)
        p.run?.score.stop()
      } else if (next === 'dark') {
        // Watch again: dark over the game, then the film from its start
        p.run?.score.stop()
        void make(p)
      }
    }

    /** The game's frames back (the film's stopped). */
    const release = (p: Playing) => {
      cancelAnimationFrame(p.raf)
      p.raf = 0
      if (p.held === null) return
      const { gl, setFrameloop } = get()
      // (the sun's shadow drawn afresh: the film's frames left it as they drew it)
      gl.shadowMap.needsUpdate = true
      setFrameloop(p.held === 'never' ? 'always' : p.held)
      p.held = null
    }

    /** The film over and gone (Continue, or the scene going): everything it made let go, the game as it was. */
    const close = () => {
      const p = playing
      if (!p) return
      playing = null
      window.clearTimeout(p.timer)
      p.token++
      release(p)
      p.run?.stop()
      p.stage?.dispose()
      p.scene.clear()
      window.removeEventListener('keydown', onKey, true)
      duckAmbient(false)
      if (p.music) playMusic()
      storyControls.skip = storyControls.again = storyControls.close = () => {}
      useStory.setState({ on: null })
    }

    /** From the dark: the film made (once) and its shaders compiled, the game's frames held, the film's drawn from
     *  its start (or where ?debug holds it); a step on once its first frames are on the screen. */
    const make = async (p: Playing) => {
      const token = ++p.token
      const asked = performance.now()
      const stale = () => playing !== p || p.token !== token
      try {
        // (the tools' films build their props with the solid engine: loaded with the farm, waited for here)
        const [story] = await Promise.all([import('./story'), loadFilmOverlay(), wait(STORY_FADE_MS + 20), loadSolids()])
        if (stale()) return
        timing.loaded = Math.round(performance.now() - asked)
        if (!p.run) p.run = new story.FilmRun(story.FILMS[p.ask.id])
        if (!p.stage) {
          p.stage = new story.FilmStage(p.run.tl, p.run.speech, farm.outfit)
          // (the game's own light all round: its environment, as strong as the game has it)
          p.stage.environment(p.scene, get().scene.environment, envIntensity())
          p.scene.add(p.stage.root)
          p.scene.background = p.stage.background
          p.scene.fog = p.stage.fog
        }
        timing.made = Math.round(performance.now() - asked)
        const run = p.run
        const again = run.started && holdNext === null
        if (holdNext !== null) run.restart(holdNext, true)
        holdNext = null
        // the game's frames held from here (the screen is dark); the film posed and its shaders compiled
        const { gl, setFrameloop, frameloop } = get()
        if (p.held === null) p.held = frameloop
        setFrameloop('never')
        cost = []
        draw(gl, p, run.now())
        await p.stage.compile(gl, p.scene, p.camera)
        if (stale()) return
        // (watched again: from its start now that it can draw at once)
        if (again) run.again()
        useStory.setState((s) => (s.on ? { on: { ...s.on, run } } : s))
        p.frames = 0
        const frame = () => {
          p.raf = requestAnimationFrame(frame)
          // (nothing else may draw the game over it meanwhile: a panel closing asks for the game's frames again)
          if (get().frameloop !== 'never') get().setFrameloop('never')
          try {
            const t = run.now()
            const info = draw(get().gl, p, t)
            p.shot = info.shot
            run.frame(t, info)
          } catch (e) {
            console.warn('[film] a frame failed', e)
            go('fail')
            return
          }
          p.frames++
          const step = useStory.getState().on?.step
          if (step === 'dark' && p.frames === 2) {
            timing.ready = Math.round(performance.now() - asked)
            go('ready')
          } else if (step === 'film' && run.ended) go('end')
        }
        p.raf = requestAnimationFrame(frame)
      } catch (e) {
        console.warn('[film] the film could not play', e)
        if (!stale()) go('fail')
      }
    }

    /** Esc skips (or closes the end card), Enter and Space skip the film; no other key reaches the game meanwhile. */
    const onKey = (e: KeyboardEvent) => {
      const step = useStory.getState().on?.step
      if (!step) return
      const mine = e.target instanceof Element && e.target.closest('.film')
      if (e.key === 'Escape' || (step !== 'card' && (e.key === 'Enter' || e.key === ' '))) {
        e.preventDefault()
        e.stopPropagation()
        go(step === 'card' ? 'close' : 'skip')
        return
      }
      if (mine && (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab')) return
      e.stopPropagation()
    }

    /** A film asked for: it plays (one at a time). */
    const start = (ask: FilmAsk) => {
      if (playing) return
      const p: Playing = {
        ask,
        run: null,
        stage: null,
        scene: new Scene(),
        camera: new PerspectiveCamera(40, 1, 0.05, 160),
        raf: 0,
        frames: 0,
        held: null,
        music: useMusic.getState().playing,
        timer: 0,
        token: 0,
        still: reduced(),
        shot: 0,
      }
      playing = p
      // the game's music and its room tone step aside while it plays
      if (p.music) pauseMusic(false)
      duckAmbient(true)
      window.addEventListener('keydown', onKey, true)
      storyControls.skip = () => go('skip')
      storyControls.again = () => go('again')
      storyControls.close = () => go('close')
      useStory.setState({ on: { ask, step: 'dark', run: null, still: p.still } })
      void make(p)
    }

    const take = () => {
      const ask = takeFilm()
      if (ask) start(ask)
    }
    const off = onFilmAsked(take)
    if (filmAsked()) take()

    debugSet('story', {
      /** the film up (null: none): its step, its second and shot, the frames drawn, the XP its card fills between */
      state: () => {
        const p = playing
        const on = useStory.getState().on
        if (!p || !on) return null
        return { id: p.ask.id, step: on.step, t: p.run?.now() ?? null, length: p.run?.length ?? null, shot: p.shot, frames: p.frames, xp: p.ask.xp, still: p.still }
      },
      /** holds the picture of the film up at `t` seconds in (null: plays on from there); with none, the next one starts
       *  held there */
      hold: (t: number | null) => {
        const run = playing?.run
        if (!run) {
          holdNext = t
          return
        }
        if (t === null) run.restart(run.now())
        else run.restart(t, true)
      },
      /** plays a moment's film again (as its moment would: the XP as it is now, nothing gained) */
      ask: (id: FilmId = 'shop') => askFilm({ id, xp: [farm.xp.points, farm.xp.points] }),
      skip: () => go('skip'),
      close: () => go('close'),
      timing,
      /** the most draws and triangles a frame of each shot took, in the last film */
      cost: () => cost.map((c, i) => ({ shot: i, ...c })),
    })
    return () => {
      off()
      close()
    }
  }, [get])
  return null
}
