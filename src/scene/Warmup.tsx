import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import type { Material, Object3D, Texture } from 'three'
import { setLoadPhase, useLoader } from '../lib/loader'
import { useHome } from '../store'

// Gets every shader compiled and every texture onto the graphics card before you walk in, so turning round or
// entering a room never stalls — the job drei's <Preload all /> did, done gently: it compiled everything in one
// blocking call and then drew the whole house six times into a cube camera to upload textures, a long burst of
// GPU work that a phone's browser can answer by dropping the context. Here the shaders compile in parallel where
// the browser can (KHR_parallel_shader_compile, via compileAsync) and textures go up a few per frame.

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
// a pause for the page (the loading card redraws) without drawing the house: the frame loop is stopped meanwhile
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'lightMap', 'envMap'] as const

function texturesOf(root: Object3D): Texture[] {
  const found = new Set<Texture>()
  root.traverse((o) => {
    const m = (o as { material?: Material | Material[] }).material
    if (!m) return
    for (const mat of Array.isArray(m) ? m : [m]) {
      for (const slot of SLOTS) {
        const t = (mat as unknown as Record<string, Texture | null | undefined>)[slot]
        if (t && (t as { isTexture?: boolean }).isTexture) found.add(t)
      }
    }
  })
  return [...found]
}

export function Warmup() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const setFrameloop = useThree((s) => s.setFrameloop)
  const markReady = useHome((s) => s.markReady)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // one frame so everything is in place, then the frame loop stops until the warm-up is done: nothing is drawn
      // behind the loading card meanwhile (drawing the whole house between two steps costs far more than the
      // steps themselves — on a slow GPU, minutes)
      await frame()
      if (cancelled) return
      setFrameloop('never')
      try {
        // wait until the lighting and every model and texture the scene asked for have arrived (or 15 s)
        for (let waited = 0; waited < 15_000; waited += 50) {
          if (cancelled) return
          if (useHome.getState().ready.env && !useProgress.getState().active) break
          await new Promise((r) => setTimeout(r, 50))
        }
        if (cancelled) return
        setLoadPhase('compile')
        useLoader.setState({ compile: 0.05 })
        // hidden things (garden icons, bubbles, the held item…) are compiled too
        const hidden: Object3D[] = []
        scene.traverse((o) => {
          if (!o.visible) {
            hidden.push(o)
            o.visible = true
          }
        })
        try {
          // in parallel where the browser can; elsewhere compileAsync would only warn and do the same as compile
          if (gl.extensions.has('KHR_parallel_shader_compile')) await gl.compileAsync(scene, camera)
          else gl.compile(scene, camera)
        } catch (e) {
          console.warn('[warmup] could not precompile', e)
        } finally {
          for (const o of hidden) o.visible = false
        }
        if (cancelled) return
        useLoader.setState({ compile: 0.3 })
        const textures = texturesOf(scene)
        if (scene.environment) textures.push(scene.environment)
        // in slices of about 12 ms, so the loading card keeps moving
        let slice = performance.now()
        for (let i = 0; i < textures.length; i++) {
          if (cancelled || gl.getContext().isContextLost()) return
          try {
            gl.initTexture(textures[i])
          } catch {
            /* a texture still decoding uploads on first use instead */
          }
          if (performance.now() - slice > 12) {
            useLoader.setState({ compile: 0.3 + (0.7 * i) / textures.length })
            await breathe()
            slice = performance.now()
          }
        }
      } finally {
        if (!cancelled) setFrameloop('always')
      }
      if (cancelled) return
      useLoader.setState({ compile: 1 })
      markReady('warm')
      setLoadPhase('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [gl, scene, camera, setFrameloop, markReady])
  return null
}
