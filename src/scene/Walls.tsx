import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Box3, BoxGeometry, DoubleSide, MathUtils, Ray, Vector3, type MeshStandardMaterial } from 'three'
import { DOORWAYS, HOUSE, ROOMS, WINDOWS, type Vec3, type WindowDef } from '../data/layout'
import { boxProject } from '../lib/boxProject'
import { surface } from '../lib/proceduralTextures'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'

type Kind = 'wall' | 'trim' | 'glass' | 'fabric' | 'dark'

interface Seg {
  key: string
  center: Vec3
  size: Vec3
  color: string
  kind: Kind
  axis: 'x' | 'z' // direction the piece runs along
  solid: boolean // gets a collider
  bottom?: boolean // wall piece that touches the floor → baseboard
  top?: boolean // wall piece that touches the ceiling → crown moulding
}

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

const INTERIOR = '#d6d2ca'
const TRIM = '#f4f2ee'
const { wallHeight: H, wallThickness: T, doorHeight: DH } = HOUSE

interface Gap {
  centre: number
  width: number
  y0?: number // bottom of the opening (windows); default floor
  y1?: number // top of the opening; default door height
}

/** A straight wall run, cut by openings. Pieces above/below an opening are generated too. */
function run(axis: 'x' | 'z', at: number, from: number, to: number, gaps: Gap[], color: string, tag: string): Seg[] {
  const out: Seg[] = []
  const add = (a: number, b: number, y0: number, y1: number, solid: boolean, suffix: string) => {
    const len = b - a
    if (len < 1e-3) return
    const mid = (a + b) / 2
    const cy = (y0 + y1) / 2
    const hh = y1 - y0
    out.push({
      key: `${tag}-${suffix}`,
      center: axis === 'x' ? [mid, cy, at] : [at, cy, mid],
      size: axis === 'x' ? [len, hh, T] : [T, hh, len],
      color,
      kind: 'wall',
      axis,
      solid,
      bottom: y0 === 0,
      top: y1 === H,
    })
  }
  let cursor = from
  gaps
    .filter((g) => g.centre - g.width / 2 >= from - 1e-6 && g.centre + g.width / 2 <= to + 1e-6)
    .sort((a, b) => a.centre - b.centre)
    .forEach((g, i) => {
      const a = g.centre - g.width / 2
      const b = g.centre + g.width / 2
      const y0 = g.y0 ?? 0
      const y1 = g.y1 ?? DH
      add(cursor, a, 0, H, true, `wall${i}`)
      if (y0 > 0) add(a, b, 0, y0, true, `sill${i}`)
      add(a, b, y1, H, false, `lintel${i}`)
      cursor = b
    })
  add(cursor, to, 0, H, true, 'end')
  return out
}

/** A box placed relative to a wall: `along` the wall, `off` out of it (towards +normal), world y. */
function piece(
  axis: 'x' | 'z',
  at: number,
  along: number,
  y: number,
  off: number,
  len: number,
  height: number,
  depth: number,
  rest: Pick<Seg, 'key' | 'color' | 'kind' | 'solid'>,
): Seg {
  return {
    ...rest,
    axis,
    center: axis === 'x' ? [along, y, at + off] : [at + off, y, along],
    size: axis === 'x' ? [len, height, depth] : [depth, height, len],
  }
}

function doorFrame(d: (typeof DOORWAYS)[keyof typeof DOORWAYS], tag: string): Seg[] {
  const depth = T + 0.05
  const jamb = 0.07
  const rest = (k: string) => ({ key: `${tag}-${k}`, color: TRIM, kind: 'trim' as const, solid: false })
  const lo = d.centre - d.width / 2
  const hi = d.centre + d.width / 2
  // Inside the opening: their outer faces touch the wall back-to-back (never coplanar, same direction),
  // and they stand proud of both wall faces by the extra depth.
  return [
    piece(d.axis, d.at, lo + jamb / 2, (DH - jamb) / 2, 0, jamb, DH - jamb, depth, rest('l')),
    piece(d.axis, d.at, hi - jamb / 2, (DH - jamb) / 2, 0, jamb, DH - jamb, depth, rest('r')),
    piece(d.axis, d.at, d.centre, DH - jamb / 2, 0, d.width, jamb, depth, rest('h')),
  ]
}

