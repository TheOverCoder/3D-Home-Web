import { useEffect } from 'react'
import { useThree, type RootState } from '@react-three/fiber'
import { AgXToneMapping, Vector2, type WebGLRenderer } from 'three'
import { clockFace, hourOf, moodAt, phaseDef, phaseOf } from '../farm/day'
import { farm } from '../farm/state'
import { debugSet } from '../lib/debug'
import { envIntensity } from '../scene/Lighting'
import { setDriveFilm } from '../scene/travel'
import { art } from '../ui/art'
import { lessMotion } from '../ui/still'
import { driveFilm, momentAt, shotAt, type DriveFilm as Film, type Trip } from './drive'
import { DriveSet, picture } from './driveSet'
import { EngineSound } from './driveSound'
import { onSkip, useFilm } from './state'
import { runFrames } from '../scene/frameRate'

// The drive's film, played in the game's own canvas while the map changes behind the curtain (src/scene/travel.ts:
// every drive plays it). It takes the frame over: the game's frame loop is held (nothing of the farm or the house is
// drawn, nothing moves; the farm's clock catches up after) and the film draws its own little world (./driveSet.ts) on
// the same renderer, one WebGL context, frame by frame on its own clock, until it ends or is skipped. The curtain
// (src/ui/Curtain.tsx) lifts onto it with the letterbox and Skip, and falls again before the game is drawn once more.
// The time of day is the farm's at that moment: the light and the sky (src/farm/day.ts, moodAt), the headlamps at
// night, the clock on the dashboard as the day chip says it. With less motion, a still from the driver's seat.

/** How long the picture takes to fade in and out (src/styles.css, .drive-film's veil, takes as long). */
export const FILM_FADE_MS = 400

const reduced = lessMotion

/** The film's world, made the first time a drive plays and kept while the scene is up. */
let made: DriveSet | null = null

/** The film playing now (for the tests and the console, ?debug): its clock — started at `start` (performance.now), or
 *  held at `hold` seconds in — what it shows, and how many frames it has drawn. */
let playing: { film: Film; start: number; hold: number | null; clock: string; night: boolean; frames: number } | null = null
/** How long the last film took to start (ms from the drive's film being asked for, ?debug): its world made (the first
 *  time), and its shaders compiled and its first frame drawn. */
const timing = { made: 0, ready: 0 }
/** The most draws and triangles a frame of each shot took, in the last film (?debug). */
let cost: { draws: number; triangles: number }[] = []
/** Stops the film playing at once (the scene going away under it). */
let stopNow: (() => void) | null = null
/** Where the next film's clock is held from its start (?debug: a picture of a moment). */
let holdNext: number | null = null

const timeOf = (p: NonNullable<typeof playing>) => Math.min(p.film.length, p.hold ?? (performance.now() - p.start) / 1000)

const size = new Vector2()

/** Draws the film `t` seconds in on the game's renderer, as the screen is now; the moment drawn. */
function draw(gl: WebGLRenderer, set: DriveSet, film: Film, t: number) {
  gl.getSize(size)
  const aspect = size.x / Math.max(1, size.y)
  const now = momentAt(film, t, aspect)
  set.pose(film, now, aspect)
  // the game's look tone-maps in its effects; the film is drawn straight to the screen, tone-mapped as it is drawn
  const before = gl.toneMapping
  const counting = gl.info.autoReset
  gl.toneMapping = AgXToneMapping
  gl.info.autoReset = false
  gl.info.reset()
  gl.setRenderTarget(null)
  gl.render(set.scene, set.camera)
  gl.toneMapping = before
  gl.info.autoReset = counting
  // what each shot costs at most (?debug)
  const most = (cost[now.shot] ??= { draws: 0, triangles: 0 })
  most.draws = Math.max(most.draws, gl.info.render.calls)
  most.triangles = Math.max(most.triangles, gl.info.render.triangles)
  return now
}

