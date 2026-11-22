import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor, useProgress } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { debugSet } from '../lib/debug'
import { registerRenderer } from '../lib/diagnostics'
import { installHdrGuard } from '../lib/hdrGuard'
import { downloadLater, setLoadPhase } from '../lib/loader'
import { resetSurfaces } from '../lib/proceduralTextures'
import { profile } from '../lib/profile'
import { setSculptDetail } from '../lib/sculpt'
import { onGraphicsRestart } from '../lib/startup'
import { useHome, type Quality } from '../store'
import { FarmClock } from '../farm/Garden'
import { EditMode } from '../farm/EditMode'
import { farm } from '../farm/state'
import { DriveFilm } from '../film/DriveFilm'
import { StoryFilm } from '../film/StoryFilm'
import { FarmFx } from '../fx/FarmFx'
import { Effects } from './Effects'
import { LightDirector } from './LightDirector'
import { Lighting } from './Lighting'
import { Maps } from './Maps'
import { ThingTag } from '../ui/ThingTag'
import { DecorateMode } from '../home/DecorateMode'
import { Wardrobes } from '../home/Wardrobe'
import { Computers } from '../home/Computer'
import { RenderPause } from './RenderPause'
import { Player } from './Player'
import { ViewPass } from './ViewPass'
import { Warmup } from './Warmup'
import { FrameCount, FramePacer, fpsAsked } from './frameRate'
import { useSettings } from '../settings'

// before any material compiles: no lit surface may write a value the half-float buffers cannot hold
installHdrGuard()
// a restart in light graphics paints the generated surfaces again, at the light profile's (smaller) size
onGraphicsRestart(resetSurfaces)

// ?tune: a live tuning panel for developers (src/debug/Tune.tsx), in a chunk of its own that players never download
const Tune = new URLSearchParams(location.search).has('tune') ? lazy(() => import('../debug/Tune')) : null

const TIERS: Quality[] = ['low', 'medium', 'high']
const isQuality = (q: unknown): q is Quality => TIERS.includes(q as Quality)
const pinned = new URLSearchParams(location.search).get('quality')
const lockedQuality = isQuality(pinned) ? pinned : null
const SAVED = '3d-home:quality:v1'

/**
 * A first guess before a single frame is drawn, so an ordinary laptop does not start on the heaviest settings
 * and stutter until the monitor catches up: the tier remembered from the last visit, else one from the GPU name.
 */
function initialQuality(): { quality: Quality; auto: boolean } {
  if (lockedQuality) return { quality: lockedQuality, auto: false }
  // light graphics (chosen, or after the graphics failed to start) always begin at the bottom
  if (profile.light) return { quality: 'low', auto: true }
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED) ?? 'null') as { quality?: unknown; auto?: unknown } | null
    if (saved && isQuality(saved.quality)) return { quality: saved.quality, auto: saved.auto !== false }
  } catch {
    /* storage blocked or garbage: guess */
  }
  if (profile.device !== 'desktop') return { quality: profile.startQuality, auto: true }
  let gpu = ''
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)).toLowerCase()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    /* no probe: assume a capable machine, the monitor still steps down */
  }
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(gpu)) return { quality: 'low', auto: true }
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false
  // integrated and mobile GPUs: the full chain (MSAA ×4, AO, depth of field) at 1.5× pixels is too much for them
  if (touch || memory <= 4 || /intel|iris|uhd|mali|adreno|powervr|apple gpu|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/.test(gpu)) {
    return { quality: 'medium', auto: true }
  }
  return { quality: 'high', auto: true }
}

const start = initialQuality()
useHome.setState({ quality: start.quality, qualityAuto: start.auto })
// the map the scene starts on: where the save was left (a new farm on the farm); from then on the scene follows the save
// (src/scene/maps.ts), and a restart of the graphics keeps the map it was on
if (useHome.getState().map === null) useHome.setState({ map: farm.place })

// pixel ratio per tier comes from the device profile (src/lib/profile.ts): retina/4K at 2× is far too heavy for
// the post chain, and shedding pixels is the cheapest win

function Ready() {
  const markReady = useHome((s) => s.markReady)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  debugSet('gl', gl)
  useEffect(() => registerRenderer(gl, camera), [gl, camera])
  useEffect(() => {
    markReady('scene')
    setLoadPhase('prepare')
  }, [markReady])
  return null
}

/**
 * Moves the quality one tier at a time with the measured frame rate. The band between the two bounds is the
 * hysteresis (no step while the rate sits inside it), it only starts once the house is up and shaders have
 * compiled (start-up frames are always slow), and after three reversals it settles on the lower tier for good.
 */
