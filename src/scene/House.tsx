import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import type { Mesh } from 'three'
import { assets } from '../assets/registry'
import { buildTrimesh } from '../lib/collision'
import { Door } from './Door'
import { Floors } from './Floors'
import { Furnishings } from './Furnishings'
import { Lamps } from './Lamps'
import { Walls } from './Walls'

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
  if (assets.house) {
    return (
      <>
        <GltfHouse url={assets.house} collisionUrl={assets.houseCollision} />
        <Lamps fixtures={false} />
      </>
    )
  }
  return (
    <>
      <Floors />
      <Walls />
      <Furnishings />
      <Door />
      <Lamps />
    </>
  )
}
