import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { FogExp2, MathUtils, Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three'
import { uiClick } from '../audio/sound'
import { HOUSE, ROOMS, roomAt, type RoomId } from '../data/layout'
import { FloorOutlines, outlinesWarmup, type FloorRect } from './FloorOutlines'
import { farm, useFarm } from '../farm/state'
import { focus } from '../lib/focus'
import { PieceLook } from '../scene/Furnishings'
import { useHome } from '../store'
import { PIECES } from './catalogue'
import { debugSet } from '../lib/debug'
import { buyPiece, movePieceTo, placeStored, putAway, turnPiece } from './actions'
import { type PieceType } from './catalogue'
import { decorateEye, decorateFocus, dragPiece, dropPiece, movable, startDecorating, stopDecorating, undo, useDecorate } from './decorate'
import { ROOM_WEIGHT, canPlacePiece, findFreeSpot, footprint, roomWeight, snapPiece, unreachable, type HomePiece } from './layout'

// The house's decorate mode, in the scene: the view over a room, and the hand that moves its furniture. The camera
// flies up from your eyes to look down on the room you are in (north at the top; the ceiling goes, and the walls on
// the near side fade); drag the floor to look round, pinch or scroll to come closer. Tap a piece to pick it, then
// drag it (with a mouse, press and drag any piece): its outline is green where it fits and red where it does not,
// and it only goes down where it is green. Leaving flies back down.

const TILT = 0.5 // the view leans this far from straight down (radians): furniture reads as solid, walls hide little
const T = Math.tan(TILT)
const MIN_H = 4.2
const MAX_H = 20

/** How far the camera has flown up (0 at your eyes … 1 over the room): the hand only works up there. */
export const decorateCamera = { blend: 0 }

interface View {
  x: number // the floor point in the middle of the view
  z: number
  h: number // how high above it
}

const fovFor = (aspect: number) => (aspect < 1 ? 64 : 50)
const eyeOf = (v: View, out: Vector3) => out.set(v.x, v.h, v.z + v.h * T)

/** The ray from a view through a point on the screen: its origin and direction. */
function rayOf(v: View, ndcX: number, ndcY: number, aspect: number) {
  const tan = Math.tan(MathUtils.degToRad(fovFor(aspect)) / 2)
  const L = Math.hypot(1, T)
  // forward and up of a camera looking north and down; right is east
  const dx = ndcX * tan * aspect
  const dy = -1 / L + (T / L) * ndcY * tan
  const dz = -T / L + (-1 / L) * ndcY * tan
  return { ox: v.x, oy: v.h, oz: v.z + v.h * T, dx, dy, dz }
}

/** Where a point on the screen lands on the floor, seen from a view. */
function floorAt(v: View, ndcX: number, ndcY: number, aspect: number): [number, number] {
  const r = rayOf(v, ndcX, ndcY, aspect)
  const t = r.dy < -1e-4 ? -r.oy / r.dy : 1e4
  return [r.ox + r.dx * t, r.oz + r.dz * t]
}

/** The piece under a point on the screen: the nearest standing piece the ray meets, else a rug under it. */
function pieceAt(v: View, ndcX: number, ndcY: number, aspect: number): string | null {
  const r = rayOf(v, ndcX, ndcY, aspect)
  let best: { id: string; t: number } | null = null
  let rug: { id: string; t: number } | null = null
  for (const p of farm.home.pieces) {
    const def = PIECES[p.type]
    const f = footprint(p)
    const lo = [f.minX, 0, f.minZ]
    const hi = [f.maxX, Math.max(0.05, def.size[1]), f.maxZ]
    const o = [r.ox, r.oy, r.oz]
    const d = [r.dx, r.dy, r.dz]
    let t0 = 0
    let t1 = Infinity
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) {
        if (o[k] < lo[k] || o[k] > hi[k]) t1 = -1
        continue
      }
      const a = (lo[k] - o[k]) / d[k]
      const b = (hi[k] - o[k]) / d[k]
      t0 = Math.max(t0, Math.min(a, b))
      t1 = Math.min(t1, Math.max(a, b))
    }
    if (t1 < t0) continue
    if (def.layer === 'rug') {
      if (!rug || t0 < rug.t) rug = { id: p.id, t: t0 }
    } else if (!best || t0 < best.t) best = { id: p.id, t: t0 }
  }
  return best?.id ?? rug?.id ?? null
}

