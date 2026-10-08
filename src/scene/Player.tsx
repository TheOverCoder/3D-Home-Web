import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlAnimationStateController } from 'ecctrl/animation'
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from 'ecctrl/camera'
import { useButtonStore, useJoystickStore } from 'ecctrl/input'
import { CameraControlsImpl } from '@react-three/drei'
import { MathUtils, Quaternion, Vector3, type Group } from 'three'
import { HOUSE, SPAWN, roomAt } from '../data/layout'
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
const UP = new Vector3(0, 1, 0)

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
  const bob = useRef({ t: 0, amp: 0 })

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

    // first person: the eyes sit on the (interpolated) body, the view follows the look angles
    const g = feet.current
    if (!g) return
    g.getWorldPosition(eye)
    const b = bob.current
    const walking = playerState.grounded && playerState.speed > 0.3 && !state.screen && useSettings.getState().headBob
    b.amp = MathUtils.damp(b.amp, walking ? Math.min(playerState.speed / 2.3, 1.7) * 0.02 : 0, 8, dt)
    b.t += dt * Math.min(playerState.speed, 5) * 2.7
    const th = look.pitch
    // eye position relative to the body, in the view's yaw frame (camera forward is local −z)
    neck
      .set(0, EYE_HEIGHT - NECK_UP + NECK_UP * Math.cos(th) + NECK_FRONT * Math.sin(th) + Math.sin(b.t * 2) * b.amp, NECK_FRONT + NECK_UP * Math.sin(th) - NECK_FRONT * Math.cos(th))
      .applyAxisAngle(UP, look.yaw)
    camera.position.set(eye.x + neck.x, eye.y + neck.y, eye.z + neck.z)
    // never let the eyes leave the shell: a ceiling lid stops the body, this catches everything else
    camera.position.y = Math.min(camera.position.y, HOUSE.wallHeight - 0.12)
    camera.position.x = MathUtils.clamp(camera.position.x, HOUSE.minX + 0.12, HOUSE.maxX - 0.12)
    camera.position.z = MathUtils.clamp(camera.position.z, HOUSE.minZ + 0.12, HOUSE.maxZ - 0.12)
    camera.rotation.set(look.pitch, look.yaw, Math.sin(b.t) * b.amp * 0.35, 'YXZ')
    // priority -0.5: right after CameraControls (-1), which keeps writing its own pose, and before every
    // other system that reads the camera this frame (ceilings, held item, wall fade, interaction)
  }, -0.5)

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
  const acc = useRef(0)
  const prevInteract = useRef(false)
  useKeyboard()

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

    // lens focus: distance to the first thing along the view (the body itself is excluded)
    camera.getWorldDirection(aim)
    const hit =
      state.view === 'first'
        ? world.castRay(new rapier.Ray(camera.position, aim), 30, true, undefined, undefined, undefined, handle.body)
        : null
    const wanted = state.view === 'first' ? (hit ? hit.timeOfImpact : 14) : camera.position.distanceTo(pos)
    focus.distance += (Math.max(0.4, wanted) - focus.distance) * (1 - Math.exp(-6 * dt))

    if (!state.screen && !state.settingsOpen) handle.setMovement(keys)
    else handle.setMovement({ forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false })

    // on-screen controls (touch devices)
    if (matchMedia('(pointer: coarse)').matches && !state.screen && !state.settingsOpen) {
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
      >
        <group ref={feet} position={[0, -FEET, 0]}>
          {/* in first person the body sits just behind the eyes so you look down onto your own arms, hands and feet */}
          <group ref={bodyYaw}>
            <group position={[0, 0, view === 'first' ? -BODY_BACK : 0]}>
              <Avatar />
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
