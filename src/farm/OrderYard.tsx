import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { CanvasTexture, Euler, MathUtils, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { useInteractable } from '../lib/interaction'
import { surface } from '../lib/proceduralTextures'
import { structureParts } from '../models/structures'
import { DESK_SCREEN, OFFICE_FLOOR, PALLET_TOP, deskModel, gateLeafShape, gatePostsShape, officeModel, palletModel, FARM_GATE } from '../models/buildings'
import { DRIVER, TRACTOR_SHAPE, carrierSlot, putTractor, seatDriver, tractorParts } from '../models/tractor'
import { PersonRig } from '../models/person'
import { Parts } from '../lib/sculpt'
import { useHome } from '../store'
import { GARDEN } from '../data/layout'
import { OFFICE, OFFICE_SCREEN, OFFICE_STAND, TRACTOR } from './data'
import { isComplete } from './orders'
import { farm, gateX, useFarm } from './state'
import { CRATE_SECONDS, tractorPose } from './tractorRoute'
import { crowdGuests } from './Visitors'

// The order office in the west yard and the tractor's yard beside it. The office: sculpted (src/models/buildings.ts),
// its doorway facing the house, the desk with the computer inside — its screen shows the board (an order per row:
// green when all is in, gold while it fills, grey while a new one is on its way) and the computer is on the action
// button (it opens the order board). The yard: the pallet where the crates of the orders sent wait, the track out
// through the gate in the west hedge, and the tractor: it loads the crates (they hop onto its carrier one by one),
// drives off along the track, out through the gate (its leaves swing open as it comes) and away, comes back, turns
// round outside the gate and backs in. Where it is comes from the farm's clock (src/farm/tractor.ts), so it is the
// same after a reload. It rides a kinematic body like the animals: you bump into it. Its driver sits with the buyers'
// crowd (src/farm/Visitors.tsx), and its engine chugs while it drives, if you are near enough to hear it.

/** A sign over the office's doorway. */
function signTexture(text: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 140
  const g = c.getContext('2d')!
  g.fillStyle = '#2f3a2c'
  g.fillRect(0, 0, 512, 140)
  g.strokeStyle = 'rgba(255,255,255,0.25)'
  g.lineWidth = 8
  g.strokeRect(8, 8, 496, 124)
  g.fillStyle = '#f3ead8'
  g.font = '800 70px Inter, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 74)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** The computer's screen: the order board as rows of colour (green: all in, gold: filling, grey: on its way), how
 *  many are ready to send. Drawn again when the farm changes. */
function drawScreen(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!
  const W = c.width
  const H = c.height
  g.fillStyle = '#10232c'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#2c8540'
  g.fillRect(0, 0, W, 34)
  g.fillStyle = '#f3ead8'
  g.font = '800 24px Inter, system-ui, sans-serif'
  g.textBaseline = 'middle'
  g.fillText('ORDERS', 12, 18)
  const slots = farm.orders
  const rowH = Math.min(22, (H - 44) / Math.max(1, slots.length))
  slots.forEach((slot, k) => {
    const y = 42 + k * rowH
    if (!('order' in slot)) {
      g.fillStyle = '#4b5a60'
      g.fillRect(12, y, W * 0.35, rowH - 6)
      return
    }
    const o = slot.order
    const done = isComplete(o)
    const share =
      o.lines.reduce((n, l) => n + l.have, 0) /
      Math.max(
        1,
        o.lines.reduce((n, l) => n + l.want, 0),
      )
    g.fillStyle = '#3a4a50'
    g.fillRect(12, y, W - 24, rowH - 6)
    g.fillStyle = done ? '#6fd36a' : '#ffc93c'
    g.fillRect(12, y, Math.max(6, (W - 24) * share), rowH - 6)
  })
}

/** The office, its desk and computer, and the computer on the action button. */
function Office() {
  const office = useMemo(() => structureParts(officeModel(), 'office'), [])
  const desk = useMemo(() => structureParts(deskModel(), 'desk'), [])
  useEffect(
    () => () => {
      office.dispose()
      desk.dispose()
    },
    [office, desk],
  )
  const sign = useMemo(() => signTexture('ORDERS'), [])
  const screen = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 150
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return { canvas: c, texture: t }
  }, [])
  const rev = useFarm((s) => s.rev)
  useEffect(() => {
    drawScreen(screen.canvas)
    screen.texture.needsUpdate = true
  }, [rev, screen])
  const openPanel = useHome((s) => s.openPanel)
  useInteractable({
    id: 'farm-office',
    position: [OFFICE_STAND.x, 1.0, OFFICE_STAND.z],
    aim: [OFFICE_SCREEN.x, OFFICE_SCREEN.y, OFFICE_SCREEN.z],
    radius: 2.0,
    label: () => {
      const ready = farm.orders.filter((s) => 'order' in s && isComplete(s.order)).length
      return ready ? `Orders · ${ready} ready to send` : 'Orders'
    },
    icon: { verb: 'watch', art: 'clipboard' },
    run: () => openPanel({ kind: 'orders' }),
  })
  const deskX = -OFFICE.half.x + 0.08 + 0.33
  return (
    <group name="farm-office" position={[OFFICE.x, 0, OFFICE.z]}>
      <primitive object={office.group} />
      <group position={[deskX, OFFICE_FLOOR, 0]}>
        <primitive object={desk.group} />
        <mesh position={[DESK_SCREEN.x + 0.002, DESK_SCREEN.y, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[DESK_SCREEN.half[0] * 2, DESK_SCREEN.half[1] * 2]} />
          <meshStandardMaterial color="#000000" emissive="#ffffff" emissiveMap={screen.texture} emissiveIntensity={0.85} roughness={0.3} />
        </mesh>
      </group>
      {/* the sign over the doorway, on the front gable */}
      <mesh position={[OFFICE.half.x - 0.0, 2.42, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.9, 0.25]} />
        <meshStandardMaterial map={sign} roughness={0.85} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {/* (a step deeper at the doorway: you look in from the paving, you do not walk in) */}
        <CuboidCollider args={[OFFICE.half.x + 0.16, 1.3, OFFICE.half.z + 0.04]} position={[0.12, 1.3, 0]} />
      </RigidBody>
    </group>
  )
}

/** The gravel track: from the tractor's yard out through the hedge, and on as a dirt track past the woods. */
function Track() {
  const from = TRACTOR.pallet.x + 0.7
  const to = GARDEN.minX - 70
  const len = from - to
  // tiled every 1.6 m, as the garden's paths are
  const gravel = useMemo(() => surface('gravel', len / 1.6, 1.5 / 1.6), [len])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(from + to) / 2, -0.012, TRACTOR.z]} receiveShadow>
      <planeGeometry args={[len, 1.5]} />
      <meshStandardMaterial color="#b7a78f" map={gravel.map} normalMap={gravel.normalMap} roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  )
}