function windowPieces(w: WindowDef): Seg[] {
  const n = w.at > 0 ? -1 : 1 // towards the inside of the house
  const h = w.top - w.sill
  const mid = (w.sill + w.top) / 2
  const bar = 0.05
  const depth = T + 0.04
  const r = (k: string, kind: Kind, solid = false, color = TRIM) => ({ key: `${w.id}-${k}`, color, kind, solid })
  const lo = w.centre - w.width / 2
  const hi = w.centre + w.width / 2
  const P = (k: string, along: number, y: number, off: number, len: number, height: number, d: number, kind: Kind, solid = false, color = TRIM) =>
    piece(w.axis, w.at, along, y, off, len, height, d, r(k, kind, solid, color))
  return [
    P('fl', lo + bar / 2, mid, 0, bar, h, depth, 'trim'),
    P('fr', hi - bar / 2, mid, 0, bar, h, depth, 'trim'),
    P('ft', w.centre, w.top - bar / 2, 0, w.width, bar, depth, 'trim'),
    P('fb', w.centre, w.sill + bar / 2, 0, w.width, bar, depth, 'trim'),
    P('mv', w.centre, mid, 0, 0.03, h - bar * 2, 0.06, 'trim'),
    P('mh', w.centre, mid + h * 0.12, 0, w.width - bar * 2, 0.03, 0.06, 'trim'),
    // the pane doubles as an invisible barrier so nothing walks or jumps out through the opening
    P('glass', w.centre, mid, 0, w.width - bar * 2, h - bar * 2, 0.012, 'glass', true, '#cfe3f2'),
    P('board', w.centre, w.sill - 0.016, n * 0.12, w.width + 0.16, 0.04, 0.26, 'trim'),
    // curtains: two panels and a rod
    P('cl', lo - 0.2, 1.33, n * 0.15, 0.34, 2.4, 0.08, 'fabric', false, '#c9bfae'),
    P('cr', hi + 0.2, 1.33, n * 0.15, 0.34, 2.4, 0.08, 'fabric', false, '#c9bfae'),
    P('rod', w.centre, 2.58, n * 0.15, w.width + 0.95, 0.03, 0.03, 'dark', false, '#2b2d30'),
  ]
}

function buildSegments(): Seg[] {
  const { minX, maxX, minZ, maxZ } = HOUSE
  const e = T / 2
  const r = ROOMS
  const gapsOn = (axis: 'x' | 'z', at: number): Gap[] =>
    WINDOWS.filter((w) => w.axis === axis && w.at === at).map((w) => ({ centre: w.centre, width: w.width, y0: w.sill, y1: w.top }))
  const zGaps: Gap[] = [DOORWAYS.livingOffice, DOORWAYS.kitchenBedroom]
  const xGapsNorth: Gap[] = [DOORWAYS.officeKitchen]
  const xGapsSouth: Gap[] = [DOORWAYS.livingBedroom]
  // Every junction is built so that no two pieces overlap: north/south walls own the corners, west/east
  // walls stop at their inner faces, the z = 0 wall owns the central crossing, the x = 0 wall stops at it.
  return [
    // exterior, coloured per room so the inside reads correctly
    ...run('x', minZ, minX - e, 0, gapsOn('x', minZ), r.office.wall, 'n-office'),
    ...run('x', minZ, 0, maxX + e, gapsOn('x', minZ), r.kitchen.wall, 'n-kitchen'),
    ...run('x', maxZ, minX - e, 0, gapsOn('x', maxZ), r.living.wall, 's-living'),
    ...run('x', maxZ, 0, maxX + e, gapsOn('x', maxZ), r.bedroom.wall, 's-bedroom'),
    ...run('z', minX, minZ + e, 0, gapsOn('z', minX), r.office.wall, 'w-office'),
    ...run('z', minX, 0, maxZ - e, gapsOn('z', minX), r.living.wall, 'w-living'),
    ...run('z', maxX, minZ + e, 0, gapsOn('z', maxX), r.kitchen.wall, 'e-kitchen'),
    ...run('z', maxX, 0, maxZ - e, gapsOn('z', maxX), r.bedroom.wall, 'e-bedroom'),
    // interior cross walls with doorways
    ...run('x', 0, minX + e, maxX - e, zGaps, INTERIOR, 'mid-z'),
    ...run('z', 0, minZ + e, -e, xGapsNorth, INTERIOR, 'mid-x-n'),
    ...run('z', 0, e, maxZ - e, xGapsSouth, INTERIOR, 'mid-x-s'),
    ...Object.entries(DOORWAYS).flatMap(([k, d]) => doorFrame(d, `door-${k}`)),
    ...WINDOWS.flatMap(windowPieces),
  ]
}

