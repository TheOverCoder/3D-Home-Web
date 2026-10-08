import { Suspense, useEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useEcctrlAnimationStore } from 'ecctrl/animation'
import { AnimationAction, Box3, LoopOnce, LoopRepeat, MathUtils, Mesh, Object3D, Vector2, Vector3, type Group } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { assets } from '../assets/registry'
import { PICKUPS } from '../data/layout'
import { CLIP_RULES, GESTURE_RULES, ONE_SHOT, pickClip } from '../lib/clips'
import { debugSet } from '../lib/debug'
import { onGesture } from '../lib/gestures'
import { useRig } from '../lib/rig'
import { surface } from '../lib/proceduralTextures'
import { useHome } from '../store'
import { Hand, SkinMaterial, type HandPose } from './Hand'
import { PickupMesh } from './Pickups'

export const AVATAR_HEIGHT = 1.75

// ─────────────────────── what you carry, in your hand ───────────────────────

/** Attaches the carried item to whichever avatar is active, so it is in your hand from inside and outside. */
export function HeldItem() {
  const id = useHome((s) => s.carrying)
  const hand = useRig((s) => s.rightHand)
  const def = PICKUPS.find((p) => p.id === id)
  if (!def || !hand) return null
  return createPortal(
    // the item rests on the palm (its thickness along the palm normal, −x for this hand) a little below the wrist
    <group position={[-0.05, -0.065, 0.004]} rotation={[0, 0.25, Math.PI / 2]}>
      <PickupMesh kind={def.kind} />
    </group>,
    hand,
  )
}

// ─────────────────────── placeholder person ───────────────────────

let fabricTex: ReturnType<typeof surface> | undefined
const fabricNormal = () => (fabricTex ??= surface('fabric', 7, 5)).normalMap

const SHIRT = '#4c6a82'
const TROUSERS = '#2b3038'
const SHOE = '#1d1b1a'
const HAIR = '#2b2017'

type Limb = { current: Group | null }

// radius / height pairs, swept around the vertical axis and then squashed front-to-back
const TORSO_LOW = [[0.001, 0], [0.15, 0], [0.147, 0.05], [0.137, 0.12], [0.132, 0.2], [0.142, 0.28], [0.157, 0.35], [0.163, 0.42]].map(([r, y]) => new Vector2(r, y))
const TORSO_HIGH = [[0.163, 0.42], [0.172, 0.47], [0.168, 0.52], [0.135, 0.555], [0.08, 0.575], [0.06, 0.585], [0.001, 0.585]].map(([r, y]) => new Vector2(r, y))
const TORSO_CAP = 0.42 // height where the lower and upper parts meet

/**
 * A jointed stand-in for the real character: hips, spine, shoulders, elbows, hips, knees, hands with
 * fingers and a face. Looking down in first person you see its torso, arms and feet; the head is hidden.
 */
