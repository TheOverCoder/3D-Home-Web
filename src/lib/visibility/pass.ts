// The drawing pass that leaves out what cannot be seen. It changes how a frame is drawn, never what is in it: a thing
// is left out of a render only where it cannot show — behind the walls of a room you are not in, or out of the view,
// or (for the sun) under the ceiling where no sunlight reaches it. Three parts, each for the render of the game's
// scene by the game's camera (the hooks `scene.onBeforeRender` / `onAfterRender`, where every matrix is final):
//
//   portals — first person, the house whole round you: the rooms and the outside are seen only through the doorways,
//             the windows and the garden door (portals.ts). Three asks every mesh, sprite, line and points object
//             whether it meets the camera's frustum; for this camera's pass the answer also asks the portals. The
//             house's shell (walls, floors, ceilings, doors: `userData.cell = 'always'`) is always drawn; what is
//             outside (`'outside'`) is seen through the outside's rectangle; everything else by where it stands now
//             (its bounds this render: a carried mug, a lamp on a piece, the piece itself).
//   crowds  — every `Parts` crowd (buyers, animals, plants) draws only the models in view and behind a portal seen,
//             each model tested once by its box; parts that cast a shadow stay whole.
//   sun     — the sun's shadow pass, first person: under the ceilings and inside the walls sunlight only comes in
//             through the windows, so a caster in the house is drawn into the map only where its footprint there
//             meets a window's (the map keeps exactly what it had: the shell is nearer the sun everywhere else). Your
//             own body, drawn always by the camera, is to the sun a thing in a room like any other.
//   walls   — the house's walls hide what lies wholly behind one of them (walls.ts): a wall fading is no wall. Every
//             view but first person in the house (there the rooms' portals already leave out what is behind a wall):
//             third person, decorating, the edit mode and first person outdoors; first person in the house they hide
//             only what is outdoors (the rooms are the portals'; the outside comes in through one rectangle round every
//             window seen, so what stands behind the wall between two windows, or inside a walk-in building's walls
//             across the lane, is the walls' to leave out).
//   keep    — the sun's map is drawn again only when something in it changed (Lighting.tsx's ShadowDirector, which
//             checks in the frame's render, every matrix final, before the shadow pass: setShadowCheck): a caster
//             that moved, but was left out of the map's last drawing and is left out now (out of the sun's view, or
//             under the ceilings where no window lets sunlight in), changes nothing in it, so the map is kept —
//             walking and turning indoors, the sun costs nothing (sunLeftOut).
//
// Off: third person, decorating and the farm's edit mode (the walls fade, the ceiling goes, the camera flies) — the
// rooms and the sun; the crowds' view test and the walls hold for any camera. `window.__home.view` (?debug) turns each part on and off
// and counts what it did; tests/e2e/16-view.spec.ts renders the same frame both ways and compares every pixel.

