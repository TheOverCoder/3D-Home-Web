import { useContext, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Box3, BoxGeometry, DoubleSide, MathUtils, Ray, Vector3, type Group, type MeshStandardMaterial, type Object3D } from 'three'
import { HOUSE, type Vec3 } from '../data/layout'
import { boxProject } from '../lib/boxProject'
import { surface } from '../lib/proceduralTextures'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { decorateEye, decorateFocus } from '../home/decorate'
import { BatchContext } from '../lib/batch'
import { setWalls, type WallPiece } from '../lib/visibility/walls'
import { TRIM, wallSegments, type HomeShell, type Seg, type SegKind } from '../home/shell'

/** A curtain panel: a box whose faces ripple into soft vertical folds. */
function pleatedBox(size: Vec3, axis: 'x' | 'z'): BoxGeometry {
  const long = axis === 'x' ? size[0] : size[2]
  const folds = Math.max(2, Math.round(long / 0.09))
  const g = new BoxGeometry(size[0], size[1], size[2], axis === 'x' ? folds * 4 : 1, 1, axis === 'z' ? folds * 4 : 1)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const along = axis === 'x' ? pos.getX(i) : pos.getZ(i)
    const wave = Math.sin((along / long) * folds * Math.PI * 2) * 0.016
    if (axis === 'x') pos.setZ(i, pos.getZ(i) + wave * Math.sign(pos.getZ(i) || 1))
    else pos.setX(i, pos.getX(i) + wave * Math.sign(pos.getX(i) || 1))
  }
  g.computeVertexNormals()
  return g
}

const { wallThickness: T } = HOUSE

/** A wall piece's two faces, each half its thickness and in its own room's paint: their offsets across the wall. */
const halves = (s: Seg): [Vec3, Vec3, Vec3][] => {
  const [x, y, z] = s.size
  const half: Vec3 = s.axis === 'x' ? [x, y, z / 2] : [x / 2, y, z]
  const off = (k: number): Vec3 => (s.axis === 'x' ? [0, 0, (k * z) / 4] : [(k * x) / 4, 0, 0])
  return [
    [half, off(-1), [s.center[0] + off(-1)[0], s.center[1], s.center[2] + off(-1)[2]]],
    [half, off(1), [s.center[0] + off(1)[0], s.center[1], s.center[2] + off(1)[2]]],
  ]
}

const ray = new Ray()
const tmp = new Vector3()
const point = new Vector3()
const eyePoint = new Vector3()
// feet, hips, head — a wall that hides any of them fades
const SAMPLE_HEIGHTS = [-0.7, 0, 0.7]
const NONE: [number, number, number][] = []
const bodySamples = () => SAMPLE_HEIGHTS.map((dy): [number, number, number] => [playerState.position.x, playerState.position.y + dy, playerState.position.z])
/** Decorating: the floor round the middle of the view, a little above it (a wall that hides any of it fades). */
const floorSamples = (x: number, z: number) => {
  const out: [number, number, number][] = []
  for (const dx of [-2.2, 0, 2.2])
    for (const dz of [-2, 0, 2]) out.push([Math.min(HOUSE.maxX - 0.3, Math.max(HOUSE.minX + 0.3, x + dx)), 0.6, Math.min(HOUSE.maxZ - 0.3, Math.max(HOUSE.minZ + 0.3, z + dz))])
  return out
}

const BASE_OPACITY: Partial<Record<SegKind, number>> = { glass: 0.16 }

/** Walls, window frames, curtains, trim, colliders, built from the house's shell as the save has it (src/home/shell.ts:
 *  its openings, each room's paint on its own side of each wall). Pieces between the camera and the player fade out.
 *  (House.tsx mounts it again, and merges it again, whenever the shell changes.) */