function PlaceholderAvatar() {
  const root = useRef<Group>(null)
  const head = useRef<Group>(null)
  const spine = useRef<Group>(null)
  const torsoHigh = useRef<Mesh>(null)
  const torsoCap = useRef<Mesh>(null)
  const upperArmL = useRef<Mesh>(null)
  const upperArmR = useRef<Mesh>(null)
  const capL = useRef<Mesh>(null)
  const capR = useRef<Mesh>(null)
  const thighL = useRef<Group>(null)
  const thighR = useRef<Group>(null)
  const kneeL = useRef<Group>(null)
  const kneeR = useRef<Group>(null)
  const ankleL = useRef<Group>(null)
  const ankleR = useRef<Group>(null)
  const shoulderL = useRef<Group>(null)
  const shoulderR = useRef<Group>(null)
  const elbowL = useRef<Group>(null)
  const elbowR = useRef<Group>(null)
  const wristR = useRef<Group>(null)
  const phase = useRef(0)
  const gesture = useRef(0)
  const poseL = useRef<HandPose>({ curl: 0.3, point: 0 })
  const poseR = useRef<HandPose>({ curl: 0.3, point: 0 })
  const setRightHand = useRig((s) => s.setRightHand)
  const fabric = fabricNormal()

  useEffect(() => onGesture(() => (gesture.current = 1.0)), [])
  useEffect(() => {
    setRightHand(wristR.current)
    return () => setRightHand(null)
  }, [setRightHand])

  useFrame((_, dt) => {
    const state = useEcctrlAnimationStore.getState().animationState
    const moving = state === 'WALK' || state === 'RUN'
    const air = state.startsWith('JUMP')
    const run = state === 'RUN'
    const hold = useHome.getState().carrying !== null
    const view = useHome.getState().view
    const fp = view === 'first'
    const reachNow = gesture.current > 0
    // Seen from inside, parts that would sit right under or against the camera are left out: the head and
    // neck, the shoulders, and the right upper arm while it is raised (only the forearm and hand show).
    if (head.current) head.current.visible = !fp
    if (torsoHigh.current) torsoHigh.current.visible = !fp
    if (torsoCap.current) torsoCap.current.visible = fp
    if (capL.current) capL.current.visible = !fp
    if (capR.current) capR.current.visible = !fp
    if (upperArmR.current) upperArmR.current.visible = !(fp && (reachNow || hold))

    phase.current += dt * (run ? 11 : 7.2) * (moving ? 1 : 0)
    const amp = run ? 0.95 : moving ? 0.58 : 0
    const f = phase.current
    gesture.current = Math.max(0, gesture.current - dt)

    const damp = (g: Limb, axis: 'x' | 'y' | 'z', target: number, k = 14) => {
      if (g.current) g.current.rotation[axis] = MathUtils.damp(g.current.rotation[axis], target, k, dt)
    }

    // legs: opposite phases, the knee folds while the leg swings forward
    const swingL = Math.sin(f) * amp
    const swingR = -swingL
    damp(thighL, 'x', air ? -0.35 : -swingL * 0.9)
    damp(thighR, 'x', air ? 0.15 : -swingR * 0.9)
    damp(kneeL, 'x', air ? 0.9 : Math.max(0, Math.cos(f)) * 1.05 * amp + (moving ? 0.06 : 0.02))
    damp(kneeR, 'x', air ? 0.25 : Math.max(0, -Math.cos(f)) * 1.05 * amp + (moving ? 0.06 : 0.02))
    damp(ankleL, 'x', air ? 0.4 : swingL * 0.25)
    damp(ankleR, 'x', air ? 0.0 : swingR * 0.25)

    // arms: counter-swing, the right arm lifts to carry or reach
    const reach = gesture.current > 0
    damp(shoulderL, 'x', air ? -2.4 : swingR * 0.8 - 0.05)
    damp(shoulderL, 'z', 0.05 + (moving ? 0.03 : 0))
    damp(elbowL, 'x', air ? -0.5 : -0.2 - Math.max(0, -swingR) * (run ? 1.1 : 0.4))
    damp(shoulderR, 'x', reach ? -1.5 : hold ? -1.2 : air ? -2.4 : swingL * 0.8 - 0.05)
    damp(shoulderR, 'z', reach ? -0.05 : -0.05 - (moving ? 0.03 : 0))
    damp(elbowR, 'x', reach ? -0.2 : hold ? -0.85 : air ? -0.5 : -0.2 - Math.max(0, -swingL) * (run ? 1.1 : 0.4))
    damp(wristR, 'y', reach ? 0.5 : hold ? 1.45 : 0, 10) // turn the palm up to carry
    poseR.current.curl = reach ? 0.85 : hold ? 0.6 : 0.32
    poseR.current.point = reach ? 1 : 0
    poseL.current.curl = air ? 0.6 : moving && run ? 0.8 : 0.32

    // body: a little counter-rotation and bob while walking
    if (spine.current) {
      spine.current.rotation.y = MathUtils.damp(spine.current.rotation.y, moving ? -Math.sin(f) * 0.08 * amp : 0, 10, dt)
      spine.current.rotation.x = MathUtils.damp(spine.current.rotation.x, run ? -0.12 : 0, 8, dt)
    }
    if (root.current) root.current.position.y = moving ? Math.abs(Math.cos(f)) * 0.03 * amp : 0
  })

  const clothMaps = { normalMap: fabric, normalScale: [0.35, 0.35] as [number, number] }

  const leg = (side: 1 | -1, thigh: Limb, knee: Limb, ankle: Limb) => (
    <group ref={thigh as never} position={[side * 0.095, 0.93, 0]}>
      <mesh position={[0, -0.21, 0]} castShadow>
        <capsuleGeometry args={[0.078, 0.34, 6, 14]} />
        <meshStandardMaterial color={TROUSERS} roughness={0.85} {...clothMaps} />
      </mesh>
      <group ref={knee as never} position={[0, -0.44, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.062, 0.32, 6, 14]} />
          <meshStandardMaterial color={TROUSERS} roughness={0.85} {...clothMaps} />
        </mesh>
        <group ref={ankle as never} position={[0, -0.42, 0]}>
          <mesh position={[0, -0.03, 0.05]} castShadow>
            <boxGeometry args={[0.095, 0.075, 0.27]} />
            <meshStandardMaterial color={SHOE} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.072, 0.055]}>
            <boxGeometry args={[0.1, 0.02, 0.28]} />
            <meshStandardMaterial color="#cfc8bd" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  )

  const arm = (side: 1 | -1, shoulder: Limb, elbow: Limb, pose: React.RefObject<HandPose>, upper: React.RefObject<Mesh | null>, cap: React.RefObject<Mesh | null>, wrist?: Limb) => (
    <group ref={shoulder as never} position={[side * 0.205, 0.47, 0]}>
      <mesh ref={cap} position={[0, -0.01, 0]} castShadow>
        <sphereGeometry args={[0.058, 14, 12]} />
        <meshStandardMaterial color={SHIRT} roughness={0.85} {...clothMaps} />
      </mesh>
      <mesh ref={upper} position={[0, -0.14, 0]} castShadow>
        <capsuleGeometry args={[0.047, 0.17, 6, 14]} />
        <meshStandardMaterial color={SHIRT} roughness={0.85} {...clothMaps} />
      </mesh>
      <group ref={elbow as never} position={[0, -0.29, 0]}>
        <mesh position={[0, -0.13, 0]} castShadow>
          <capsuleGeometry args={[0.034, 0.2, 6, 14]} />
          <SkinMaterial />
        </mesh>
        <group ref={wrist as never} position={[0, -0.29, 0]}>
          <Hand side={side} pose={pose} />
        </group>
      </group>
    </group>
  )

  return (
    <group ref={root}>
      {leg(-1, thighL, kneeL, ankleL)}
      {leg(1, thighR, kneeR, ankleR)}
      {/* hips and waistband */}
      <mesh position={[0, 0.975, 0]} scale={[1.0, 0.62, 0.66]} castShadow>
        <sphereGeometry args={[0.165, 24, 16]} />
        <meshStandardMaterial color={TROUSERS} roughness={0.85} {...clothMaps} />
      </mesh>
      <mesh position={[0, 1.035, 0]} rotation-x={Math.PI / 2} scale={[1, 0.66, 1]}>
        <torusGeometry args={[0.152, 0.012, 8, 36]} />
        <meshStandardMaterial color="#3a2a1f" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.035, 0.1]}>
        <boxGeometry args={[0.035, 0.026, 0.01]} />
        <meshStandardMaterial color="#b9b4a8" roughness={0.3} metalness={0.8} />
      </mesh>

      <group ref={spine} position={[0, 1.02, 0]}>
        {/* torso: a waist, a chest and sloping shoulders; the upper part is hidden in first person */}
        <mesh scale={[1.1, 1, 0.66]} castShadow>
          <latheGeometry args={[TORSO_LOW, 32]} />
          <meshStandardMaterial color={SHIRT} roughness={0.85} {...clothMaps} />
        </mesh>
        <mesh ref={torsoCap} position={[0, TORSO_CAP, 0]} rotation-x={-Math.PI / 2} scale={[1.1, 0.66, 1]} visible={false}>
          <circleGeometry args={[0.163, 32]} />
          <meshStandardMaterial color={SHIRT} roughness={0.85} {...clothMaps} />
        </mesh>
        <mesh ref={torsoHigh} scale={[1.1, 1, 0.66]} castShadow>
          <latheGeometry args={[TORSO_HIGH, 32]} />
          <meshStandardMaterial color={SHIRT} roughness={0.85} {...clothMaps} />
        </mesh>
        {arm(1, shoulderL, elbowL, poseL, upperArmL, capL)}
        {arm(-1, shoulderR, elbowR, poseR, upperArmR, capR, wristR)}

        <group ref={head} position={[0, 0.54, 0]}>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.048, 0.056, 0.1, 14]} />
            <SkinMaterial />
          </mesh>
          <group position={[0, 0.13, 0.005]}>
            <mesh scale={[0.92, 1.1, 1]} castShadow>
              <sphereGeometry args={[0.105, 24, 18]} />
              <SkinMaterial />
            </mesh>
            <mesh position={[0, 0.035, -0.012]} castShadow>
              <sphereGeometry args={[0.112, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
              <meshStandardMaterial color={HAIR} roughness={0.9} />
            </mesh>
            {([-1, 1] as const).map((s) => (
              <group key={s}>
                <mesh position={[s * 0.04, 0.012, 0.092]}>
                  <sphereGeometry args={[0.0135, 12, 10]} />
                  <meshStandardMaterial color="#f4f0ea" roughness={0.25} />
                </mesh>
                <mesh position={[s * 0.04, 0.012, 0.104]}>
                  <sphereGeometry args={[0.0075, 10, 8]} />
                  <meshStandardMaterial color="#3a2a1d" roughness={0.2} />
                </mesh>
                <mesh position={[s * 0.04, 0.04, 0.097]} rotation={[0, 0, -s * 0.12]}>
                  <boxGeometry args={[0.04, 0.007, 0.012]} />
                  <meshStandardMaterial color={HAIR} roughness={0.9} />
                </mesh>
                <mesh position={[s * 0.1, -0.005, 0]} scale={[0.4, 1, 0.8]}>
                  <sphereGeometry args={[0.024, 10, 8]} />
                  <SkinMaterial />
                </mesh>
              </group>
            ))}
            <mesh position={[0, -0.012, 0.102]} scale={[0.9, 1.2, 1]}>
              <sphereGeometry args={[0.016, 10, 8]} />
              <SkinMaterial />
            </mesh>
            <mesh position={[0, -0.056, 0.093]}>
              <boxGeometry args={[0.04, 0.005, 0.01]} />
              <meshStandardMaterial color="#8a4e48" roughness={0.5} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

// ─────────────────────── glTF character + animation library ───────────────────────

const HAND_R = /(^|[_.:\s-])(r|right)[_.\s-]*hand$|hand[_.\s-]*(r|right)$|^righthand$|mixamorig:?righthand$/i
const HEAD = /(^|[_.:\s-])head$|^head$|mixamorig:?head$/i

function findBone(root: Object3D, pattern: RegExp): Object3D | null {
  let found: Object3D | null = null
  root.traverse((o) => {
    if (!found && (o as { isBone?: boolean }).isBone && pattern.test(o.name)) found = o
  })
  return found
}

function GltfAvatar({ characterUrl, animationsUrl }: { characterUrl: string; animationsUrl?: string }) {
  const character = useGLTF(characterUrl, false)
  // clips may live in the character file itself or in a separate library on the same rig
  const library = useGLTF(animationsUrl ?? characterUrl, false)
  const group = useRef<Group>(null)
  const setRightHand = useRig((s) => s.setRightHand)

  const rig = useMemo(() => {
    const root = cloneSkinned(character.scene)
    root.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        o.frustumCulled = false
      }
    })
    // Skinned bounds depend on the bones' world matrices, so refresh them before every measurement.
    const measure = () => {
      root.updateMatrixWorld(true)
      return new Box3().setFromObject(root, true)
    }
    const size = measure().getSize(new Vector3())
    root.scale.setScalar(AVATAR_HEIGHT / (size.y || 1))
    const fitted = measure()
    root.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2)
    const final = measure()
    debugSet('avatarBox', [final.min.y, final.max.y])
    return root
  }, [character.scene])

  const headBone = useMemo(() => findBone(rig, HEAD), [rig])
  useEffect(() => {
    setRightHand(findBone(rig, HAND_R))
    return () => setRightHand(null)
  }, [rig, setRightHand])

  // first person: collapse the head so the camera is never inside it (re-applied after the mixer each frame)
  useFrame(() => {
    if (headBone) headBone.scale.setScalar(useHome.getState().view === 'first' ? 0.0001 : 1)
  })

  const { actions, names, mixer } = useAnimations(library.animations, group)
  const state = useEcctrlAnimationStore((s) => s.animationState)
  const current = useRef<AnimationAction | null>(null)
  const gestureBusy = useRef(false)

  useEffect(() => {
    const name = pickClip(names, CLIP_RULES[state]) ?? pickClip(names, CLIP_RULES.IDLE)
    const action = name ? actions[name] : undefined
    if (!action) return
    const once = ONE_SHOT.has(state)
    action.reset().setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity)
    action.clampWhenFinished = once
    action.fadeIn(0.18).play()
    current.current = action
    debugSet('avatarClip', action.getClip().name)
    return () => {
      action.fadeOut(0.18)
    }
  }, [actions, names, state])

  useEffect(
    () =>
      onGesture((gesture) => {
        const name = pickClip(names, GESTURE_RULES[gesture])
        const action = name ? actions[name] : undefined
        if (!action || gestureBusy.current) return
        gestureBusy.current = true
        current.current?.fadeOut(0.12)
        action.reset().setLoop(LoopOnce, 1)
        action.clampWhenFinished = true
        action.fadeIn(0.12).play()
        const done = (e: { action: AnimationAction }) => {
          if (e.action !== action) return
          mixer.removeEventListener('finished', done)
          action.fadeOut(0.2)
          current.current?.reset().fadeIn(0.2).play()
          gestureBusy.current = false
        }
        mixer.addEventListener('finished', done)
      }),
    [actions, names, mixer],
  )

  return (
    <group ref={group}>
      <primitive object={rig} />
    </group>
  )
}

export function Avatar() {
  if (!assets.character) return <PlaceholderAvatar />
  return (
    <Suspense fallback={<PlaceholderAvatar />}>
      <GltfAvatar characterUrl={assets.character} animationsUrl={assets.animations} />
    </Suspense>
  )
}
