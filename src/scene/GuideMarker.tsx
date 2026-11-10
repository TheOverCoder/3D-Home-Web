import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ConeGeometry, MeshBasicMaterial, type Group } from 'three'
import { aimPointOf } from '../lib/interaction'
import { useHome } from '../store'

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Where a mark tapped on the compass is: a warm arrow pointing down at it from above, the same size on screen near
 * or far and drawn over everything (it is often behind a hedge or the coop), bobbing gently. It goes once you are
 * there (the button offers it) or after a while.
 */
export function GuideMarker() {
  const group = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const fade = useRef(0)
  const geometry = useMemo(() => new ConeGeometry(0.5, 1, 18).rotateX(Math.PI), [])
  const material = useMemo(() => new MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }), [])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const guide = useHome.getState().guide
    const p = guide ? aimPointOf(guide.id) : null
    fade.current += ((p ? 1 : 0) - fade.current) * (1 - Math.exp(-dt * 8))
    material.opacity = 0.9 * fade.current
    g.visible = fade.current > 0.02
    if (!p) return
    const d = camera.position.distanceTo(g.position)
    const size = Math.max(0.14, d * 0.045)
    const bob = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 4) * size * 0.35
    g.position.set(p.x, p.y + 0.45 + size * 1.2 + bob, p.z)
    g.scale.setScalar(size)
  })

  return (
    <group ref={group} visible={false} renderOrder={999}>
      <mesh geometry={geometry} material={material} renderOrder={999} />
    </group>
  )
}
