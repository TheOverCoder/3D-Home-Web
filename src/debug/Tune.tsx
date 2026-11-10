import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import GUI, { type Controller } from 'lil-gui'
import type { Color, DirectionalLight, FogExp2, HemisphereLight, Object3D } from 'three'
import { COW, CROPS, EGG, LEMON_TREE, LOOM, MILL, PRODUCE, QUEUE, RECIPES, SHEEP, VISITOR } from '../farm/data'
import { tick } from '../farm/state'
import { profile } from '../lib/profile'
import { LOOK, useLook } from '../scene/Effects'
import { useHome, type Quality } from '../store'

// A live tuning panel for developers (open the game with ?tune; Experience.tsx loads it in a chunk of its own, which
// players never download). Sliders sit straight on the plain objects the game reads as it runs: the farm's timers and
// prices (src/farm/data.ts), the film look (LOOK in src/scene/Effects.tsx), the sun, sky light and haze as they are in
// the scene, and this device's profile (src/lib/profile.ts). One line shows frames per second and what the view draws,
// counted as tests/e2e/05-budget counts it; *Copy changes* puts what was changed on the clipboard as JSON (and in the
// console), to write back into the code. Nothing is kept: a reload starts from the code again.

const TIERS: Quality[] = ['high', 'medium', 'low']

/** Makes the effects again with LOOK and the profile as they are now. */
const retouch = () => useLook.setState((s) => ({ rev: s.rev + 1 }))

/** The profile is read when a tier is set: switch to another tier and back, so the scene reads it again. */
function reapplyTier() {
  const { quality } = useHome.getState()
  useHome.setState({ quality: quality === 'low' ? 'medium' : 'low' })
  requestAnimationFrame(() => useHome.setState({ quality }))
  retouch()
}

function find<T extends Object3D>(root: Object3D, test: (o: Object3D) => boolean): T | null {
  const all: Object3D[] = []
  root.traverse((o) => {
    if (test(o)) all.push(o)
  })
  return (all[0] as T | undefined) ?? null
}

