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
import { HOUSE, ROOMS, SPAWN, roomAt, type FloorKind } from '../data/layout'
import { screenById, type ScreenDef } from '../data/screens'
import { debugSet } from '../lib/debug'
import { focus } from '../lib/focus'
import { playGesture } from '../lib/gestures'
import { findNearest, triggerInteraction, type ViewRay } from '../lib/interaction'
import { addLook, look, look as lookState } from '../lib/look'
import { playerState } from '../lib/playerState'
import { useSettings } from '../settings'
import { useHome } from '../store'
import { Avatar, HeldItem } from './Avatar'

const CAPSULE_HALF = 0.5
const CAPSULE_RADIUS = 0.28
const FLOAT = 0.12
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
const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Walking rhythm shared by the footsteps and the head bob: one step per π of phase; the foot strikes at the bottom of the bob. */
const gait = { phase: 0, step: 0 }
/** Set by the player when it lands; the camera turns it into a short dip of the head. */
const landing = { kick: 0 }

const floorAt = (x: number, z: number): FloorKind => {
  const room = roomAt(x, z)
  return room ? ROOMS[room].floor : 'wood'
}

/** Critically damped spring towards `to` (exact for any dt, so it never overshoots or explodes at low frame rates). */
function spring(s: { x: number; v: number }, to: number, omega: number, dt: number) {
  const x0 = s.x - to
  const e = Math.exp(-omega * dt)
  const k = (s.v + omega * x0) * dt
  s.x = to + (x0 + k) * e
  s.v = (s.v - omega * k) * e
}

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

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

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
      if (e.code === 'Escape') {
        if (state.screen) state.closeScreen()
        else if (state.phase === 'playing') {
          // some browsers also deliver this Esc after releasing the pointer lock, which already opened the panel
          if (!state.settingsOpen) state.setSettingsOpen(true)
          else if (performance.now() - lastOpened > 250) state.setSettingsOpen(false)
        }
        return
      }
      if (state.phase !== 'playing' || state.screen || state.settingsOpen) return
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
      if ((s.screen && !p.screen) || (s.settingsOpen && !p.settingsOpen) || (s.phase !== 'playing' && p.phase === 'playing')) release()
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
    let dragging = false
    let lastX = 0
    let lastY = 0
    let wasLocked = false
    let expectedUnlock = false
    const active = () => {
      const s = useHome.getState()
      return s.view === 'first' && s.phase === 'playing' && !s.screen && !s.settingsOpen
    }
    const look = (dx: number, dy: number, base: number) => {
      const { sensitivity, invertY } = useSettings.getState()
      addLook(dx, invertY ? -dy : dy, base * sensitivity)
    }
    const onDown = (e: PointerEvent) => {
      if (!active()) return
      dragging = true
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
      } else if (dragging) {
        look(e.clientX - lastX, e.clientY - lastY, 0.0032)
        lastX = e.clientX
        lastY = e.clientY
      }
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
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
      if (!expectedUnlock && s.phase === 'playing' && !s.screen && !s.settingsOpen) s.setSettingsOpen(true)
      expectedUnlock = false
    }
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointercancel', onUp)
    document.addEventListener('pointerlockchange', onLockChange)
    const unsub = useHome.subscribe((s) => {
      if ((s.screen || s.settingsOpen || s.view !== 'first') && document.pointerLockElement === dom) {
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
const screenQ = new Quaternion()
const m4 = new Matrix4()
const UP = new Vector3(0, 1, 0)
// the first-person pose of the last frame (see the early pass in CameraRig)
const lastPose = { pos: new Vector3(), quat: new Quaternion(), valid: false }

function CameraRig({ ecctrl, feet }: { ecctrl: RefObject<EcctrlHandle | null>; feet: RefObject<Group | null> }) {
  const controls = useRef<EcctrlCameraControlsHandle>(null)
  const phase = useHome((s) => s.phase)
  const view = useHome((s) => s.view)
  const screen = useHome((s) => s.screen)
  const settingsOpen = useHome((s) => s.settingsOpen)
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
    c.setLookAt(SPAWN[0] + 2.6, SPAWN[1] + 4.2, SPAWN[2] + 4.0, SPAWN[0], SPAWN[1] - 0.4, SPAWN[2], false)
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
      c.setLookAt(p.x - fx * 4.2, p.y + 3.4, p.z - fz * 4.2, p.x, p.y + 0.5, p.z, false)
    }
  }, [view, phase, camera])

  // Early pass, right after CameraControls (-1). The controls write their orbit pose into the camera every
  // frame, even while disabled: in first person put last frame's eyes back before anything reads the camera.
  useFrame((_, dt) => {
    const state = useHome.getState()
    const c = controls.current
    if (state.phase === 'intro') {
      c?.rotate(dt * 0.18, 0, false)
      return
    }
    if (state.view === 'third') {
      const p = ecctrl.current?.currPos
      if (c && p) c.moveTo(p.x, p.y + 0.5, p.z, true)
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
    const th = look.pitch
    // eye position relative to the body, in the view's yaw frame (camera forward is local −z)
    neck
      .set(0, EYE_HEIGHT - NECK_UP + NECK_UP * Math.cos(th) + NECK_FRONT * Math.sin(th) + Math.sin(t * 2) * b.amp, NECK_FRONT + NECK_UP * Math.sin(th) - NECK_FRONT * Math.cos(th))
      .applyAxisAngle(UP, look.yaw)
    camera.position.set(eye.x + neck.x, h.x + d.x + neck.y, eye.z + neck.z)
    camera.rotation.set(look.pitch, look.yaw, Math.sin(t) * b.amp * 0.35, 'YXZ')

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

    // never let the eyes leave the shell: a ceiling lid stops the body, this catches everything else
    camera.position.y = Math.min(camera.position.y, HOUSE.wallHeight - 0.12)
    // walls are centred on HOUSE's edges: stay clear of their inner faces
    const wall = HOUSE.wallThickness / 2 + 0.1
    camera.position.x = MathUtils.clamp(camera.position.x, HOUSE.minX + wall, HOUSE.maxX - wall)
    camera.position.z = MathUtils.clamp(camera.position.z, HOUSE.minZ + wall, HOUSE.maxZ - wall)
    camera.updateMatrixWorld()
    lastPose.pos.copy(camera.position)
    lastPose.quat.copy(camera.quaternion)
    lastPose.valid = true
  })

  return (
    <EcctrlCameraControls
      ref={controls}
      makeDefault
      enabled={phase === 'playing' && view === 'third' && !screen && !settingsOpen}
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
  const feet = useRef<Group>(null)
  const bodyYaw = useRef<Group>(null)
  const view = useHome((s) => s.view)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const { world, rapier } = useRapier()
  debugSet('physics', { world, rapier })
  const acc = useRef(0)
  const prevInteract = useRef(false)
  const air = useRef({ airborne: false, minVy: 0 })
  // frame-rate meter for the acceleration rescaling: re-renders only when the rate really changes
  const [fps, setFps] = useState(60)
  const meter = useRef({ t: 0, n: 0, fps: 60 })
  const groundRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier])
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
      const body = ecctrl.current?.body
      body?.setTranslation({ x, y, z }, true)
      body?.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
      body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body?.setAngvel({ x: 0, y: 0, z: 0 }, true)
    })
    debugSet('ecctrl', () => ecctrl.current)
    debugSet('camera', camera)
    debugSet('scene', scene)
    debugSet('gesture', playGesture)
  }, [camera, scene])

  useFrame((_, dt) => {
    const handle = ecctrl.current
    if (!handle) return
    const pos = handle.currPos
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

    if (!state.screen && !state.settingsOpen) handle.setMovement(keys)
    else handle.setMovement({ forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false })

    // on-screen controls (touch devices)
    if (coarsePointer && !state.screen && !state.settingsOpen) {
      const joy = useJoystickStore.getState().joysticks.default
      const buttons = useButtonStore.getState().buttons
      handle.setMovement({
        joystick: { x: joy?.x ?? 0, y: joy?.y ?? 0 },
        jump: !!buttons.jump,
        run: Math.hypot(joy?.x ?? 0, joy?.y ?? 0) > 0.92,
      })
      const interact = !!buttons.interact
      if (interact && !prevInteract.current) triggerInteraction()
      prevInteract.current = interact
    }

    // detection runs at ~10 Hz — no need to do it every frame
    acc.current += dt
    if (acc.current < 0.1) return
    acc.current = 0
    const room = roomAt(pos.x, pos.z)
    if (room !== state.room) state.setRoom(room)
    if (state.screen || state.settingsOpen) return
    let view: ViewRay | undefined
    if (state.view === 'first') {
      camera.getWorldDirection(aim)
      view = { origin: camera.position, dir: aim }
    }
    const next = findNearest({ x: pos.x, y: pos.y + 0.1, z: pos.z }, view)
    const cur = state.nearby
    if (next?.id !== cur?.id || next?.label !== cur?.label) state.setNearby(next)
  })

  return (
    <>
      <EcctrlAnimationStateController ecctrl={ecctrl} />
      <Ecctrl
        ref={ecctrl}
        position={SPAWN}
        capsuleHalfHeight={CAPSULE_HALF}
        capsuleRadius={CAPSULE_RADIUS}
        floatHeight={FLOAT}
        maxWalkVel={2.3}
        maxRunVel={4.6}
        jumpVel={4.4}
        enableToggleRun={false}
        springK={0}
        dampingC={0}
        accDeltaTime={perFrame(ACC_60, fps)}
        decDeltaTime={perFrame(DEC_60, fps)}
      >
        <group ref={feet} position={[0, -FEET, 0]}>
          {/* in first person the body sits just behind the eyes so you look down onto your own arms, hands and feet */}
          <group ref={bodyYaw}>
            <group position={[0, 0, view === 'first' ? -BODY_BACK : 0]}>
              {avatar}
            </group>
          </group>
        </group>
      </Ecctrl>
      <HeldItem />
      <CameraRig ecctrl={ecctrl} feet={feet} />
      <LookInput />
    </>
  )
}