import {
  Frustum,
  Line,
  Matrix4,
  Mesh,
  Points,
  Sprite,
  WebGLCoordinateSystem,
  type Camera,
  type DirectionalLight,
  type InstancedMesh,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { HOUSE } from '../../data/layout'
import { liveParts, type Parts } from '../sculpt/parts'
import { CELLS, OUTER_PORTALS, OUTSIDE, Portals, portalBox, type Cell } from './portals'
import { updateWalls, wallHides } from './walls'

export interface ViewHooks {
  scene: Scene
  /** the game's camera: only its renders are culled (the item pictures and the gallery have cameras of their own) */
  camera: Camera
  /** first person with the house whole round the eye: no camera flight, every ceiling up and opaque */
  firstPerson: () => boolean
  /** whether the kitchen's door is anything but shut, as drawn this render */
  doorOpen: () => boolean
  /** the sun (the light whose shadow map is culled) */
  sun: () => DirectionalLight | null
}

const stats = {
  /** renders of the game's scene by its camera */
  renders: 0,
  /** this render: the portals were used / the sun's pass was culled */
  portals: false,
  sun: false,
  /** things three asked about in the camera's pass, and those the portals left out */
  tested: 0,
  culled: 0,
  /** crowd models tested, left out; part instances put, drawn */
  models: 0,
  modelsCulled: 0,
  /** this render: the wall pieces used, and the things and crowd models they hid (counted in culled and modelsCulled too) */
  walls: 0,
  wallCulled: 0,
  wallModels: 0,
  instances: 0,
  drawn: 0,
  /** the sun's last shadow pass: casters asked about, left out */
  casters: 0,
  castersCulled: 0,
  /** since the start: frames the sun's map was drawn again for a change (ShadowDirector), and frames it was kept
   *  although casters moved (only what the map leaves out: `keep`) */
  mapDrawn: 0,
  mapKept: 0,
  /** the pass's own time: the hook before the render (ms), last and most; with `timing`, the tests during it too */
  hookMs: 0,
  maxHookMs: 0,
  /** the hook's time summed over every render since the start (a frame may draw the scene more than once) */
  hookSum: 0,
  testMs: 0,
  maxTestMs: 0,
}

/** The pass's switches and counters (window.__home.view with ?debug). */
export const view = {
  /** the whole pass */
  on: true,
  portals: true,
  crowds: true,
  sun: true,
  /** the house's walls hide what is behind them */
  walls: true,
  /** the sun's map kept when all that changed is what it leaves out */
  keep: true,
  /** time every test three asks for (costs a little time itself) */
  timing: false,
  stats,
  /** the portal state of the last render (rectangles per cell) */
  portalState: null as Portals | null,
  reset() {
    stats.maxHookMs = 0
    stats.maxTestMs = 0
  },
}

const portals = new Portals()
view.portalState = portals

// ── what a thing is: the shell, the outside, or by where it stands ──

const NONE = 0
const ALWAYS = 1
const OUT = 2
function tagOf(o: Object3D): number {
  for (let p: Object3D | null = o; p; p = p.parent) {
    const c = p.userData.cell
    if (c === 'always') return ALWAYS
    if (c === 'outside') return OUT
  }
  return NONE
}
/** The same for the sun: what is drawn always by the camera but stands in a room (your own body, `sun: 'room'`) is
 *  judged by where it is, like anything else there. */
function sunTagOf(o: Object3D): number {
  for (let p: Object3D | null = o; p; p = p.parent) {
    const u = p.userData
    if (u.sun === 'room') return NONE
    if (u.cell === 'always') return ALWAYS
    if (u.cell === 'outside') return OUT
  }
  return NONE
}

// a thing's box in the world this render (from what three's own test uses, or the geometry's tighter box)
const B = new Float64Array(6)
const maxScale = (m: number[]) => Math.sqrt(Math.max(m[0] * m[0] + m[1] * m[1] + m[2] * m[2], m[4] * m[4] + m[5] * m[5] + m[6] * m[6], m[8] * m[8] + m[9] * m[9] + m[10] * m[10]))
function worldBox(o: Object3D): boolean {
  const m = o.matrixWorld.elements
  if ((o as Sprite).isSprite) {
    // as three bounds it: the quad's corners round its centre point
    const s = o as Sprite
    const r = (0.7071067811865476 + Math.hypot(s.center.x - 0.5, s.center.y - 0.5)) * maxScale(m)
    return sphereBox(m[12], m[13], m[14], r)
  }
  const mesh = o as Mesh
  const own = (mesh as InstancedMesh).boundingSphere
  const g = mesh.geometry
  if (own !== undefined || !g || (g as { isInstancedBufferGeometry?: boolean }).isInstancedBufferGeometry || !g.attributes.position) {
    // instanced, skinned and batched meshes, and instanced geometry (text): the sphere three tests
    let sphere = own
    if (own === null) {
      ;(mesh as InstancedMesh).computeBoundingSphere()
      sphere = (mesh as InstancedMesh).boundingSphere
    } else if (own === undefined) {
      if (!g) return false
      if (!g.boundingSphere) g.computeBoundingSphere()
      sphere = g.boundingSphere
    }
    if (!sphere) return false
    const c = sphere.center
    return sphereBox(m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12], m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13], m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14], sphere.radius * maxScale(m))
  }
  if (!g.boundingBox) g.computeBoundingBox()
  const b = g.boundingBox!
  if (!(b.min.x <= b.max.x && b.min.y <= b.max.y && b.min.z <= b.max.z)) return false
  const cx = (b.min.x + b.max.x) / 2
  const cy = (b.min.y + b.max.y) / 2
  const cz = (b.min.z + b.max.z) / 2
  const hx = (b.max.x - b.min.x) / 2
  const hy = (b.max.y - b.min.y) / 2
  const hz = (b.max.z - b.min.z) / 2
  const wx = m[0] * cx + m[4] * cy + m[8] * cz + m[12]
  const wy = m[1] * cx + m[5] * cy + m[9] * cz + m[13]
  const wz = m[2] * cx + m[6] * cy + m[10] * cz + m[14]
  const ex = Math.abs(m[0]) * hx + Math.abs(m[4]) * hy + Math.abs(m[8]) * hz
  const ey = Math.abs(m[1]) * hx + Math.abs(m[5]) * hy + Math.abs(m[9]) * hz
  const ez = Math.abs(m[2]) * hx + Math.abs(m[6]) * hy + Math.abs(m[10]) * hz
  B[0] = wx - ex
  B[1] = wy - ey
  B[2] = wz - ez
  B[3] = wx + ex
  B[4] = wy + ey
  B[5] = wz + ez
  return finite()
}
function sphereBox(x: number, y: number, z: number, r: number) {
  B[0] = x - r
  B[1] = y - r
  B[2] = z - r
  B[3] = x + r
  B[4] = y + r
  B[5] = z + r
  return finite()
}
// a box that is not a box of numbers is not judged (the thing is drawn)
const finite = () => B[0] <= B[3] && B[1] <= B[4] && B[2] <= B[5]

