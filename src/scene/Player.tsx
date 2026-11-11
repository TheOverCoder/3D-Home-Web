import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlAnimationStateController } from 'ecctrl/animation'
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from 'ecctrl/camera'
import { useButtonStore, useJoystickStore } from 'ecctrl/input'
import { CameraControlsImpl } from '@react-three/drei'
import { MathUtils, Matrix4, Quaternion, Vector3, type Group, type PerspectiveCamera } from 'three'
import { footstep, jumpSound, land } from '../audio/sound'
import { GARDEN_DOOR, HOUSE, ROOMS, SPAWN, groundAt, insideHouse, roomAt, type FloorKind } from '../data/layout'
import { WALK_INS, bounds, walkInRoomAt, type Box, type Rect, type WalkIn } from '../data/buildings'
import { screenById, type ScreenDef } from '../data/screens'
import { debugSet } from '../lib/debug'
import { openEdit, stopDecorating, useDecorate } from '../home/decorate'
import { coarsePointer } from '../lib/device'
import { focus } from '../lib/focus'
import { playGesture } from '../lib/gestures'
import { findActions, findFar, findStatus, findTag, interactable, triggerInteraction, type ActionIcon, type ViewRay } from '../lib/interaction'
import { addLook, look, look as lookState, stepTurn, stopTurn } from '../lib/look'
import { resume } from '../lib/startup'
import { RUN_AT, followTurn, orbit, useStick } from '../lib/stick'
import { Walker } from '../lib/route/walker'
import { stepWalkView, stopWalk, useWalk, walkStats, walkStick, walkTo, walkingTo } from '../lib/route/walking'
import { BODY, playerState } from '../lib/playerState'
import { useSettings } from '../settings'
import { busy, useHome, type CompassMark, type Nearby } from '../store'
import { reachBounds } from '../farm/layout'
import { farm } from '../farm/state'
import { AimMarker } from './AimMarker'
import { GuideMarker } from './GuideMarker'
import { gardenDoor } from './GardenDoor'
import { Avatar, HeldItem } from './Avatar'

const CAPSULE_HALF = BODY.half
const CAPSULE_RADIUS = BODY.radius
const FLOAT = BODY.float
// body-centre → feet: the capsule hovers FLOAT above the floor
const FEET = CAPSULE_HALF + CAPSULE_RADIUS + FLOAT
const EYE_HEIGHT = 1.62 // above the feet
const BODY_BACK = 0.14 // how far the body sits behind the eyes in first person
// the eyes sit above and in front of the neck pivot, so tipping the head forward moves them forward and down
const NECK_UP = 0.12
const NECK_FRONT = 0.09
// The capsule's float height is held per physics step (see <Player />), critically damped: stiff enough to
// stand firmly, soft enough that stepping onto a rug or landing never kicks the body up.
const FLOAT_OMEGA = 22 // rad/s
const FLOAT_FORGIVE = 0.22 // within this much above the float height the spring still holds you to the floor
// ecctrl closes this fraction of the gap to the target speed per frame at 60 fps (× its ground grip, ≈ 0.5);
// rescaled for the measured frame rate so speeding up and slowing down take the same time on every machine
const ACC_60 = 0.18
const DEC_60 = 0.26
const GRIP = 0.5
const perFrame = (base: number, fps: number) => Math.min(1, (1 - Math.pow(1 - base * GRIP, 60 / fps)) / GRIP)
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Walking rhythm shared by the footsteps and the head bob: one step per π of phase; the foot strikes at the bottom of the bob. */
const gait = { phase: 0, step: 0 }
/** Set by the player when it lands; the camera turns it into a short dip of the head. */
const landing = { kick: 0 }

/** What a walk-in building's floor sounds like underfoot. */
const WALK_IN_FLOOR: Record<WalkIn['floor'], FloorKind> = { tile: 'tile', boards: 'wood' }

const floorAt = (x: number, z: number): FloorKind => {
  const room = roomAt(x, z)
  if (room) return ROOMS[room].floor
  const inside = walkInRoomAt(x, z)
  return inside ? WALK_IN_FLOOR[inside.walkIn.floor] : groundAt(x, z)
}

/** The touch stick as the player reads it: walking to a compass mark by itself is the stick pushed where the way goes
 *  (src/lib/route); walking on by itself (the button beside the stick) is the stick pushed straight ahead, at a walk. */
function stickInput() {
  if (walkStick.on) return { x: walkStick.x, y: walkStick.y, run: walkStick.run }
  if (useStick.getState().cruise) return { x: 0, y: 1, run: false }
  const joy = useJoystickStore.getState().joysticks.default
  const x = joy?.x ?? 0
  const y = joy?.y ?? 0
  return { x, y, run: Math.hypot(x, y) > RUN_AT }
}

const CLEAR = HOUSE.wallThickness / 2 + 0.1 // eyes stay this far from a wall's centre line
const DOOR_HALF = GARDEN_DOOR.width / 2 - 0.1 // the garden door's opening, less the jambs

// the prompt draws an action's numbers (how many, coins, how long), not only its label: a change in one is a change
const iconKey = (i: ActionIcon | undefined) => (i ? `${i.verb}|${i.item}|${i.art}|${i.count}|${i.of}|${i.coins}|${i.seconds}|${i.also?.map((g) => `${g.item}${g.count}`).join(',')}` : '')
const actionsKey = (list: Nearby[]) => list.map((a) => `${a.id}|${a.label}|${iconKey(a.icon)}|${a.reach}|${a.side}|${a.hint}|${a.needs?.map((n) => `${n.item}${n.count}`).join(',')}`).join('\n')
const marksKey = (list: CompassMark[]) => list.map((m) => `${m.id}|${m.item}|${m.count}|${m.alert ? 1 : 0}`).join('\n')

