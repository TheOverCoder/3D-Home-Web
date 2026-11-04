import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, MeshBasicMaterial, type Group } from 'three'
import { aimPointOf } from '../lib/interaction'
import { useHome } from '../store'

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A quiet focus cue on whatever E would act on: a thin ring with a soft centre that settles onto the thing's
 * aim point, keeps a constant size on screen and breathes very slightly. Drawn over everything (it often
 * sits inside a lamp shade or on a screen) but faint, so it reads as a glint rather than a UI sticker.
 */
export function AimMarker() {
  const group = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const state = useRef({ id: null as string | null, a: 0, grow: 0, x: 0, y: 0, z: 0, t: 0 })
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#fff3e2',
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const core = useMemo(() => material.clone(), [material])
  // a faint dark halo under the ring keeps it readable on a glowing lamp shade or a white wall
  const halo = useMemo(() => {
    const m = material.clone()
    m.color.set('#000000')
    return m
  }, [material])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const s = useHome.getState()
    const m = state.current
    const id = s.phase === 'playing' && !s.screen && !s.settingsOpen ? (s.nearby?.id ?? null) : null
    const p = id ? aimPointOf(id) : null
    if (p) {
      if (id !== m.id || m.a < 0.02) {
        // a new target: appear on it (no sliding across the room from the last one)
        m.x = p.x
        m.y = p.y
        m.z = p.z
        m.grow = 0
      } else {
        // follow it (a pushed mug keeps its ring)
        const k = 1 - Math.exp(-18 * dt)
        m.x += (p.x - m.x) * k
        m.y += (p.y - m.y) * k
        m.z += (p.z - m.z) * k
      }
      m.id = id
    }
    m.a = MathUtils.damp(m.a, p ? 1 : 0, p ? 9 : 14, dt)
    m.grow = MathUtils.damp(m.grow, p ? 1 : 0, 7, dt)
    m.t += dt
    g.visible = m.a > 0.01
    if (!g.visible) return
    g.position.set(m.x, m.y, m.z)
    g.quaternion.copy(camera.quaternion)
    const dist = camera.position.distanceTo(g.position)
    const breathe = reducedMotion ? 1 : 1 + 0.05 * Math.sin(m.t * 2.6)
    // ~1.3° across: constant on screen, settling in from a little larger
    g.scale.setScalar(Math.max(0.05, dist) * 0.023 * (1.35 - 0.35 * m.grow) * breathe)
    material.opacity = 0.62 * m.a
    core.opacity = 0.42 * m.a
    halo.opacity = 0.2 * m.a
  })

  return (
    <group ref={group} visible={false}>
      <mesh material={halo} renderOrder={19}>
        <ringGeometry args={[0.7, 1.12, 48]} />
      </mesh>
      <mesh material={material} renderOrder={20}>
        <ringGeometry args={[0.82, 1, 48]} />
      </mesh>
      <mesh material={core} renderOrder={20}>
        <circleGeometry args={[0.16, 24]} />
      </mesh>
    </group>
  )
}
