import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { BoxGeometry, CanvasTexture, Color, IcosahedronGeometry, SRGBColorSpace, Vector3, type BufferGeometry, type MeshStandardMaterial, type Sprite } from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { farmSound, placeSound } from '../audio/sound'
import { GARDEN, GATE } from '../data/layout'
import { debugSet } from '../lib/debug'
import { playGesture } from '../lib/gestures'
import { useInteractable } from '../lib/interaction'
import { boxProject } from '../lib/boxProject'
import { material, surface } from '../lib/proceduralTextures'
import { B } from '../scene/Furnishings'
import { StaticBatch } from '../scene/House'
import { SHRUB_SPOTS, CORNER_TREES } from '../scene/Exterior'
import { useHome } from '../store'
import { BED, BEDS, COOP, EXPANSIONS, LEMON_TREE, NEST, PASTURE, PATH_X, RUN, SHED, STAND, count, cropById } from './data'
import { Chickens } from './Chickens'
import { Plants } from './Plants'
import {
  bake,
  bedProgress,
  bedStage,
  buildBed,
  buy,
  collectEggs,
  farm,
  harvest,
  milkCow,
  millCollect,
  millLoad,
  millStage,
  ovenStage,
  takeOut,
  pickLemons,
  plant,
  resetFarm,
  spawnVisitor,
  tick,
  useFarm,
  water,
  yieldOf,
} from './state'
import { Cows, herd } from './Cows'
import { Visitors } from './Visitors'
import { Workshop } from './Workshop'

const WOOD = '#8a6440'
const WOOD_DARK = '#5e4630'
const mmss = (seconds: number) => {
  const t = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

function signTexture(lines: string[], w = 512, h = 256, bg = '#f3ead8', fg = '#3b2a1c'): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')!
  c.fillStyle = bg
  c.fillRect(0, 0, w, h)
  c.strokeStyle = 'rgba(60,40,20,0.35)'
  c.lineWidth = 10
  c.strokeRect(8, 8, w - 16, h - 16)
  c.fillStyle = fg
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  lines.forEach((line, i) => {
    c.font = `${i === 0 ? 800 : 600} ${i === 0 ? h * 0.3 : h * 0.18}px Inter, system-ui, sans-serif`
    c.fillText(line, w / 2, h * (lines.length === 1 ? 0.52 : 0.38 + i * 0.32))
  })
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

function iconTexture(kind: 'water' | 'ripe'): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const c = canvas.getContext('2d')!
  c.fillStyle = 'rgba(255,255,255,0.92)'
  c.beginPath()
  c.arc(64, 64, 56, 0, Math.PI * 2)
  c.fill()
  if (kind === 'water') {
    c.fillStyle = '#3b8fd9'
    c.beginPath()
    c.moveTo(64, 22)
    c.bezierCurveTo(80, 48, 94, 62, 94, 78)
    c.arc(64, 78, 30, 0, Math.PI)
    c.bezierCurveTo(34, 62, 48, 48, 64, 22)
    c.fill()
    c.fillStyle = 'rgba(255,255,255,0.6)'
    c.beginPath()
    c.ellipse(52, 80, 7, 12, 0.3, 0, Math.PI * 2)
    c.fill()
  } else {
    c.fillStyle = '#e9b93c'
    c.beginPath()
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 44 : 14
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r)
    }
    c.closePath()
    c.fill()
  }
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

let icons: { water: CanvasTexture; ripe: CanvasTexture } | undefined
const bedIcons = () => (icons ??= { water: iconTexture('water'), ripe: iconTexture('ripe') })

function noisyBlob(radius: number, seed: number): BufferGeometry {
  const g = mergeVertices(new IcosahedronGeometry(1, 2).deleteAttribute('uv').deleteAttribute('normal'))
  const p = g.getAttribute('position')
  const v = new Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = Math.sin(v.x * 4.1 + seed) * Math.sin(v.y * 3.7 + seed * 2) * Math.sin(v.z * 4.3 + seed * 3) * 0.12 + Math.sin(v.x * 9 + seed) * 0.04
    v.multiplyScalar(radius * (1 + n))
    p.setXYZ(i, v.x, v.y * 0.85, v.z)
  }
  g.computeVertexNormals()
  return g
}

// ───────────────────────────── beds ─────────────────────────────

