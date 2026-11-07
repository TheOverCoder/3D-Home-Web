import { playerState } from './playerState'
import { look } from './look'
import { setLoadPhase } from './loader'
import { profile, switchLightProfile } from './profile'
import { useHome, type Failure } from '../store'

// Starting the 3D scene, and starting it again. A phone browser that runs short of graphics memory (many tabs, a
// big scene) drops the WebGL context — sometimes before the first frame — and the scene cannot continue on it.
// Instead of a dead end, the scene restarts on a fresh context: right away in light graphics if it never got
// going, or as it was (and where you stood) if it had. Only when that fails too does the intro say so, with the
// actual reason and what to try. No three.js in here: the page shell uses it.

/** Where to put the player when the scene starts again mid-game (read once by <Player />). */
export const resume: { at: [number, number, number] | null; yaw: number; pitch: number } = { at: null, yaw: Math.PI, pitch: -0.04 }

const hooks: (() => void)[] = []
/** Lets the 3D side drop what it cached for the old context (generated surfaces…) before the scene mounts again. */
export function onGraphicsRestart(fn: () => void) {
  hooks.push(fn)
}

let restarts = 0
const MAX_RESTARTS = 3

/** Is WebGL there at all? (A quick probe, released at once.) */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

const NETWORK = /failed to fetch|dynamically imported module|importing a module script failed|error loading dynamically|chunkloaderror|load failed|networkerror/i
const GRAPHICS = /webgl|context|shader|getshaderprecisionformat|gl_|gpu|framebuffer|out of memory/i
const WASM = /webassembly|wasm|rapier/i

export function classify(error: unknown): Failure {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  if (NETWORK.test(detail) || navigator.onLine === false)
    return { kind: 'network', message: 'Part of the game did not download. Check the connection and try again.', detail }
  if (typeof WebAssembly === 'undefined' || WASM.test(detail))
    return { kind: 'wasm', message: 'This browser blocks WebAssembly (strict or lockdown mode), which the physics needs.', detail }
  if (GRAPHICS.test(detail) || !webglAvailable())
    return {
      kind: 'graphics',
      message: webglAvailable()
        ? 'The browser could not keep the 3D graphics running — usually it ran short of graphics memory (many open tabs or apps).'
        : 'This browser has 3D graphics (WebGL) switched off or blocked for this site.',
      detail,
    }
  return { kind: 'other', message: 'Something went wrong while the house was starting.', detail }
}

/**
 * Starts the 3D scene again on a fresh graphics context. `light`: with the lightest settings (kept for next
 * time). In the middle of a game the player comes back where they stood.
 */
export function restartGraphics(light: boolean, auto = false) {
  restarts++
  const s = useHome.getState()
  if (s.phase === 'playing') {
    const p = playerState.position
    resume.at = [p.x, p.y + 0.2, p.z]
    resume.yaw = look.yaw
    resume.pitch = look.pitch
  }
  if (light && !profile.light) switchLightProfile(true, auto)
  if (profile.light) useHome.setState({ quality: 'low', qualityAuto: true })
  for (const fn of hooks) {
    try {
      fn()
    } catch (e) {
      console.warn('[startup] restart hook failed', e)
    }
  }
  setLoadPhase('prepare')
  useHome.setState((st) => ({
    attempt: st.attempt + 1,
    failure: null,
    graphics: st.phase === 'playing' ? 'restarting' : 'ok',
    ready: { scene: false, env: false, warm: false },
    progress: 0,
  }))
}

/** The 3D scene threw while starting (or later): restart it if that can help, otherwise explain. */
export function handleSceneError(error: unknown) {
  console.warn('[startup] the 3D scene failed:', error)
  const s = useHome.getState()
  const lost = s.graphics === 'lost'
  const failure = lost ? classify(new Error(`WebGL context lost (${String((error as Error)?.message ?? error)})`)) : classify(error)
  // a failure before the scene was up is often the graphics running short too (an error thrown by a context that
  // was lost as it started): one try in light graphics is cheap; a graphics failure gets a few tries
  const early = !s.ready.warm
  const retries = failure.kind === 'graphics' ? MAX_RESTARTS : failure.kind === 'other' && early ? 1 : 0
  const canRetry = restarts < retries && webglAvailable()
  if (canRetry) {
    // never got going: try the lightest settings; it had been running: the same settings on a new context
    const started = useHome.getState().ready.warm
    window.setTimeout(() => restartGraphics(!started || restarts > 0, true), 400)
    return
  }
  useHome.getState().setFailure(failure)
}

/**
 * The browser dropped the graphics context. Before the scene was up: start again in light graphics. During a
 * game: wait a moment for the browser to give it back by itself, then start the scene again where you stood.
 */
export function handleContextLost() {
  const s = useHome.getState()
  if (s.failure) return
  if (restarts >= MAX_RESTARTS) {
    s.setFailure(classify(new Error('WebGL context lost repeatedly')))
    return
  }
  if (!s.ready.warm) {
    window.setTimeout(() => restartGraphics(true, true), 600)
    return
  }
  // browsers usually give the context back within a moment (three asks them to); if not, start afresh
  window.setTimeout(() => {
    if (useHome.getState().graphics === 'lost') restartGraphics(false)
  }, 8000)
}

export const restartCount = () => restarts
