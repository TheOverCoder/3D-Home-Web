import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useEcctrlAnimationStore } from 'ecctrl/animation'
import { AnimationAction, Box3, LoopOnce, LoopRepeat, MathUtils, Mesh, Vector3, type Group } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { assets } from '../assets/registry'
import { CLIP_RULES, GESTURE_RULES, ONE_SHOT, pickClip } from '../lib/clips'
import { debugSet } from '../lib/debug'
import { onGesture } from '../lib/gestures'

export const AVATAR_HEIGHT = 1.75

// ─────────────────────── placeholder mannequin ───────────────────────

function PlaceholderAvatar() {
  const root = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const phase = useRef(0)
  const gesture = useRef(0)

  useEffect(() => onGesture(() => (gesture.current = 0.9)), [])

  useFrame((_, dt) => {
    const state = useEcctrlAnimationStore.getState().animationState
    const moving = state === 'WALK' || state === 'RUN'
    const air = state.startsWith('JUMP')
    phase.current += dt * (state === 'RUN' ? 11 : 7) * (moving ? 1 : 0)
    const amp = state === 'RUN' ? 0.95 : moving ? 0.6 : 0
    const swing = Math.sin(phase.current) * amp
    gesture.current = Math.max(0, gesture.current - dt)
    const k = 14
    const set = (g: Group | null, target: number) => {
      if (g) g.rotation.x = MathUtils.damp(g.rotation.x, target, k, dt)
    }
    set(armL.current, air ? -2.5 : swing)
    set(armR.current, gesture.current > 0 ? -1.7 : air ? -2.5 : -swing)
    set(legL.current, air ? 0.5 : -swing * 0.9)
    set(legR.current, air ? -0.2 : swing * 0.9)
    if (root.current) root.current.position.y = moving ? Math.abs(Math.cos(phase.current)) * 0.035 : 0
  })

  const outfit = '#3b4a5a'
  const skin = '#dfb899'
  return (
    <group ref={root}>
      {/* legs: pivots at the hip */}
      {([[legL, -0.1], [legR, 0.1]] as const).map(([ref, x]) => (
        <group key={x} ref={ref} position={[x, 0.9, 0]}>
          <mesh position={[0, -0.42, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.68, 6, 12]} />
            <meshStandardMaterial color="#2c3440" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.84, 0.05]} castShadow>
            <boxGeometry args={[0.12, 0.08, 0.26]} />
            <meshStandardMaterial color="#1b1d20" roughness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.96, 0]} castShadow>
        <boxGeometry args={[0.32, 0.18, 0.2]} />
        <meshStandardMaterial color="#2c3440" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.27, 0]} scale={[1, 1, 0.72]} castShadow>
        <capsuleGeometry args={[0.17, 0.42, 8, 16]} />
        <meshStandardMaterial color={outfit} roughness={0.85} />
      </mesh>
      {/* arms: pivots at the shoulder */}
      {([[armL, -0.24], [armR, 0.24]] as const).map(([ref, x]) => (
        <group key={x} ref={ref} position={[x, 1.47, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.048, 0.5, 6, 10]} />
            <meshStandardMaterial color={outfit} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.62, 0]} castShadow>
            <sphereGeometry args={[0.052, 12, 10]} />
            <meshStandardMaterial color={skin} roughness={0.7} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.1, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.115, 20, 16]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.69, -0.01]} castShadow>
        <sphereGeometry args={[0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color="#2a2118" roughness={0.9} />
      </mesh>
      {/* visor so the facing direction is readable */}
      <mesh position={[0, 1.66, 0.095]}>
        <boxGeometry args={[0.15, 0.035, 0.05]} />
        <meshStandardMaterial color="#14171b" roughness={0.3} />
      </mesh>
    </group>
  )
}

// ─────────────────────── glTF character + animation library ───────────────────────

function GltfAvatar({ characterUrl, animationsUrl }: { characterUrl: string; animationsUrl?: string }) {
  const character = useGLTF(characterUrl, false)
  // clips may live in the character file itself or in a separate library on the same rig
  const library = useGLTF(animationsUrl ?? characterUrl, false)
  const group = useRef<Group>(null)

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
