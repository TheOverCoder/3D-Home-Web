import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlAnimationStateController } from 'ecctrl/animation'
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from 'ecctrl/camera'
import { useButtonStore, useJoystickStore } from 'ecctrl/input'
import { CameraControlsImpl } from '@react-three/drei'
import { MathUtils, Quaternion, Vector3, type Group } from 'three'
import { PICKUPS, SPAWN, roomAt } from '../data/layout'
import { debugSet } from '../lib/debug'
import { findNearest, triggerInteraction, type ViewRay } from '../lib/interaction'
import { addLook, look } from '../lib/look'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { Avatar } from './Avatar'
import { PickupMesh } from './Pickups'

const CAPSULE_HALF = 0.5
const CAPSULE_RADIUS = 0.28
const FLOAT = 0.12
// body-centre → feet: the capsule hovers FLOAT above the floor
const FEET = CAPSULE_HALF + CAPSULE_RADIUS + FLOAT
const EYE_HEIGHT = 1.62 // above the feet

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
      if (e.code === 'Escape' && state.screen) {
        state.closeScreen()
        return
      }
      if (state.phase !== 'playing' || state.screen) return
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
      if ((s.screen && !p.screen) || (s.phase !== 'playing' && p.phase === 'playing')) release()
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
    const active = () => {
      const s = useHome.getState()
      return s.view === 'first' && s.phase === 'playing' && !s.screen
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
        addLook(e.movementX, e.movementY)
      } else if (dragging) {
        addLook(e.clientX - lastX, e.clientY - lastY, 0.0032)
        lastX = e.clientX
        lastY = e.clientY
      }
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      dom.releasePointerCapture?.(e.pointerId)
    }
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointercancel', onUp)
    const unsub = useHome.subscribe((s) => {
      if ((s.screen || s.view !== 'first') && document.pointerLockElement === dom) document.exitPointerLock()
    })
    debugSet('addLook', addLook)
    debugSet('look', look)
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerup', onUp)
      dom.removeEventListener('pointercancel', onUp)
      unsub()
    }
  }, [dom])
  return null
}

/** What the avatar carries, seen from outside (third person). */
function CarriedItem() {
  const id = useHome((s) => s.carrying)
  const def = PICKUPS.find((p) => p.id === id)
  if (!def) return null
  return (
    <group position={[0.16, 1.02, 0.42]}>
      <PickupMesh kind={def.kind} />
    </group>
  )
}

const fwd = new Vector3()
const right = new Vector3()
const up = new Vector3(0, 1, 0)

/** What you carry, seen from your own eyes: held low and to the right, following the view. */
function HeldItem() {
  const id = useHome((s) => s.carrying)
  const view = useHome((s) => s.view)
  const camera = useThree((s) => s.camera)
  const group = useRef<Group>(null)
  const def = PICKUPS.find((p) => p.id === id)

  useFrame(() => {
    const g = group.current
    if (!g) return
    camera.getWorldDirection(fwd)
    right.crossVectors(fwd, up).normalize()
    g.position.copy(camera.position).addScaledVector(fwd, 0.55).addScaledVector(right, 0.24).addScaledVector(up, -0.24)
    g.quaternion.copy(camera.quaternion)
  })

  if (!def || view !== 'first') return null
  return (
    <group ref={group}>
      <PickupMesh kind={def.kind} />
    </group>
  )
}

const facing = new Vector3()
const q = new Quaternion()
const eye = new Vector3()
const aim = new Vector3()

function CameraRig({ ecctrl, feet }: { ecctrl: RefObject<EcctrlHandle | null>; feet: RefObject<Group | null> }) {
  const controls = useRef<EcctrlCameraControlsHandle>(null)
  const phase = useHome((s) => s.phase)
  const view = useHome((s) => s.view)
  const screen = useHome((s) => s.screen)
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
    camera.fov = firstPerson ? (portrait ? 84 : 72) : portrait ? 68 : 50
    camera.near = firstPerson ? 0.05 : 0.1
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height, view, phase])

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
    const walking = playerState.grounded && playerState.speed > 0.3 && !state.screen
    b.amp = MathUtils.damp(b.amp, walking ? Math.min(playerState.speed / 2.3, 1.7) * 0.02 : 0, 8, dt)
    b.t += dt * Math.min(playerState.speed, 5) * 2.7
    camera.position.set(eye.x, eye.y + EYE_HEIGHT + Math.sin(b.t * 2) * b.amp, eye.z)
    camera.rotation.set(look.pitch, look.yaw, Math.sin(b.t) * b.amp * 0.35, 'YXZ')
    // priority -0.5: right after CameraControls (-1), which keeps writing its own pose, and before every
    // other system that reads the camera this frame (ceilings, held item, wall fade, interaction)
  }, -0.5)

  return (
    <EcctrlCameraControls
      ref={controls}
      makeDefault
      enabled={phase === 'playing' && view === 'third' && !screen}
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
  const view = useHome((s) => s.view)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
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

    if (!state.screen) handle.setMovement(keys)
    else handle.setMovement({ forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false })

    // on-screen controls (touch devices)
    if (matchMedia('(pointer: coarse)').matches && !state.screen) {
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
    if (state.screen) return
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
          {/* your own body is not drawn from inside it */}
          <group visible={view === 'third'}>
            <Avatar />
          </group>
          {view === 'third' && <CarriedItem />}
        </group>
      </Ecctrl>
      <HeldItem />
      <CameraRig ecctrl={ecctrl} feet={feet} />
      <LookInput />
    </>
  )
}