// A walk-in building (src/data/buildings.ts): the eyes keep this far from its walls' faces, and a doorway's opening
// reaches this far either side of its wall (stepping through, the eyes go a little ahead of the body)
const WALL_CLEAR = 0.1
const PASS = 0.35

const WALK_IN_BOUNDS = WALK_INS.map((w) => ({ w, b: bounds(w) }))

const inRect = (r: Rect, x: number, z: number, margin = 0) => x >= r.x0 - margin && x <= r.x1 + margin && z >= r.z0 - margin && z <= r.z1 + margin

/** The doorway of a walk-in whose opening the point is in (less its jambs, and reaching PASS either side of its wall),
 *  with how high the eyes may be there (under its lintel); or null. */
function doorwayAt(w: WalkIn, x: number, z: number): { top: number } | null {
  for (const d of w.doors) {
    // the opening runs along the wall: the door's longer side
    const alongX = d.x1 - d.x0 >= d.z1 - d.z0
    const inside = alongX ? x > d.x0 + WALL_CLEAR && x < d.x1 - WALL_CLEAR && z > d.z0 - PASS && z < d.z1 + PASS : z > d.z0 + WALL_CLEAR && z < d.z1 - WALL_CLEAR && x > d.x0 - PASS && x < d.x1 + PASS
    if (!inside) continue
    // the lintel over it: the lowest wall above the opening
    let top = Infinity
    for (const b of w.walls) if (b.y0 > 0.5 && b.x0 < d.x1 && b.x1 > d.x0 && b.z0 < d.z1 && b.z1 > d.z0) top = Math.min(top, b.y0)
    return { top: Number.isFinite(top) ? top : Math.min(...w.rooms.map((r) => r.top)) }
  }
  return null
}

/**
 * Never let the eyes enter a wall or rise through the ceiling — inside, outside, and in between: the only way
 * through the outer walls is the garden door's opening while it is open. `body` is where the body is drawn this
 * frame (not last frame's position: right after a teleport out of the house that would hold the eyes indoors).
 * A walk-in building is the same: with your body in one of its rooms (or a doorway's thickness) the eyes stay in that
 * room, or in a doorway out of it; outside, they keep out of its walls but for its doorways.
 */
function keepCameraInBounds(p: Vector3, body: Vector3) {
  const walkIn = walkInRoomAt(body.x, body.z)
  if (walkIn) {
    const door = doorwayAt(walkIn.walkIn, p.x, p.z)
    if (door) {
      // stepping through a doorway: keep under its lintel
      p.y = Math.min(p.y, door.top - 0.12)
      return
    }
    const r = walkIn.room
    p.y = Math.min(p.y, r.top)
    p.x = MathUtils.clamp(p.x, r.x0 + WALL_CLEAR, r.x1 - WALL_CLEAR)
    p.z = MathUtils.clamp(p.z, r.z0 + WALL_CLEAR, r.z1 - WALL_CLEAR)
    return
  }
  const inOpening = gardenDoor.open > 0.55 && Math.abs(p.x - GARDEN_DOOR.centre) < DOOR_HALF
  if (inOpening && Math.abs(p.z - GARDEN_DOOR.at) < CLEAR) {
    // stepping through the door: keep to the opening
    p.y = Math.min(p.y, GARDEN_DOOR.top - 0.12)
    return
  }
  if (insideHouse(body.x, body.z)) {
    p.y = Math.min(p.y, HOUSE.wallHeight - 0.12)
    p.x = MathUtils.clamp(p.x, HOUSE.minX + CLEAR, HOUSE.maxX - CLEAR)
    p.z = MathUtils.clamp(p.z, HOUSE.minZ + CLEAR, inOpening ? HOUSE.maxZ + 3 : HOUSE.maxZ - CLEAR)
    return
  }
  // outdoors: above the ground, around the ground you can be on, and out of the house's walls and every walk-in's
  const ours = reachBounds(farm.layout)
  p.y = Math.max(p.y, 0.2)
  p.x = MathUtils.clamp(p.x, ours.minX - 4, ours.maxX + 4)
  p.z = MathUtils.clamp(p.z, ours.minZ - 4, ours.maxZ + 4)
  for (const { w, b } of WALK_IN_BOUNDS) {
    if (!inRect(b, p.x, p.z, WALL_CLEAR)) continue
    // looking in through a doorway: keep under its lintel
    const door = doorwayAt(w, p.x, p.z)
    if (door) {
      p.y = Math.min(p.y, door.top - 0.12)
      continue
    }
    const d = [p.x - (b.x0 - WALL_CLEAR), b.x1 + WALL_CLEAR - p.x, p.z - (b.z0 - WALL_CLEAR), b.z1 + WALL_CLEAR - p.z]
    const m = Math.min(...d)
    if (m === d[0]) p.x = b.x0 - WALL_CLEAR
    else if (m === d[1]) p.x = b.x1 + WALL_CLEAR
    else if (m === d[2]) p.z = b.z0 - WALL_CLEAR
    else p.z = b.z1 + WALL_CLEAR
  }
  if (inOpening) {
    if (insideHouse(p.x, p.z)) p.y = Math.min(p.y, HOUSE.wallHeight - 0.12)
    return
  }
  if (insideHouse(p.x, p.z, CLEAR)) {
    const d = [p.x - (HOUSE.minX - CLEAR), HOUSE.maxX + CLEAR - p.x, p.z - (HOUSE.minZ - CLEAR), HOUSE.maxZ + CLEAR - p.z]
    const m = Math.min(...d)
    if (m === d[0]) p.x = HOUSE.minX - CLEAR
    else if (m === d[1]) p.x = HOUSE.maxX + CLEAR
    else if (m === d[2]) p.z = HOUSE.minZ - CLEAR
    else p.z = HOUSE.maxZ + CLEAR
  }
}