/** Where a point of the room is on the screen, seen from a view (normalised: −1…1 across and up). */
function screenOf(v: View, x: number, y: number, z: number, aspect: number): [number, number] {
  const tan = Math.tan(MathUtils.degToRad(fovFor(aspect)) / 2)
  const L = Math.hypot(1, T)
  const dx = x - v.x
  const dy = y - v.h
  const dz = z - (v.z + v.h * T)
  const depth = dy * (-1 / L) + dz * (-T / L)
  const up = dy * (T / L) + dz * (-1 / L)
  return [dx / (Math.max(0.01, depth) * tan * aspect), up / (Math.max(0.01, depth) * tan)]
}

/** The part of the screen the room should fill: clear of the buttons at the top and of the card (along the bottom,
 *  or on the left of a phone held sideways). */
function freeArea(w: number, h: number) {
  const top = 1 - (2 * 72) / h
  if (w >= h && h <= 560) return { x0: -1 + (2 * (Math.min(360, w * 0.46) + 24)) / w, x1: 0.94, y0: -0.92, y1: top }
  const card = w < h ? Math.min(0.36 * h, 200) : 200
  return { x0: -0.92, x1: 0.92, y0: -1 + (2 * card) / h, y1: top }
}

/** A view that shows a whole room in the free part of the screen (a few steps of fitting its corners into it). */
function fitRoom(room: RoomId, w: number, h: number): View {
  const aspect = w / Math.max(1, h)
  const b = ROOMS[room].bounds
  const area = freeArea(w, h)
  const corners: [number, number, number][] = []
  for (const x of [b.minX, b.maxX]) for (const z of [b.minZ, b.maxZ]) for (const y of [0, 1]) corners.push([x, y, z])
  const v: View = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, h: 9 }
  for (let k = 0; k < 6; k++) {
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const [x, y, z] of corners) {
      const [sx, sy] = screenOf(v, x, y, z, aspect)
      x0 = Math.min(x0, sx)
      x1 = Math.max(x1, sx)
      y0 = Math.min(y0, sy)
      y1 = Math.max(y1, sy)
    }
    // higher or lower so the room's size matches the free part, then sideways so their middles meet
    v.h = MathUtils.clamp(v.h * Math.max((x1 - x0) / (area.x1 - area.x0), (y1 - y0) / (area.y1 - area.y0)), MIN_H, MAX_H)
    const want = floorAt(v, (area.x0 + area.x1) / 2, (area.y0 + area.y1) / 2, aspect)
    const have = floorAt(v, (x0 + x1) / 2, (y0 + y1) / 2, aspect)
    v.x += have[0] - want[0]
    v.z += have[1] - want[1]
  }
  return v
}

function clampView(v: View) {
  v.h = MathUtils.clamp(v.h, MIN_H, MAX_H)
  v.x = MathUtils.clamp(v.x, HOUSE.minX, HOUSE.maxX)
  v.z = MathUtils.clamp(v.z, HOUSE.minZ, HOUSE.maxZ + 2)
}

const UP = new Vector3(0, 1, 0)
const eye = new Vector3()
const look = new Vector3()
const m4 = new Matrix4()
const quat = new Quaternion()

/** The camera: flies up over the room while decorating, and back to your eyes after (it runs after the player's own
 *  camera, so it blends from wherever that put it). A room chosen at the top flies the view there. */
