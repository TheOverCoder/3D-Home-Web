import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { MathUtils, Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three'
import { farm, useFarm } from '../farm/state'
import { debugSet } from '../lib/debug'
import { playGesture } from '../lib/gestures'
import { useInteractable } from '../lib/interaction'
import { turnTowards, turning } from '../lib/look'
import { BODY, playerState } from '../lib/playerState'
import { useHome } from '../store'
import { PIECES } from './catalogue'
import { dressView } from './dress'
import type { HomePiece } from './layout'

// The wardrobe (src/farm/outfit.ts for its garments, ./WardrobePanel.tsx for its sheet): every wardrobe in the house
// opens with the action button. You turn round, your back to it, and the camera comes out of your eyes to stand in
// front of you and film you while you choose — framed in the part of the screen the sheet leaves free — and goes back
// to your eyes when it closes. In third person the view is first person while the wardrobe is open, and third again
// after.

/** The view to go back to when the wardrobe closes (the open turned it to first person). */
let viewBefore: 'first' | 'third' | null = null

/** The body from its feet to the top of a hat, and how much of the free part of the screen it fills. */
const BODY_HEIGHT = 1.95
const FILL = 0.86
/** The camera's own field of view while it films you (narrower than your eyes': a person, not a room). */
const DRESS_FOV = { wide: 42, tall: 54 }
/** In first person the body is drawn this far behind the eyes (src/scene/Player.tsx, BODY_BACK). */
const BODY_BACK = 0.14
const FEET = BODY.half + BODY.radius + BODY.float

/** A wardrobe's action: open it. Reach is from its front and sides (its footprint), like a bed's. */
function WardrobeAction({ p }: { p: HomePiece }) {
  const [w, , d] = PIECES[p.type].size
  const quarter = p.rot % 2 === 1
  const a = (p.rot * Math.PI) / 2
  useInteractable({
    id: `wardrobe-${p.id}`,
    label: 'Open the wardrobe',
    icon: { verb: 'dress' },
    position: [p.x, 0, p.z],
    box: { x: (quarter ? d : w) / 2, z: (quarter ? w : d) / 2 },
    // you look at its doors (its front is +z at no turn)
    aim: [p.x + Math.sin(a) * (d / 2), 1.3, p.z + Math.cos(a) * (d / 2)],
    radius: 1.2,
    run: () => {
      const s = useHome.getState()
      playGesture('interact')
      viewBefore = s.view
      if (s.view === 'third') s.setView('first')
      s.openPanel({ kind: 'wardrobe', piece: p.id })
    },
  })
  return null
}

const UP = new Vector3(0, 1, 0)
const target = new Vector3()
const eye = new Vector3()
const fwd = new Vector3()
const m4 = new Matrix4()
const quat = new Quaternion()
const tilt = new Quaternion()
const X = new Vector3(1, 0, 0)

/** The camera while the wardrobe is open: from your eyes to in front of you, critically damped (about a second each
 *  way, whatever the frame rate), and back. It runs after the player's own camera, so it blends from wherever that
 *  put it; a wall or a piece of furniture between you and where it would stand brings it closer. */
function DressCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const { world, rapier } = useRapier()
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), [rapier])
  const blend = useRef({ x: 0, v: 0 })
  const saved = useRef<{ fov: number } | null>(null)
  // the wardrobe you turned your back to, and the frames since it opened (the view's hand-over from third person
  // settles first: src/scene/Player.tsx)
  const opened = useRef<{ piece: string; frames: number } | null>(null)

  useFrame((_, dt) => {
    const s = useHome.getState()
    const panel = s.panel
    const on = panel?.kind === 'wardrobe' && s.phase === 'playing'
    dressView.settled = false
    if (on) {
      const o = opened.current?.piece === panel.piece ? opened.current : (opened.current = { piece: panel.piece, frames: 0 })
      // turn round, your back to the wardrobe (a frame or two after it opened)
      if (o.frames++ === 2) {
        const w = farm.home.pieces.find((p) => p.id === panel.piece)
        const p = playerState.position
        if (w) turnTowards(playerState.eye, { x: 2 * p.x - w.x, y: playerState.eye.y, z: 2 * p.z - w.z })
      }
    } else opened.current = null
    const b = blend.current
    const omega = 5
    const step = Math.min(dt, 1)
    const x0 = b.x - (on ? 1 : 0)
    const e = Math.exp(-omega * step)
    const k0 = (b.v + omega * x0) * step
    b.x = (on ? 1 : 0) + (x0 + k0) * e
    b.v = (b.v - omega * k0) * e
    if (on && b.x > 0.995) b.x = 1
    if (!on && b.x < 0.002) {
      b.x = b.v = 0
      dressView.blend = 0
      if (saved.current) {
        camera.fov = saved.current.fov
        camera.updateProjectionMatrix()
        saved.current = null
      }
      return
    }
    dressView.blend = b.x
    if (!saved.current) saved.current = { fov: camera.fov }
    const k = MathUtils.smootherstep(MathUtils.clamp(b.x, 0, 1), 0, 1)
    const aspect = size.width / Math.max(1, size.height)
    const fov = aspect < 1 ? DRESS_FOV.tall : DRESS_FOV.wide
    const tanV = Math.tan(MathUtils.degToRad(fov) / 2)
    const tanH = tanV * aspect

    // you, as the body is drawn: facing where the eyes look, a little behind them
    const p = playerState.position
    const f = playerState.facing
    fwd.set(f.x, 0, f.z).normalize()
    target.set(p.x - fwd.x * BODY_BACK, p.y - FEET + BODY_HEIGHT / 2, p.z - fwd.z * BODY_BACK)
    // as far as fits you in the free part of the screen, unless something stands in the way
    const fr = dressView.free
    const free = Math.max(0.2, (fr.y1 - fr.y0) / 2)
    let dist = BODY_HEIGHT / (2 * FILL * free * tanV)
    const from = 0.45
    ray.origin.x = target.x + fwd.x * from
    ray.origin.y = target.y + 0.1
    ray.origin.z = target.z + fwd.z * from
    ray.dir.x = fwd.x
    ray.dir.y = 0
    ray.dir.z = fwd.z
    const hit = world.castRay(ray, dist - from, true)
    if (hit) dist = Math.max(0.9, from + hit.timeOfImpact - 0.15)
    eye.set(target.x + fwd.x * dist, target.y + 0.1, target.z + fwd.z * dist)
    // looking at you, then turned so you stand in the middle of the free part (left of a sheet on the right, above one
    // at the bottom)
    m4.lookAt(eye, target, UP)
    quat.setFromRotationMatrix(m4)
    const cx = (fr.x0 + fr.x1) / 2
    const cy = (fr.y0 + fr.y1) / 2
    tilt.setFromAxisAngle(UP, Math.atan(cx * tanH))
    quat.multiply(tilt)
    tilt.setFromAxisAngle(X, -Math.atan(cy * tanV))
    quat.multiply(tilt)
    camera.position.lerp(eye, k)
    camera.quaternion.slerp(quat, k)
    camera.fov = MathUtils.lerp(saved.current.fov, fov, k)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    // there, and you turned round (a slow frame can bring the camera before the turn is done)
    dressView.settled = on && b.x === 1 && (opened.current?.frames ?? 0) > 3 && !turning()
  })
  return null
}

/** Every wardrobe in the house opens (one bought later too), and the camera that films you while one is open. */
export function Wardrobes() {
  const home = useFarm(() => farm.home)
  useEffect(() => debugSet('dressView', dressView), [])
  // closed: back to third person if that is where it was opened from (at once, as it closes)
  useEffect(
    () =>
      useHome.subscribe((s, before) => {
        if (before.panel?.kind !== 'wardrobe' || s.panel?.kind === 'wardrobe') return
        const back = viewBefore
        viewBefore = null
        if (back === 'third' && s.view === 'first') s.setView('third')
      }),
    [],
  )
  return (
    <>
      {home.pieces
        .filter((p) => p.type === 'wardrobe')
        .map((p) => (
          <WardrobeAction key={`${p.id}|${p.x}|${p.z}|${p.rot}`} p={p} />
        ))}
      <DressCamera />
    </>
  )
}