/** A raised bed's timber frame (four boards, four corner posts) as one mesh, UVs in wood-grain tiles. */
function bedFrameGeometry(): BufferGeometry {
  const { w, d, h } = BED
  const parts = [
    new BoxGeometry(w + 0.1, h, 0.05).translate(0, h / 2, d / 2 + 0.025),
    new BoxGeometry(w + 0.1, h, 0.05).translate(0, h / 2, -d / 2 - 0.025),
    new BoxGeometry(0.05, h, d).translate(w / 2 + 0.025, h / 2, 0),
    new BoxGeometry(0.05, h, d).translate(-w / 2 - 0.025, h / 2, 0),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => new BoxGeometry(0.075, h + 0.05, 0.075).translate(sx * (w / 2 + 0.03), (h + 0.05) / 2, sz * (d / 2 + 0.03)))),
  ]
  return boxProject(mergeGeometries(parts.map((g) => g.toNonIndexed()))!, 0.8, 0)
}

/** Stakes and string marking out a plot that has not been built yet. */
function plotGeometry(): BufferGeometry {
  const { w, d } = BED
  const parts = [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => new BoxGeometry(0.03, 0.42, 0.03).translate((sx * w) / 2, 0.21, (sz * d) / 2))),
    ...[-1, 1].map((sz) => new BoxGeometry(w, 0.006, 0.006).translate(0, 0.34, (sz * d) / 2)),
    ...[-1, 1].map((sx) => new BoxGeometry(0.006, 0.006, d).translate((sx * w) / 2, 0.34, 0)),
  ]
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!
}

let shared: { frame: BufferGeometry; plot: BufferGeometry } | undefined
const bedGeometries = () => (shared ??= { frame: bedFrameGeometry(), plot: plotGeometry() })

const DRY = new Color('#ffffff')
const WET = new Color('#7d6e66')

