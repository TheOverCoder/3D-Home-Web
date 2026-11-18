import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, FogExp2, MathUtils, Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three'
import { farmSound } from '../audio/sound'
import { useHome } from '../store'
import { dragTo, drop, editCamera, editView, keyOf, shownAt, shownPlacement, thingOf, useEdit, type Pick } from './edit'
import { BLOCKERS, PARCELS, PARCEL_IDS, PLACE_IDS, bedRect, canBuyParcel, decorRect, doorway, footprint, landBounds, thingRect, type ParcelId, type PlaceId, type Rect, type Thing } from './layout'
import { farm, lockOf, useFarm } from './state'
import { LockTag } from '../ui/LockTag'

// The farm's edit mode, in the scene: the view from above, and the hand that moves things. The camera flies up
// from wherever you are to look down on the farm (north at the top of the screen); drag the ground to look round,
// pinch or scroll to come closer; drag a place (the hen run, the pasture, the fold, a tree, the mill, the loom, the
// oven), a built bed or a piece of decoration to move it — its outline goes green where it fits and red where it does
// not, and let go where it is green it stays there; tap one to pick it (the panel can turn it, or put a piece away), tap
// a field beyond the hedge to buy it. Leaving flies back down.

const TILT = 0.28 // the view leans this far from straight down (radians), so the farm still looks solid
const T = Math.tan(TILT)
const MIN_H = 7
const MAX_H = 75
const ALL_LAND = landBounds({ ...farm.layout, land: PARCEL_IDS })

interface View {
  x: number // the ground point in the middle of the view
  z: number
  h: number // how high above it
}

/** The view's vertical field of view: wider on an upright screen, which sees less across. */
const fovFor = (aspect: number) => (aspect < 1 ? 64 : 50)

const eyeOf = (v: View, out: Vector3) => out.set(v.x, v.h, v.z + v.h * T)

/** Where a point on the screen lands on the ground, seen from a view (worked out from the view itself, so it
 *  holds however many pointer moves come between two frames). */
function groundAt(v: View, ndcX: number, ndcY: number, aspect: number): [number, number] {
  const tan = Math.tan(MathUtils.degToRad(fovFor(aspect)) / 2)
  const L = Math.hypot(1, T)
  // forward, right and up of a camera looking north and down
  const fy = -1 / L
  const fz = -T / L
  const uy = T / L
  const uz = -1 / L
  const dx = ndcX * tan * aspect
  const dy = fy + uy * ndcY * tan
  const dz = fz + uz * ndcY * tan
  const ey = v.h
  const t = dy < -1e-4 ? -ey / dy : 1e4
  return [v.x + dx * t, v.z + v.h * T + dz * t]
}

const inRect = (r: Rect, x: number, z: number, m = 0) => x >= r.minX - m && x <= r.maxX + m && z >= r.minZ - m && z <= r.maxZ + m

/** Everything that moves in the edit mode, with its footprint where it is shown: the places, the built beds (one not built
 *  yet stays where it was staked out) and the decoration. */
function movables(): { thing: Thing; rect: Rect }[] {
  const out: { thing: Thing; rect: Rect }[] = PLACE_IDS.map((id) => ({ thing: { kind: 'place', id } as Thing, rect: footprint(id, shownPlacement(id)) }))
  farm.beds.forEach((b, index) => {
    const t: Thing = { kind: 'bed', index }
    const at = b.built ? shownAt(t) : null
    if (at) out.push({ thing: t, rect: bedRect(at) })
  })
  for (const d of farm.layout.decor) {
    const t: Thing = { kind: 'decor', id: d.id }
    const at = shownAt(t)
    if (at) out.push({ thing: t, rect: decorRect({ kind: d.kind, ...at }) })
  }
  return out
}

/** The thing under a ground point (the one picked first, then the smallest: a tree inside a pasture's outline wins; a
 *  small piece of decoration a little beyond its edge, for a finger). */
function thingAt(x: number, z: number): Thing | null {
  const picked = thingOf(useEdit.getState().picked)
  const area = (r: Rect) => (r.maxX - r.minX) * (r.maxZ - r.minZ)
  const hits = movables().filter((m) => inRect(m.rect, x, z, area(m.rect) < 1 ? 0.35 : 0.3))
  if (!hits.length) return null
  if (picked) {
    const k = keyOf(picked)
    const mine = hits.find((h) => keyOf(h.thing) === k)
    if (mine) return mine.thing
  }
  return hits.sort((a, b) => area(a.rect) - area(b.rect))[0].thing
}