// Third person: the camera keeps this far from a walk-in's walls and under its roof
const ARM_CLEAR = 0.2
/** What the third-person camera stays out of: every walk-in's walls, grown by ARM_CLEAR, and each room's air from its
 *  top up through the roof over it. */
const ARM_BOXES: Box[] = WALK_INS.flatMap((w) => [
  ...w.walls.map((b) => ({ x0: b.x0 - ARM_CLEAR, x1: b.x1 + ARM_CLEAR, z0: b.z0 - ARM_CLEAR, z1: b.z1 + ARM_CLEAR, y0: b.y0, y1: b.y1 + ARM_CLEAR })),
  ...w.rooms.map((r) => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0: r.top, y1: w.roof.y + w.roof.thick + ARM_CLEAR })),
])
const armDir = new Vector3()
const span = { near: 0, far: 0 }

/** Narrows `span` to where a ray at `p` going `v` is between `lo` and `hi` on one axis (false: never). */
function slab(p: number, v: number, lo: number, hi: number) {
  if (Math.abs(v) < 1e-9) return p >= lo && p <= hi
  const t0 = (lo - p) / v
  const t1 = (hi - p) / v
  span.near = Math.max(span.near, Math.min(t0, t1))
  span.far = Math.min(span.far, Math.max(t0, t1))
  return true
}

/** Where a ray from `o` along `d` first enters a box, or Infinity (it misses it, or starts inside it). */
function enters(o: Vector3, d: Vector3, b: Box): number {
  if (o.x >= b.x0 && o.x <= b.x1 && o.y >= b.y0 && o.y <= b.y1 && o.z >= b.z0 && o.z <= b.z1) return Infinity
  span.near = 0
  span.far = Infinity
  if (!slab(o.x, d.x, b.x0, b.x1) || !slab(o.y, d.y, b.y0, b.y1) || !slab(o.z, d.z, b.z0, b.z1)) return Infinity
  return span.near > span.far ? Infinity : span.near
}

/**
 * Third person: the camera is held on your side of every walk-in building's walls and roof — inside one, in the room
 * you are in, under its roof; outside, out of its walls (they never fade: src/scene/WalkIn.tsx). The line from what the
 * camera looks at to the camera is cut where it first meets one, so it still looks at you.
 */
function holdArm(target: Vector3, cam: Vector3) {
  armDir.subVectors(cam, target)
  const length = armDir.length()
  if (length < 1e-6) return
  armDir.divideScalar(length)
  let t = length
  for (const b of ARM_BOXES) t = Math.min(t, enters(target, armDir, b))
  if (t < length) cam.copy(target).addScaledVector(armDir, t)
}

/** Critically damped spring towards `to` (exact for any dt, so it never overshoots or explodes at low frame rates). */
function spring(s: { x: number; v: number }, to: number, omega: number, dt: number) {
  const x0 = s.x - to
  const e = Math.exp(-omega * dt)
  const k = (s.v + omega * x0) * dt
  s.x = to + (x0 + k) * e
  s.v = (s.v - omega * k) * e
}

/** What the player is told to do this frame (ecctrl keeps the last of each until told otherwise). */
const move = { forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false, joystick: { x: 0, y: 0 } }
const STILL = { forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false, joystick: { x: 0, y: 0 } }

const KEYS: Record<string, 'forward' | 'backward' | 'leftward' | 'rightward' | 'jump' | 'run'> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'leftward',
  ArrowLeft: 'leftward',
  KeyD: 'rightward',
  ArrowRight: 'rightward',
  Space: 'jump',
  ShiftLeft: 'run',
  ShiftRight: 'run',
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

// Current keyboard state. Events only mutate this; <Player /> applies it to the controller every
// frame, so a key pressed while the scene is momentarily suspended is never lost.
let lastOpened = 0 // when the settings panel last opened (see the Esc handling)
const keys = { forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false }
const held = new Set<string>()

function refreshKeys() {
  const any = (action: string) => [...held].some((c) => KEYS[c] === action)
  keys.forward = any('forward')
  keys.backward = any('backward')
  keys.leftward = any('leftward')
  keys.rightward = any('rightward')
  keys.jump = any('jump')
  keys.run = any('run')
}

/** Keyboard listeners (WASD / arrows / Space / Shift, E, V, Esc). Ecctrl v2 has no built-in key handling. */
function useKeyboard() {
  useEffect(() => {
    const release = () => {
      held.clear()
      refreshKeys()
    }
    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const state = useHome.getState()
      if (state.confirm && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
        // a machine asking first: Enter goes ahead, Esc says no (E again also says no: see triggerInteraction)
        if (e.code !== 'Escape' && !e.repeat) state.confirm.go()
        state.setConfirm(null)
        return
      }
      if (e.code === 'Escape') {
        if (state.screen) state.closeScreen()
        else if (state.panel) state.closePanel()
        else if (state.editing) state.setEditing(false)
        else if (state.decorating) {
          if (useDecorate.getState().picked) useDecorate.getState().pick(null)
          else stopDecorating()
        } else if (state.phase === 'playing') {
          // some browsers also deliver this Esc after releasing the pointer lock, which already opened the panel
          if (!state.settingsOpen) state.setSettingsOpen(true)
          else if (performance.now() - lastOpened > 250) state.setSettingsOpen(false)
        }
        return
      }
      // B: the edit mode for where you are (the farm's view from above outdoors, decorating indoors), in and out
      if (e.code === 'KeyB' && !e.repeat && state.phase === 'playing' && !state.screen && !state.settingsOpen && !state.panel) {
        if (state.editing) state.setEditing(false)
        else if (state.decorating) stopDecorating()
        else openEdit()
        return
      }
      if (state.phase !== 'playing' || busy(state)) return
      if (e.code === 'KeyE') {
        if (!e.repeat) triggerInteraction()
        return
      }
      if (e.code === 'KeyV') {
        if (!e.repeat) state.setView(state.view === 'first' ? 'third' : 'first')
        return
      }
      if (KEYS[e.code]) {
        e.preventDefault()
        // walking to a compass mark by itself: a step or a jump of your own takes over (Shift only runs)
        if (KEYS[e.code] !== 'run') stopWalk('key')
        held.add(e.code)
        refreshKeys()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (held.delete(e.code)) refreshKeys()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', release)
    const unsub = useHome.subscribe((s, p) => {
      if (s.settingsOpen && !p.settingsOpen) lastOpened = performance.now()
      if ((busy(s) && !busy(p)) || (s.phase !== 'playing' && p.phase === 'playing')) release()
    })
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', release)
      unsub()
      release()
    }
  }, [])
}

