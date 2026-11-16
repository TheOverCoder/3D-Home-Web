import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { AgXToneMapping, type PerspectiveCamera } from 'three'
import type { Film } from '../../src/film/format'
import { FilmRun, type FrameInfo } from '../../src/film/run'
import { render } from '../../src/film/score'
import { FilmStage } from '../../src/film/stage3d'
import { FilmScreen } from '../../src/ui/Film'
import './Player.css'

// The lab's film player: any film (src/film/format.ts) played on the game's own models (src/film/stage3d.ts) in a 3D
// view of its own that fills the screen, under the game's own film overlay (src/ui/Film.tsx: the letterbox, the
// lines, the effects, Sound, Skip and the end card) — the same clock and sound as the game's (src/film/run.ts), so
// what is chosen here is what the game plays. Sound starts with the film when the page has been touched; otherwise the
// Sound button starts it. In the lab the end card shows over the film's last frame (in the game, over the game).

/** The player's XP after the moment, in the lab (the end card's bar fills to it from the film's XP less): as a player
 *  buying the shop might have it, level 13 near its end. */
const SAMPLE_XP = 1360

export function FilmPlayer({ film, from = 0, sound = true, xp = SAMPLE_XP, onClose }: { film: Film; from?: number; sound?: boolean; xp?: number; onClose: () => void }) {
  const run = useMemo(() => new FilmRun(film, from), [film, from])
  const reduced = !!useReducedMotion()
  const view = useRef<FrameInfo | null>(null)
  useEffect(() => () => run.stop(), [run])

  // what scripts and the lab's checks may ask of it (lab/films/moments.mjs, scripts/lab-film.mjs)
  useEffect(() => {
    const w = window as unknown as { __filmPlayer?: unknown }
    const problems = run.problems()
    w.__filmPlayer = {
      length: run.length,
      timeline: run.tl,
      lint: problems,
      speech: run.speech,
      voices: run.voices,
      /** the last frame drawn: its shot, the speaker on the screen, whether the camera looks at the farm */
      view: () => view.current,
      now: () => run.now(),
      seek: (t: number) => run.restart(t, true),
      play: () => run.restart(run.now()),
      /** the score rendered offline (the levels, a wav) */
      render: (rate?: number) => render(run.tl, run.speech, run.voices, rate),
    }
    if (import.meta.env.DEV) for (const problem of problems) console.warn(`[film ${film.id}] ${problem}`)
    return () => void delete w.__filmPlayer
  }, [run, film])

  return (
    // (any touch on the film lets a phone speak the lines: it speaks only once a touch has made it)
    <m.div className="film" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onPointerDown={() => run.talker.unlock()}>
      <Canvas
        className="film-canvas"
        shadows
        dpr={[1, 2]}
        camera={{ fov: 40, near: 0.05, far: 160, position: [8, 2, 12] }}
        onCreated={({ gl }) => {
          gl.toneMapping = AgXToneMapping
        }}
      >
        <Stage run={run} reduced={reduced} onFrame={(info) => (view.current = info)} />
      </Canvas>
      <FilmScreen run={run} xp={[Math.max(0, xp - film.end.xp), xp]} sound={sound} onSkip={() => run.skip()} onAgain={() => run.again()} onClose={onClose} />
    </m.div>
  )
}

/** The 3D view: the stage, played at the film's time every frame. */
function Stage({ run, reduced, onFrame }: { run: FilmRun; reduced: boolean; onFrame: (info: FrameInfo) => void }) {
  const { camera, size, scene } = useThree()
  const stage = useMemo(() => new FilmStage(run.tl, run.speech), [run])
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
    const t = run.now()
    const info = stage.frame(t, camera as PerspectiveCamera, size, reduced)
    onFrame(info)
    run.frame(t, info)
  })
  return <primitive object={stage.root} />
}