export function Walls({ shell }: { shell: HomeShell }) {
  const segs = useMemo(() => wallSegments(shell), [shell])
  const plaster = useMemo(() => surface('plaster', 1, 1), [])
  const textures = useMemo(() => segs.map((s) => (s.kind === 'fabric' ? surface('fabric', 3, 6) : plaster)), [segs, plaster])
  // walls share one plaster texture set; their UVs are projected in metres (one tile = 2.2 m), which is what lets
  // identical walls merge into a single draw in first person
  const geometries = useMemo(() => segs.map((s) => (s.kind === 'fabric' ? pleatedBox(s.size, s.axis) : null)), [segs])
  // a wall is two halves, one per face, each in its room's paint (the plaster's UVs projected in metres as one)
  const faces = useMemo(
    () => segs.map((s) => (s.kind === 'wall' ? halves(s).map(([size, , at]) => boxProject(new BoxGeometry(size[0], size[1], size[2]), 2.2, at[0] * 0.73 + at[2] * 1.31)) : null)),
    [segs],
  )
  // built again whenever an opening moves or a room is painted: what this build made goes with it
  useEffect(
    () => () => {
      for (const g of geometries) g?.dispose()
      for (const f of faces) f?.forEach((g) => g.dispose())
      for (const t of textures) if (t !== plaster) [t.map, t.normalMap, t.roughnessMap].forEach((x) => x.dispose())
    },
    [geometries, faces, textures, plaster],
  )
  const mats = useRef<(MeshStandardMaterial | null)[][]>(segs.map(() => []))
  const boxes = useMemo(() => segs.map((s) => new Box3().setFromCenterAndSize(new Vector3(...s.center), new Vector3(...s.size)).expandByScalar(0.02)), [segs])
  const fade = useRef<number[]>(segs.map(() => 1))
  const settled = useRef(false)
  const camera = useThree((s) => s.camera)
  // the walls are merged (House.tsx); one that fades is drawn on its own while it does, in the frame it starts
  const batch = useContext(BatchContext)
  const alone = useRef(new Set<string>())
  const root = useRef<Group>(null)

  // the wall pieces hide what lies wholly behind them (src/lib/visibility/walls.ts), while opaque: a wall fading is
  // drawn on its own, see-through, and hides nothing
  useEffect(() => {
    const index: number[] = []
    const pieces: WallPiece[] = []
    segs.forEach((s, i) => {
      if (s.kind !== 'wall') return
      const [cx, cy, cz] = s.center
      const [sx, sy, sz] = s.size
      const onX = s.axis === 'x'
      index.push(i)
      pieces.push({
        axis: s.axis,
        at: onX ? cz : cx,
        a: onX ? cx - sx / 2 : cz - sz / 2,
        b: onX ? cx + sx / 2 : cz + sz / 2,
        y0: cy - sy / 2,
        y1: cy + sy / 2,
        box: [cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2],
      })
    })
    const shown = () => {
      for (let o: Object3D | null = root.current; o; o = o.parent) if (!o.visible) return false
      return root.current !== null
    }
    return setWalls({ pieces, opaque: (k) => fade.current[index[k]] >= 0.995, drawn: shown })
  }, [segs])

  useFrame((_, dt) => {
    const state = useHome.getState()
    const decorating = state.decorating
    const inside = state.view === 'first' && state.phase === 'playing' && !decorating
    // in first person nothing ever fades, so once every wall is fully back there is nothing left to do
    if (inside && settled.current) return
    settled.current = false
    let allBack = true
    let regroup = false
    // decorating, the camera that matters is the decorate view's (it moves after this runs)
    const eyeAt = decorating ? eyePoint.set(decorateEye.x, decorateEye.y, decorateEye.z) : camera.position
    ray.origin.copy(eyeAt)
    // what must stay in view: you (feet, hips, head), or, decorating, the floor round the middle of the view
    const samples = inside ? NONE : decorating ? floorSamples(decorateFocus.x, decorateFocus.z) : bodySamples()
    for (let i = 0; i < segs.length; i++) {
      let blocked = false
      for (const s of samples) {
        point.set(s[0], s[1], s[2])
        const length = eyeAt.distanceTo(point)
        ray.direction.copy(point).sub(eyeAt).normalize()
        const hit = ray.intersectBox(boxes[i], tmp)
        if (hit !== null && tmp.distanceTo(eyeAt) < length - 0.05) {
          blocked = true
          break
        }
      }
      fade.current[i] = MathUtils.damp(fade.current[i], blocked ? 0.06 : 1, 10, dt)
      if (fade.current[i] < 0.999) allBack = false
      const o = fade.current[i] * (BASE_OPACITY[segs[i].kind] ?? 1)
      const transparent = segs[i].kind === 'glass' || fade.current[i] < 0.995
      if (segs[i].kind !== 'glass' && transparent !== alone.current.has(segs[i].key)) {
        if (transparent) alone.current.add(segs[i].key)
        else alone.current.delete(segs[i].key)
        regroup = true
      }
      for (const mat of mats.current[i]) {
        if (!mat) continue
        mat.opacity = o
        if (mat.transparent !== transparent) {
          mat.transparent = transparent
          mat.depthWrite = !transparent
          mat.needsUpdate = true
        }
      }
    }
    settled.current = inside && allBack
    if (regroup && batch) {
      batch.exclude = new Set(alone.current)
      batch.batch?.exclude(batch.exclude)
    }
  })

  return (
    <group ref={root}>
      {segs.map((s, i) => {
        const tex = textures[i]
        const onX = s.axis === 'x'
        const len = onX ? s.size[0] : s.size[2]
        const trimDepth = T + 0.04
        return (
          <group key={s.key} position={s.center} userData={{ part: s.key }}>
            {s.kind === 'wall' &&
              halves(s).map(([, off], k) => (
                <mesh key={k} position={off} castShadow receiveShadow geometry={faces[i]![k]}>
                  <meshStandardMaterial
                    ref={(m) => {
                      mats.current[i][k === 0 ? 0 : 3] = m
                    }}
                    color={s.faces![k]}
                    map={tex.map}
                    normalMap={tex.normalMap}
                    normalScale={[0.5, 0.5]}
                    roughnessMap={tex.roughnessMap}
                    roughness={1}
                  />
                </mesh>
              ))}
            {s.kind !== 'wall' && (
              <mesh castShadow={s.kind !== 'glass'} receiveShadow={s.kind !== 'glass'} geometry={geometries[i] ?? undefined}>
                {!geometries[i] && <boxGeometry args={s.size} />}
                {s.kind === 'glass' ? (
                  <meshStandardMaterial
                    ref={(m) => {
                      mats.current[i][0] = m
                    }}
                    color={s.color}
                    roughness={0.04}
                    metalness={0}
                    envMapIntensity={1.6}
                    transparent
                    depthWrite={false}
                    side={DoubleSide}
                  />
                ) : (
                  <meshStandardMaterial
                    ref={(m) => {
                      mats.current[i][0] = m
                    }}
                    color={s.color}
                    map={s.kind === 'fabric' ? tex.map : null}
                    normalMap={s.kind === 'fabric' ? tex.normalMap : null}
                    normalScale={s.kind === 'fabric' ? [0.9, 0.9] : [0.5, 0.5]}
                    roughnessMap={s.kind === 'fabric' ? tex.roughnessMap : null}
                    roughness={s.kind === 'trim' ? 0.35 : s.kind === 'dark' ? 0.4 : 1}
                    metalness={s.kind === 'dark' ? 0.6 : 0}
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                  />
                )}
              </mesh>
            )}
            {s.kind === 'wall' && (s.bottom || s.top) && (
              <>
                {s.bottom && (
                  <mesh position={[0, -s.size[1] / 2 + 0.055, 0]} receiveShadow>
                    <boxGeometry args={onX ? [len, 0.11, trimDepth] : [trimDepth, 0.11, len]} />
                    <meshStandardMaterial
                      ref={(m) => {
                        mats.current[i][1] = m
                      }}
                      color={TRIM}
                      roughness={0.35}
                      polygonOffset
                      polygonOffsetFactor={-1}
                      polygonOffsetUnits={-1}
                    />
                  </mesh>
                )}
                {s.top && (
                  <mesh position={[0, s.size[1] / 2 - 0.039, 0]} receiveShadow>
                    <boxGeometry args={onX ? [len, 0.07, trimDepth + 0.03] : [trimDepth + 0.03, 0.07, len]} />
                    <meshStandardMaterial
                      ref={(m) => {
                        mats.current[i][2] = m
                      }}
                      color={TRIM}
                      roughness={0.35}
                      polygonOffset
                      polygonOffsetFactor={-1}
                      polygonOffsetUnits={-1}
                    />
                  </mesh>
                )}
              </>
            )}
          </group>
        )
      })}
      <RigidBody type="fixed" colliders={false}>
        {segs
          .filter((s) => s.solid)
          .map((s) => (
            <CuboidCollider key={s.key} args={[s.size[0] / 2, s.size[1] / 2, s.size[2] / 2]} position={s.center} />
          ))}
      </RigidBody>
    </group>
  )
}