// ── the render under way ──

let hooks: ViewHooks | null = null
let inRender = false
let portalsOn = false
let wallsOn = false
/** first person in the house: the walls hide only what is outdoors */
let wallsOutdoorsOnly = false
let sunOn = false
let sunFrustum: Frustum | null = null
let sunLight: DirectionalLight | null = null
const frustum = new Frustum()
const projScreen = new Matrix4()
/** the renderer's frustum for this camera pass, once recognised by its planes */
let cameraFrustum: Frustum | null = null

function isCameraFrustum(f: Frustum): boolean {
  if (f === cameraFrustum) {
    // the same object, and still this camera's (nothing renders in between)
    const p = f.planes
    const q = frustum.planes
    return p[0].constant === q[0].constant && p[2].constant === q[2].constant && p[4].constant === q[4].constant && p[5].constant === q[5].constant
  }
  if (cameraFrustum !== null) return false
  const p = f.planes
  const q = frustum.planes
  for (let i = 0; i < 6; i++) {
    const a = p[i]
    const b = q[i]
    if (a.constant !== b.constant || a.normal.x !== b.normal.x || a.normal.y !== b.normal.y || a.normal.z !== b.normal.z) return false
  }
  cameraFrustum = f
  return true
}

/** What three's frustum test says, judged again by the pass in the passes it culls. */
function judge(o: Object3D, f: Frustum): boolean {
  // a crowd's part with none of its models drawn this render (Parts.cull): nothing to draw, in any pass
  if ((o as InstancedMesh).isInstancedMesh && (o as InstancedMesh).count === 0) return false
  if (!inRender) return true
  if (f === sunFrustum) return sunOn ? sunSees(o) : true
  if (!(portalsOn || wallsOn) || !isCameraFrustum(f)) return true
  const t0 = view.timing ? performance.now() : 0
  stats.tested++
  const seen = cameraSees(o)
  if (!seen) stats.culled++
  if (view.timing) stats.testMs += performance.now() - t0
  return seen
}

function cameraSees(o: Object3D): boolean {
  const tag = tagOf(o)
  if (tag === ALWAYS) return true
  const byPortals = portalsOn && !(tag === OUT && portals.isStart(OUTSIDE))
  // the walls: in the house, only for what is outdoors (what is in the rooms is the portals')
  const byWalls = wallsOn && (tag === OUT || !wallsOutdoorsOnly)
  if (!byPortals && !byWalls) return true
  if (!worldBox(o)) return true
  if (byPortals && !portals.seesBox(B[0], B[1], B[2], B[3], B[4], B[5], tag === OUT)) return false
  // only a mesh drawn with the depth test (one drawn over everything shows through a wall)
  if (!byWalls || !(o as Mesh).isMesh || !depthTested(o as Mesh)) return true
  if (!wallHides(B[0], B[1], B[2], B[3], B[4], B[5])) return true
  stats.wallCulled++
  return false
}