/** A pick for a thing. */
const pickOf = (t: Thing): Pick => (t.kind === 'place' ? { kind: 'place', id: t.id } : t.kind === 'bed' ? { kind: 'bed', index: t.index } : { kind: 'decor', id: t.id })

const parcelAt = (x: number, z: number): ParcelId | null => PARCEL_IDS.find((id) => !farm.layout.land.includes(id) && inRect(PARCELS[id].rect, x, z)) ?? null

function fitView(aspect: number): View {
  const r = landBounds(farm.layout)
  const tan = Math.tan(MathUtils.degToRad(fovFor(aspect)) / 2)
  const hx = (r.maxX - r.minX) / 2 + 2
  const hz = (r.maxZ - r.minZ) / 2 + 2
  const h = MathUtils.clamp(Math.max(hz / tan, hx / (tan * aspect)) * 1.05, MIN_H, MAX_H)
  return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 + 1, h }
}

function clampView(v: View) {
  v.h = MathUtils.clamp(v.h, MIN_H, MAX_H)
  v.x = MathUtils.clamp(v.x, ALL_LAND.minX - 4, ALL_LAND.maxX + 4)
  v.z = MathUtils.clamp(v.z, ALL_LAND.minZ - 4, ALL_LAND.maxZ + 8)
}

const UP = new Vector3(0, 1, 0)
const eye = new Vector3()
const look = new Vector3()
const m4 = new Matrix4()
const quat = new Quaternion()

/** The camera: flies up to the view from above while editing, and back down after. Runs after the player's own
 *  camera (it is mounted after <Player />), blending from wherever that put the camera. */
