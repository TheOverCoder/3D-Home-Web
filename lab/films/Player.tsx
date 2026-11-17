import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AgXToneMapping, PMREMGenerator, type PerspectiveCamera, type Scene } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Film } from '../../src/film/format'
import { FilmRun, type FrameInfo } from '../../src/film/run'
import { render } from '../../src/film/score'
import { FilmStage } from '../../src/film/stage3d'
import { FilmScreen } from '../../src/ui/Film'
import { loadSolids, solidsReady } from '../../src/lib/sculpt'
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
  // (the tools' props are built with the solid engine: the stage waits for it, as the game's does)
  const [solid, setSolid] = useState(solidsReady)
  useEffect(() => void loadSolids().then(() => setSolid(true)), [])
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
        {solid && <Stage run={run} reduced={reduced} onFrame={(info) => (view.current = info)} />}
      </Canvas>
      <FilmScreen run={run} xp={[Math.max(0, xp - film.end.xp), xp]} sound={sound} onSkip={() => run.skip()} onAgain={() => run.again()} onClose={onClose} />
    </m.div>
  )
}

/** The 3D view: the stage, played at the film's time every frame. */
function Stage({ run, reduced, onFrame }: { run: FilmRun; reduced: boolean; onFrame: (info: FrameInfo) => void }) {
  const { camera, size, scene, gl } = useThree()
  const stage = useMemo(() => new FilmStage(run.tl, run.speech), [run])
  useEffect(() => {
    scene.background = stage.background
    scene.fog = stage.fog
    // the light all round: the game's is a daylight probe (src/scene/Lighting.tsx, 0.4 at noon); the lab's a soft room
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    stage.environment(scene as Scene, env, 0.4)
    return () => {
      scene.background = null
      scene.fog = null
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [scene, stage, gl])
  useEffect(() => () => stage.dispose(), [stage])
  useFrame(() => {
    const t = run.now()
    const info = stage.frame(t, camera as PerspectiveCamera, size, reduced)
    onFrame(info)
    run.frame(t, info)
  })
  return <primitive object={stage.root} />
}
