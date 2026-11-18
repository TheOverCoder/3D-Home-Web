import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ConeGeometry, MeshBasicMaterial, type Group } from 'three'
import { lineFor } from '../farm/firstSteps'
import { farm, stepNow } from '../farm/state'
import { walkTarget } from '../farm/walkTargets'
import { aimPointOf } from '../lib/interaction'
import { useHome } from '../store'
import { lessMotion } from '../ui/still'

/** How often the step's target is looked for again (s): where a step walks you changes only as the farm does. */
const STEP_EVERY = 0.3

/**
 * Where a mark tapped on the compass is: a warm arrow pointing down at it from above, the same size on screen near
 * or far and drawn over everything (it is often behind a hedge or the coop), bobbing gently. It goes once you are
 * there (the button offers it) or after a while. With no mark tapped, while a new farm's step runs (src/farm/FirstSteps.tsx),
 * it stands over what the step asks for — where a tap on the farmer's bubble walks you — from the first second, and
 * goes while the button offers it (within reach).
 */
export function GuideMarker() {
  const group = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const fade = useRef(0)
  // the step's target, looked for a few times a second
  const step = useRef<{ id: string | null; t: number }>({ id: null, t: 0 })
  const geometry = useMemo(() => new ConeGeometry(0.5, 1, 18).rotateX(Math.PI), [])
  const material = useMemo(() => new MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }), [])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const s = useHome.getState()
    const guide = s.guide
    step.current.t -= dt
    if (step.current.t <= 0) {
      step.current.t = STEP_EVERY
      const now = !guide && s.map === 'farm' && s.phase === 'playing' ? stepNow() : null
      step.current.id = now ? walkTarget(lineFor(now, farm).target) : null
    }
    const stepId = step.current.id
    const id = guide?.id ?? (stepId && !s.actions.some((a) => a.id === stepId) ? stepId : null)
    const p = id ? aimPointOf(id) : null
    fade.current += ((p ? 1 : 0) - fade.current) * (1 - Math.exp(-dt * 8))
    material.opacity = 0.9 * fade.current
    g.visible = fade.current > 0.02
    if (!p) return
    const d = camera.position.distanceTo(g.position)
    const size = Math.max(0.14, d * 0.045)
    const bob = lessMotion() ? 0 : Math.sin(state.clock.elapsedTime * 4) * size * 0.35
    g.position.set(p.x, p.y + 0.45 + size * 1.2 + bob, p.z)
    g.scale.setScalar(size)
  })

  return (
    <group name="guide-marker" ref={group} visible={false} renderOrder={999}>
      <mesh geometry={geometry} material={material} renderOrder={999} />
    </group>
  )
}