function Bed({ index }: { index: number }) {
  const def = BEDS[index]
  useFarm((s) => s.rev)
  const bed = farm.beds[index]
  const soilTex = useMemo(() => surface('soil', BED.w / 0.55, BED.d / 0.55), [])
  const soil = useRef<MeshStandardMaterial>(null)
  const icon = useRef<Sprite>(null)
  // a staked plot carries a price board; a piece of land to buy has one board, on its first plot
  const lead = def.expansion ? BEDS.find((b) => b.expansion === def.expansion)!.index === index : true
  const sign = useMemo(() => {
    if (def.expansion) return lead ? signTexture(['EXPAND', `${EXPANSIONS[def.expansion].price} coins`], 512, 256, '#2f3a2c', '#f3ead8') : null
    return def.price ? signTexture(['NEW BED', `${def.price} coins`], 512, 256) : null
  }, [def.expansion, def.price, lead])
  const openPanel = useHome((s) => s.openPanel)
  const showToast = useHome((s) => s.showToast)
  const geo = bedGeometries()
  const wood = material('veneer')

  useFrame((state, dt) => {
    const m = soil.current
    if (m) {
      const wet = farm.sprinkler || (bed.crop !== null && bed.water > 0) ? 1 : 0
      const k = 1 - Math.exp(-dt * 2)
      m.userData.wet = (m.userData.wet ?? 0) + (wet - (m.userData.wet ?? 0)) * k
      m.color.copy(DRY).lerp(WET, m.userData.wet)
      m.roughness = 1 - m.userData.wet * 0.3
    }
    const s = icon.current
    if (s) {
      const stage = bedStage(index)
      const show = stage === 'thirsty' || stage === 'ripe'
      s.visible = show
      if (show) {
        const tex = bedIcons()[stage === 'thirsty' ? 'water' : 'ripe']
        if (s.material.map !== tex) {
          s.material.map = tex
          s.material.needsUpdate = true
        }
        s.position.y = 1.05 + Math.sin(state.clock.elapsedTime * 2.4 + index) * 0.04
      }
    }
  })

  useInteractable({
    id: `farm-bed-${index}`,
    position: [def.x, 0.5, def.z],
    aim: [def.x, 0.42, def.z],
    radius: 2.1,
    label: () => {
      const b = farm.beds[index]
      const stage = bedStage(index)
      if (stage === 'unbought') return `Expand the farm: ${EXPANSIONS[def.expansion!].name} · ${EXPANSIONS[def.expansion!].price} coins`
      if (stage === 'locked') return `Build a bed · ${def.price} coins`
      if (stage === 'empty') return 'Plant seeds'
      const crop = cropById(b.crop!)
      if (stage === 'thirsty') return `Water the ${crop.plural}`
      if (stage === 'ripe') return `Harvest ${count(crop.id, yieldOf(crop.id))}`
      return `${crop.plural[0].toUpperCase()}${crop.plural.slice(1)} · ready in ${mmss(crop.growSeconds - b.growth)}`
    },
    run: () => {
      const stage = bedStage(index)
      const { pan, near } = placeSound(def.x, def.z)
      if (stage === 'unbought') {
        const e = EXPANSIONS[def.expansion!]
        if (buy(def.expansion!)) {
          playGesture('interact')
          farmSound('build', pan, near)
        } else showToast(`${e.name} cost ${e.price} coins — you have ${farm.coins}`)
      } else if (stage === 'locked') {
        if (buildBed(index)) {
          playGesture('interact')
          farmSound('build', pan, near)
        } else showToast(`A new bed costs ${def.price} coins — you have ${farm.coins}`)
      } else if (stage === 'empty') openPanel({ kind: 'seeds', bed: index })
      else if (stage === 'thirsty') {
        water(index)
        playGesture('interact')
        farmSound('water', pan, near)
      } else if (stage === 'ripe') {
        harvest(index)
        playGesture('interact')
        farmSound('harvest', pan, near)
      } else {
        const b = farm.beds[index]
        const crop = cropById(b.crop!)
        showToast(`${Math.round(bedProgress(index) * 100)}% grown · ${mmss(crop.growSeconds - b.growth)} to go`)
      }
    },
  })

  const { w, d, h } = BED
  return (
    <group position={[def.x, 0, def.z]}>
      {bed.built ? (
        <>
          <mesh geometry={geo.frame} castShadow receiveShadow>
            <meshStandardMaterial color={WOOD} map={wood.map} normalMap={wood.normalMap} roughnessMap={wood.roughnessMap} roughness={0.85} />
          </mesh>
          <mesh position={[0, (h - 0.05) / 2, 0]} receiveShadow>
            <boxGeometry args={[w, h - 0.05, d]} />
            <meshStandardMaterial ref={soil} map={soilTex.map} normalMap={soilTex.normalMap} roughnessMap={soilTex.roughnessMap} normalScale={[1.4, 1.4]} roughness={1} />
          </mesh>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[w / 2 + 0.06, h / 2, d / 2 + 0.06]} position={[0, h / 2, 0]} />
          </RigidBody>
        </>
      ) : (
        <>
          {/* a plot marked out with stakes and string, waiting to be built */}
          <mesh geometry={geo.plot} castShadow>
            <meshStandardMaterial color="#c9ad86" roughness={0.9} />
          </mesh>
          {sign && (
            <>
              <B size={[0.05, 0.8, 0.05]} position={[-def.side * (w / 2 - 0.25), 0.4, -d / 2 - 0.08]} color={WOOD_DARK} radius={0.006} />
              <mesh position={[-def.side * (w / 2 - 0.25), 0.72, -d / 2 - 0.05]} rotation={[0, 0, 0]}>
                <boxGeometry args={[0.5, 0.25, 0.02]} />
                <meshStandardMaterial map={sign} roughness={0.85} />
              </mesh>
            </>
          )}
        </>
      )}
      <sprite ref={icon} position={[0, 1.05, 0]} scale={[0.26, 0.26, 1]} visible={false}>
        <spriteMaterial transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

// ───────────────────────────── tree, nest, shop ─────────────────────────────

function LemonTree() {
  const crowns = useMemo(
    () => [
      { g: noisyBlob(0.85, 1), p: [0, 2.05, 0] as const },
      { g: noisyBlob(0.62, 2), p: [0.45, 1.75, 0.25] as const },
      { g: noisyBlob(0.58, 3), p: [-0.4, 1.8, -0.3] as const },
      { g: noisyBlob(0.55, 4), p: [-0.2, 2.45, 0.35] as const },
    ],
    [],
  )
  const leaves = useMemo(() => surface('grass', 1.2, 1.2), [])
  useInteractable({
    id: 'farm-lemon-tree',
    position: [LEMON_TREE.x, 1.0, LEMON_TREE.z],
    aim: [LEMON_TREE.x, 1.75, LEMON_TREE.z],
    radius: 2.3,
    enabled: () => farm.lemons > 0,
    label: () => `Pick ${count('lemon', farm.lemons)}`,
    run: () => {
      pickLemons()
      playGesture('interact')
      const { pan, near } = placeSound(LEMON_TREE.x, LEMON_TREE.z)
      farmSound('harvest', pan, near)
    },
  })
  return (
    <group position={[LEMON_TREE.x, 0, LEMON_TREE.z]}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.085, 0.13, 1.4, 9]} />
        <meshStandardMaterial color="#6a5440" roughness={0.95} />
      </mesh>
      <mesh position={[0.18, 1.35, 0.05]} rotation={[0.1, 0, -0.6]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.6, 7]} />
        <meshStandardMaterial color="#6a5440" roughness={0.95} />
      </mesh>
      {crowns.map((c, i) => (
        <mesh key={i} geometry={c.g} position={c.p as unknown as [number, number, number]} castShadow receiveShadow>
          <meshStandardMaterial color={i % 2 ? '#47703a' : '#3f6a35'} map={leaves.map} normalMap={leaves.normalMap} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Nest() {
  useInteractable({
    id: 'farm-nest',
    position: [NEST.x - 0.45, 0.9, NEST.z],
    aim: [NEST.x, 0.66, NEST.z],
    radius: 1.9,
    enabled: () => farm.eggs > 0,
    label: () => `Collect ${count('egg', farm.eggs)}`,
    run: () => {
      collectEggs()
      playGesture('interact')
      const { pan, near } = placeSound(NEST.x, NEST.z)
      farmSound('cluck', pan, near)
    },
  })
  return null
}

function ShopDoor() {
  const openPanel = useHome((s) => s.openPanel)
  useInteractable({
    id: 'farm-shop',
    position: [SHED.x + 1.15, 1.0, SHED.z],
    aim: [SHED.x + 0.92, 1.25, SHED.z],
    radius: 2.0,
    label: 'Farm shop',
    run: () => openPanel({ kind: 'shop' }),
  })
  return null
}

// ───────────────────────────── the yard's furniture ─────────────────────────────

function Structures() {
  const shopSign = useMemo(() => signTexture(['FARM SHOP'], 512, 160, '#2f3a2c', '#f3ead8'), [])
  const standSign = useMemo(() => signTexture(['FRESH', 'from the garden'], 512, 256, '#2b2f2a', '#f6efe0'), [])
  const pathLen = GARDEN.maxZ - 0.1 - 7.6
  const cross = GATE.x + 0.7 - PATH_X
  const gravelMat = (rx: number, ry: number) => {
    const t = surface('gravel', rx, ry)
    return <meshStandardMaterial map={t.map} normalMap={t.normalMap} roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
  }
  const shed = { x: SHED.x, z: SHED.z, w: 1.8, d: 1.4, h: 2.0 }
  return (
    <group name="farm-structures">
      {/* gravel: down the middle of the beds from the door, and along the fence to the gate */}
      <mesh rotation-x={-Math.PI / 2} position={[PATH_X, -0.012, 7.6 + pathLen / 2]} receiveShadow>
        <planeGeometry args={[1.25, pathLen]} />
        {gravelMat(1.25 / 1.6, pathLen / 1.6)}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[PATH_X + 0.625 + (cross - 0.625) / 2, -0.011, 12.45]} receiveShadow>
        <planeGeometry args={[cross - 0.625, 0.85]} />
        {gravelMat((cross - 0.625) / 1.6, 0.85 / 1.6)}
      </mesh>
      {/* stepping stones across the lawn to the lemon tree and the shed */}
      {[
        [-3.95, 10.25],
        [-4.75, 10.75],
        [-5.55, 11.25],
        [-6.75, 11.35],
        [-7.55, 11.15],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.004, z]} rotation={[0, i * 1.3, 0]} receiveShadow>
          <cylinderGeometry args={[0.27 + (i % 2) * 0.04, 0.29, 0.04, 7]} />
          <meshStandardMaterial color="#b5afa4" roughness={0.9} />
        </mesh>
      ))}

      {/* the shed (farm shop): plank walls, a door facing the beds, a sloping roof */}
      <group position={[shed.x, 0, shed.z]}>
        <B size={[shed.w, 0.08, shed.d]} position={[0, 0.04, 0]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0.01} />
        <B size={[shed.w, shed.h, 0.06]} position={[0, shed.h / 2, -shed.d / 2]} color="#7a5a3c" mat="veneer" tile={0.9} radius={0.01} />
        <B size={[shed.w, shed.h, 0.06]} position={[0, shed.h / 2, shed.d / 2]} color="#7a5a3c" mat="veneer" tile={0.9} radius={0.01} />
        <B size={[0.06, shed.h, shed.d]} position={[-shed.w / 2, shed.h / 2, 0]} color="#7a5a3c" mat="veneer" tile={0.9} radius={0.01} />
        <B size={[0.06, shed.h, 0.35]} position={[shed.w / 2, shed.h / 2, -shed.d / 2 + 0.175]} color="#7a5a3c" mat="veneer" tile={0.9} radius={0.01} />
        <B size={[0.06, shed.h, 0.35]} position={[shed.w / 2, shed.h / 2, shed.d / 2 - 0.175]} color="#7a5a3c" mat="veneer" tile={0.9} radius={0.01} />
        <B size={[0.06, 0.2, 0.7]} position={[shed.w / 2, shed.h - 0.1, 0]} color="#7a5a3c" mat="veneer" tile={0.9} radius={0.01} />
        {/* the door, ajar */}
        <B size={[0.04, 1.75, 0.68]} position={[shed.w / 2 + 0.2, 0.9, -0.22]} rotation={[0, 0.55, 0]} color="#4f6a4a" mat="paint" tile={0.8} radius={0.01} />
        <B size={[0.05, 0.05, 0.05]} position={[shed.w / 2 + 0.36, 0.95, -0.52]} color="#c9ccce" metalness={0.8} roughness={0.3} radius={0.01} />
        {/* inside: a shelf with seed packets and pots */}
        <B size={[0.35, 0.03, 1.2]} position={[-shed.w / 2 + 0.22, 1.1, 0]} color={WOOD} radius={0.004} />
        {[-0.4, -0.15, 0.1, 0.35].map((z, i) => (
          <B key={z} size={[0.04, 0.16, 0.11]} position={[-shed.w / 2 + 0.2, 1.2, z]} color={['#d8342a', '#e8792a', '#7cb84a', '#f0cf4a'][i]} radius={0.004} />
        ))}
        <B size={[shed.w + 0.3, 0.06, shed.d + 0.36]} position={[0, shed.h + 0.1, 0]} rotation={[0, 0, 0.16]} color="#3b3f42" roughness={0.6} radius={0.01} />
        <mesh position={[shed.w / 2 + 0.035, shed.h + 0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.0, 0.31]} />
          <meshStandardMaterial map={shopSign} roughness={0.8} />
        </mesh>
        {/* a rain barrel and a watering can */}
        <mesh position={[0.95, 0.42, -1.05]} castShadow receiveShadow>
          <cylinderGeometry args={[0.28, 0.25, 0.84, 18]} />
          <meshStandardMaterial color="#4a6f8a" roughness={0.55} />
        </mesh>
        <mesh position={[0.95, 0.85, -1.05]}>
          <cylinderGeometry args={[0.25, 0.25, 0.02, 18]} />
          <meshStandardMaterial color="#26394a" roughness={0.2} metalness={0.2} />
        </mesh>
        <group position={[1.4, 0, -0.75]} rotation={[0, -0.6, 0]}>
          <mesh position={[0, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.11, 0.26, 14]} />
            <meshStandardMaterial color="#3f8a5a" roughness={0.45} metalness={0.3} />
          </mesh>
          <mesh position={[0.17, 0.2, 0]} rotation={[0, 0, -0.9]}>
            <cylinderGeometry args={[0.018, 0.022, 0.32, 8]} />
            <meshStandardMaterial color="#3f8a5a" roughness={0.45} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.08, 0.012, 6, 14, Math.PI]} />
            <meshStandardMaterial color="#3f8a5a" roughness={0.45} metalness={0.3} />
          </mesh>
        </group>
      </group>

      {/* the coop: a raised hen house in a fenced run, its nest box poking out through the fence */}
      <group position={[COOP.x, 0, COOP.z]}>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <B key={`${sx}${sz}`} size={[0.07, 0.5, 0.07]} position={[sx * 0.58, 0.25, sz * 0.43]} color={WOOD_DARK} radius={0.006} />),
        )}
        <B size={[1.3, 0.78, 1.0]} position={[0, 0.88, 0]} color="#b5523a" mat="paint" tile={0.8} radius={0.02} />
        <B size={[1.45, 0.06, 0.66]} position={[0, 1.44, -0.27]} rotation={[-0.55, 0, 0]} color="#3b3f42" roughness={0.6} radius={0.01} />
        <B size={[1.45, 0.06, 0.66]} position={[0, 1.44, 0.27]} rotation={[0.55, 0, 0]} color="#3b3f42" roughness={0.6} radius={0.01} />
        <B size={[0.3, 0.36, 0.02]} position={[0.3, 0.8, 0.51]} color="#3b2a1c" radius={0.004} />
        <B size={[0.34, 0.03, 0.8]} position={[0.3, 0.27, 0.86]} rotation={[0.62, 0, 0]} color={WOOD} radius={0.004} />
      </group>
      <group position={[NEST.x, 0, NEST.z]}>
        <B size={[0.4, 0.03, 0.44]} position={[0, 0.615, 0]} color={WOOD} radius={0.004} />
        <B size={[0.4, 0.2, 0.03]} position={[0, 0.7, -0.22]} color={WOOD} radius={0.004} />
        <B size={[0.4, 0.2, 0.03]} position={[0, 0.7, 0.22]} color={WOOD} radius={0.004} />
        <B size={[0.03, 0.12, 0.44]} position={[-0.2, 0.66, 0]} color={WOOD} radius={0.004} />
        <B size={[0.36, 0.02, 0.4]} position={[0, 0.635, 0]} color="#d9c18a" roughness={1} radius={0} />
        <B size={[0.06, 0.6, 0.06]} position={[-0.17, 0.3, 0]} color={WOOD_DARK} radius={0.006} />
      </group>
      {/* the run's fence: posts and three rails */}
      {(() => {
        const out = []
        const sides: [number, number, number, number][] = [
          [RUN.minX, RUN.minZ, RUN.maxX, RUN.minZ],
          [RUN.maxX, RUN.minZ, RUN.maxX, RUN.maxZ],
          [RUN.maxX, RUN.maxZ, RUN.minX, RUN.maxZ],
          [RUN.minX, RUN.maxZ, RUN.minX, RUN.minZ],
        ]
        for (const [x0, z0, x1, z1] of sides) {
          const len = Math.hypot(x1 - x0, z1 - z0)
          const n = Math.ceil(len / 1.15)
          for (let i = 0; i < n; i++) {
            const t = i / n
            out.push(<B key={`p${x0}${z0}${i}`} size={[0.07, 0.95, 0.07]} position={[x0 + (x1 - x0) * t, 0.475, z0 + (z1 - z0) * t]} color={WOOD_DARK} radius={0.006} />)
          }
          const alongX = Math.abs(x1 - x0) > 0.01
          for (const y of [0.25, 0.55, 0.85]) {
            out.push(
              <B
                key={`r${x0}${z0}${y}`}
                size={alongX ? [len, 0.05, 0.025] : [0.025, 0.05, len]}
                position={[(x0 + x1) / 2, y, (z0 + z1) / 2]}
                color={WOOD}
                radius={0.004}
              />,
            )
          }
        }
        return out
      })()}

      {/* the farm stand by the gate: a table of crates under a striped awning */}
      <group position={[STAND.x, 0, STAND.z]}>
        <B size={[1.3, 0.05, 0.55]} position={[0, 0.82, 0]} color={WOOD} mat="veneer" tile={0.9} radius={0.008} />
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <B key={`${sx}${sz}`} size={[0.05, 0.82, 0.05]} position={[sx * 0.6, 0.41, sz * 0.23]} color={WOOD_DARK} radius={0.006} />),
        )}
        {[-1, 1].map((sx) => <B key={`post${sx}`} size={[0.05, 1.9, 0.05]} position={[sx * 0.62, 0.95, -0.3]} color={WOOD_DARK} radius={0.006} />)}
        <B size={[1.45, 0.03, 0.75]} position={[0, 1.88, -0.02]} rotation={[-0.22, 0, 0]} color="#e9e2d2" mat="fabric" tile={0.5} radius={0.005} />
        {[-0.48, -0.16, 0.16, 0.48].map((x, i) => (
          <B key={`stripe${x}`} size={[0.16, 0.035, 0.76]} position={[x, 1.885, -0.02]} rotation={[-0.22, 0, 0]} color={i % 2 ? '#c94f3d' : '#e9e2d2'} radius={0.004} />
        ))}
        {[-0.36, 0.36].map((x, i) => (
          <group key={x} position={[x, 0.845, 0]}>
            <B size={[0.5, 0.16, 0.36]} position={[0, 0.08, 0]} color="#a87b4f" mat="veneer" tile={0.6} radius={0.006} />
            {Array.from({ length: 6 }, (_, k) => (
              <mesh key={k} position={[(k % 3 - 1) * 0.13, 0.19, (Math.floor(k / 3) - 0.5) * 0.13]}>
                <sphereGeometry args={[0.055, 8, 6]} />
                <meshStandardMaterial color={i ? '#d8342a' : '#f2d43a'} roughness={0.45} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 0.5, -0.29]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.6, 0.3]} />
          <meshStandardMaterial map={standSign} roughness={0.9} />
        </mesh>
      </group>

      {/* the cows' pasture: post-and-rail fence (the garden fence closes its east side), an open gate on the house side,
          a water trough and a hay rack */}
      {(() => {
        const { minX, maxX, minZ, maxZ, gateZ, gateWidth } = PASTURE
        const out = []
        const runs: [number, number, number, number][] = [
          [minX, minZ, maxX, minZ],
          [minX, maxZ, maxX, maxZ],
          [minX, minZ, minX, gateZ - gateWidth / 2],
          [minX, gateZ + gateWidth / 2, minX, maxZ],
        ]
        for (const [x0, z0, x1, z1] of runs) {
          const len = Math.hypot(x1 - x0, z1 - z0)
          const n = Math.max(1, Math.round(len / 1.4))
          for (let i = 0; i <= n; i++) {
            const t = i / n
            out.push(<B key={`pp${x0}${z0}${i}`} size={[0.09, 1.1, 0.09]} position={[x0 + (x1 - x0) * t, 0.55, z0 + (z1 - z0) * t]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0.01} />)
          }
          const alongX = Math.abs(x1 - x0) > 0.01
          for (const y of [0.45, 0.9]) {
            out.push(
              <B key={`pr${x0}${z0}${y}`} size={alongX ? [len, 0.08, 0.04] : [0.04, 0.08, len]} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} color={WOOD} mat="veneer" tile={0.9} radius={0.006} />,
            )
          }
        }
        // the gate stands open, swung into the pasture
        out.push(
          <group key="pgate" position={[minX, 0, gateZ + gateWidth / 2]} rotation={[0, -1.25, 0]}>
            {[0.3, 0.75].map((y) => (
              <B key={y} size={[0.04, 0.09, gateWidth - 0.1]} position={[0.03, y, -(gateWidth - 0.1) / 2]} color={WOOD} radius={0.006} />
            ))}
            <B size={[0.04, 0.95, 0.07]} position={[0.03, 0.5, -gateWidth + 0.12]} color={WOOD} radius={0.006} />
          </group>,
        )
        return out
      })()}
      <group position={[13.0, 0, -2.0]}>
        <B size={[0.55, 0.4, 1.7]} position={[0, 0.2, 0]} color={WOOD_DARK} mat="veneer" tile={0.8} radius={0.01} />
        <mesh position={[0, 0.375, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.45, 1.6]} />
          <meshStandardMaterial color="#3d6f8a" roughness={0.08} metalness={0.1} envMapIntensity={1.4} />
        </mesh>
      </group>
      <group position={[13.0, 0, 1.6]}>
        {[-1, 1].flatMap((sz) => [-1, 1].map((sx) => <B key={`${sx}${sz}`} size={[0.06, 1.0, 0.06]} position={[sx * 0.25, 0.5, sz * 0.5]} color={WOOD_DARK} radius={0.006} />))}
        <B size={[0.56, 0.05, 1.06]} position={[0, 0.98, 0]} color={WOOD} radius={0.006} />
        <mesh position={[0, 0.62, 0]} scale={[0.26, 0.3, 0.5]} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#d6b660" roughness={1} />
        </mesh>
      </group>

      {/* the gate in the south fence: two posts and a slatted leaf */}
      <group position={[GATE.x, 0, GARDEN.maxZ]}>
        {[-1, 1].map((s) => (
          <B key={s} size={[0.12, 1.35, 0.12]} position={[s * (GATE.width / 2), 0.675, 0]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0.01} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <B key={i} size={[0.11, 1.0, 0.03]} position={[-GATE.width / 2 + 0.16 + i * ((GATE.width - 0.32) / 6), 0.58, 0]} color={WOOD} mat="veneer" tile={0.9} radius={0.004} />
        ))}
        <B size={[GATE.width - 0.12, 0.08, 0.035]} position={[0, 0.32, 0.02]} color={WOOD} radius={0.004} />
        <B size={[GATE.width - 0.12, 0.08, 0.035]} position={[0, 0.92, 0.02]} color={WOOD} radius={0.004} />
        <B size={[0.07, 1.3, 0.03]} position={[0, 0.62, 0.035]} rotation={[0, 0, 0.62]} color={WOOD} radius={0.004} />
      </group>
    </group>
  )
}