/**
 * Mouse / touch look for the first-person view. A click locks the pointer (desktop); where locking is
 * refused (embedded frames, touch) dragging on the scene turns the view instead.
 */
function LookInput() {
  const dom = useThree((s) => s.gl.domElement)
  useEffect(() => {
    // the finger (or mouse) that is turning the view: a second finger landing on the scene must not make the
    // view jump to it, and its own moves are ignored until the first one lifts
    let dragging: number | null = null
    let lastX = 0
    let lastY = 0
    let wasLocked = false
    let expectedUnlock = false
    const active = () => {
      const s = useHome.getState()
      return s.view === 'first' && s.phase === 'playing' && !busy(s)
    }
    const look = (dx: number, dy: number, base: number) => {
      const { sensitivity, invertY } = useSettings.getState()
      addLook(dx, invertY ? -dy : dy, base * sensitivity)
    }
    const onDown = (e: PointerEvent) => {
      if (!active()) return
      if (dragging !== null && e.pointerType === 'touch') return
      dragging = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      if (e.pointerType === 'mouse' && document.pointerLockElement !== dom) {
        try {
          void Promise.resolve(dom.requestPointerLock()).catch(() => {})
        } catch {
          /* pointer lock unavailable — dragging still works */
        }
      }
      dom.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!active()) return
      if (document.pointerLockElement === dom) {
        look(e.movementX, e.movementY, 0.0022)
      } else if (dragging === e.pointerId) {
        look(e.clientX - lastX, e.clientY - lastY, 0.0032)
        lastX = e.clientX
        lastY = e.clientY
      }
    }
    const onUp = (e: PointerEvent) => {
      if (dragging === e.pointerId) dragging = null
      dom.releasePointerCapture?.(e.pointerId)
    }
    // Esc while the pointer is captured releases it; treat that as "pause" and show the settings
    const onLockChange = () => {
      if (document.pointerLockElement === dom) {
        wasLocked = true
        return
      }
      if (!wasLocked) return
      wasLocked = false
      const s = useHome.getState()
      if (!expectedUnlock && s.phase === 'playing' && !busy(s)) s.setSettingsOpen(true)
      expectedUnlock = false
    }
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointercancel', onUp)
    document.addEventListener('pointerlockchange', onLockChange)
    const unsub = useHome.subscribe((s) => {
      if ((busy(s) || s.view !== 'first') && document.pointerLockElement === dom) {
        expectedUnlock = true
        document.exitPointerLock()
      }
    })
    debugSet('addLook', addLook)
    debugSet('look', lookState)
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerup', onUp)
      dom.removeEventListener('pointercancel', onUp)
      document.removeEventListener('pointerlockchange', onLockChange)
      unsub()
    }
  }, [dom])
  return null
}

const facing = new Vector3()
const q = new Quaternion()
const eye = new Vector3()
const aim = new Vector3()
const fwd = new Vector3()
const neck = new Vector3()
const vantage = new Vector3()
const target = new Vector3()
const armTarget = new Vector3()
const screenQ = new Quaternion()
const m4 = new Matrix4()
const UP = new Vector3(0, 1, 0)
// the first-person pose of the last frame (see the early pass in CameraRig)
const lastPose = { pos: new Vector3(), quat: new Quaternion(), valid: false }