function EditCamera({ view }: { view: React.RefObject<View> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const blend = useRef({ x: 0, v: 0 })
  const saved = useRef<{ fov: number; near: number; fog: number } | null>(null)
  const editing = useHome((s) => s.editing)

  // a fresh view over the land each time the edit mode opens
  useEffect(() => {
    if (editing) view.current = fitView(size.width / Math.max(1, size.height))
  }, [editing, view, size.width, size.height])

  useFrame((_, dt) => {
    const on = useHome.getState().editing
    editView.x = view.current.x
    editView.z = view.current.z
    const b = blend.current
    // critically damped, exact for any frame time: about a second up or down however slow the frames are
    const omega = 5
    const step = Math.min(dt, 1)
    const x0 = b.x - (on ? 1 : 0)
    const e = Math.exp(-omega * step)
    const k0 = (b.v + omega * x0) * step
    b.x = (on ? 1 : 0) + (x0 + k0) * e
    b.v = (b.v - omega * k0) * e
    if (on && b.x > 0.995) b.x = 1
    editCamera.blend = b.x
    if (!on && b.x < 0.002) {
      b.x = b.v = 0
      editCamera.blend = 0
      if (saved.current) {
        // back on the ground: the player's own lens and haze
        camera.fov = saved.current.fov
        camera.near = saved.current.near
        camera.updateProjectionMatrix()
        if (scene.fog instanceof FogExp2) scene.fog.density = saved.current.fog
        saved.current = null
      }
      return
    }
    if (!saved.current) saved.current = { fov: camera.fov, near: camera.near, fog: scene.fog instanceof FogExp2 ? scene.fog.density : 0 }
    const k = MathUtils.smootherstep(MathUtils.clamp(b.x, 0, 1), 0, 1)
    const v = view.current
    eyeOf(v, eye)
    look.set(v.x, 0, v.z)
    m4.lookAt(eye, look, UP)
    quat.setFromRotationMatrix(m4)
    camera.position.lerp(eye, k)
    camera.quaternion.slerp(quat, k)
    const s = saved.current
    camera.fov = MathUtils.lerp(s.fov, fovFor(size.width / Math.max(1, size.height)), k)
    camera.near = k > 0.5 ? 0.3 : s.near
    camera.updateProjectionMatrix()
    // the haze that gives the rooms depth would hide the farm from up here
    if (scene.fog instanceof FogExp2) scene.fog.density = MathUtils.lerp(s.fog, Math.min(s.fog, 0.004), k)
    camera.updateMatrixWorld()
  })
  return null
}

interface Press {
  kind: 'thing' | 'parcel' | 'ground'
  thing?: Thing
  parcel?: ParcelId
  start: [number, number] // screen
  offset: [number, number] // place middle − ground point, for a place
  ground: [number, number] // the ground point pressed, seen from `from`
  from: View
  moved: boolean
}

/** Pointer and wheel: look round, zoom, pick and drag. */
function EditInput({ view }: { view: React.RefObject<View> }) {
  const dom = useThree((s) => s.gl.domElement)
  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number }>()
    let press: Press | null = null
    let pinch: { d: number; mid: [number, number]; from: View; ground: [number, number] } | null = null
    const ndc = (x: number, y: number): [number, number] => {
      const r = dom.getBoundingClientRect()
      return [((x - r.left) / r.width) * 2 - 1, -(((y - r.top) / r.height) * 2 - 1)]
    }
    const aspect = () => dom.clientWidth / Math.max(1, dom.clientHeight)
    const ground = (x: number, y: number, v: View = view.current) => {
      const [nx, ny] = ndc(x, y)
      return groundAt(v, nx, ny, aspect())
    }
    const active = () => useHome.getState().editing
    const startPinch = () => {
      const [a, b] = [...pointers.values()]
      const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2]
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mid, from: { ...view.current }, ground: ground(mid[0], mid[1]) }
    }

    const onDown = (e: PointerEvent) => {
      // not while the camera is still on its way up: what is under the finger is not where it will be
      if (!active() || editCamera.blend < 0.98) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      dom.setPointerCapture?.(e.pointerId)
      if (pointers.size === 2) {
        // a second finger: pinch and pan; whatever the first was dragging goes back
        if (press?.kind === 'thing' && press.moved) useEdit.getState().setDrag(null)
        press = null
        startPinch()
        return
      }
      if (pointers.size > 2) return
      const g = ground(e.clientX, e.clientY)
      const thing = thingAt(g[0], g[1])
      const parcel = thing ? null : parcelAt(g[0], g[1])
      const p = thing ? shownAt(thing) : null
      press = {
        kind: thing ? 'thing' : parcel ? 'parcel' : 'ground',
        thing: thing ?? undefined,
        parcel: parcel ?? undefined,
        start: [e.clientX, e.clientY],
        offset: p ? [p.x - g[0], p.z - g[1]] : [0, 0],
        ground: g,
        from: { ...view.current },
        moved: false,
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!active() || !pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const v: View = { ...pinch.from, h: pinch.from.h * (pinch.d / Math.max(20, d)) }
        clampView(v)
        // keep the ground under the fingers' middle where it was
        const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2]
        const g = ground(mid[0], mid[1], v)
        v.x += pinch.ground[0] - g[0]
        v.z += pinch.ground[1] - g[1]
        clampView(v)
        view.current = v
        return
      }
      const pr = press
      if (!pr) return
      if (!pr.moved && Math.hypot(e.clientX - pr.start[0], e.clientY - pr.start[1]) < 7) return
      if (!pr.moved && pr.kind === 'thing' && pr.thing) farmSound('lift')
      pr.moved = true
      if (pr.kind === 'thing' && pr.thing) {
        const g = ground(e.clientX, e.clientY)
        if (keyOf(thingOf(useEdit.getState().picked) ?? pr.thing) !== keyOf(pr.thing) || !useEdit.getState().picked) useEdit.getState().pick(pickOf(pr.thing))
        dragTo(pr.thing, g[0] + pr.offset[0], g[1] + pr.offset[1])
      } else {
        // look round: the ground pressed stays under the finger
        const g = ground(e.clientX, e.clientY, pr.from)
        const v = { ...pr.from, x: pr.from.x + pr.ground[0] - g[0], z: pr.from.z + pr.ground[1] - g[1] }
        clampView(v)
        view.current = v
      }
    }

    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return
      dom.releasePointerCapture?.(e.pointerId)
      if (pinch) {
        if (pointers.size < 2) pinch = null
        return
      }
      const pr = press
      press = null
      if (!pr || !active()) return
      const edit = useEdit.getState()
      if (pr.kind === 'thing' && pr.thing) {
        if (pr.moved) {
          const fit = drop()
          const r = thingRect(farm.layout, pr.thing, shownAt(pr.thing) ?? { x: 0, z: 0, rot: 0 })
          farmSound(fit && !fit.ok ? 'nope' : 'thud', 0, 1, undefined, { size: r ? Math.max(r.maxX - r.minX, r.maxZ - r.minZ) : undefined })
          if (fit && !fit.ok) useHome.getState().showToast(`${fit.reason} — it went back`)
        } else edit.pick(pickOf(pr.thing))
      } else if (!pr.moved) edit.pick(pr.kind === 'parcel' && pr.parcel ? { kind: 'parcel', id: pr.parcel } : null)
    }

    const onWheel = (e: WheelEvent) => {
      if (!active()) return
      e.preventDefault()
      const before = ground(e.clientX, e.clientY)
      const v = { ...view.current, h: view.current.h * Math.exp(e.deltaY * 0.0012) }
      clampView(v)
      const after = ground(e.clientX, e.clientY, v)
      v.x += before[0] - after[0]
      v.z += before[1] - after[1]
      clampView(v)
      view.current = v
    }

    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointercancel', onUp)
    dom.addEventListener('wheel', onWheel, { passive: false })
    // leaving the edit mode in the middle of a drag: it goes back
    const unsub = useHome.subscribe((s, prev) => {
      if (!s.editing && prev.editing) {
        pointers.clear()
        press = null
        pinch = null
        useEdit.setState({ drag: null, picked: null, note: null })
      }
    })
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerup', onUp)
      dom.removeEventListener('pointercancel', onUp)
      dom.removeEventListener('wheel', onWheel)
      unsub()
    }
  }, [dom, view])
  return null
}