/** The pallet the crates wait on. */
function Pallet() {
  const pallet = useMemo(() => structureParts(palletModel(), 'pallet'), [])
  useEffect(() => () => pallet.dispose(), [pallet])
  return (
    <group position={[TRACTOR.pallet.x, 0, TRACTOR.pallet.z]}>
      <primitive object={pallet.group} />
    </group>
  )
}

/** The gate in the hedge where the track goes out: its leaves swing outwards as the tractor comes near, and shut
 *  behind it. Where the hedge is (the garden's own, or the west meadow's once it is bought). */
function FarmGate() {
  const parts = useMemo(
    () =>
      new Parts(
        {
          posts: { geometry: gatePostsShape().geometry(), max: 1, material: { roughness: 0.85 }, castShadow: true },
          leaf: { geometry: gateLeafShape().geometry(), max: 2, material: { roughness: 0.85 }, castShadow: true },
        },
        'farm-gate',
      ),
    [],
  )
  useEffect(() => () => parts.dispose(), [parts])
  const open = useRef(0)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const x = gateX()
    const d = farm.dispatch
    const pose = tractorPose(d.trip, d.aboard, x)
    // open while the tractor is within a few metres of it (going out, coming back)
    const near = pose.visible && pose.phase !== 'home' && pose.phase !== 'loading' && Math.abs(pose.x - x) < 5.5
    open.current = MathUtils.damp(open.current, near ? 1 : 0, 3, dt)
    const a = open.current * 1.45
    parts.begin()
    parts.at(x, 0, TRACTOR.z)
    parts.put('posts', 0, 0, 0)
    // each leaf hangs from its post, swinging out (west, away from the yard)
    parts.put('leaf', 0, 0, -FARM_GATE.half, 0, -a, 0)
    parts.put('leaf', 0, 0, FARM_GATE.half, 0, Math.PI + a, 0)
    parts.end()
  })
  return <primitive object={parts.group} />
}

const MAX_CRATES = 4 + 8 + 1 // on the carrier, on the pallet (two layers of four), hopping
/** The crates' places on the pallet: two layers of two by two. */
const STACK: [number, number, number][] = [0, 1].flatMap((layer) =>
  [-0.25, 0.25].flatMap((x) => [-0.21, 0.21].map((z): [number, number, number] => [TRACTOR.pallet.x + x, PALLET_TOP + layer * 0.37, TRACTOR.pallet.z + z])),
)

const v3 = new Vector3()
const q = new Quaternion()
const eul = new Euler()
const local = new Vector3()

