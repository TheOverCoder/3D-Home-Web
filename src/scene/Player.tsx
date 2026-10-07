import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlAnimationStateController } from 'ecctrl/animation'
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from 'ecctrl/camera'
import { useButtonStore, useJoystickStore } from 'ecctrl/input'
import { CameraControlsImpl } from '@react-three/drei'
import { Quaternion, Vector3 } from 'three'
import { PICKUPS, SPAWN, roomAt } from '../data/layout'
import { debugSet } from '../lib/debug'
import { findNearest, triggerInteraction } from '../lib/interaction'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { Avatar } from './Avatar'
import { PickupMesh } from './Pickups'

const CAPSULE_HALF = 0.5
const CAPSULE_RADIUS = 0.28
const FLOAT = 0.12
// body-centre → feet: the capsule hovers FLOAT above the floor
const FEET = CAPSULE_HALF + CAPSULE_RADIUS + FLOAT

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

/** Keyboard listeners (WASD / arrows / Space / Shift, E, Esc). Ecctrl v2 has no built-in key handling. */
function useKeyboard() {
  useEffect(() => {
    const release = () => {
      held.clear()
      refreshKeys()
    }
    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const { phase, screen } = useHome.getState()
      if (e.code === 'Escape' && screen) {
        useHome.getState().closeScreen()
        return
      }
      if (phase !== 'playing' || screen) return
      if (e.code === 'KeyE') {
        if (!e.repeat) triggerInteraction()
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

const facing = new Vector3()
const q = new Quaternion()

function FollowCamera({ ecctrl }: { ecctrl: React.RefObject<EcctrlHandle | null> }) {
  const controls = useRef<EcctrlCameraControlsHandle>(null)
  const phase = useHome((s) => s.phase)
  const screen = useHome((s) => s.screen)
  const { ACTION } = CameraControlsImpl
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)

  // a narrow (portrait) window needs a wider vertical field of view to keep the same framing
  useEffect(() => {
    if ('fov' in camera) {
      camera.fov = size.width / size.height < 1 ? 68 : 50
      camera.updateProjectionMatrix()
    }
  }, [camera, size.width, size.height])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.setLookAt(SPAWN[0] + 2.6, SPAWN[1] + 4.2, SPAWN[2] + 4.0, SPAWN[0], SPAWN[1] - 0.4, SPAWN[2], false)
  }, [])

  useFrame((_, dt) => {
    const c = controls.current
    const p = ecctrl.current?.currPos
    if (!c || !p) return
    c.moveTo(p.x, p.y + 0.5, p.z, true)
    if (useHome.getState().phase === 'intro') c.rotate(dt * 0.18, 0, false)
  })

  return (
    <EcctrlCameraControls
      ref={controls}
      makeDefault
      enabled={phase === 'playing' && !screen}
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
  }, [])

  useFrame((_, dt) => {
    const handle = ecctrl.current
    if (!handle) return
    const pos = handle.currPos
    playerState.position.x = pos.x
    playerState.position.y = pos.y
    playerState.position.z = pos.z
    playerState.speed = handle.moveSpeed
    playerState.grounded = handle.isOnGround
    // face direction = body forward (+z in the body's frame)
    q.copy(handle.currQuat)
    facing.set(0, 0, 1).applyQuaternion(q).setY(0).normalize()
    playerState.facing.x = facing.x
    playerState.facing.z = facing.z

    const state = useHome.getState()
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
    const next = findNearest({ x: pos.x, y: pos.y + 0.1, z: pos.z })
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
        <group position={[0, -FEET, 0]}>
          <Avatar />
          <CarriedItem />
        </group>
      </Ecctrl>
      <FollowCamera ecctrl={ecctrl} />
    </>
  )
}