function depthTested(m: Mesh): boolean {
  const mat = m.material
  if (Array.isArray(mat)) {
    for (const x of mat) if (x.depthTest === false) return false
    return true
  }
  return !!mat && mat.depthTest !== false
}

// the frustum tests three calls: each answers as before, then the pass may still say no
for (const proto of [Mesh.prototype, Sprite.prototype, Line.prototype, Points.prototype] as unknown as { intersectsFrustum: (this: Object3D, f: Frustum) => boolean }[]) {
  const own = proto.intersectsFrustum
  proto.intersectsFrustum = function (this: Object3D, f: Frustum) {
    if (f !== sunFrustum || !inRender) return own.call(this, f) && judge(this, f)
    // the sun's shadow pass: what it leaves out (by three's test or the pass's) is noted, for sunLeftOut
    if (sunPassOf !== renders) {
      sunPassOf = renders
      sunPasses++
      stats.casters = stats.castersCulled = 0
    }
    const seen = own.call(this, f) && judge(this, f)
    if (!seen) leftOut.set(this, sunPasses)
    return seen
  }
}

// ── the sun ──

const H = HOUSE.wallHeight
const HALF = HOUSE.wallThickness / 2
const INNER = { minX: HOUSE.minX + HALF, maxX: HOUSE.maxX - HALF, minZ: HOUSE.minZ + HALF, maxZ: HOUSE.maxZ - HALF }
/** renders of the game's scene (any camera), the sun's shadow passes in them, and the render of the last pass */
let renders = 0
let sunPasses = 0
let sunPassOf = -1
/** the shadow pass each caster was last left out of */
const leftOut = new WeakMap<Object3D, number>()
/** the windows' rectangles in the sun's map (NDC), worked out once per shadow pass */
const windows = new Float64Array(OUTER_PORTALS.length * 4)
let windowsFor = -1
const PB = new Float64Array(6)
const LR = new Float64Array(4)

/** A world box (B) as a rectangle in the sun's shadow map: its box in the light's view, then the orthographic
 *  projection. */
function lightRect(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, out: Float64Array, at: number) {
  const cam = sunLight!.shadow.camera
  const V = cam.matrixWorldInverse.elements
  const P = cam.projectionMatrix.elements
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const hx = (maxX - minX) / 2
  const hy = (maxY - minY) / 2
  const hz = (maxZ - minZ) / 2
  const vx = V[0] * cx + V[4] * cy + V[8] * cz + V[12]
  const vy = V[1] * cx + V[5] * cy + V[9] * cz + V[13]
  const ex = Math.abs(V[0]) * hx + Math.abs(V[4]) * hy + Math.abs(V[8]) * hz
  const ey = Math.abs(V[1]) * hx + Math.abs(V[5]) * hy + Math.abs(V[9]) * hz
  const a = P[0] * (vx - ex) + P[12]
  const b = P[0] * (vx + ex) + P[12]
  const c = P[5] * (vy - ey) + P[13]
  const d = P[5] * (vy + ey) + P[13]
  out[at] = Math.min(a, b)
  out[at + 1] = Math.max(a, b)
  out[at + 2] = Math.min(c, d)
  out[at + 3] = Math.max(c, d)
}

function sunSees(o: Object3D): boolean {
  stats.casters++
  if (!sunCulls(o)) return true
  stats.castersCulled++
  return false
}

/** Whether the sun's pass leaves a caster out: it stands wholly in the house, under the ceilings, and its footprint in
 *  the sun's map meets no window's. */
