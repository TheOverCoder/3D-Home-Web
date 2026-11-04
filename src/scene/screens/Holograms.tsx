// One hologram per room, floating over the pedestal: an orbit (welcome), floating project cards,
// activity rings (services) and a network globe (contact). Each is a handful of draw calls, mounts
// only while you are in its room, and is hidden until you walk up to it — then it unfolds.
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  QuadraticBezierCurve3,
  RingGeometry,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
} from 'three'
import interBold from '@pmndrs/assets/fonts/inter_bold.woff'
import type { ScreenDef } from '../../data/screens'
import { playerState } from '../../lib/playerState'
import { drawArt, mulberry32, rgba } from '../../ui/screens/art'
import { FONT_FAMILY } from './fonts'

type Reveal = RefObject<number>
const easeOut = (x: number) => 1 - Math.pow(1 - MathUtils.clamp(x, 0, 1), 3)
const easeBack = (x: number) => {
  const c = 1.4
  const t = MathUtils.clamp(x, 0, 1) - 1
  return 1 + (c + 1) * t * t * t + c * t * t
}

/** Accent colour pushed above 1 so the bloom pass picks it up. */
const hot = (hex: string, k: number) => new Color(hex).multiplyScalar(k)

function useFade(reveal: Reveal, mats: RefObject<(Material | null)[]>, base: number[]) {
  useFrame(() => {
    const r = reveal.current ?? 0
    mats.current?.forEach((m, i) => {
      if (m) m.opacity = base[i] * r
    })
  })
}

/* ─────────────── Welcome: rings orbiting a core, one per data point ─────────────── */
function Orbit({ def, reveal }: { def: ScreenDef; reveal: Reveal }) {
  const rings = useRef<(Group | null)[]>([])
  const core = useRef<Mesh>(null)
  const mats = useRef<(Material | null)[]>([])
  const bars = def.bars.slice(0, 4)
  const base = [1, 0.3, ...bars.flatMap(() => [0.9, 1])]
  useFade(reveal, mats, base)
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    rings.current.forEach((g, i) => {
      if (g) g.rotation.z += dt * (0.35 + bars[i].value * 0.7) * (i % 2 ? -1 : 1)
    })
    if (core.current) core.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06)
  })
  const reg = (i: number) => (m: Material | null) => {
    mats.current[i] = m
  }
  return (
    <group position={[0, 0.36, 0]}>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.07, 2]} />
        <meshBasicMaterial ref={reg(0)} color={hot(def.accent, 1.8)} transparent />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.12, 2]} />
        <meshBasicMaterial ref={reg(1)} color={def.accent} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {bars.map((b, i) => {
        const radius = 0.16 + i * 0.075
        return (
          <group key={b.label} rotation={[1.15 + i * 0.42, i * 0.7, 0]}>
            <group
              ref={(g) => {
                rings.current[i] = g
              }}
              rotation-z={i * 1.7}
            >
              <mesh>
                <torusGeometry args={[radius, 0.0065, 6, 96]} />
                <meshBasicMaterial ref={reg(2 + i * 2)} color={hot(def.accent, 1.1)} transparent depthWrite={false} />
              </mesh>
              <mesh position={[radius, 0, 0]}>
                <sphereGeometry args={[0.016 + b.value * 0.014, 12, 8]} />
                <meshBasicMaterial ref={reg(3 + i * 2)} color={hot('#ffffff', 1.6)} transparent />
              </mesh>
            </group>
          </group>
        )
      })}
    </group>
  )
}