function DecorateCamera({ view, goal }: { view: React.RefObject<View>; goal: React.RefObject<View> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const blend = useRef({ x: 0, v: 0 })
  const saved = useRef<{ fov: number; near: number; fog: number } | null>(null)
  const decorating = useHome((s) => s.decorating)
  const room = useDecorate((s) => s.room)
  const first = useRef(true)

  // the room you are in when it opens (no flight across the house), then a flight to each room chosen
  useEffect(() => {
    if (!decorating) {
      first.current = true
      return
    }
    const v = fitRoom(room, size.width, size.height)
    goal.current = v
    if (first.current) view.current = { ...v }
    first.current = false
  }, [decorating, room, view, goal, size.width, size.height])

  useFrame((_, dt) => {
    const on = useHome.getState().decorating
    const b = blend.current
    // critically damped, exact for any frame time: about a second up or down however slow the frames are
    const omega = 5
    const step = Math.min(dt, 1)
    const x0 = b.x - (on ? 1 : 0)
    const e = Math.exp(-omega * step)
    const k0 = (b.v + omega * x0) * step
    b.x = (on ? 1 : 0) + (x0 + k0) * e
    b.v = (b.v - omega * k0) * e
    if (on && b.x > 0.995) b.x = 1
    decorateCamera.blend = b.x
    if (!on && b.x < 0.002) {
      b.x = b.v = 0
      decorateCamera.blend = 0
      if (saved.current) {
        camera.fov = saved.current.fov
        camera.near = saved.current.near
        camera.updateProjectionMatrix()
        if (scene.fog instanceof FogExp2) scene.fog.density = saved.current.fog
        saved.current = null
      }
      return
    }
    if (!saved.current) saved.current = { fov: camera.fov, near: camera.near, fog: scene.fog instanceof FogExp2 ? scene.fog.density : 0 }
    // towards the room chosen
    const v = view.current
    const g = goal.current
    const k1 = 1 - Math.exp(-4 * step)
    v.x += (g.x - v.x) * k1
    v.z += (g.z - v.z) * k1
    v.h += (g.h - v.h) * k1
    decorateFocus.x = v.x
    decorateFocus.z = v.z
    const k = MathUtils.smootherstep(MathUtils.clamp(b.x, 0, 1), 0, 1)
    eyeOf(v, eye)
    look.set(v.x, 0, v.z)
    m4.lookAt(eye, look, UP)
    quat.setFromRotationMatrix(m4)
    camera.position.lerp(eye, k)
    camera.quaternion.slerp(quat, k)
    const s = saved.current
    camera.fov = MathUtils.lerp(s.fov, fovFor(size.width / Math.max(1, size.height)), k)
    camera.near = k > 0.5 ? 0.2 : s.near
    camera.updateProjectionMatrix()
    // the haze that gives the rooms depth would grey the room from up here; the lens focuses on the floor
    if (scene.fog instanceof FogExp2) scene.fog.density = MathUtils.lerp(s.fog, Math.min(s.fog, 0.004), k)
    if (k > 0.5) focus.distance = Math.hypot(v.h, v.h * T)
    camera.updateMatrixWorld()
    decorateEye.x = camera.position.x
    decorateEye.y = camera.position.y
    decorateEye.z = camera.position.z
  })
  return null
}

interface Press {
  kind: 'piece' | 'floor'
  id: string | null // the piece under the finger (for a tap)
  start: [number, number]
  offset: [number, number] // piece middle − floor point pressed
  floor: [number, number] // the floor point pressed, seen from `from`
  from: View
  moved: boolean
}

/** Pointer and wheel: look round, zoom, pick and drag. On a touch screen a piece is picked with a tap and then
 *  dragged (a drag that starts anywhere else looks round, so a crowded room is never rearranged by accident); with a
 *  mouse, pressing on a piece and dragging moves it at once. */
function DecorateInput({ view, goal }: { view: React.RefObject<View>; goal: React.RefObject<View> }) {
  const dom = useThree((s) => s.gl.domElement)
  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number }>()
    let press: Press | null = null
    let pinch: { d: number; from: View; floor: [number, number] } | null = null
    const ndc = (x: number, y: number): [number, number] => {
      const r = dom.getBoundingClientRect()
      return [((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1)]
    }
    const aspect = () => dom.clientWidth / Math.max(1, dom.clientHeight)
    const floor = (x: number, y: number, v: View = view.current) => floorAt(v, ...ndc(x, y), aspect())
    const active = () => useHome.getState().decorating
    const setView = (v: View) => {
      clampView(v)
      view.current = v
      goal.current = { ...v }
    }

    const onDown = (e: PointerEvent) => {
      // not while the camera is still on its way: what is under the finger is not where it will be
      if (!active() || decorateCamera.blend < 0.98) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      dom.setPointerCapture?.(e.pointerId)
      if (pointers.size === 2) {
        // a second finger: pinch and look round; whatever the first was dragging goes back
        if (press?.kind === 'piece' && press.moved) useDecorate.getState().setDrag(null)
        press = null
        const [a, b] = [...pointers.values()]
        const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2]
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), from: { ...view.current }, floor: floor(mid[0], mid[1]) }
        return
      }
      if (pointers.size > 2) return
      const id = pieceAt(view.current, ...ndc(e.clientX, e.clientY), aspect())
      const touch = e.pointerType !== 'mouse'
      const grab = !!id && movable(id) && (!touch || id === useDecorate.getState().picked)
      const g = floor(e.clientX, e.clientY)
      const p = id ? farm.home.pieces.find((q) => q.id === id) : null
      press = {
        kind: grab ? 'piece' : 'floor',
        id,
        start: [e.clientX, e.clientY],
        offset: p ? [p.x - g[0], p.z - g[1]] : [0, 0],
        floor: g,
        from: { ...view.current },
        moved: false,
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!active() || !pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const v: View = { ...pinch.from, h: pinch.from.h * (pinch.d / Math.max(20, d)) }
        clampView(v)
        // keep the floor under the fingers' middle where it was
        const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2]
        const g = floor(mid[0], mid[1], v)
        v.x += pinch.floor[0] - g[0]
        v.z += pinch.floor[1] - g[1]
        setView(v)
        return
      }
      const pr = press
      if (!pr) return
      if (!pr.moved && Math.hypot(e.clientX - pr.start[0], e.clientY - pr.start[1]) < 7) return
      pr.moved = true
      if (pr.kind === 'piece' && pr.id) {
        const g = floor(e.clientX, e.clientY)
        if (useDecorate.getState().picked !== pr.id) useDecorate.getState().pick(pr.id)
        dragPiece(pr.id, g[0] + pr.offset[0], g[1] + pr.offset[1])
      } else {
        // look round: the floor pressed stays under the finger
        const g = floor(e.clientX, e.clientY, pr.from)
        setView({ ...pr.from, x: pr.from.x + pr.floor[0] - g[0], z: pr.from.z + pr.floor[1] - g[1] })
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return
      dom.releasePointerCapture?.(e.pointerId)
      if (pinch) {
        if (pointers.size < 2) pinch = null
        return
      }
      const pr = press
      press = null
      if (!pr || !active()) return
      const deco = useDecorate.getState()
      if (pr.kind === 'piece' && pr.moved) {
        dropPiece()
        uiClick()
        return
      }
      if (pr.moved) return
      // a tap: pick what is under it (the kitchen is built in), or nothing
      if (pr.id && !movable(pr.id)) {
        deco.pick(null)
        deco.setNote('Built in — it stays')
      } else deco.pick(pr.id)
      if (pr.id) {
        const p = farm.home.pieces.find((q) => q.id === pr.id)
        const r = p ? roomAt(p.x, p.z) : null
        if (r && r !== deco.room) useDecorate.setState({ room: r })
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (!active()) return
      e.preventDefault()
      const before = floor(e.clientX, e.clientY)
      const v = { ...view.current, h: view.current.h * Math.exp(e.deltaY * 0.0012) }
      clampView(v)
      const after = floor(e.clientX, e.clientY, v)
      v.x += before[0] - after[0]
      v.z += before[1] - after[1]
      setView(v)
    }

    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointercancel', onUp)
    dom.addEventListener('wheel', onWheel, { passive: false })
    // leaving in the middle of a drag: it goes back
    const unsub = useHome.subscribe((s, prev) => {
      if (!s.decorating && prev.decorating) {
        pointers.clear()
        press = null
        pinch = null
      }
    })
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerup', onUp)
      dom.removeEventListener('pointercancel', onUp)
      dom.removeEventListener('wheel', onWheel)
      unsub()
    }
  }, [dom, view, goal])
  return null
}

