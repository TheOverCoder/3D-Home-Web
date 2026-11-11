import { CanvasTexture, Color, Group, MeshBasicMaterial, NormalBlending, SRGBColorSpace, type Camera, type Object3D, type Scene, type WebGLRenderer } from 'three'
import {
  ApplyForce,
  BatchedRenderer,
  Bezier,
  CircleEmitter,
  ColorOverLife,
  ColorRange,
  ConeEmitter,
  ConstantValue,
  Gradient,
  HemisphereEmitter,
  IntervalValue,
  ParticleSystem,
  PiecewiseBezier,
  RectangleEmitter,
  RenderMode,
  RotationOverLife,
  SizeOverLife,
  SpeedOverLife,
  Vector3,
  Vector4,
  type EmitterShape,
} from 'three.quarks'
import type { FxRequest } from './fx'

// The farm's particles, with three.quarks (loaded by src/fx/FarmFx.tsx once the game is playing). Every burst is a
// small system of its own that ends by itself; all of them share one material (a picture sheet of a drop, a star and
// a puff, drawn here), so the batched renderer draws whatever is alive in a single draw — and nothing at all, hidden,
// while no effect is alive. Particles cast no shadows and are not in the shadow pass.

/** The picture sheet: three 64 px tiles side by side, each shape drawn white (the particles colour it) with room
 *  round it, so smaller mipmaps do not bleed into the next tile. */
const TILE = { drop: 0, star: 1, puff: 2 } as const
const TILES = 3

function sheet(): CanvasTexture {
  const S = 64
  const canvas = document.createElement('canvas')
  canvas.width = S * TILES
  canvas.height = S
  const c = canvas.getContext('2d')!
  const soft = (x: number, y: number, r: number, core: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${core})`)
    g.addColorStop(0.55, `rgba(255,255,255,${core * 0.55})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
  }
  // a drop of water: a round bead, brighter where the light catches it
  const d = TILE.drop * S + S / 2
  soft(d, S / 2, 20, 1)
  c.fillStyle = 'rgba(255,255,255,0.9)'
  c.beginPath()
  c.arc(d - 5, S / 2 - 6, 5, 0, Math.PI * 2)
  c.fill()
  // a four-pointed star with a glow
  const s = TILE.star * S + S / 2
  soft(s, S / 2, 16, 0.8)
  c.fillStyle = '#fff'
  c.beginPath()
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    const r = k % 2 ? 4 : 24
    c.lineTo(s + Math.sin(a) * r, S / 2 - Math.cos(a) * r)
  }
  c.closePath()
  c.fill()
  // a puff of dust: a few soft blobs together
  const p = TILE.puff * S + S / 2
  for (const [ox, oy, r] of [
    [0, 2, 22],
    [-8, -4, 15],
    [9, -3, 14],
    [2, 9, 13],
  ])
    soft(p + ox, S / 2 + oy, r, 0.8)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

const lin = (hex: string, alpha = 1, boost = 1) => {
  const c = new Color(hex)
  return new Vector4(c.r * boost, c.g * boost, c.b * boost, alpha)
}
const curve = (a: number, b: number, c: number, d: number) => new PiecewiseBezier([[new Bezier(a, b, c, d), 0]])
/** Fully there, then gone over the last part of its life. */
const fadeOut = new Gradient(
  [
    [new Vector3(1, 1, 1), 0],
    [new Vector3(1, 1, 1), 1],
  ],
  [
    [1, 0],
    [1, 0.6],
    [0, 1],
  ],
)

/** The colour each good's sparkles take (its picture's main colour); anything else sparkles warm white. */
const GOOD_TINT: Record<string, string> = {
  lettuce: '#8fd14f',
  carrot: '#ff8a26',
  strawberry: '#ff4b5c',
  tomato: '#ff5233',
  corn: '#ffd447',
  pumpkin: '#ff9524',
  wheat: '#f0c552',
  sugarcane: '#b4dc6e',
  lemon: '#ffe14a',
  flour: '#fff4dc',
  sugar: '#ffffff',
  cloth: '#ffe2b8',
  lemon_cake: '#ffe680',
  strawberry_cake: '#ff9cb4',
  carrot_cake: '#ffb366',
  pumpkin_pie: '#ffad45',
}

export interface FxEngine {
  /** starts a burst; `share` of its particles are drawn (the light graphics draw half) */
  burst(r: FxRequest, share: number): void
  update(dt: number): void
  /** how many bursts are still alive */
  alive(): number
  /** compiles the particles' shader ahead of the first burst, so it never stalls a frame */
  warm(gl: WebGLRenderer, camera: Camera, scene: Scene): Promise<void>
  dispose(): void
}