/* ─────────────── Projects: cards with generated artwork, fanned out ─────────────── */
function cardTexture(def: ScreenDef, card: NonNullable<ScreenDef['tabs'][number]['cards']>[number], i: number) {
  const w = 512
  const h = 320
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 26)
  ctx.clip()
  drawArt(ctx, w, h, card.seed ?? i * 7 + 1, def.accent)
  const shade = ctx.createLinearGradient(0, h * 0.45, 0, h)
  shade.addColorStop(0, 'rgba(5,7,12,0)')
  shade.addColorStop(1, 'rgba(5,7,12,0.85)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = rgba(def.accent, 1)
  ctx.font = `600 22px ${FONT_FAMILY}`
  ctx.fillText(card.kicker.toUpperCase(), 30, h - 82)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 46px ${FONT_FAMILY}`
  ctx.fillText(card.title, 28, h - 34)
  ctx.restore()
  ctx.strokeStyle = rgba(def.accent, 0.9)
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(2, 2, w - 4, h - 4, 25)
  ctx.stroke()
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// painted and uploaded once per screen, then kept: the hologram remounts every time you enter the room
const cardTextures = new Map<string, CanvasTexture[]>()

function Cards({ def, reveal }: { def: ScreenDef; reveal: Reveal }) {
  const cards = useMemo(() => (def.tabs.find((t) => t.cards?.length)?.cards ?? []).slice(0, 4), [def])
  const textures = useMemo(() => {
    let list = cardTextures.get(def.id)
    if (!list) cardTextures.set(def.id, (list = cards.map((c, i) => cardTexture(def, c, i))))
    return list
  }, [cards, def])
  const refs = useRef<(Mesh | null)[]>([])
  const n = cards.length
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const r = easeOut(reveal.current ?? 0)
    refs.current.forEach((m, i) => {
      if (!m) return
      const k = i - (n - 1) / 2
      const a = k * 0.5 * r
      m.position.set(Math.sin(a) * 0.62, 0.4 + Math.abs(k) * -0.03 * r + Math.sin(t * 1.3 + i * 1.7) * 0.012, Math.cos(a) * 0.62 - 0.62 - i * 0.004)
      m.rotation.set(Math.sin(t * 0.9 + i) * 0.03, a, k * -0.04 * r)
      ;(m.material as MeshBasicMaterial).opacity = r
    })
  })
  return (
    <group>
      {cards.map((c, i) => (
        <mesh
          key={c.title}
          ref={(m) => {
            refs.current[i] = m
          }}
          renderOrder={i}
        >
          <planeGeometry args={[0.36, 0.225]} />
          <meshBasicMaterial map={textures[i]} transparent side={DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/* ─────────────── Services: activity rings that fill as you approach ─────────────── */
const SEGMENTS = 96
function Rings({ def, reveal }: { def: ScreenDef; reveal: Reveal }) {
  const bars = def.bars.slice(0, 4)
  const geos = useMemo(
    () =>
      bars.map((_, i) => {
        const r = 0.27 - i * 0.07
        return {
          track: new RingGeometry(r - 0.022, r + 0.022, SEGMENTS, 1),
          value: new RingGeometry(r - 0.022, r + 0.022, SEGMENTS, 1, Math.PI / 2, Math.PI * 2),
        }
      }),
    [def], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useEffect(() => () => geos.forEach((g) => (g.track.dispose(), g.value.dispose())), [geos])
  const mats = useRef<(Material | null)[]>([])
  const base = bars.flatMap(() => [0.1, 1])
  useFade(reveal, mats, base)
  useFrame(() => {
    const r = easeOut(((reveal.current ?? 0) - 0.15) / 0.85)
    geos.forEach((g, i) => g.value.setDrawRange(0, 6 * Math.round(SEGMENTS * bars[i].value * r)))
  })
  const shades = [1.5, 1.1, 0.8, 0.6]
  return (
    <group position={[-0.17, 0.36, 0]}>
      {bars.map((b, i) => (
        <group key={b.label}>
          <mesh geometry={geos[i].track}>
            <meshBasicMaterial
              ref={(m) => {
                mats.current[i * 2] = m
              }}
              color="#ffffff"
              transparent
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
          {/* mirrored so the arc runs clockwise from twelve o'clock */}
          <mesh geometry={geos[i].value} scale-x={-1}>
            <meshBasicMaterial
              ref={(m) => {
                mats.current[i * 2 + 1] = m
              }}
              color={hot(def.accent, shades[i])}
              transparent
              side={DoubleSide}
            />
          </mesh>
          <Text
            font={interBold}
            fontSize={0.05}
            color={i === 0 ? def.accent : '#ffffff'}
            fillOpacity={1}
            position={[0.36, 0.17 - i * 0.11, 0]}
            anchorX="left"
            anchorY="middle"
          >
            {`${b.label}  ${Math.round(b.value * 100)}%`}
          </Text>
        </group>
      ))}
    </group>
  )
}

/* ─────────────── Contact: a wireframe globe with connections from "home" ─────────────── */
function onSphere(lat: number, lon: number, r: number) {
  return new Vector3(Math.cos(lat) * Math.sin(lon) * r, Math.sin(lat) * r, Math.cos(lat) * Math.cos(lon) * r)
}

function Globe({ def, reveal }: { def: ScreenDef; reveal: Reveal }) {
  const R = 0.27
  const spin = useRef<Group>(null)
  const home = useRef<Mesh>(null)
  const mats = useRef<(Material | null)[]>([])
  const { grid, arcs, dots, homePos } = useMemo(() => {
    const rand = mulberry32(7)
    // latitude + longitude lines
    const g: number[] = []
    for (let la = -60; la <= 60; la += 30) {
      const lat = MathUtils.degToRad(la)
      for (let s = 0; s < 64; s++) {
        const a = onSphere(lat, (s / 64) * Math.PI * 2, R)
        const b = onSphere(lat, ((s + 1) / 64) * Math.PI * 2, R)
        g.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    for (let lo = 0; lo < 180; lo += 30) {
      const lon = MathUtils.degToRad(lo)
      for (let s = 0; s < 64; s++) {
        const a = onSphere((s / 64) * Math.PI * 2, lon, R)
        const b = onSphere(((s + 1) / 64) * Math.PI * 2, lon, R)
        g.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    const grid = new BufferGeometry()
    grid.setAttribute('position', new Float32BufferAttribute(g, 3))
    // "home" and the places it talks to
    const homePos = onSphere(0.6, 0.3, R)
    const places = def.bars.map(() => onSphere((rand() - 0.5) * 2.2, rand() * Math.PI * 2, R))
    const arcPts: number[] = []
    const dotPts: number[] = [homePos.x, homePos.y, homePos.z]
    places.forEach((p) => {
      dotPts.push(p.x, p.y, p.z)
      const mid = homePos.clone().add(p).multiplyScalar(0.5)
      const lift = R * (1.25 + homePos.distanceTo(p) * 1.1)
      const curve = new QuadraticBezierCurve3(homePos, mid.setLength(lift), p)
      const pts = curve.getPoints(40)
      for (let s = 0; s < pts.length - 1; s++) arcPts.push(pts[s].x, pts[s].y, pts[s].z, pts[s + 1].x, pts[s + 1].y, pts[s + 1].z)
    })
    const arcs = new BufferGeometry()
    arcs.setAttribute('position', new Float32BufferAttribute(arcPts, 3))
    const dots = new BufferGeometry()
    dots.setAttribute('position', new Float32BufferAttribute(dotPts, 3))
    return { grid, arcs, dots, homePos }
  }, [def])
  useEffect(() => () => (grid.dispose(), arcs.dispose(), dots.dispose()), [grid, arcs, dots])
  const base = [0.6, 0.95, 1, 0.55]
  useFade(reveal, mats, base)
  const total = arcs.getAttribute('position').count
  useFrame((state, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.25
    const r = easeOut(((reveal.current ?? 0) - 0.2) / 0.8)
    arcs.setDrawRange(0, Math.floor((total * r) / 2) * 2)
    if (home.current) home.current.scale.setScalar(1 + 0.35 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3)))
  })
  const reg = (i: number) => (m: Material | null) => {
    mats.current[i] = m
  }
  return (
    <group position={[0, 0.38, 0]} rotation={[0.25, 0, 0.12]}>
      <group ref={spin}>
        <lineSegments geometry={grid}>
          <lineBasicMaterial ref={reg(0)} color={hot(def.accent, 1.2)} transparent depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={arcs}>
          <lineBasicMaterial ref={reg(1)} color={hot('#ffffff', 1.3)} transparent depthWrite={false} />
        </lineSegments>
        <points geometry={dots}>
          <pointsMaterial ref={reg(2)} color={hot(def.accent, 1.6)} size={0.022} sizeAttenuation transparent depthWrite={false} />
        </points>
        <mesh ref={home} position={homePos}>
          <sphereGeometry args={[0.014, 12, 8]} />
          <meshBasicMaterial color={hot('#ffffff', 2)} />
        </mesh>
      </group>
      {/* a dark glass core behind the lines, so the globe still reads against a bright window */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[R * 0.97, 32, 16]} />
        <meshBasicMaterial ref={reg(3)} color="#0a1424" transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ─────────────── stage: reveal on approach, beam, title, face the viewer ─────────────── */
let beamTexture: CanvasTexture | null = null
function beam() {
  if (beamTexture) return beamTexture
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 64)
  beamTexture = new CanvasTexture(c)
  return beamTexture
}

const worldPos = new Vector3()
const KINDS = { orbit: Orbit, cards: Cards, rings: Rings, globe: Globe }

/** Mounted inside the pedestal group (already rotated by `def.rotationY`); y = 0 is the floor. */
export function Hologram({ def }: { def: ScreenDef }) {
  const camera = useThree((s) => s.camera)
  const root = useRef<Group>(null)
  const face = useRef<Group>(null)
  const beamMat = useRef<MeshBasicMaterial>(null)
  const reveal = useRef(0)
  const Kind = KINDS[def.holoKind] ?? Orbit

  useFrame((state, dt) => {
    const p = playerState.position
    const d = Math.hypot(p.x - def.holo[0], p.z - def.holo[2])
    // starts unfolding 4.2 m away, complete within 2.4 m
    reveal.current = MathUtils.damp(reveal.current, MathUtils.clamp((4.2 - d) / 1.8, 0, 1), 3.2, dt)
    const r = reveal.current
    const g = root.current
    if (!g) return
    g.visible = r > 0.01
    if (!g.visible) return
    g.scale.setScalar(Math.max(0.001, easeBack(r)))
    g.position.y = 0.88 + Math.sin(state.clock.elapsedTime * 1.4) * 0.012
    if (beamMat.current) beamMat.current.opacity = 0.28 * r
    const f = face.current
    if (f) {
      // yaw towards the camera so text never reads mirrored (the pedestal is rotated by rotationY)
      f.getWorldPosition(worldPos)
      const want = Math.atan2(camera.position.x - worldPos.x, camera.position.z - worldPos.z) - def.rotationY
      const diff = Math.atan2(Math.sin(want - f.rotation.y), Math.cos(want - f.rotation.y))
      f.rotation.y += diff * (1 - Math.exp(-5 * dt))
    }
  })

  return (
    <group ref={root} name="hologram" position={[0, 0.88, 0]} visible={false}>
      <mesh position={[0, -0.02 + 0.3, 0]}>
        <cylinderGeometry args={[0.36, 0.29, 0.6, 40, 1, true]} />
        <meshBasicMaterial
          ref={beamMat}
          map={beam()}
          color={def.accent}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>
      <group ref={face}>
        <Kind def={def} reveal={reveal} />
        <Text font={interBold} fontSize={0.085} color={hot(def.accent, 1.15)} position={[0, 0.74, 0]} anchorX="center" anchorY="bottom">
          {def.title}
        </Text>
      </group>
    </group>
  )
}