const COLOURS = { idle: '#ffffff', picked: '#ffb454', fits: '#5fd068', bad: '#ff5a4e' }

/** Each piece's outline on the floor: faint white for what can be moved, orange for the one picked, green or red for
 *  the one being dragged (where it is now). */
function Outlines() {
  const home = useFarm(() => farm.home)
  const picked = useDecorate((s) => s.picked)
  const drag = useDecorate((s) => s.drag)
  // all of them in two draws (FloorOutlines), as each drawn on its own would look
  const rects = useMemo<FloorRect[]>(
    () =>
      home.pieces
        .filter((p) => !PIECES[p.type].fitted)
        .map((p) => {
          const dragged = drag?.id === p.id ? drag : null
          const on = dragged || p.id === picked
          const color = dragged ? (dragged.fit.ok ? COLOURS.fits : COLOURS.bad) : on ? COLOURS.picked : COLOURS.idle
          return { key: p.id, r: footprint(dragged?.at ?? p), color, fill: on ? 0.22 : 0.05, edge: on ? 0.07 : 0.025, y: 0.03 }
        }),
    [home, picked, drag],
  )
  return <FloorOutlines rects={rects} />
}

/** The piece being dragged, drawn where it would go. */
function Dragged() {
  const drag = useDecorate((s) => s.drag)
  const piece = useFarm(() => (drag ? farm.home.pieces.find((p) => p.id === drag.id) : undefined))
  if (!drag || !piece) return null
  return (
    <group position={[drag.at.x, 0, drag.at.z]} rotation-y={(drag.at.rot * Math.PI) / 2}>
      <PieceLook p={piece} />
    </group>
  )
}