function CameraRig({ ecctrl, feet }: { ecctrl: RefObject<EcctrlHandle | null>; feet: RefObject<Group | null> }) {
  const controls = useRef<EcctrlCameraControlsHandle>(null)
  const phase = useHome((s) => s.phase)
  const view = useHome((s) => s.view)
  const occupied = useHome(busy)
  const fovSetting = useSettings((s) => s.fov)
  const { ACTION } = CameraControlsImpl
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const prev = useRef({ view, phase })
  const bob = useRef({ amp: 0 })
  // smoothed height of the body, the landing dip, and the blend towards an open screen
  const height = useRef({ x: 0, v: 0, init: false, lastX: 0, lastZ: 0 })
  const dip = useRef({ x: 0, v: 0 })
  const focusBlend = useRef<{ x: number; v: number; def: ScreenDef | undefined }>({ x: 0, v: 0, def: undefined })

  // field of view: a narrow (portrait) window needs a wider vertical FOV to keep the same framing
  useEffect(() => {
    if (!('fov' in camera)) return
    const portrait = size.width / size.height < 1
    const firstPerson = view === 'first' && phase === 'playing'
    camera.fov = firstPerson ? (portrait ? fovSetting + 12 : fovSetting) : portrait ? 68 : 50
    camera.near = firstPerson ? 0.05 : 0.1
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height, view, phase, fovSetting])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    void c.setLookAt(SPAWN[0] + 2.6, SPAWN[1] + 4.2, SPAWN[2] + 4.0, SPAWN[0], SPAWN[1] - 0.4, SPAWN[2], false)
    // turning round in third person swings the camera round you
    orbit.turn = (yaw, smooth) => void controls.current?.rotate(yaw, 0, smooth)
    return () => {
      orbit.turn = null
    }
  }, [])

  // hand-overs between the two camera modes
  useEffect(() => {
    const before = prev.current
    prev.current = { view, phase }
    const c = controls.current
    if (phase !== 'playing') return
    if (view === 'first' && (before.view === 'third' || before.phase === 'intro')) {
      lastPose.valid = false
      if (before.phase === 'intro') {
        look.yaw = Math.PI // start facing the living room
        look.pitch = -0.04
      } else {
        camera.getWorldDirection(fwd)
        look.yaw = Math.atan2(-fwd.x, -fwd.z)
        look.pitch = 0
      }
    } else if (view === 'third' && before.view === 'first' && c) {
      const p = playerState.position
      const fx = -Math.sin(look.yaw)
      const fz = -Math.cos(look.yaw)
      void c.setLookAt(p.x - fx * 4.2, p.y + 3.4, p.z - fz * 4.2, p.x, p.y + 0.5, p.z, false)
    }
  }, [view, phase, camera])

  // Early pass, right after CameraControls (-1). The controls write their orbit pose into the camera every
  // frame, even while disabled: in first person put last frame's eyes back before anything reads the camera.
  useFrame((_, dt) => {
    const state = useHome.getState()
    const c = controls.current
    if (state.phase === 'intro') {
      void c?.rotate(dt * 0.18, 0, false)
      return
    }
    if (state.view === 'third') {
      const p = ecctrl.current?.currPos
      if (c && p) void c.moveTo(p.x, p.y + 0.5, p.z, true)
      // the camera swings round behind where you walk with the stick, when chosen (the button beside it)
      if (c && coarsePointer && !busy(state)) {
        const s = stickInput()
        const turn = followTurn(s.x, s.y, playerState.speed > 0.3, dt)
        if (turn) void c.rotate(turn, 0, false)
      }
      return
    }
    if (lastPose.valid) {
      camera.position.copy(lastPose.pos)
      camera.quaternion.copy(lastPose.quat)
    }
  }, -0.5)

  // Late pass (priority 0, after the physics step: <Physics> subscribes its stepper before its children). The
  // eyes sit exactly where the body is drawn this frame, so your own arms, hands and whatever you carry never
  // shake against the view, whatever the frame rate.
  useFrame((_, dt) => {
    const state = useHome.getState()
    if (state.phase === 'playing' && state.view === 'third' && controls.current) {
      // third person: along the line to what it looks at now (not where that is gliding to)
      holdArm(controls.current.getTarget(armTarget, false), camera.position)
      camera.updateMatrixWorld()
      return
    }
    if (state.phase !== 'playing' || state.view !== 'first') return
    const g = feet.current
    if (!g) return
    g.getWorldPosition(eye)
    const settings = useSettings.getState()

    // height: a critically damped follow absorbs the float spring and hops onto furniture, never far behind.
    // A teleport or respawn (more than a metre in one frame) is taken as it is instead of gliding through walls.
    const h = height.current
    if (!h.init || Math.abs(eye.y - h.x) > 0.8 || Math.hypot(eye.x - h.lastX, eye.z - h.lastZ) > 1) {
      h.x = eye.y
      h.v = 0
      h.init = true
      dip.current.x = dip.current.v = 0
    }
    h.lastX = eye.x
    h.lastZ = eye.z
    spring(h, eye.y, 26, dt)
    h.x = MathUtils.clamp(h.x, eye.y - 0.08, eye.y + 0.08)

    // landing: a short dip of the head and back, deeper for a harder landing (a slightly under-damped spring)
    const d = dip.current
    if (landing.kick) {
      if (settings.headBob) d.v -= landing.kick
      landing.kick = 0
    }
    for (let left = Math.min(dt, 0.25); left > 1e-6; left -= 1 / 120) {
      const step = Math.min(left, 1 / 120)
      d.v += (-170 * d.x - 17 * d.v) * step
      d.x += d.v * step
    }
    d.x = MathUtils.clamp(d.x, -0.1, 0.04)

    const b = bob.current
    const walking = playerState.grounded && playerState.speed > 0.3 && !state.screen && settings.headBob
    b.amp = MathUtils.damp(b.amp, walking ? Math.min(playerState.speed / 2.3, 1.7) * 0.02 : 0, 8, dt)
    const t = gait.phase
    // the view turns towards where you walk with the stick, when chosen (touch: the button beside the stick); walking to a
    // compass mark by itself, towards where the way goes, whatever is chosen
    if (coarsePointer && !busy(state)) {
      const s = stickInput()
      look.yaw += followTurn(s.x, s.y, playerState.speed > 0.3 && !walkStick.on, dt)
    }
    stepWalkView(dt)
    stepTurn(dt) // a turn towards something you chose to use from where you stand
    const th = look.pitch
    // eye position relative to the body, in the view's yaw frame (camera forward is local −z)
    neck
      .set(0, EYE_HEIGHT - NECK_UP + NECK_UP * Math.cos(th) + NECK_FRONT * Math.sin(th) + Math.sin(t * 2) * b.amp, NECK_FRONT + NECK_UP * Math.sin(th) - NECK_FRONT * Math.cos(th))
      .applyAxisAngle(UP, look.yaw)
    camera.position.set(eye.x + neck.x, h.x + d.x + neck.y, eye.z + neck.z)
    camera.rotation.set(look.pitch, look.yaw, Math.sin(t) * b.amp * 0.35, 'YXZ')
    playerState.eye.x = camera.position.x
    playerState.eye.y = camera.position.y
    playerState.eye.z = camera.position.z

    // an open screen draws the view towards it, and gives it back the same way when it closes
    const fb = focusBlend.current
    const def = state.screen ? screenById(state.screen) : undefined
    if (def) fb.def = def
    spring(fb, def ? 1 : 0, reducedMotion ? 14 : 4.2, dt)
    const k = MathUtils.smoothstep(MathUtils.clamp(fb.x, 0, 1), 0, 1)
    if (fb.def && k > 1e-3) {
      const sd = fb.def
      const nx = Math.sin(sd.rotationY)
      const nz = Math.cos(sd.rotationY)
      const tanHalf = Math.tan(MathUtils.degToRad((camera as PerspectiveCamera).fov ?? 60) / 2)
      // far enough that the panel fills about two thirds of the view either way
      const fitH = sd.size[1] / (2 * tanHalf * 0.66)
      const fitW = sd.size[0] / (2 * tanHalf * (size.width / size.height) * 0.72)
      const dist = MathUtils.clamp(Math.max(fitH, fitW), 0.9, 2.6)
      target.set(sd.position[0], sd.position[1], sd.position[2])
      vantage.set(target.x + nx * dist, target.y, target.z + nz * dist)
      m4.lookAt(vantage, target, UP)
      screenQ.setFromRotationMatrix(m4)
      camera.position.lerp(vantage, k)
      camera.quaternion.slerp(screenQ, k)
    }

    keepCameraInBounds(camera.position, eye)
    camera.updateMatrixWorld()
    lastPose.pos.copy(camera.position)
    lastPose.quat.copy(camera.quaternion)
    lastPose.valid = true
  })

  return (
    <EcctrlCameraControls
      ref={controls}
      makeDefault
      enabled={phase === 'playing' && view === 'third' && !occupied}
      smoothTime={0.14}
      draggingSmoothTime={0.08}
      minDistance={2.5}
      maxDistance={7.5}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI * 0.42}
      mouseButtons={{ left: ACTION.ROTATE, middle: ACTION.NONE, right: ACTION.NONE, wheel: ACTION.DOLLY }}
      touches={{ one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY, three: ACTION.NONE }}
    />
  )
}