// ───────────────────────────── what is drawn on the ground ─────────────────────────────

const COLOURS = { idle: '#ffffff', picked: '#ffb454', fits: '#5fd068', bad: '#ff5a4e', sale: '#f2cf6b', locked: '#9aa5b8', door: '#ffffff' }

/** A rectangle drawn flat on the ground over everything: a soft fill and a crisp edge. */
export function Outline({ r, color, fill = 0.16, edge = 0.14, y = 0.06 }: { r: Rect; color: string; fill?: number; edge?: number; y?: number }) {
  const w = r.maxX - r.minX
  const d = r.maxZ - r.minZ
  const cx = (r.minX + r.maxX) / 2
  const cz = (r.minZ + r.maxZ) / 2
  const mat = (opacity: number) => <meshBasicMaterial color={color} transparent opacity={opacity} depthTest={false} depthWrite={false} fog={false} toneMapped={false} />
  const bars: [number, number, number, number][] = [
    [cx, r.minZ + edge / 2, w, edge],
    [cx, r.maxZ - edge / 2, w, edge],
    [r.minX + edge / 2, cz, edge, d - edge * 2],
    [r.maxX - edge / 2, cz, edge, d - edge * 2],
  ]
  return (
    <group renderOrder={20}>
      <mesh position={[cx, y, cz]} rotation-x={-Math.PI / 2} renderOrder={20}>
        <planeGeometry args={[w, d]} />
        {mat(fill)}
      </mesh>
      {bars.map(([x, z, bw, bd], i) => (
        <mesh key={i} position={[x, y + 0.01, z]} rotation-x={-Math.PI / 2} renderOrder={21}>
          <planeGeometry args={[bw, bd]} />
          {mat(0.95)}
        </mesh>
      ))}
    </group>
  )
}

function PlaceOutline({ id }: { id: PlaceId }) {
  useFarm(() => farm.layout.places[id])
  const drag = useEdit((s) => (s.drag?.id === id ? s.drag : null))
  const picked = useEdit((s) => s.picked?.kind === 'place' && s.picked.id === id)
  const p = drag?.at ?? farm.layout.places[id]
  const color = drag ? (drag.fit.ok ? COLOURS.fits : COLOURS.bad) : picked ? COLOURS.picked : COLOURS.idle
  const door = doorway(id, p)
  return (
    <>
      <Outline r={footprint(id, p)} color={color} fill={drag || picked ? 0.24 : 0.1} edge={drag || picked ? 0.2 : 0.12} />
      {door && (drag || picked) && <Outline r={door} color={color} fill={0.12} edge={0.06} />}
    </>
  )
}

/** The bed or piece of decoration picked, or dragged: its outline, green or red where it would land as it is dragged. */
function ThingOutline() {
  useFarm((s) => s.rev)
  const drag = useEdit((s) => (s.drag && s.drag.thing.kind !== 'place' ? s.drag : null))
  const picked = useEdit((s) => (s.picked && (s.picked.kind === 'bed' || s.picked.kind === 'decor') ? s.picked : null))
  const thing = drag?.thing ?? thingOf(picked)
  if (!thing || thing.kind === 'place') return null
  const at = drag?.at ?? shownAt(thing)
  if (!at) return null
  const d = thing.kind === 'decor' ? farm.layout.decor.find((x) => x.id === thing.id) : null
  const r = thing.kind === 'bed' ? bedRect(at) : d ? decorRect({ kind: d.kind, ...at }) : null
  if (!r) return null
  const color = drag ? (drag.fit.ok ? COLOURS.fits : COLOURS.bad) : COLOURS.picked
  return <Outline r={r} color={color} fill={0.26} edge={0.1} y={0.07} />
}

/** Every built bed and piece of decoration not picked: a thin white outline each, all in one draw (a farm can have
 *  dozens of pieces). */
