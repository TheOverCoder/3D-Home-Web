import { BoxGeometry, Frustum, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLCoordinateSystem, type WebGLRenderer } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { installViewPass } from './pass'
import { setWalls } from './walls'

// The drawing pass (pass.ts) leaves out only what cannot be seen. A thing drawn without the depth test (the aim marker
// on what the button would act on, the compass's arrow) is drawn over everything, walls included: neither the rooms'
// portals nor the walls may leave it out — only the view itself (three's own test). Here one render of a scene is
// begun as three begins it (the scene's onBeforeRender), and each thing is asked what three asks: whether it meets the
// camera's frustum.

const renderer = { getRenderTarget: () => null, getContext: () => ({ drawingBufferHeight: 360 }) } as unknown as WebGLRenderer

function camera(x: number, y: number, z: number, yaw: number) {
  const c = new PerspectiveCamera(72, 640 / 360, 0.05, 1500)
  c.position.set(x, y, z)
  c.rotation.order = 'YXZ'
  c.rotation.set(0, yaw, 0)
  c.updateMatrixWorld(true)
  c.updateProjectionMatrix()
  return c
}

/** A box of 0.3 m at (x, y, z), its material depth-tested or not (as the aim marker's). */
function box(scene: Scene, x: number, y: number, z: number, depthTest: boolean) {
  const m = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshBasicMaterial({ transparent: !depthTest, depthTest, depthWrite: depthTest }))
  m.position.set(x, y, z)
  scene.add(m)
  m.updateMatrixWorld(true)
  return m
}

let stops: (() => void)[] = []
afterEach(() => {
  for (const s of stops.splice(0)) s()
})

/** What the pass answers, in one render by `cam` (first person in the house, or not), for each thing. */
function drawn(scene: Scene, cam: PerspectiveCamera, firstPerson: boolean, things: Mesh[]) {
  stops.push(installViewPass({ scene, camera: cam, firstPerson: () => firstPerson, doorOpen: () => false, sun: () => null }))
  // the frustum three makes for the camera's pass (WebGLRenderer.render)
  const f = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), WebGLCoordinateSystem, cam.reversedDepth)
  // (three calls a scene's two hooks with the renderer, the scene, the camera and the render target: the pass reads the
  // first three)
  const none = null as never
  scene.onBeforeRender(renderer, scene, cam, none, none, none)
  const out = things.map((t) => t.intersectsFrustum(f))
  scene.onAfterRender(renderer, scene, cam, none, none, none)
  return out
}

describe('the drawing pass never leaves out a thing drawn over everything', () => {
  it('first person in the studio: in the kitchen behind the wall, the portals leave out a thing drawn with the depth test, never one drawn without', () => {
    const scene = new Scene()
    // in the studio, 1.5 m west of the wall it shares with the kitchen, looking east at it: the doorway between them is
    // at the left edge of the view, the kitchen seen only through it; straight ahead, behind the wall, the kitchen
    const cam = camera(-1.5, 1.62, -1.0, -Math.PI / 2)
    const tested = box(scene, 2.5, 1.0, -0.8, true)
    const over = box(scene, 2.5, 1.0, -0.8, false)
    const inView = box(scene, -0.6, 1.0, -0.8, true)
    expect(drawn(scene, cam, true, [tested, over, inView])).toEqual([false, true, true])
  })

  it('any other view: the walls leave out a thing drawn with the depth test wholly behind one, never one drawn without', () => {
    const scene = new Scene()
    // one wall along x at z = 0, 4 m long, 3 m high; the eye 3 m in front of it, looking at it
    stops.push(setWalls({ pieces: [{ axis: 'x', at: 0, a: -2, b: 2, y0: 0, y1: 3, box: [-2, 0, -0.08, 2, 3, 0.08] }], opaque: () => true, drawn: () => true }))
    const cam = camera(0, 1.5, 3, 0)
    const tested = box(scene, 0, 0.8, -1, true)
    const over = box(scene, 0, 0.8, -1, false)
    expect(drawn(scene, cam, false, [tested, over])).toEqual([false, true])
  })
})
