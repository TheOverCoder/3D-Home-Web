import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import type { Group, Mesh } from 'three'
import { assets } from '../assets/registry'
import { batchStatic, type Batch } from '../lib/batch'
import { buildTrimesh } from '../lib/collision'
import { Ceilings } from './Ceilings'
import { Door } from './Door'
import { Dressing } from './Dressing'
import { Exterior } from './Exterior'
import { Floors } from './Floors'
import { Furnishings } from './Furnishings'
import { GardenDoor } from './GardenDoor'
import { Lamps } from './Lamps'
import { Walls } from './Walls'
import { useHome } from '../store'
import { farm, useFarm } from '../farm/state'
import '../home/actions' // the decorating actions (and their test hook)

/**
 * Merges the never-moving placeholder geometry into a few draws (see lib/batch). With `firstPersonOnly` the
 * original pieces come back in the third-person view, where walls must be able to fade individually. When `rev`
 * changes (a piece of furniture moved), the merge is made again from what is there now.
 */
export function StaticBatch({ children, firstPersonOnly = false, rev, off = false }: { children: ReactNode; firstPersonOnly?: boolean; rev?: string; off?: boolean }) {
  const group = useRef<Group>(null)
  const batch = useRef<Batch | null>(null)
  useEffect(() => {
    // `off`: nothing merged (decorating: each piece is drawn on its own, so one can be picked up and moved)
    const b = group.current && !off ? batchStatic(group.current) : null
    batch.current = b
    const merged = (s: { view: string; phase: string; decorating: boolean }) => s.view === 'first' && s.phase === 'playing' && !s.decorating
    if (b && firstPersonOnly) b.setMerged(merged(useHome.getState()))
    const unsub = firstPersonOnly
      ? useHome.subscribe((s, prev) => {
          if (merged(s) !== merged(prev)) b?.setMerged(merged(s))
        })
      : undefined
    return () => {
      unsub?.()
      b?.dispose()
      batch.current = null
    }
  }, [firstPersonOnly, rev, off])
  return <group ref={group}>{children}</group>
}

/** Physics-only geometry: a dedicated low-poly collision GLB, or the visual house itself. */
function HouseCollider({ url }: { url: string }) {
  const { scene } = useGLTF(url, false)
  const data = useMemo(() => buildTrimesh(scene), [scene])
  if (!data) {
    console.warn('[house] no collidable triangles found in', url)
    return null
  }
  return (
    <RigidBody type="fixed" colliders={false}>
      <TrimeshCollider args={[data.vertices, data.indices]} />
    </RigidBody>
  )
}

/** A real house model. */
function GltfHouse({ url, collisionUrl }: { url: string; collisionUrl?: string }) {
  const { scene } = useGLTF(url, false)
  const object = useMemo(() => scene.clone(true), [scene])
  useEffect(() => {
    object.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }, [object])
  return (
    <>
      <primitive object={object} />
      <HouseCollider url={collisionUrl ?? url} />
    </>
  )
}

export function House() {
  // where the furniture stands: the merged furniture is made again when it moves
  const home = useFarm(() => farm.home)
  const homeRev = useMemo(() => home.pieces.map((p) => `${p.id}:${p.x}:${p.z}:${p.rot}`).join('|'), [home])
  const decorating = useHome((s) => s.decorating)
  if (assets.house) {
    return (
      <>
        <GltfHouse url={assets.house} collisionUrl={assets.houseCollision} />
        <Exterior />
        <Lamps fixtures={false} />
      </>
    )
  }
  return (
    <>
      <Floors />
      <StaticBatch firstPersonOnly>
        <Walls />
      </StaticBatch>
      <Ceilings />
      <StaticBatch>
        <Exterior />
      </StaticBatch>
      <StaticBatch rev={homeRev} off={decorating}>
        <Furnishings />
        <Dressing />
      </StaticBatch>
      <Door />
      <GardenDoor />
      <Lamps />
    </>
  )
}