/** Plays the drive's film: resolves once it is over (or skipped) and the screen is dark again. */
async function play(trip: Trip, r3f: () => RootState): Promise<void> {
  const { gl, scene, setFrameloop } = r3f()
  const still = reduced()
  const film = driveFilm(trip, still)
  const asked = performance.now()
  const set = (made ??= new DriveSet())
  timing.made = Math.round(performance.now() - asked)
  // the hour now: its light, its sky, the clock on the dashboard and its picture (the day chip's), where you are going
  const now = farm.day.t
  const phase = phaseOf(now)
  const mood = moodAt(now)
  const night = phase === 'night'
  const clock = clockFace(hourOf(now))
  const fonts = document.fonts
  const [clockArt, toArt] = await Promise.all([
    picture(art(phaseDef(phase).art)),
    picture(art(trip.to === 'home' ? 'house' : 'sheaf-of-rice')),
    fonts?.load('800 64px "Nunito Variable"').catch(() => null),
    fonts?.load('600 64px "Fredoka Variable"').catch(() => null),
  ])
  set.label({ clock, clockArt, to: trip.to === 'home' ? 'The house' : 'The farm', toArt })
  set.light({ ...mood, night }, scene.environment, envIntensity())

  // the game's frames held from here (the screen is dark already); the film's shaders compiled before its first frame
  // (in parallel where the browser can: nothing stalls once it plays)
  const loop = r3f().frameloop
  setFrameloop('never')
  gl.getSize(size)
  set.pose(film, momentAt(film, 0, size.x / Math.max(1, size.y)), size.x / Math.max(1, size.y))
  await set.compile(gl)
  timing.ready = Math.round(performance.now() - asked)

  const sound = new EngineSound()
  return new Promise<void>((resolve) => {
    const me = { film, start: performance.now(), hold: holdNext, clock, night, frames: 0 }
    cost = []
    holdNext = null
    let raf = 0
    let ending = false
    let horned = -1
    const finish = () => {
      if (stopNow === finish) stopNow = null
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey, true)
      onSkip(null)
      sound.stop()
      if (playing === me) playing = null
      // (the curtain's layer goes, and the curtain, still down, is back over the scene: src/ui/Curtain.tsx)
      useFilm.setState({ on: null, lifted: false })
      // the game's frames again (its sun's shadow drawn afresh: the film's frames left it as it was)
      gl.shadowMap.needsUpdate = true
      if (loop === 'never') runFrames(setFrameloop)
      else setFrameloop(loop)
      resolve()
    }
    const end = () => {
      if (ending) return
      ending = true
      useFilm.setState({ lifted: false })
      setTimeout(finish, FILM_FADE_MS + 20)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      e.stopPropagation()
      end()
    }
    const frame = () => {
      raf = requestAnimationFrame(frame)
      // (nothing else may draw the game over it meanwhile)
      if (r3f().frameloop !== 'never') setFrameloop('never')
      const t = timeOf(me)
      const m = draw(gl, set, film, t)
      me.frames++
      // the sound follows the car (the still: cruising along)
      const shot = film.shots[m.shot]
      sound.drive(still ? 11 : m.car.v, still ? 0 : m.car.a, shot.cam.kind === 'cabin')
      if (shot.horn !== undefined && m.u >= shot.horn && horned !== m.shot) {
        horned = m.shot
        sound.horn()
      }
      // the curtain lifts once the film's first frames are on the screen
      if (me.frames === 2) useFilm.setState({ lifted: true })
      if (!ending && me.hold === null && t >= film.length - FILM_FADE_MS / 1000) end()
    }
    playing = me
    stopNow = finish
    useFilm.setState({ on: { to: trip.to, still }, lifted: false })
    onSkip(end)
    window.addEventListener('keydown', onKey, true)
    raf = requestAnimationFrame(frame)
  })
}

/** In the game's canvas: sets the drive's film for every drive from the scene's start (and takes it away with it). */
export function DriveFilm() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    debugSet('film', {
      /** the film playing (null: none): where it is, its shot, the clock it shows, whether it is night */
      state: () => {
        const p = playing
        if (!p) return null
        const t = timeOf(p)
        const { index } = shotAt(p.film, t)
        return { trip: p.film.trip, still: p.film.still, length: p.film.length, t, shot: p.film.shots[index].name, set: p.film.shots[index].set, clock: p.clock, night: p.night, frames: p.frames }
      },
      /** holds the picture of the film playing at `t` seconds in (null: plays on from there on its own clock); with
       *  none playing, the next one starts held there */
      hold: (t: number | null) => {
        const p = playing
        if (!p) {
          holdNext = t
          return
        }
        if (t === null && p.hold !== null) p.start = performance.now() - p.hold * 1000
        p.hold = t
      },
      film: driveFilm,
      timing,
      /** the most draws and triangles a frame of each shot took, in the last film */
      cost: () => cost.map((c, i) => ({ shot: i, ...c })),
    })
    const off = setDriveFilm((trip) => play(trip, get))
    return () => {
      off()
      stopNow?.()
      made?.dispose()
      made = null
    }
  }, [get])
  return null
}