function sunCulls(o: Object3D): boolean {
  if (windowsFor !== sunPasses) {
    // once per shadow pass (the sun's camera is placed by now: at its first caster, or after it)
    windowsFor = sunPasses
    // a texel of margin each way
    const t = 2 / Math.max(1, sunLight!.shadow.mapSize.x)
    for (let i = 0; i < OUTER_PORTALS.length; i++) {
      portalBox(OUTER_PORTALS[i], PB)
      lightRect(PB[0], PB[1], PB[2], PB[3], PB[4], PB[5], windows, i * 4)
      windows[i * 4] -= t
      windows[i * 4 + 1] += t
      windows[i * 4 + 2] -= t
      windows[i * 4 + 3] += t
    }
  }
  if (sunTagOf(o) !== NONE) return false
  if (!worldBox(o)) return false
  // only what lies wholly within the outer walls' inner faces and under the ceilings: there every line from the sun
  // passes through a wall, a ceiling slab or a window (inside a wall's thickness the wall's own far face is not)
  if (B[0] < INNER.minX || B[3] > INNER.maxX || B[2] < INNER.minZ || B[5] > INNER.maxZ || B[4] > H) return false
  lightRect(B[0], B[1], B[2], B[3], B[4], B[5], LR, 0)
  if (!(LR[0] <= LR[1] && LR[2] <= LR[3])) return false
  for (let i = 0; i < OUTER_PORTALS.length; i++) {
    const w = i * 4
    if (LR[0] <= windows[w + 1] && LR[1] >= windows[w] && LR[2] <= windows[w + 3] && LR[3] >= windows[w + 2]) return false
  }
  return true
}

/**
 * For the shadow director, during its check (setShadowCheck), about a caster that moved, appeared, vanished or stopped
 * casting: whether the sun's map stays as it is all the same — the sun's pass left it out of the map's last drawing,
 * and leaves it out now (out of the sun's view, or, with `culling` (this render's), in the house where no window lets
 * sunlight in).
 */
export function sunLeftOut(o: Object3D, culling: boolean): boolean {
  if (!view.on || !view.keep || sunFrustum === null || sunLight === null || leftOut.get(o) !== sunPasses || !(o as Mesh).isMesh) return false
  if ((o as InstancedMesh).isInstancedMesh && (o as InstancedMesh).count === 0) return true
  if (!sunFrustum.intersectsObject(o)) return true
  return culling && sunCulls(o)
}

/** The shadow director's check (Lighting.tsx): called in every render of the game's scene by its camera, once the pass
 *  is set up for it — every matrix final, before the shadow pass — with whether the sun's pass leaves out what no
 *  sunlight reaches in this render. It asks for the map to be drawn, or keeps it (once a frame, in its own render). */
let shadowCheck: ((renderer: WebGLRenderer, culling: boolean) => void) | null = null
export function setShadowCheck(check: (renderer: WebGLRenderer, culling: boolean) => void) {
  shadowCheck = check
  return () => {
    if (shadowCheck === check) shadowCheck = null
  }
}

// ── crowds ──

let crowdTag = NONE
let crowdScene: Scene | null = null
let crowdsOn = false
const planes = frustum.planes

/** One crowd model, by its world box: in the camera's frustum, and (first person) behind a portal seen. */
const modelSeen = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => {
  for (let i = 0; i < 6; i++) {
    const n = planes[i].normal
    // the box's corner farthest along the plane's normal
    if (n.x * (n.x > 0 ? maxX : minX) + n.y * (n.y > 0 ? maxY : minY) + n.z * (n.z > 0 ? maxZ : minZ) + planes[i].constant < 0) return false
  }
  if (crowdTag === ALWAYS) return true
  if (portalsOn && !portals.seesBox(minX, minY, minZ, maxX, maxY, maxZ, crowdTag === OUT)) return false
  if (!wallsOn || (wallsOutdoorsOnly && crowdTag !== OUT) || !wallHides(minX, minY, minZ, maxX, maxY, maxZ)) return true
  stats.wallModels++
  return false
}

function inScene(o: Object3D, scene: Scene) {
  let root = o
  while (root.parent) root = root.parent
  return root === scene
}

const cullCrowd = (p: Parts) => {
  if (!inScene(p.group, crowdScene!)) return
  if (!crowdsOn) {
    p.cull(null)
    return
  }
  crowdTag = tagOf(p.group)
  p.cull(modelSeen)
  stats.models += p.models
  stats.modelsCulled += p.culledModels
  stats.instances += p.instances()
  stats.drawn += p.drawnInstances
}