/** Everything solid in the garden that is not a wall: the boundary, sheds, trees, shrubs and fences. */
function Colliders() {
  const { minX, maxX, minZ, maxZ } = GARDEN
  const midX = (minX + maxX) / 2
  const midZ = (minZ + maxZ) / 2
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[(maxX - minX) / 2 + 1, 1.2, 0.5]} position={[midX, 1.2, minZ]} />
      <CuboidCollider args={[(maxX - minX) / 2 + 1, 1.2, 0.1]} position={[midX, 1.2, maxZ + 0.05]} />
      <CuboidCollider args={[0.5, 1.2, (maxZ - minZ) / 2 + 1]} position={[minX, 1.2, midZ]} />
      <CuboidCollider args={[0.1, 1.2, (maxZ - minZ) / 2 + 1]} position={[maxX + 0.05, 1.2, midZ]} />
      {/* shed and rain barrel */}
      <CuboidCollider args={[0.95, 1.05, 0.75]} position={[SHED.x, 1.05, SHED.z]} />
      <CylinderCollider args={[0.45, 0.3]} position={[SHED.x + 0.95, 0.45, SHED.z - 1.05]} />
      {/* lemon tree */}
      <CylinderCollider args={[0.9, 0.17]} position={[LEMON_TREE.x, 0.9, LEMON_TREE.z]} />
      {/* the hen run, the coop inside it and the nest box outside */}
      <CuboidCollider args={[(RUN.maxX - RUN.minX) / 2, 0.55, 0.05]} position={[(RUN.minX + RUN.maxX) / 2, 0.55, RUN.minZ]} />
      <CuboidCollider args={[(RUN.maxX - RUN.minX) / 2, 0.55, 0.05]} position={[(RUN.minX + RUN.maxX) / 2, 0.55, RUN.maxZ]} />
      <CuboidCollider args={[0.05, 0.55, (RUN.maxZ - RUN.minZ) / 2]} position={[RUN.minX, 0.55, (RUN.minZ + RUN.maxZ) / 2]} />
      <CuboidCollider args={[0.05, 0.55, (RUN.maxZ - RUN.minZ) / 2]} position={[RUN.maxX, 0.55, (RUN.minZ + RUN.maxZ) / 2]} />
      <CuboidCollider args={[0.22, 0.4, 0.24]} position={[NEST.x, 0.4, NEST.z]} />
      {/* the pasture's fence (the open gate on the west side lets you in), trough and hay rack */}
      <CuboidCollider args={[(PASTURE.maxX - PASTURE.minX) / 2, 0.6, 0.06]} position={[(PASTURE.minX + PASTURE.maxX) / 2, 0.6, PASTURE.minZ]} />
      <CuboidCollider args={[(PASTURE.maxX - PASTURE.minX) / 2, 0.6, 0.06]} position={[(PASTURE.minX + PASTURE.maxX) / 2, 0.6, PASTURE.maxZ]} />
      <CuboidCollider
        args={[0.06, 0.6, (PASTURE.gateZ - PASTURE.gateWidth / 2 - PASTURE.minZ) / 2]}
        position={[PASTURE.minX, 0.6, (PASTURE.minZ + PASTURE.gateZ - PASTURE.gateWidth / 2) / 2]}
      />
      <CuboidCollider
        args={[0.06, 0.6, (PASTURE.maxZ - PASTURE.gateZ - PASTURE.gateWidth / 2) / 2]}
        position={[PASTURE.minX, 0.6, (PASTURE.maxZ + PASTURE.gateZ + PASTURE.gateWidth / 2) / 2]}
      />
      <CuboidCollider args={[0.3, 0.25, 0.86]} position={[13.0, 0.25, -2.0]} />
      <CuboidCollider args={[0.3, 0.5, 0.55]} position={[13.0, 0.5, 1.6]} />
      {/* the farm stand */}
      <CuboidCollider args={[0.68, 0.45, 0.32]} position={[STAND.x, 0.45, STAND.z]} />
      {/* the garden's own trees and shrubs */}
      {CORNER_TREES.map(([x, z]) => (
        <CylinderCollider key={`t${x}${z}`} args={[1.2, 0.32]} position={[x, 1.2, z]} />
      ))}
      {SHRUB_SPOTS.map(([x, z]) => (
        <CylinderCollider key={`s${x}${z}`} args={[0.6, 0.45]} position={[x, 0.6, z]} />
      ))}
    </RigidBody>
  )
}

/** Advances the farm on the wall clock (growth keeps up even if rendering paused for a while). */
function FarmClock() {
  const last = useRef(performance.now())
  useEffect(() => {
    debugSet('farm', {
      state: farm,
      useFarm,
      tick,
      reset: resetFarm,
      spawnVisitor,
      plant,
      water,
      harvest,
      bedStage,
      herd,
      milkCow,
      millLoad,
      millCollect,
      millStage,
      bake,
      takeOut,
      ovenStage,
      buy,
    })
  }, [])
  useFrame(() => {
    const now = performance.now()
    const dt = (now - last.current) / 1000
    last.current = now
    tick(Math.min(dt, 3600))
  })
  return null
}

/** The kitchen garden in the south yard (see src/farm/data.ts for what grows and where things stand). */
export function Garden() {
  return (
    <group name="farm">
      <FarmClock />
      <StaticBatch>
        <Structures />
        <LemonTree />
      </StaticBatch>
      <Colliders />
      {BEDS.map((b) => (
        <Bed key={b.index} index={b.index} />
      ))}
      <Nest />
      <ShopDoor />
      <Plants />
      <Chickens />
      <Cows />
      <Workshop />
      <Visitors />
    </group>
  )
}