function IdleOutlines() {
  const rev = useFarm((s) => s.rev)
  const busy = useEdit((s) => s.drag?.id ?? (s.picked && s.picked.kind !== 'parcel' ? keyOf(thingOf(s.picked)!) : ''))
  const geometry = useMemo(() => {
    const rects: Rect[] = []
    farm.beds.forEach((b, index) => {
      if (b.built && keyOf({ kind: 'bed', index }) !== busy) rects.push(bedRect(farm.layout.beds[index]))
    })
    for (const d of farm.layout.decor) if (keyOf({ kind: 'decor', id: d.id }) !== busy) rects.push(decorRect(d))
    const e = 0.06
    const y = 0.065
    const pos: number[] = []
    const quad = (x0: number, z0: number, x1: number, z1: number) => pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0)
    for (const r of rects) {
      quad(r.minX, r.minZ, r.maxX, r.minZ + e)
      quad(r.minX, r.maxZ - e, r.maxX, r.maxZ)
      quad(r.minX, r.minZ + e, r.minX + e, r.maxZ - e)
      quad(r.maxX - e, r.minZ + e, r.maxX, r.maxZ - e)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    g.computeBoundingSphere()
    return g
    // the layout is read from the farm; its revision is what changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, busy])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} renderOrder={20}>
      <meshBasicMaterial color={COLOURS.idle} transparent opacity={0.8} depthTest={false} depthWrite={false} fog={false} toneMapped={false} side={2} />
    </mesh>
  )
}

function ParcelOverlay({ id }: { id: ParcelId }) {
  useFarm((s) => s.rev)
  const picked = useEdit((s) => s.picked?.kind === 'parcel' && s.picked.id === id)
  const def = PARCELS[id]
  if (farm.layout.land.includes(id)) return null
  // not open yet at the farm's level: the level it opens at for the price (src/farm/unlocks.ts)
  const lock = lockOf(`parcel:${id}`)
  const open = canBuyParcel(farm.layout, id) && lock === null
  const r = def.rect
  return (
    <>
      <Outline r={r} color={picked ? COLOURS.picked : open ? COLOURS.sale : COLOURS.locked} fill={picked ? 0.26 : open ? 0.14 : 0.07} edge={0.22} />
      <Html position={[(r.minX + r.maxX) / 2, 0.2, (r.minZ + r.maxZ) / 2]} center zIndexRange={[12, 11]}>
        <button className={`edit-sale${open ? '' : ' locked'}${picked ? ' on' : ''}`} onClick={() => useEdit.getState().pick({ kind: 'parcel', id })} onPointerDown={(e) => e.stopPropagation()}>
          <strong>{def.name}</strong>
          {lock !== null ? <LockTag level={lock} /> : <span>{open ? `${def.price} coins` : 'not yet'}</span>}
        </button>
      </Html>
    </>
  )
}

/** While something is dragged: what it may not stand on (the paths, the shed, the stand, the office, the shrubs, and the
 *  plots and fields' beds not built yet, which stay where they were staked out). */
function Blocked() {
  const dragging = useEdit((s) => !!s.drag)
  if (!dragging) return null
  return (
    <>
      {BLOCKERS.map((b, i) => (
        <Outline key={i} r={b.rect} color="#d0453b" fill={0.2} edge={0.05} y={0.04} />
      ))}
      {farm.beds.map((b, i) => (b.built ? null : <Outline key={`bed${i}`} r={bedRect(farm.layout.beds[i])} color="#d0453b" fill={0.2} edge={0.05} y={0.04} />))}
    </>
  )
}

/** The edit mode in the scene (mount it after <Player />: its camera runs after the player's). */
export function EditMode() {
  const view = useRef<View>({ x: 0, z: 0, h: 40 })
  const editing = useHome((s) => s.editing)
  const parcels = useMemo(() => PARCEL_IDS, [])
  // the outlines and the labels once the camera is up (on the way they would swing across the screen)
  const [up, setUp] = useState(false)
  useFrame(() => {
    const now = editing && editCamera.blend > 0.95
    if (now !== up) setUp(now)
  })
  return (
    <>
      <EditCamera view={view} />
      <EditInput view={view} />
      {editing && up && (
        <group name="edit-overlay">
          <Blocked />
          {PLACE_IDS.map((id) => (
            <PlaceOutline key={id} id={id} />
          ))}
          <IdleOutlines />
          <ThingOutline />
          {parcels.map((id) => (
            <ParcelOverlay key={id} id={id} />
          ))}
        </group>
      )}
    </>
  )
}