export function Player() {
  const ecctrl = useRef<EcctrlHandle>(null)
  // a restart of the graphics mid-game puts you back where you stood, looking the same way
  const [spawnAt] = useState<[number, number, number]>(() => {
    if (!resume.at) return SPAWN
    const at = resume.at
    look.yaw = resume.yaw
    look.pitch = resume.pitch
    resume.at = null
    return at
  })
  const feet = useRef<Group>(null)
  const bodyYaw = useRef<Group>(null)
  const view = useHome((s) => s.view)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const { world, rapier } = useRapier()
  debugSet('physics', { world, rapier })
  const acc = useRef(0)
  const prevInteract = useRef(false)
  const blocked = useRef(0) // how long walking on by itself has been held up
  const blockedFrames = useRef(0) // and for how many frames
  const air = useRef({ airborne: false, minVy: 0 })
  // frame-rate meter for the acceleration rescaling: re-renders only when the rate really changes
  const [fps, setFps] = useState(60)
  const meter = useRef({ t: 0, n: 0, fps: 60 })
  const groundRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier])
  // walking to a compass mark by itself: finds the way and pushes the stick along it
  const walker = useMemo(() => new Walker(world, rapier, () => ecctrl.current?.body), [world, rapier])
  const focusRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }), [rapier])
  const impulse = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])
  // the body tree never changes with the frame rate: keep it out of those re-renders
  const avatar = useMemo(() => <Avatar />, [])
  useKeyboard()

  // ecctrl applies its float spring once per rendered frame, so it is weak at a low frame rate (the body sags
  // and drags) and harsh at a high one (it jitters). It is switched off (springK/dampingC 0) and the float is
  // held here instead, once per physics step: a critically damped spring on the distance to the floor.
  useBeforePhysicsStep((w) => {
    const h = ecctrl.current
    const body = h?.body
    if (!h || !body || body.isSleeping()) return
    const t = body.translation()
    groundRay.origin.x = t.x
    groundRay.origin.y = t.y
    groundRay.origin.z = t.z
    const hit = w.castRay(groundRay, FEET + FLOAT_FORGIVE, true, undefined, undefined, undefined, body)
    if (!hit) return
    const vy = body.linvel().y
    const accel = FLOAT_OMEGA * FLOAT_OMEGA * (FEET - hit.timeOfImpact) - 2 * FLOAT_OMEGA * vy
    // never pull a jump back down
    if (accel < 0 && (h.jumpActive || vy > 0.6)) return
    impulse.y = body.mass() * (accel + 9.81 * body.gravityScale()) * w.timestep
    body.applyImpulse(impulse, false)
  })

  // debug-only helpers (window.__home exists in dev or with ?debug): teleport and controller access
  useEffect(() => {
    debugSet('teleport', (x: number, y: number, z: number) => {
      stopTurn()
      stopWalk('moved')
      const body = ecctrl.current?.body
      body?.setTranslation({ x, y, z }, true)
      body?.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body?.setAngvel({ x: 0, y: 0, z: 0 }, true)
      // where you are, and what is within reach, start again from here at once: until the next frame has looked
      // round, nothing from where you stood before (the offer, the place a turn is worked out from) can be acted
      // on — a slow frame after a teleport used to turn you towards a bed from the spot you had just left
      playerState.position.x = x
      playerState.position.y = y
      playerState.position.z = z
      useHome.getState().setActions([])
      acc.current = 1
    })
    debugSet('ecctrl', () => ecctrl.current)
    debugSet('camera', camera)
    debugSet('scene', scene)
    debugSet('gesture', playGesture)
    // walking to a mark: start and stop it, how it went, the way to a thing found at once, the whole grid measured
    debugSet('walk', {
      to: walkTo,
      stop: stopWalk,
      state: () => useWalk.getState(),
      stats: walkStats,
      plan: (id: string, from?: { x: number; z: number }, fresh?: boolean) => walker.planNow(id, from, fresh),
      measure: () => walker.measureGrid(),
      forget: () => walker.forget(),
      // where a thing is and how far it reaches (what a walk to it ends within)
      target: (id: string) => {
        const d = interactable(id)
        return d ? { position: { ...d.position }, aim: { ...(d.aim ?? d.position) }, box: d.box, radius: d.radius } : null
      },
    })
  }, [camera, scene, walker])

  useFrame((_, dt) => {
    const handle = ecctrl.current
    if (!handle) return
    const pos = handle.currPos
    // the game asked for you to be somewhere else (something was just built where you stood)
    const to = playerState.moveTo
    if (to) {
      playerState.moveTo = null
      stopWalk('moved')
      const body = handle.body
      body?.setTranslation(to, true)
      body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
      playerState.position.x = to.x
      playerState.position.y = to.y
      playerState.position.z = to.z
      return
    }
    // a safety net: should physics ever throw the body out of the world (through the floor, or knocked flying),
    // it comes back to the start instead of falling or flying for ever (anywhere on the ground you can be on is in it)
    const ours = reachBounds(farm.layout)
    if (pos.y < -6 || pos.y > 30 || pos.x < ours.minX - 8 || pos.x > ours.maxX + 8 || pos.z < ours.minZ - 8 || pos.z > ours.maxZ + 8) {
      const body = handle.body
      body?.setTranslation({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }, true)
      body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body?.setAngvel({ x: 0, y: 0, z: 0 }, true)
      return
    }
    playerState.position.x = pos.x
    playerState.position.y = pos.y
    playerState.position.z = pos.z
    playerState.speed = handle.moveSpeed
    playerState.grounded = handle.isOnGround

    const m = meter.current
    m.t += dt
    m.n += 1
    if (m.t > 2) {
      const rate = m.n / m.t
      const quantised = rate < 12 ? Math.max(1, Math.round(rate)) : Math.round(rate / 5) * 5
      m.t = 0
      m.n = 0
      if (Math.abs(quantised - m.fps) / m.fps > 0.18) {
        m.fps = quantised
        setFps(quantised)
      }
    }

    const state = useHome.getState()
    // First person: the visible body always faces where you look. The physics body turns by itself only while
    // it is awake and moving, so its stale heading is cancelled out here instead of waiting for it.
    const yawGroup = bodyYaw.current
    if (yawGroup) {
      if (state.view === 'first') {
        const z = handle.bodyZAxis
        const d = look.yaw + Math.PI - Math.atan2(z.x, z.z)
        yawGroup.rotation.y = Math.atan2(Math.sin(d), Math.cos(d))
      } else yawGroup.rotation.y = 0
    }
    // first person: the body turns with the view (and strafes), like your own
    handle.setLockForward(state.view === 'first')
    if (state.view === 'first') {
      // "forward" for dropping things and picking what to interact with is where you are looking
      playerState.facing.x = -Math.sin(look.yaw)
      playerState.facing.z = -Math.cos(look.yaw)
    } else {
      // body forward (+z in the body's frame)
      q.copy(handle.currQuat)
      facing.set(0, 0, 1).applyQuaternion(q).setY(0).normalize()
      playerState.facing.x = facing.x
      playerState.facing.z = facing.z
    }

    if (state.phase !== 'playing') return

    // footsteps on the rhythm of the walk, by floor; a jump and a landing have their own sound
    const sp = handle.moveSpeed
    const vy = handle.verticalSpeed
    const a = air.current
    if (handle.isOnGround) {
      if (a.airborne) {
        if (a.minVy < -2.2) {
          land(floorAt(pos.x, pos.z), (-a.minVy - 1.5) / 5)
          landing.kick = Math.min(-a.minVy, 7) * 0.075
        }
        a.airborne = false
        a.minVy = 0
      }
      if (sp > 0.3) {
        gait.phase += dt * Math.min(sp, 5) * 2.7
        const step = Math.floor((gait.phase - Math.PI * 0.75) / Math.PI)
        if (step !== gait.step) {
          gait.step = step
          footstep(floorAt(pos.x, pos.z), sp / 2.3, sp > 3.4)
        }
      }
    } else {
      if (!a.airborne && vy > 2) jumpSound()
      a.airborne = true
      a.minVy = Math.min(a.minVy, vy)
    }

    // lens focus: distance to the first thing along the view (the body itself is excluded)
    camera.getWorldDirection(aim)
    let hit = null
    if (state.view === 'first') {
      focusRay.origin.x = camera.position.x
      focusRay.origin.y = camera.position.y
      focusRay.origin.z = camera.position.z
      focusRay.dir.x = aim.x
      focusRay.dir.y = aim.y
      focusRay.dir.z = aim.z
      hit = world.castRay(focusRay, 30, true, undefined, undefined, undefined, handle.body)
    }
    const wanted = state.view === 'first' ? (hit ? hit.timeOfImpact : 14) : camera.position.distanceTo(pos)
    focus.distance += (Math.max(0.4, wanted) - focus.distance) * (1 - Math.exp(-6 * dt))

    // walking to a compass mark by itself: anything you do yourself takes over — the stick, the jump button, a panel or
    // a card opening (a key: see useKeyboard; tapping the mark again: the compass)
    if (useWalk.getState().id) {
      const joy = useJoystickStore.getState().joysticks.default
      if (busy(state) || state.confirm) stopWalk('busy')
      else if (coarsePointer && Math.hypot(joy?.x ?? 0, joy?.y ?? 0) > 0) stopWalk('stick')
      else if (coarsePointer && useButtonStore.getState().buttons.jump) stopWalk('jump')
    }
    fwd.set(aim.x, 0, aim.z).normalize()
    walker.frame(dt, pos, handle.moveSpeed, { x: fwd.x, z: fwd.z }, state.view === 'first')

    if (!busy(state)) {
      move.forward = keys.forward
      move.backward = keys.backward
      move.leftward = keys.leftward
      move.rightward = keys.rightward
      move.jump = keys.jump
      move.run = keys.run || (walkStick.on && walkStick.run)
      move.joystick.x = walkStick.on ? walkStick.x : 0
      move.joystick.y = walkStick.on ? walkStick.y : 0
      handle.setMovement(move)
    } else handle.setMovement(STILL)

    // on-screen controls (touch devices)
    const cruising = useStick.getState().cruise
    if (coarsePointer && !busy(state)) {
      const buttons = useButtonStore.getState().buttons
      const s = stickInput()
      handle.setMovement({ joystick: { x: s.x, y: s.y }, jump: !!buttons.jump, run: s.run })
      const interact = !!buttons.interact
      if (interact && !prevInteract.current) triggerInteraction()
      prevInteract.current = interact
      // walking on by itself stops at a wall: held up for a second, and for ten frames at least (on a page drawing a
      // frame or two a second, the first second is spent getting going)
      const held = cruising && handle.moveSpeed < 0.3
      blocked.current = held ? blocked.current + dt : 0
      blockedFrames.current = held ? blockedFrames.current + 1 : 0
      if (blocked.current > 1 && blockedFrames.current > 10) useStick.getState().setCruise(false)
    } else if (cruising) useStick.getState().setCruise(false) // something opened: you stop

    // detection runs at ~10 Hz — no need to do it every frame
    acc.current += dt
    if (acc.current < 0.1) return
    acc.current = 0
    const room = roomAt(pos.x, pos.z)
    if (room !== state.room) state.setRoom(room)
    const outdoors = !insideHouse(pos.x, pos.z)
    if (outdoors !== state.outdoors) state.setOutdoors(outdoors)
    if (busy(state)) return
    let view: ViewRay | undefined
    if (state.view === 'first') {
      camera.getWorldDirection(aim)
      view = { origin: camera.position, dir: aim }
    }
    // what you look at first; then (touch buttons, or when you look at nothing) whatever is within reach
    const from = { x: pos.x, y: pos.y + 0.1, z: pos.z }
    const next = findActions(from, view, { reach: !state.carrying })
    // with nothing to do here, what is on its way (shown, not pressed)
    const status = next.length || state.carrying ? null : findStatus(from, view)
    // what is ready to take farther off is on the compass at the top, not on the button (in reach, it is the
    // button's, and it leaves the compass); indoors too, what is ready outside (tap it to walk there)
    const marks = findFar(from)
    if (marksKey(marks) !== marksKey(state.compass)) state.setCompass(marks)
    // a mark tapped is reached: its arrow in the world goes (or after a while, unless you are still walking to it; read
    // afresh: a walk stopped this frame has just set it again)
    const guide = useHome.getState().guide
    if (guide && (next.some((a) => a.id === guide.id) || (!walkingTo(guide.id) && performance.now() - guide.at > 12000))) state.setGuide(null)
    // a confirm card asks about an action that is still on offer (walked away, or the oven got busy: it goes)
    if (state.confirm && !next.some((a) => a.id === state.confirm!.id)) state.setConfirm(null)
    if (actionsKey(next) !== actionsKey(state.actions) || actionsKey(status ? [status] : []) !== actionsKey(state.status ? [state.status] : [])) state.setActions(next, status)
    // the thing looked at, when it carries a tag: a gear on it for what can be set, a price tag when it is for sale
    const found = findTag(from, view)
    const tag = found ? { id: found.id, kind: found.tag.kind, label: found.tag.label, price: found.tag.price } : null
    if (tag?.id !== state.tag?.id || tag?.kind !== state.tag?.kind || tag?.label !== state.tag?.label || tag?.price !== state.tag?.price) state.setTag(tag)
  })

  return (
    <>
      <EcctrlAnimationStateController ecctrl={ecctrl} />
      <Ecctrl
        ref={ecctrl}
        position={spawnAt}
        capsuleHalfHeight={CAPSULE_HALF}
        capsuleRadius={CAPSULE_RADIUS}
        floatHeight={FLOAT}
        maxWalkVel={2.3}
        maxRunVel={4.6}
        jumpVel={4.4}
        enableToggleRun={false}
        springK={0}
        dampingC={0}
        // ecctrl's self-righting torque is also once per frame: too weak at a low frame rate to stop a knock
        // from a table edge tipping the capsule (and the eyes with it). A person does not tip: only yaw is free.
        enabledRotations={[false, true, false]}
        accDeltaTime={perFrame(ACC_60, fps)}
        decDeltaTime={perFrame(DEC_60, fps)}
      >
        {/* your own body (and what you carry) is drawn whatever the rooms and portals say; to the sun it is a thing in
            a room like any other: indoors where no window lets sunlight in, its shadow is left out of the map, and
            walking there does not draw the map again (src/lib/visibility) */}
        <group ref={feet} position={[0, -FEET, 0]} userData={{ cell: 'always', sun: 'room' }}>
          {/* in first person the body sits just behind the eyes so you look down onto your own arms, hands and feet */}
          <group ref={bodyYaw}>
            <group position={[0, 0, view === 'first' ? -BODY_BACK : 0]}>{avatar}</group>
          </group>
        </group>
      </Ecctrl>
      <HeldItem />
      <AimMarker />
      <GuideMarker />
      <CameraRig ecctrl={ecctrl} feet={feet} />
      <LookInput />
    </>
  )
}