export function createFx(scene: Scene): FxEngine {
  const renderer = new BatchedRenderer()
  renderer.name = 'farm-fx'
  renderer.visible = false
  const emitters = new Group()
  emitters.name = 'farm-fx-emitters'
  scene.add(renderer, emitters)
  const map = sheet()
  const material = new MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: NormalBlending })
  const live = new Set<ParticleSystem>()

  /** A one-off burst: `count` particles at once, then it ends by itself when the last one is gone. */
  const system = (p: {
    count: number
    life: [number, number]
    speed: [number, number]
    size: [number, number]
    color: ColorRange
    tile: number
    shape: EmitterShape
    behaviors: ParticleSystem['behaviors']
  }) =>
    new ParticleSystem({
      autoDestroy: true,
      looping: false,
      duration: 0.1,
      worldSpace: true,
      shape: p.shape,
      startLife: new IntervalValue(...p.life),
      startSpeed: new IntervalValue(...p.speed),
      startSize: new IntervalValue(...p.size),
      startRotation: new IntervalValue(0, Math.PI * 2),
      startColor: p.color,
      startTileIndex: new ConstantValue(p.tile),
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [{ time: 0, count: new ConstantValue(p.count), cycle: 1, interval: 0.01, probability: 1 }],
      behaviors: p.behaviors,
      material,
      renderMode: RenderMode.BillBoard,
      uTileCount: TILES,
      vTileCount: 1,
    })

  const make = (r: FxRequest, share: number): ParticleSystem => {
    const n = (full: number) => Math.max(2, Math.round(full * share))
    if (r.kind === 'water')
      // drops jumping up from the soil all over the bed's middle, falling back
      return system({
        count: n(14),
        life: [0.5, 0.75],
        speed: [1.5, 2.5],
        size: [0.06, 0.1],
        color: new ColorRange(lin('#dcf3ff', 0.95), lin('#8ccfff', 0.9)),
        tile: TILE.drop,
        shape: new ConeEmitter({ radius: 0.45, angle: 0.55, thickness: 1 }),
        behaviors: [new ApplyForce(new Vector3(0, -1, 0), new ConstantValue(9.8)), new ColorOverLife(fadeOut), new SizeOverLife(curve(1, 1, 0.9, 0.6))],
      })
    if (r.kind === 'harvest') {
      // stars popping up and out in the good's colour (some white), turning, growing and then shrinking away
      const tint = GOOD_TINT[r.good ?? ''] ?? '#fff1bd'
      return system({
        count: n(14),
        life: [0.5, 0.85],
        speed: [0.7, 1.5],
        size: [0.11, 0.2],
        // the good's own colour, some a little brighter than 1 for the bloom to catch (much more and the tone mapping
        // washes them out to white)
        color: new ColorRange(lin(tint, 1, 1), lin(tint, 1, 1.35)),
        tile: TILE.star,
        shape: new HemisphereEmitter({ radius: 0.3, thickness: 1 }),
        behaviors: [
          new ApplyForce(new Vector3(0, -1, 0), new ConstantValue(1.6)),
          new SpeedOverLife(curve(1, 0.6, 0.3, 0.15)),
          new SizeOverLife(curve(0.3, 1.2, 1, 0)),
          new RotationOverLife(new IntervalValue(-5, 5)),
          new ColorOverLife(fadeOut),
        ],
      })
    }
    // dust kicked out from the edge of what was built or put down, rising a little, spreading and thinning out
    const half = r.half ?? { x: 0.5, z: 0.5 }
    return system({
      count: n(Math.min(16, 8 + Math.round((half.x + half.z) * 3))),
      life: [0.6, 0.95],
      speed: [0.5, 1.0],
      size: [0.26, 0.42],
      color: new ColorRange(lin('#d2b48a', 0.75), lin('#eadbbf', 0.65)),
      tile: TILE.puff,
      shape: half.x > 0.01 && half.z > 0.01 ? new RectangleEmitter({ width: half.x * 2, height: half.z * 2, thickness: 0.2 }) : new CircleEmitter({ radius: 0.4, thickness: 0.3 }),
      behaviors: [new ApplyForce(new Vector3(0, 1, 0), new ConstantValue(0.6)), new SpeedOverLife(curve(1, 0.45, 0.2, 0.1)), new SizeOverLife(curve(0.7, 1.2, 1.6, 1.9)), new ColorOverLife(fadeOut)],
    })
  }

  return {
    burst(r, share) {
      const s = make(r, share)
      // the shapes send their particles along their own z: turned so that z points up (out of the ground)
      s.emitter.position.set(r.x, r.y, r.z)
      s.emitter.rotation.x = -Math.PI / 2
      emitters.add(s.emitter)
      renderer.addSystem(s)
      live.add(s)
      s.addEventListener('destroy', () => live.delete(s))
      renderer.visible = true
    },
    update(dt) {
      if (!live.size) {
        renderer.visible = false
        return
      }
      renderer.update(dt)
      if (!live.size) renderer.visible = false
    },
    alive: () => live.size,
    async warm(gl, camera, target) {
      // the shared batch (and its shader) is made with the first system: make it now, with nothing to draw
      const probe = system({ count: 1, life: [0.1, 0.1], speed: [0, 0], size: [0.01, 0.01], color: new ColorRange(lin('#ffffff'), lin('#ffffff')), tile: 0, shape: new CircleEmitter(), behaviors: [] })
      renderer.addSystem(probe)
      renderer.deleteSystem(probe)
      // a new batch asks for Infinity instances until it is first updated: while it shows for the compile below, three
      // drew (and counted) its whole buffer, a thousand empty particles a frame. Updated now it holds what is alive: none
      renderer.update(0)
      const was = renderer.visible
      renderer.visible = true
      try {
        await gl.compileAsync(renderer as Object3D, camera, target)
      } finally {
        renderer.visible = was || live.size > 0
      }
    },
    dispose() {
      // (each takes itself out of `live` as it goes: a Set may lose the entry being visited)
      for (const s of live) s.dispose()
      live.clear()
      scene.remove(renderer, emitters)
      for (const b of renderer.batches) {
        b.geometry.dispose()
        ;(b.material as { dispose?: () => void }).dispose?.()
      }
      material.dispose()
      map.dispose()
    },
  }
}