export default function Tune() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const budget = useRef({ line: '…' })
  const frames = useRef({ n: 0, since: performance.now() })

  useEffect(() => {
    const gui = new GUI({ title: 'Tune', width: 250, closeFolders: true })
    // at the left and closed: clear of the compass and the corner buttons, even on a narrow phone
    Object.assign(gui.domElement.style, { left: '0', right: 'auto' })
    gui.close()
    // where each value lives in the code, for the JSON of what changed (colours: their starting hex)
    const paths = new Map<Controller, string>()
    const colours = new Map<Controller, string>()
    const bind = <T extends object>(folder: GUI, obj: T, key: keyof T & string, path: string, min?: number, max?: number, step?: number) => {
      const c = folder.add(obj, key, min, max, step)
      paths.set(c, `${path}.${key}`)
      return c
    }

    gui.add(budget.current, 'line').name('fps · draws · tris').listen().disable()

    // ── the farm: read on every tick, so a change shows at once
    const farmF = gui.addFolder('Farm')
    farmF.add({ forward: () => tick(60) }, 'forward').name('Fast-forward 1 min')
    for (const c of CROPS) {
      const f = farmF.addFolder(c.plural)
      bind(f, c, 'growSeconds', `CROPS.${c.id}`, 5, 600, 1)
      bind(f, c, 'yield', `CROPS.${c.id}`, 1, 20, 1)
      bind(f, c, 'seedCost', `CROPS.${c.id}`, 0, 50, 1)
    }
    const prices = farmF.addFolder('Prices (a fair price each)')
    for (const p of PRODUCE) bind(prices, p, 'price', `PRODUCE.${p.id}`, 1, 100, 1).name(p.plural)
    const oven = farmF.addFolder('Oven (seconds)')
    for (const r of RECIPES) bind(oven, r, 'seconds', `RECIPES.${r.id}`, 5, 300, 1).name(r.name)
    const animals = farmF.addFolder('Animals and the lemon tree')
    for (const [name, def] of [
      ['COW', COW],
      ['SHEEP', SHEEP],
      ['EGG', EGG],
      ['LEMON_TREE', LEMON_TREE],
    ] as const) {
      bind(animals, def, 'every', name, 5, 300, 1).name(`${name} every (s)`)
      bind(animals, def, 'max', name, 1, 12, 1).name(`${name} max`)
    }
    const machines = farmF.addFolder('Mill and loom')
    bind(machines, MILL, 'perItem', 'MILL', 1, 30, 1).name('mill s per item')
    bind(machines, MILL, 'capacity', 'MILL', 1, 20, 1).name('mill capacity')
    bind(machines, LOOM, 'perItem', 'LOOM', 1, 30, 1).name('loom s per item')
    bind(machines, LOOM, 'capacity', 'LOOM', 1, 20, 1).name('loom capacity')
    const buyers = farmF.addFolder('Buyers')
    bind(buyers, QUEUE, 'every', 'QUEUE', 10, 600, 1).name('a new one every (s)')
    bind(buyers, QUEUE, 'step', 'QUEUE', 1, 60, 1).name('sooner per step (s)')
    bind(buyers, QUEUE, 'fastest', 'QUEUE', 5, 120, 1).name('fastest (s)')
    bind(buyers, VISITOR, 'speed', 'VISITOR', 0.3, 4, 0.05).name('walking speed')
    bind(buyers, VISITOR, 'firstAfter', 'VISITOR', 0, 120, 1).name('first after (s)')

    // ── the look: the effects' numbers (made again on a change) and the lights as they are in the scene
    const look = gui.addFolder('Look')
    const fx = look.addFolder('Effects')
    for (const t of TIERS) bind(fx, LOOK.bloom, t, 'LOOK.bloom', 0, 3, 0.01).name(`bloom (${t})`).onChange(retouch)
    bind(fx, LOOK.bloom, 'threshold', 'LOOK.bloom', 0, 3, 0.01).name('bloom threshold').onChange(retouch)
    bind(fx, LOOK.bloom, 'smoothing', 'LOOK.bloom', 0, 1, 0.01).name('bloom smoothing').onChange(retouch)
    bind(fx, LOOK.ao, 'radius', 'LOOK.ao', 0.05, 3, 0.05).name('AO radius').onChange(retouch)
    bind(fx, LOOK.ao, 'intensity', 'LOOK.ao', 0, 5, 0.05).name('AO intensity').onChange(retouch)
    bind(fx, LOOK.ao, 'falloff', 'LOOK.ao', 0.1, 5, 0.05).name('AO falloff').onChange(retouch)
    bind(fx, LOOK.grade, 'brightness', 'LOOK.grade', -0.3, 0.3, 0.005).onChange(retouch)
    bind(fx, LOOK.grade, 'contrast', 'LOOK.grade', -0.5, 0.5, 0.01).onChange(retouch)
    bind(fx, LOOK.grade, 'saturation', 'LOOK.grade', -1, 1, 0.01).onChange(retouch)
    bind(fx, LOOK.vignette, 'offset', 'LOOK.vignette', 0, 1, 0.01).name('vignette offset').onChange(retouch)
    bind(fx, LOOK.vignette, 'darkness', 'LOOK.vignette', 0, 1.5, 0.01).name('vignette darkness').onChange(retouch)
    bind(fx, LOOK, 'grain', 'LOOK', 0, 0.5, 0.01).name('film grain').onChange(retouch)
    const lights = look.addFolder('Lights (src/scene/Lighting.tsx)')
    const sun = find<DirectionalLight>(scene, (o) => (o as DirectionalLight).isDirectionalLight && o.castShadow)
    if (sun) {
      bind(lights, sun, 'intensity', 'sun', 0, 8, 0.05).name('sun')
      const c = lights.addColor(sun, 'color').name('sun colour')
      paths.set(c, 'sun.color')
      colours.set(c, `#${sun.color.getHexString()}`)
    }
    const sky = find<HemisphereLight>(scene, (o) => (o as HemisphereLight).isHemisphereLight)
    if (sky) bind(lights, sky, 'intensity', 'hemisphere', 0, 2, 0.01).name('sky fill')
    bind(lights, scene, 'environmentIntensity', 'environment', 0, 3, 0.01).name('sky light (IBL)')
    const fog = scene.fog as FogExp2 | null
    if (fog?.isFogExp2) bind(lights, fog, 'density', 'fog', 0, 0.08, 0.0005).name('haze')

    // ── this device's profile (src/lib/profile.ts), per tier: the scene reads it again on a change (a moment's stutter)
    const device = gui.addFolder(`Device: ${profile.device}${profile.light ? ', light graphics' : ''}`)
    device
      .add({ tier: useHome.getState().quality }, 'tier', ['low', 'medium', 'high'])
      .name('tier (pins it)')
      .onChange((q: Quality) => useHome.getState().setQuality(q))
    for (const t of TIERS) {
      const f = device.addFolder(t)
      bind(f, profile.dpr, t, 'profile.dpr', 0.5, 2, 0.05).name('pixel ratio').onFinishChange(reapplyTier)
      bind(f, profile.msaa, t, 'profile.msaa', 0, 8, 1).name('MSAA').onFinishChange(reapplyTier)
      bind(f, profile.ao, t, 'profile.ao').options({ off: false, performance: 'performance', medium: 'medium' }).name('AO').onFinishChange(reapplyTier)
      bind(f, profile.shadowMap, t, 'profile.shadowMap', 256, 4096, 256).name('shadow map').onFinishChange(reapplyTier)
      bind(f, profile.bloomLevels, t, 'profile.bloomLevels', 1, 9, 1).name('bloom levels').onFinishChange(reapplyTier)
    }
    bind(device, profile, 'lensEffects', 'profile').name('lens effects (high)').onChange(reapplyTier)

    // ── what changed, as JSON (the clipboard needs https or localhost: it goes to the console as well)
    const copy = () => {
      const changed: Record<string, unknown> = {}
      for (const [c, path] of paths) {
        const start = colours.get(c)
        if (start !== undefined) {
          const hex = `#${(c.getValue() as Color).getHexString()}`
          if (hex !== start) changed[path] = hex
        } else if (c.getValue() !== c.initialValue) changed[path] = c.getValue()
      }
      const json = JSON.stringify(changed, null, 1)
      console.log('[tune] what changed:', json)
      navigator.clipboard?.writeText(json).catch(() => {})
    }
    gui.add({ copy }, 'copy').name('Copy changes (JSON)')

    return () => gui.destroy()
  }, [scene])

  // frames per second, and once a second the scene drawn on its own as 05-budget counts it (no post-processing, no
  // shadow maps), before the effects draw the frame: nothing of it shows
  useFrame(() => {
    const f = frames.current
    f.n++
    const now = performance.now()
    if (now - f.since < 1000) return
    const fps = (f.n * 1000) / (now - f.since)
    f.n = 0
    f.since = now
    const prevAuto = gl.info.autoReset
    const prevShadow = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    gl.info.autoReset = false
    gl.info.reset()
    gl.render(scene, camera)
    const { calls, triangles } = gl.info.render
    gl.info.autoReset = prevAuto
    gl.shadowMap.autoUpdate = prevShadow
    budget.current.line = `${fps.toFixed(0)} · ${calls} · ${(triangles / 1000).toFixed(0)}k`
  }, -1)

  return null
}