/** The decorate mode in the scene (mount it after <Player />: its camera runs after the player's). */
export function DecorateMode() {
  const view = useRef<View>({ x: -3.5, z: 3, h: 9 })
  const goal = useRef<View>({ x: -3.5, z: 3, h: 9 })
  const decorating = useHome((s) => s.decorating)
  // tests and the console: window.__home.home
  useEffect(() => {
    debugSet('home', {
      get layout() {
        return farm.home
      },
      pieces: PIECES,
      canPlace: (p: HomePiece) => canPlacePiece(farm.home, p),
      unreachable: () => unreachable(farm.home),
      roomWeight: (room: RoomId) => roomWeight(farm.home, room),
      roomLimit: ROOM_WEIGHT,
      snap: snapPiece,
      freeSpot: (type: PieceType, room: RoomId) => findFreeSpot(farm.home, type, room),
      move: movePieceTo,
      turn: turnPiece,
      putAway,
      placeStored,
      buy: buyPiece,
      decorate: { useDecorate, start: startDecorating, stop: stopDecorating, undo, camera: decorateCamera, view },
    })
  }, [])
  // the outlines once the camera is up (on the way they would swing across the screen)
  const [up, setUp] = useState(false)
  useFrame(() => {
    const now = decorating && decorateCamera.blend > 0.95
    if (now !== up) setUp(now)
  })
  return (
    <>
      <primitive object={outlinesWarmup} />
      <DecorateCamera view={view} goal={goal} />
      <DecorateInput view={view} goal={goal} />
      {decorating && <Dragged />}
      {decorating && up && (
        <group name="decorate-overlay">
          <Outlines />
        </group>
      )}
    </>
  )
}