function beforeRender(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  const h = hooks
  if (!h || scene !== h.scene) return
  const t0 = performance.now()
  inRender = true
  renders++
  cameraFrustum = null
  const ours = camera === h.camera && (camera as PerspectiveCamera).isPerspectiveCamera === true
  crowdsOn = view.on && view.crowds && ours
  const firstPerson = view.on && ours && h.firstPerson()
  portalsOn = firstPerson && view.portals
  sunLight = h.sun()
  sunOn = firstPerson && view.sun && sunLight !== null
  sunFrustum = sunLight ? sunLight.shadow.getFrustum() : null
  if (ours) {
    stats.renders++
    stats.tested = stats.culled = stats.models = stats.modelsCulled = stats.instances = stats.drawn = 0
    stats.wallCulled = stats.wallModels = 0
    stats.testMs = 0
    stats.portals = portalsOn
    stats.sun = sunOn
    // the sun's counters are its last culled pass's; nothing is left out of it while it is whole
    if (!sunOn) stats.casters = stats.castersCulled = 0
    const cam = camera as PerspectiveCamera
    projScreen.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    frustum.setFromProjectionMatrix(projScreen, WebGLCoordinateSystem, cam.reversedDepth)
    const e = cam.matrixWorld.elements
    eye.x = e[12]
    eye.y = e[13]
    eye.z = e[14]
    if (portalsOn) portals.update(cam.matrixWorldInverse.elements, cam.projectionMatrix.elements, cam.near, eye, h.doorOpen())
    // the walls, in every view; first person in the house only for what is outdoors (the portals already leave out the
    // rooms not seen, but let the outside in through one rectangle round every window seen: what stands behind the wall
    // between two windows, or inside a walk-in building across the lane, is left to the walls)
    wallsOutdoorsOnly = portalsOn && !portals.isStart(OUTSIDE)
    stats.walls = view.on && view.walls ? updateWalls(eye.x, eye.y, eye.z, cam.near, cam.far) : 0
    wallsOn = stats.walls > 0
  } else wallsOn = false
  crowdScene = scene
  liveParts.forEach(cullCrowd)
  if (ours) {
    const ms = performance.now() - t0
    stats.hookMs = ms
    stats.hookSum += ms
    if (ms > stats.maxHookMs) stats.maxHookMs = ms
    // the sun's map: drawn again in this render if something in it changed
    shadowCheck?.(renderer, sunOn)
  }
}
const eye = { x: 0, y: 0, z: 0 }

function afterRender(scene: Scene) {
  if (!hooks || scene !== hooks.scene) return
  inRender = false
  cameraFrustum = null
  if (stats.testMs > stats.maxTestMs) stats.maxTestMs = stats.testMs
}

/** The cells as names, for the counters. */
export function cellNames(bits: (c: number) => boolean): Cell[] {
  const out: Cell[] = []
  for (let c = 0; c < CELLS.length; c++) if (bits(c)) out.push(CELLS[c])
  return out
}

/** The cells the eye was in and the cells seen, in the last render that used the portals. */
export function portalCells() {
  return { start: cellNames((c) => portals.isStart(c)), seen: cellNames((c) => portals.seen(c)), rects: Array.from(portals.rects) }
}

/** Starts the pass on the game's scene; the returned function stops it (every crowd drawn whole again). */
export function installViewPass(h: ViewHooks): () => void {
  hooks = h
  const scene = h.scene
  // three calls these on a scene with (renderer, scene, camera, render target)
  type Hook = (this: Scene, ...args: unknown[]) => void
  const hooked = scene as unknown as { onBeforeRender: Hook; onAfterRender: Hook }
  const before = hooked.onBeforeRender
  const after = hooked.onAfterRender
  hooked.onBeforeRender = function (this: Scene, ...args: unknown[]) {
    before.apply(this, args)
    beforeRender(args[0] as WebGLRenderer, args[1] as Scene, args[2] as Camera)
  }
  hooked.onAfterRender = function (this: Scene, ...args: unknown[]) {
    after.apply(this, args)
    afterRender(args[1] as Scene)
  }
  return () => {
    hooked.onBeforeRender = before
    hooked.onAfterRender = after
    liveParts.forEach((p) => p.cull(null))
    if (hooks === h) hooks = null
    inRender = portalsOn = wallsOn = sunOn = crowdsOn = false
  }
}
