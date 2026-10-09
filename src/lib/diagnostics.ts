import { Vector3, type Camera, type WebGLRenderer } from 'three'
import { playerState } from './playerState'
import { useSettings } from '../settings'
import { useHome } from '../store'

// A one-click report for when something looks wrong on someone else's machine: GPU, browser, where the player
// stands, what the renderer is holding, and the last errors. Nothing leaves the page unless the person pastes it.

const log: string[] = []
let renderer: WebGLRenderer | null = null
let camera: Camera | null = null
let installed = false

const push = (kind: string, ...args: unknown[]) => {
  const text = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : safe(a))).join(' ')
  log.push(`[${new Date().toISOString().slice(11, 19)}] ${kind}: ${text}`.slice(0, 400))
  if (log.length > 40) log.shift()
}
const safe = (v: unknown) => {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** Starts recording console errors/warnings and uncaught errors. Call once, as early as possible. */
export function installDiagnostics() {
  if (installed) return
  installed = true
  for (const k of ['error', 'warn'] as const) {
    const original = console[k].bind(console)
    console[k] = (...args: unknown[]) => {
      push(k, ...args)
      original(...args)
    }
  }
  window.addEventListener('error', (e) => push('uncaught', e.message))
  window.addEventListener('unhandledrejection', (e) => push('rejection', String(e.reason)))
}

export function registerRenderer(gl: WebGLRenderer, cam: Camera) {
  renderer = gl
  camera = cam
  gl.domElement.addEventListener('webglcontextlost', () => push('webglcontextlost'))
  gl.domElement.addEventListener('webglcontextrestored', () => push('webglcontextrestored'))
}

export function collectDiagnostics(): string {
  const s = useHome.getState()
  const gl = renderer?.getContext()
  const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
  const p = playerState.position
  const info = renderer?.info
  const report = {
    when: new Date().toISOString(),
    page: location.href,
    browser: navigator.userAgent,
    screen: { inner: [innerWidth, innerHeight], dpr: devicePixelRatio, pixelRatioUsed: renderer?.getPixelRatio() },
    gpu: gl
      ? {
          renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'hidden',
          vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'hidden',
          webgl: gl.getParameter(gl.VERSION),
          maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          contextLost: gl.isContextLost(),
        }
      : 'no renderer yet',
    app: { phase: s.phase, view: s.view, quality: s.quality, room: s.room, screenOpen: s.screen, carrying: s.carrying },
    settings: useSettings.getState(),
    where: {
      player: [p.x, p.y, p.z].map((n) => +n.toFixed(2)),
      camera: camera ? camera.position.toArray().map((n) => +n.toFixed(2)) : null,
      lookingAt: camera ? camera.getWorldDirection(new Vector3()).toArray().map((n) => +n.toFixed(2)) : null,
    },
    renderer: info ? { geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length, calls: info.render.calls, triangles: info.render.triangles } : null,
    recent: log,
  }
  return JSON.stringify(report, null, 2)
}