function QualityGovernor({ onLastResort }: { onLastResort: () => void }) {
  const phase = useHome((s) => s.phase)
  const [armed, setArmed] = useState(false)
  const lastStep = useRef(0)
  useEffect(() => {
    if (phase !== 'playing') return
    const t = setTimeout(() => setArmed(true), 4000)
    return () => clearTimeout(t)
  }, [phase])
  if (!armed) return null
  const step = (dir: -1 | 1) => {
    const { quality, qualityAuto, setQuality } = useHome.getState()
    if (!qualityAuto) return
    const i = TIERS.indexOf(quality) + dir
    lastStep.current = dir
    if (i < 0) onLastResort()
    else if (i < TIERS.length) setQuality(TIERS[i], true)
  }
  return (
    <PerformanceMonitor
      // [decline below, incline above] in fps; 60 Hz screens must hold ~58 to earn the next tier; at the 30 a player
      // chose (./frameRate.ts) the bounds are 30's: below 24 is too slow, and nothing above it is asked for
      bounds={(refresh) => (useSettings.getState().frameRate === 30 ? [24, 100] : refresh > 90 ? [55, 100] : [45, 58])}
      flipflops={3}
      onDecline={() => step(-1)}
      onIncline={() => step(1)}
      onFallback={() => {
        if (lastStep.current > 0) step(-1)
      }}
    />
  )
}

export default function Experience() {
  const map = useHome((s) => s.map)
  const quality = useHome((s) => s.quality)
  const qualityAuto = useHome((s) => s.qualityAuto)
  const progress = useProgress((s) => s.progress)
  const device = window.devicePixelRatio || 1
  // last step below "low": render slightly under native resolution rather than drop frames
  const [squeeze, setSqueeze] = useState(false)
  const dpr = squeeze ? Math.min(device, 0.8) : Math.min(device, profile.dpr[quality])

  useEffect(() => useHome.setState({ progress }), [progress])
  // what the loader left for later (the house's furniture on a farm that opens on the farm): a few seconds into play,
  // in idle time, so the first frames have the network and the device to themselves
  const playing = useHome((s) => s.phase === 'playing')
  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(downloadLater, 5000)
    return () => window.clearTimeout(t)
  }, [playing])

  useEffect(() => {
    if (lockedQuality) return
    try {
      localStorage.setItem(SAVED, JSON.stringify({ quality, auto: qualityAuto }))
    } catch {
      /* storage unavailable */
    }
  }, [quality, qualityAuto])
  useEffect(() => {
    if (quality !== 'low') setSqueeze(false)
  }, [quality])
  // the models' fine surface detail (wool, cloth, feathers) is drawn from Medium up: Low keeps every pixel cheap
  useEffect(() => setSculptDetail(quality !== 'low'), [quality])

  return (
    <Canvas
      shadows="percentage"
      flat
      dpr={[Math.min(1, dpr), dpr]}
      camera={{ fov: 50, near: 0.1, far: 1500, position: [0, 6, 9] }}
      gl={{ antialias: false, powerPreference: profile.powerPreference }}
      // touch: every drag on the scene turns the view — no browser panning, zooming or pull-to-refresh
      style={{ position: 'fixed', inset: 0, zIndex: 0, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* the frames a second the player chose: 60, or a steady 30 */}
      <FramePacer />
      {fpsAsked && <FrameCount />}
      {!lockedQuality && qualityAuto && <QualityGovernor onLastResort={() => setSqueeze(true)} />}
      {/* leaves out of each frame what cannot be seen (behind walls, out of view, out of the sun) */}
      <ViewPass />
      <Lighting />
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]}>
          {/* the map you are on, the farm or the house (only one in the scene: src/scene/Maps.tsx) */}
          <Maps />
          {/* the farm goes on while you are in the house */}
          <FarmClock />
          <LightDirector />
          <ThingTag />
          <Player />
          {/* after the player: the edit mode's camera runs after the player's own (the farm's mode opens on the farm
              only, decorating in the house only: src/home/decorate.ts) */}
          <EditMode />
          <DecorateMode />
          {/* the house's wardrobes, and the camera that films you while one is open (after the player's own too) */}
          {map === 'home' && <Wardrobes />}
          {/* the house's computers, and the desk's price tag while it has none (src/home/Computer.tsx) */}
          {map === 'home' && <Computers />}
          <Ready />
        </Physics>
        {/* the farm's small effects: water, sparkles and dust (three.quarks, loaded once playing) and flying coins */}
        <FarmFx />
        <Effects />
        {/* compile every shader and upload every texture up front, so turning round or entering a room never stalls */}
        <Warmup />
        <RenderPause />
        {/* the drive's film, played between the maps on this same canvas (src/scene/travel.ts) */}
        <DriveFilm />
        {/* a moment's film (buying the shop), played on this same canvas (src/film/films.ts) */}
        <StoryFilm />
      </Suspense>
      {Tune && (
        <Suspense fallback={null}>
          <Tune />
        </Suspense>
      )}
    </Canvas>
  )
}