/** The tractor, its crates, its driver and its body. */
function TheTractor() {
  const parts = useMemo(() => tractorParts(MAX_CRATES), [])
  useEffect(() => () => parts.dispose(), [parts])
  const body = useRef<RapierRigidBody>(null)
  const heading = useRef(-Math.PI / 2)
  const chug = useRef(0)
  const driver = useMemo(() => new PersonRig(DRIVER), [])
  const shown = useRef<{ x: number; z: number; heading: number; visible: boolean; reverse: boolean }>({ x: TRACTOR.park, z: TRACTOR.z, heading: -Math.PI / 2, visible: true, reverse: false })

  // the driver, with the buyers' crowd
  useEffect(() => {
    const guest = (crowd: Parts) => {
      const s = shown.current
      if (!s.visible) return
      driver.root.position.set(s.x, 0, s.z)
      driver.root.rotation.set(0, s.heading, 0)
      seatDriver(driver, s.reverse ? 1.2 : 0)
      driver.write(crowd)
    }
    crowdGuests.add(guest)
    return () => void crowdGuests.delete(guest)
  }, [driver])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const d = farm.dispatch
    const x = gateX()
    const pose = tractorPose(d.trip, d.aboard, x)
    heading.current = pose.heading
    // backing up, the driver looks over a shoulder
    shown.current = { x: pose.x, z: pose.z, heading: pose.heading, visible: pose.visible, reverse: pose.reverse }

    parts.begin()
    const loading = pose.phase === 'loading'
    const loaded = loading ? pose.aboard : pose.phase === 'home' ? 0 : d.aboard
    if (pose.visible) putTractor(parts, pose.x, pose.z, heading.current, pose.roll, loaded)
    // the crates on the pallet: those waiting, and while it loads those not on yet; one hopping across
    const hopping = loading && d.trip - pose.aboard * CRATE_SECONDS < CRATE_SECONDS * 0.75 && pose.aboard < d.aboard ? 1 : 0
    const onPallet = Math.min(STACK.length, d.waiting + (loading ? d.aboard - pose.aboard - hopping : 0))
    parts.at(0, 0, 0)
    for (let k = 0; k < onPallet; k++) parts.put('crate', STACK[k][0], STACK[k][1], STACK[k][2], 0, (k % 3) * 0.05 - 0.05)
    if (hopping) {
      // from the top of the pile onto its place on the carrier, on an arc
      const u = Math.min(1, (d.trip - pose.aboard * CRATE_SECONDS) / (CRATE_SECONDS * 0.75))
      const from = STACK[Math.min(STACK.length - 1, onPallet)]
      const [sx, sy, sz] = carrierSlot(pose.aboard)
      local.set(sx, sy, sz).applyAxisAngle(v3.set(0, 1, 0), heading.current)
      const tx = pose.x + local.x
      const tz = pose.z + local.z
      const e = u * u * (3 - 2 * u)
      parts.put('crate', from[0] + (tx - from[0]) * e, from[1] + (sy - from[1]) * e + Math.sin(u * Math.PI) * 0.55, from[2] + (tz - from[2]) * e, 0, heading.current * e)
    }
    parts.end()

    // its body follows it (far off while it is away, so nothing bumps into it there)
    const b = body.current
    if (b) {
      const at = pose.visible ? v3.set(pose.x, 0, pose.z) : v3.set(pose.x, -20, pose.z)
      q.setFromEuler(eul.set(0, heading.current, 0))
      const now = b.translation()
      if (Math.hypot(now.x - at.x, now.y - at.y, now.z - at.z) > 1.5) b.setTranslation(at, true)
      b.setNextKinematicTranslation(at)
      b.setNextKinematicRotation(q)
    }

    // its engine, now and then while it drives, if you are near enough to hear it
    if (pose.visible && pose.speed > 0.05) {
      chug.current -= dt
      if (chug.current <= 0) {
        chug.current = 0.16 + 0.12 / (0.5 + pose.speed)
        const { pan, near } = placeSound(pose.x, pose.z)
        if (near > 0.12) farmSound('chug', pan, near)
      }
    }
  })

  const { half, y, z } = TRACTOR_SHAPE.body
  return (
    <group name="farm-tractor">
      <primitive object={parts.group} />
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[TRACTOR.park, 0, TRACTOR.z]} rotation={[0, -Math.PI / 2, 0]}>
        <CuboidCollider args={half} position={[0, y, z]} />
      </RigidBody>
    </group>
  )
}

/** The office, the tractor's yard and track, its gate in the hedge, and the tractor. */
export function OrderYard() {
  return (
    <group name="farm-yard">
      <Office />
      <Track />
      <Pallet />
      <FarmGate />
      <TheTractor />
    </group>
  )
}
