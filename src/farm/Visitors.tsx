import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MathUtils,
  Object3D,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three'
import { useInteractable } from '../lib/interaction'
import { useHome } from '../store'
import { GATE_SPOT, count } from './data'
import { drawProduce } from './icons'
import { farm, waiting, type Visitor } from './state'

// People from the lane who queue at the garden gate to buy something. Built like the player's own body, in their
// own clothes, they walk up, wave when they get to their place, move up the line as it shortens, hop when you sell
// to them and shake their head when you say no. A speech bubble over each head shows what they want and offer.
// Up to fifteen can stand in line, so they are drawn together: six instanced draws for everyone's bodies (each
// person is a small rig of joints that is posed, then copied into the instances), and one bubble each.

function bubbleTexture(v: Visitor): CanvasTexture {
  const W = 320
  const H = 136
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!
  const r = 34
  c.fillStyle = 'rgba(255,255,255,0.96)'
  c.beginPath()
  c.moveTo(r, 4)
  c.arcTo(W - 4, 4, W - 4, H - 24, r)
  c.arcTo(W - 4, H - 24, 4, H - 24, r)
  c.lineTo(W / 2 + 14, H - 24)
  c.lineTo(W / 2, H - 4)
  c.lineTo(W / 2 - 14, H - 24)
  c.arcTo(4, H - 24, 4, 4, r)
  c.arcTo(4, 4, W - 4, 4, r)
  c.closePath()
  c.fill()
  drawProduce(c, v.want, 58, 56, 72)
  c.fillStyle = '#1d232c'
  c.font = '700 44px Inter, system-ui, sans-serif'
  c.textBaseline = 'middle'
  c.fillText(`×${v.qty}`, 100, 58)
  drawProduce(c, 'coin', 214, 56, 50)
  c.fillText(String(v.offer), 244, 58)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

type Part = 'capsule' | 'sphere' | 'box' | 'cylinder' | 'cap' | 'shadow'
const PARTS: Part[] = ['capsule', 'sphere', 'box', 'cylinder', 'cap', 'shadow']
const MAX_PEOPLE = 32 // fifteen in line, and room for those walking off after "sell to everyone"
const PER_PERSON: Record<Part, number> = { capsule: 10, sphere: 6, box: 2, cylinder: 5, cap: 1, shadow: 1 }

interface Piece {
  node: Object3D
  part: Part
  color: Color
}

interface Rig {
  root: Group
  hips: Group
  head: Group
  thighL: Group
  thighR: Group
  kneeL: Group
  kneeR: Group
  armL: Group
  armR: Group
  elbowR: Group
  pieces: Piece[]
  bubble: Sprite
  phase: number
  lastX: number
  lastZ: number
}

const SHOE = new Color('#2a2522')
const EYE = new Color('#1b1b1b')
const STRAW = new Color('#d9c18a')
const BAND = new Color('#8a4b3a')
const WICKER = new Color('#b88a52')
const BLACK = new Color('#000000')

/** One person as a rig of joints (the same proportions as the player's own body), parts as scaled unit shapes. */
function buildRig(v: Visitor): Rig {
  const L = v.look
  const shirt = new Color(L.shirt)
  const trousers = new Color(L.trousers)
  const skin = new Color(L.skin)
  const hair = new Color(L.hair)
  const pieces: Piece[] = []
  const add = (parent: Object3D, part: Part, color: Color, p: [number, number, number], s: [number, number, number]) => {
    const o = new Object3D()
    o.position.set(p[0], p[1], p[2])
    o.scale.set(s[0], s[1], s[2])
    parent.add(o)
    pieces.push({ node: o, part, color })
  }
  const group = (parent: Object3D, x: number, y: number, z: number) => {
    const g = new Group()
    g.position.set(x, y, z)
    parent.add(g)
    return g
  }
  // the unit capsule is 0.5 round and 2 tall (end to end)
  const capsule = (r: number, len: number): [number, number, number] => [2 * r, (len + 2 * r) / 2, 2 * r]
  const root = new Group()
  const hips = group(root, 0, 0.885 * L.height, 0)
  hips.scale.setScalar(L.height)
  const leg = (side: 1 | -1) => {
    const thigh = group(hips, side * 0.09, 0, 0)
    add(thigh, 'capsule', trousers, [0, -0.2, 0], capsule(0.072, 0.3))
    const knee = group(thigh, 0, -0.42, 0)
    add(knee, 'capsule', trousers, [0, -0.19, 0], capsule(0.058, 0.3))
    add(knee, 'box', SHOE, [0, -0.43, 0.045], [0.1, 0.07, 0.25])
    return [thigh, knee]
  }
  const [thighL, kneeL] = leg(1)
  const [thighR, kneeR] = leg(-1)
  add(hips, 'capsule', shirt, [0, 0.26, 0], capsule(0.16, 0.36))
  const arm = (side: 1 | -1) => {
    const a = group(hips, side * 0.215, 0.5, 0)
    add(a, 'capsule', shirt, [0, -0.14, 0], capsule(0.052, 0.2))
    const elbow = group(a, 0, -0.29, 0)
    add(elbow, 'capsule', skin, [0, -0.12, 0], capsule(0.042, 0.19))
    add(elbow, 'sphere', skin, [0, -0.27, 0], [0.048, 0.048, 0.048])
    if (side < 0) add(elbow, 'cylinder', WICKER, [0, -0.42, 0.02], [0.12, 0.13, 0.12]) // a basket for the shopping
    return [a, elbow]
  }
  const [armL] = arm(1)
  const [armR, elbowR] = arm(-1)
  add(hips, 'cylinder', skin, [0, 0.63, 0], [0.052, 0.1, 0.052])
  const head = group(hips, 0, 0.79, 0)
  add(head, 'sphere', skin, [0, 0, 0], [0.115, 0.115, 0.115])
  add(head, 'sphere', EYE, [0.04, 0.02, 0.105], [0.012, 0.012, 0.012])
  add(head, 'sphere', EYE, [-0.04, 0.02, 0.105], [0.012, 0.012, 0.012])
  add(head, 'cap', hair, [0, 0.035, -0.012], [0.123, 0.118 * (L.hairStyle === 1 ? 0.95 : 0.82), 0.125])
  if (L.hairStyle === 1) add(head, 'capsule', hair, [0, -0.08, -0.07], [0.2, 0.18, 0.11])
  if (L.hairStyle === 2) add(head, 'sphere', hair, [0, 0.09, -0.08], [0.06, 0.06, 0.06])
  if (L.hat) {
    add(head, 'cylinder', STRAW, [0, 0.09, 0], [0.21, 0.012, 0.21])
    add(head, 'cylinder', STRAW, [0, 0.14, 0], [0.112, 0.1, 0.112])
    add(head, 'cylinder', BAND, [0, 0.11, 0], [0.122, 0.025, 0.122])
  }
  // a soft shadow on the ground: people do not draw into the sun's shadow map (it would redraw every frame)
  add(root, 'shadow', BLACK, [0, 0.006, 0], [0.32, 1, 0.32])
  const bubble = new Sprite(new SpriteMaterial({ map: bubbleTexture(v), transparent: true, depthWrite: false }))
  bubble.scale.set(0.66, 0.28, 1)
  bubble.visible = false
  return { root, hips, head, thighL, thighR, kneeL, kneeR, armL, armR, elbowR, pieces, bubble, phase: Math.random() * 10, lastX: v.x, lastZ: v.z }
}

function disposeRig(rig: Rig) {
  rig.bubble.material.map?.dispose()
  rig.bubble.material.dispose()
  rig.bubble.removeFromParent()
}

/** The line at the gate: one "Buyers at the gate" action, for whoever is waiting. */
function Gate() {
  const openPanel = useHome((s) => s.openPanel)
  useInteractable({
    id: 'farm-queue',
    position: [GATE_SPOT.x, 1.0, GATE_SPOT.z],
    aim: [GATE_SPOT.x, 1.45, GATE_SPOT.z],
    radius: 2.9,
    enabled: () => waiting().length > 0,
    label: () => {
      const line = waiting()
      const v = line[0]
      const first = `${v.name}: ${count(v.want, v.qty)} for ${v.offer} coins`
      return line.length === 1 ? first : `${line.length} buyers waiting · ${first}`
    },
    icon: () => ({ verb: 'sell', item: waiting()[0]?.want }),
    run: () => openPanel({ kind: 'queue' }),
  })
  return null
}

/** Everyone on the lane or in line at the gate. */
export function Visitors() {
  const geometries = useMemo(
    () => ({
      capsule: new CapsuleGeometry(0.5, 1, 2, 8),
      sphere: new SphereGeometry(1, 10, 7),
      box: new BoxGeometry(1, 1, 1),
      cylinder: new CylinderGeometry(1, 1, 1, 10),
      cap: new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      shadow: new CircleGeometry(1, 16).rotateX(-Math.PI / 2),
    }),
    [],
  )
  const meshes = useRef<Partial<Record<Part, InstancedMesh | null>>>({})
  const bubbles = useRef<Group>(null)
  const rigs = useRef(new Map<number, Rig>())

  useEffect(() => {
    const all = rigs.current
    return () => {
      all.forEach(disposeRig)
      all.clear()
    }
  }, [])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = state.clock.elapsedTime
    const live = new Set<number>()
    const n: Record<Part, number> = { capsule: 0, sphere: 0, box: 0, cylinder: 0, cap: 0, shadow: 0 }
    let people = 0
    for (const v of farm.visitors) {
      if (people >= MAX_PEOPLE) break
      people++
      live.add(v.id)
      let rig = rigs.current.get(v.id)
      if (!rig) {
        rig = buildRig(v)
        rigs.current.set(v.id, rig)
        bubbles.current?.add(rig.bubble)
      }
      const H = v.look.height
      rig.root.position.set(v.x, 0, v.z)
      rig.root.rotation.y = v.heading
      const moved = Math.hypot(v.x - rig.lastX, v.z - rig.lastZ)
      rig.lastX = v.x
      rig.lastZ = v.z
      rig.phase += moved * 5.2
      const walking = v.moving && moved > 1e-4
      const f = rig.phase
      const amp = walking ? 0.55 : 0
      const since = farm.clock - v.moodAt
      const waving = v.phase === 'queued' && v.mood === 'neutral' && since < 2.4
      const happy = v.mood === 'happy' && since < 1.8
      const sad = v.mood === 'sad' && since < 1.8
      const damp = (o: Group, axis: 'x' | 'y' | 'z', to: number, k = 12) => {
        o.rotation[axis] = MathUtils.damp(o.rotation[axis], to, k, dt)
      }
      damp(rig.thighL, 'x', -Math.sin(f) * amp)
      damp(rig.thighR, 'x', Math.sin(f) * amp)
      damp(rig.kneeL, 'x', Math.max(0, Math.cos(f)) * amp * 1.1 + 0.03)
      damp(rig.kneeR, 'x', Math.max(0, -Math.cos(f)) * amp * 1.1 + 0.03)
      damp(rig.armL, 'x', happy ? -2.6 : Math.sin(f) * amp * 0.7)
      damp(rig.armL, 'z', happy ? 0.25 : 0.06)
      damp(rig.armR, 'x', waving || happy ? -2.7 : -Math.sin(f) * amp * 0.7)
      damp(rig.armR, 'z', waving ? -0.35 + Math.sin(t * 9) * 0.25 : happy ? -0.25 : -0.06)
      damp(rig.elbowR, 'x', waving ? -0.5 : -0.15)
      const bob = walking ? Math.abs(Math.cos(f)) * 0.025 : 0
      const hop = happy ? Math.abs(Math.sin(t * 10)) * 0.07 : 0
      const breathe = walking ? 0 : Math.sin(t * 1.6 + v.id) * 0.004
      rig.hips.position.y = 0.885 * H + bob + hop + breathe
      damp(rig.head, 'y', sad ? Math.sin(t * 13) * 0.4 : 0, 18)
      damp(rig.head, 'x', sad ? 0.25 : 0)
      rig.root.updateMatrixWorld(true)
      for (const p of rig.pieces) {
        const mesh = meshes.current[p.part]
        if (!mesh) continue
        const i = n[p.part]++
        mesh.setMatrixAt(i, p.node.matrixWorld)
        mesh.setColorAt(i, p.color)
      }
      const b = rig.bubble
      b.visible = v.phase === 'queued'
      b.position.set(v.x, 2.12 * H + Math.sin(t * 2.2 + v.id) * 0.02, v.z)
    }
    // whoever has gone home
    for (const [id, rig] of rigs.current) {
      if (live.has(id)) continue
      disposeRig(rig)
      rigs.current.delete(id)
    }
    for (const part of PARTS) {
      const mesh = meshes.current[part]
      if (!mesh) continue
      mesh.count = n[part]
      mesh.visible = n[part] > 0
      if (!n[part]) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere() // culled as a crowd when out of view (indoors, looking away)
    }
  })

  return (
    <group name="farm-visitors">
      <Gate />
      {PARTS.map((part) => (
        <instancedMesh
          key={part}
          ref={(m) => {
            meshes.current[part] = m
          }}
          args={[geometries[part], undefined, MAX_PEOPLE * PER_PERSON[part]]}
          visible={false}
        >
          {part === 'shadow' ? (
            <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
          ) : (
            <meshStandardMaterial roughness={part === 'sphere' || part === 'cap' ? 0.7 : 0.85} />
          )}
        </instancedMesh>
      ))}
      <group ref={bubbles} />
    </group>
  )
}
