import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import type { Group, Mesh } from 'three'
import { assets } from '../assets/registry'
import { BatchContext, batchStatic, type BatchHandle } from '../lib/batch'
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
import { useDecorate } from '../home/decorate'
import type { HomeLayout, HomePiece } from '../home/layout'
import '../home/actions' // the decorating actions (and their test hook)

/**
 * Merges the never-moving placeholder geometry into a few draws (see lib/batch). A part inside (`userData.part`) can be
 * drawn on its own instead, as it is now: a wall while it fades (third person, decorating), a piece dragged or moved
 * while decorating (`exclude`). When `rev` changes (a piece of furniture moved), the merge is made again from what is
 * there now.
 */
export function StaticBatch({ children, rev, off = false, exclude }: { children: ReactNode; rev?: string; off?: boolean; exclude?: ReadonlySet<string> }) {
  const group = useRef<Group>(null)
  const handle = useMemo<BatchHandle>(() => ({ batch: null, exclude: NONE }), [])
  // the parts drawn on their own: before the frame is drawn (the piece dragged moves at once)
  useLayoutEffect(() => {
    if (!exclude) return
    handle.exclude = exclude
    handle.batch?.exclude(exclude)
  }, [exclude, handle])
  useEffect(() => {
    // `off`: nothing merged
    const b = group.current && !off ? batchStatic(group.current) : null
    handle.batch = b
    b?.exclude(handle.exclude)
    return () => {
      b?.dispose()
      handle.batch = null
    }
  }, [rev, off, handle])
  return (
    <BatchContext.Provider value={handle}>
      <group ref={group}>{children}</group>
    </BatchContext.Provider>
  )
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

const NONE: ReadonlySet<string> = new Set()
const placed = (p: HomePiece) => `${p.x}:${p.z}:${p.rot}`

/**
 * Where the furniture stands, for its merged meshes: made again when a piece moves. While decorating they stay as they
 * were when it began (no merging again at every move): the piece being dragged, and any moved, put away or bought
 * since, are drawn on their own instead (their own meshes, where they are now); all merged again when decorating ends.
 */
function useFurnitureBatch(home: HomeLayout, decorating: boolean) {
  const homeRev = useMemo(() => home.pieces.map((p) => `${p.id}:${placed(p)}`).join('|'), [home])
  const dragged = useDecorate((s) => (decorating ? (s.drag?.id ?? null) : null))
  // as merged: the rev, where each piece stood, and the pieces changed since (a changed piece is drawn afresh by React,
  // so it stays on its own even when it goes back)
  const [kept, setKept] = useState<{ rev: string; at: Map<string, string>; changed: Set<string> } | null>(null)
  if (decorating && !kept) setKept({ rev: homeRev, at: new Map(home.pieces.map((p) => [p.id, placed(p)])), changed: new Set() })
  if (!decorating && kept) setKept(null)
  const exclude = useMemo(() => {
    if (!kept) return NONE
    const now = new Map(home.pieces.map((p) => [p.id, placed(p)]))
    for (const [id, at] of kept.at) if (now.get(id) !== at) kept.changed.add(id)
    const out = new Set(kept.changed)
    if (dragged) out.add(dragged)
    return out
  }, [kept, dragged, home])
  return { rev: kept?.rev ?? homeRev, exclude }
}

export function House() {
  // where the furniture stands: the merged furniture is made again when it moves
  const home = useFarm(() => farm.home)
  const decorating = useHome((s) => s.decorating)
  const furniture = useFurnitureBatch(home, decorating)
  if (assets.house) {
    return (
      <>
        <GltfHouse url={assets.house} collisionUrl={assets.houseCollision} />
        <Exterior />
        <Lamps fixtures={false} />
      </>
    )
  }
  // what the drawing pass may leave out (src/lib/visibility): the shell — walls, floors, ceilings, doors — is always
  // drawn; the garden round the house is the outside, seen from indoors only through a window or the garden door; the
  // furniture and everything else in a room is drawn where its room can be seen
  return (
    <>
      <group userData={{ cell: 'always' }}>
        <Floors />
        <StaticBatch>
          <Walls />
        </StaticBatch>
        <Ceilings />
        <Door />
        <GardenDoor />
      </group>
      <group userData={{ cell: 'outside' }}>
        <StaticBatch>
          <Exterior />
        </StaticBatch>
      </group>
      <StaticBatch rev={furniture.rev} exclude={furniture.exclude}>
        <Furnishings />
        <Dressing />
      </StaticBatch>
      <Lamps />
    </>
  )
}