const ray = new Ray()
const tmp = new Vector3()
const point = new Vector3()
// feet, hips, head — a wall that hides any of them fades
const SAMPLE_HEIGHTS = [-0.7, 0, 0.7]
const NONE: number[] = []

const BASE_OPACITY: Partial<Record<Kind, number>> = { glass: 0.16 }

/** Walls, window frames, curtains, trim, colliders. Pieces between the camera and the player fade out. */
export function Walls() {
  const segs = useMemo(buildSegments, [])
  const plaster = useMemo(() => surface('plaster', 1, 1), [])
  const textures = useMemo(() => segs.map((s) => (s.kind === 'fabric' ? surface('fabric', 3, 6) : plaster)), [segs, plaster])
  // walls share one plaster texture set; their UVs are projected in metres (one tile = 2.2 m), which is what lets
  // identical walls merge into a single draw in first person
  const geometries = useMemo(
    () =>
      segs.map((s) =>
        s.kind === 'fabric'
          ? pleatedBox(s.size, s.axis)
          : s.kind === 'wall'
            ? boxProject(new BoxGeometry(s.size[0], s.size[1], s.size[2]), 2.2, s.center[0] * 0.73 + s.center[2] * 1.31)
            : null,
      ),
    [segs],
  )
  const mats = useRef<(MeshStandardMaterial | null)[][]>(segs.map(() => []))
  const boxes = useMemo(
    () => segs.map((s) => new Box3().setFromCenterAndSize(new Vector3(...s.center), new Vector3(...s.size)).expandByScalar(0.02)),
    [segs],
  )
  const fade = useRef<number[]>(segs.map(() => 1))
  const camera = useThree((s) => s.camera)

  useFrame((_, dt) => {
    const state = useHome.getState()
    const inside = state.view === 'first' && state.phase === 'playing'
    ray.origin.copy(camera.position)
    for (let i = 0; i < segs.length; i++) {
      let blocked = false
      for (const dy of inside ? NONE : SAMPLE_HEIGHTS) {
        point.set(playerState.position.x, playerState.position.y + dy, playerState.position.z)
        const length = camera.position.distanceTo(point)
        ray.direction.copy(point).sub(camera.position).normalize()
        const hit = ray.intersectBox(boxes[i], tmp)
        if (hit !== null && tmp.distanceTo(camera.position) < length - 0.05) {
          blocked = true
          break
        }
      }
      fade.current[i] = MathUtils.damp(fade.current[i], blocked ? 0.06 : 1, 10, dt)
      const o = fade.current[i] * (BASE_OPACITY[segs[i].kind] ?? 1)
      const transparent = segs[i].kind === 'glass' || fade.current[i] < 0.995
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
  })

  return (
    <group>
      {segs.map((s, i) => {
        const tex = textures[i]
        const onX = s.axis === 'x'
        const len = onX ? s.size[0] : s.size[2]
        const trimDepth = T + 0.04
        return (
          <group key={s.key} position={s.center}>
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
                  map={s.kind === 'wall' || s.kind === 'fabric' ? tex.map : null}
                  normalMap={s.kind === 'wall' || s.kind === 'fabric' ? tex.normalMap : null}
                  normalScale={s.kind === 'fabric' ? [0.9, 0.9] : [0.5, 0.5]}
                  roughnessMap={s.kind === 'wall' || s.kind === 'fabric' ? tex.roughnessMap : null}
                  roughness={s.kind === 'trim' ? 0.35 : s.kind === 'dark' ? 0.4 : 1}
                  metalness={s.kind === 'dark' ? 0.6 : 0}
                  polygonOffset={s.kind !== 'wall'}
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              )}
            </mesh>
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
