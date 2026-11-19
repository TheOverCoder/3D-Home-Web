import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Points,
  SRGBColorSpace,
  ShaderMaterial,
  Sphere,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3 as ThreeVector3,
  Vector4 as ThreeVector4,
  type Camera,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three'
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
import { SUN } from '../data/layout'
import { MOST_SHELTERS, shelterUniforms } from '../lib/sculpt/material'
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

// ───────────────────────────── the weather ─────────────────────────────
//
// Rain, snow and the rainbow (update-v1/missions/10-seasons-weather.md, change 4): read only from the look of the season
// and the weather (src/scene/weatherLook.ts), fed by src/fx/FarmFx.tsx on both maps. The mission's fallback renderer
// (decision 11): drawn through three.quarks, the rain's script came to 4.3 ms a frame at a 4× CPU throttle on a phone's
// Medium drops (0.9 unthrottled), against the 1 ms its check allows (tests/e2e/05). So what falls is moved by its own
// shader, from the weather's clock: each drop or flake is a fixed seed, made once; where it is now (how far down its
// fall, drifting with the wind, its column wrapped round a box that follows the camera, so it keeps its place in the
// world as you walk) is worked out on the graphics card, and a frame's script is a few uniforms. Rain as streaks (two
// triangles each, stretched along its fall), snow as round soft points (no triangles), as many as the tier draws at the
// full (src/lib/profile.ts, `weather`) times how far the weather is in (the first so many seeds drawn). Neither is drawn
// at a roof (src/lib/world.ts, `shelters`: never inside the house or a walk-in building) nor below the ground. Drawn as
// the outside (`userData.cell`): from a room only through a window. The rainbow is one additive arc of 64 segments
// opposite the sun, far off: a picture of a gradient. Nothing here casts, nor is it in the sun's pass. (In this file as
// the weather's renderer was planned here: it loads with the bursts' chunk, once playing, only with motion on.)

/** What the weather draws reads of the look (src/scene/weatherLook.ts, `Look`): how much rain, snow, wind and rainbow. */
export interface WeatherLook {
  rain: number
  snow: number
  wind: number
  rainbow: number
}

/** The weather's numbers: the box round the camera (metres a side; how high over the ground each falls from; how far its
 *  middle is ahead of you, so most of what falls is in view), how fast each falls (metres a second), how big each is
 *  (rain: the streak's width and length; snow: the flake), how far the wind blows it at its strongest (metres a second),
 *  its colour, and how many flakes snow has to rain's drops. */
export const WEATHER_FX = {
  box: 26,
  high: 12,
  ahead: 5,
  rain: { speed: 9, width: 0.03, length: 0.5, wind: 4, color: [0.82, 0.86, 0.94, 0.55] as const },
  snow: { speed: 1.1, size: 0.1, wind: 1.6, flutter: 0.25, color: [1, 1, 1, 0.95] as const, share: 0.8 },
  /** the rainbow: how far off (metres), its radius against that (the sky's 42°), its width a share of it, how far its
   *  middle is under the horizon (a share of its radius), how bright at the full */
  rainbow: { far: 320, radius: 0.9, width: 0.06, low: 0.2, bright: 0.6 },
  /** a drop this close to a roof's rooms counts as under it (metres): none pokes through a wall */
  margin: 0.2,
  /** seeds made once: more than the most any tier draws (src/lib/profile.ts, `weather`) */
  room: 3200,
} as const

/** Which way the wind blows (from the west-south-west, across the farm), a unit vector on the ground. */
const WIND_DIR = (() => {
  const l = Math.hypot(1, 0.35)
  return { x: 1 / l, z: 0.35 / l }
})()

export interface WeatherStats {
  /** drops and flakes drawn */
  rain: number
  snow: number
  /** the rainbow's strength drawn */
  rainbow: number
  /** the script a frame (ms): the last frame's, the mean, the median and the most over the last 120 */
  ms: number
  mean: number
  median: number
  most: number
  frames: number
}

export interface WeatherEngine {
  /** Each frame: the look now, the camera, the seconds gone by on the weather's clock (0: its time stopped, nothing
   *  moves), how many drops fall at the full (the tier's), and the drawing buffer's height in pixels (a flake's size).
   *  The roofs are the materials' own uniforms (src/lib/sculpt/material.ts, `shelterUniforms`: the map's, set by
   *  src/scene/Lighting.tsx). */
  update(look: WeatherLook, camera: Camera, dt: number, most: number, pixels: number): void
  /** Runs the weather's clock on by `seconds` (what falls needs no filling: it is everywhere in its box at once). */
  settle(seconds: number): void
  /** Everything that fell goes (another map): its clock starts again. */
  clear(): void
  stats: WeatherStats
  /** compiles its shaders ahead of the first drop, so it never stalls a frame */
  warm(gl: WebGLRenderer, camera: Camera, scene: Scene): Promise<void>
  dispose(): void
}

// where a seed is now: how far down its fall (from its own phase and the clock's), its column drifting with the wind and
// wrapped round the box's middle; hidden at a roof (the rooms with a margin) or below the ground
const FALL = `
uniform float uPhase;
uniform vec3 uCentre;
uniform float uBox;
uniform float uHigh;
uniform vec2 uDrift;
uniform vec4 seasonShelter[ ${MOST_SHELTERS} ];
uniform float seasonShelterTop[ ${MOST_SHELTERS} ];
uniform int seasonShelters;
varying float vFall;
vec3 fallAt( vec3 seed ) {
	float k = fract( seed.z + uPhase );
	vFall = k;
	vec2 col = seed.xy * uBox + uDrift * k;
	vec2 rel = mod( col - uCentre.xz + 0.5 * uBox, uBox ) - 0.5 * uBox;
	return vec3( uCentre.x + rel.x, uHigh * ( 1.0 - k ), uCentre.z + rel.y );
}
bool sheltered( vec3 p ) {
	for ( int i = 0; i < ${MOST_SHELTERS}; i ++ ) {
		if ( i >= seasonShelters ) break;
		vec4 r = seasonShelter[ i ];
		float m = ${WEATHER_FX.margin.toFixed(2)};
		if ( p.y < seasonShelterTop[ i ] + m && p.x > r.x - m && p.x < r.z + m && p.z > r.y - m && p.z < r.w + m ) return true;
	}
	return false;
}
`

const RAIN_VERTEX = `
attribute vec2 corner;
uniform vec3 uFallDir;
uniform float uLength;
uniform float uWidth;
varying vec2 vCorner;
${FALL}
#include <fog_pars_vertex>
void main() {
	vec3 head = fallAt( position );
	vCorner = corner;
	vec4 h = modelViewMatrix * vec4( head, 1.0 );
	vec4 t = modelViewMatrix * vec4( head - uFallDir * uLength, 1.0 );
	vec3 along = t.xyz - h.xyz;
	vec3 side = normalize( cross( along, h.xyz ) ) * uWidth * 0.5;
	vec4 mvPosition = mix( h, t, corner.x );
	mvPosition.xyz += side * corner.y;
	gl_Position = projectionMatrix * mvPosition;
	// none under a roof: off the screen
	if ( sheltered( head ) ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
	#include <fog_vertex>
}
`
const RAIN_FRAGMENT = `
uniform vec4 uColor;
varying vec2 vCorner;
varying float vFall;
#include <fog_pars_fragment>
void main() {
	// soft across its width, fading towards its tail
	float a = uColor.a * ( 1.0 - abs( vCorner.y ) ) * ( 1.0 - 0.7 * vCorner.x );
	gl_FragColor = vec4( uColor.rgb, a );
	#include <fog_fragment>
}
`

const SNOW_VERTEX = `
uniform float uTime;
uniform float uFlutter;
uniform float uSize;
uniform float uScale;
${FALL}
#include <fog_pars_vertex>
void main() {
	vec3 p = fallAt( position );
	// each flake sways as it falls, on its own beat
	float beat = position.z * 40.0;
	p.x += sin( uTime * 1.3 + beat ) * uFlutter;
	p.z += cos( uTime * 1.1 + beat * 1.7 ) * uFlutter;
	vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
	gl_Position = projectionMatrix * mvPosition;
	gl_PointSize = min( 48.0, uSize * ( 0.7 + 0.6 * fract( beat ) ) * uScale / max( 0.1, - mvPosition.z ) );
	if ( sheltered( p ) ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
	#include <fog_vertex>
}
`
const SNOW_FRAGMENT = `
uniform vec4 uColor;
varying float vFall;
#include <fog_pars_fragment>
void main() {
	// a soft round flake, coming in at the top of its fall and going as it lands
	float d = length( gl_PointCoord - 0.5 );
	float a = uColor.a * smoothstep( 0.5, 0.15, d ) * smoothstep( 0.0, 0.06, vFall ) * smoothstep( 1.0, 0.97, vFall );
	gl_FragColor = vec4( uColor.rgb, a );
	#include <fog_fragment>
}
`

/** The seeds, made once: where each falls across the box (x, z: 0–1) and its own phase in its fall. */
function seeds(n: number, salt: number): Float32Array {
  const s = new Float32Array(n * 3)
  let x = salt >>> 0 || 1
  const r = () => {
    // a small fixed generator: the same field every time (16-view draws the same frame both ways)
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
  for (let i = 0; i < s.length; i++) s[i] = r()
  return s
}

/** The rain's streaks: four corners a drop (head and tail, either side), two triangles. */
function rainGeometry(n: number): BufferGeometry {
  const seed = seeds(n, 0x9e3779b9)
  const pos = new Float32Array(n * 4 * 3)
  const corner = new Float32Array(n * 4 * 2)
  const index = new Uint32Array(n * 6)
  const C = [0, -1, 0, 1, 1, -1, 1, 1]
  for (let i = 0; i < n; i++) {
    for (let v = 0; v < 4; v++) {
      pos.set(seed.subarray(i * 3, i * 3 + 3), (i * 4 + v) * 3)
      corner.set([C[v * 2], C[v * 2 + 1]], (i * 4 + v) * 2)
    }
    const a = i * 4
    index.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('corner', new Float32BufferAttribute(corner, 2))
  g.setIndex(new BufferAttribute(index, 1))
  return g
}

/** The snow's flakes: one point a seed. */
function snowGeometry(n: number): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(seeds(n, 0x85ebca6b), 3))
  return g
}

/** The rainbow's picture: across its width violet inside to red outside, soft at both edges (additive: dark is none). */
function rainbowTexture(): CanvasTexture {
  const W = 128
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = 2
  const c = canvas.getContext('2d')!
  const g = c.createLinearGradient(0, 0, W, 0)
  const bands = ['#7a3cff', '#3c64ff', '#2fc4ff', '#46e05a', '#fff04a', '#ff9a2e', '#ff3b30']
  bands.forEach((col, i) => g.addColorStop(0.08 + (i / (bands.length - 1)) * 0.84, col))
  c.fillStyle = g
  c.fillRect(0, 0, W, 2)
  const img = c.getImageData(0, 0, W, 2)
  for (let x = 0; x < W; x++) {
    const u = x / (W - 1)
    const a = Math.min(1, Math.min(u, 1 - u) / 0.22)
    for (let y = 0; y < 2; y++) for (let k = 0; k < 3; k++) img.data[(y * W + x) * 4 + k] = Math.round(img.data[(y * W + x) * 4 + k] * a * a)
  }
  c.putImageData(img, 0, 0)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

/** The rainbow's arc: 64 segments of half a ring (128 triangles), radius 1, its width a share of that, facing +z; across
 *  it (u) inside to outside. */
function rainbowArc(width: number): BufferGeometry {
  const N = 64
  const pos: number[] = []
  const uv: number[] = []
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI
    const c = Math.cos(a)
    const s = Math.sin(a)
    pos.push(c * (1 - width / 2), s * (1 - width / 2), 0, c * (1 + width / 2), s * (1 + width / 2), 0)
    uv.push(0, 0.5, 1, 0.5)
  }
  const index: number[] = []
  for (let i = 0; i < N; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  return g
}

/** The weather's renderer: rain, snow and the rainbow, as the look says. */
export function weatherFx(scene: Scene): WeatherEngine {
  const R = WEATHER_FX.rain
  const S = WEATHER_FX.snow
  const group = new Group()
  group.name = 'weather'
  // the outside, for the drawing pass (src/lib/visibility): from a room only through a window
  group.userData.cell = 'outside'
  scene.add(group)
  const fog = UniformsUtils.clone(UniformsLib.fog)
  /** what both read: the box, its clock and the roofs (the materials' own: one set for both) */
  const fall = (color: readonly number[]) => ({
    ...fog,
    ...shelterUniforms,
    uPhase: { value: 0 },
    uCentre: { value: new ThreeVector3() },
    uBox: { value: WEATHER_FX.box },
    uHigh: { value: WEATHER_FX.high },
    uDrift: { value: new Vector2() },
    uColor: { value: new ThreeVector4(color[0], color[1], color[2], color[3]) },
  })
  const rainU = { ...fall(R.color), uFallDir: { value: new ThreeVector3(0, -1, 0) }, uLength: { value: R.length }, uWidth: { value: R.width } }
  const snowU = { ...fall(S.color), uTime: { value: 0 }, uFlutter: { value: S.flutter }, uSize: { value: S.size }, uScale: { value: 1 } }
  const material = (u: Record<string, unknown>, vertexShader: string, fragmentShader: string) =>
    new ShaderMaterial({ uniforms: u as ShaderMaterial['uniforms'], vertexShader, fragmentShader, transparent: true, depthWrite: false, fog: true, side: DoubleSide })
  const rain = new Mesh(rainGeometry(WEATHER_FX.room), material(rainU, RAIN_VERTEX, RAIN_FRAGMENT))
  rain.name = 'rain'
  const snow = new Points(snowGeometry(WEATHER_FX.room), material(snowU, SNOW_VERTEX, SNOW_FRAGMENT))
  snow.name = 'snow'
  // drawn only where their box can be seen: a sphere and a box round it, kept up to date (three's own test reads the
  // sphere, the drawing pass the box)
  const sphere = new Sphere()
  const box = new Box3()
  for (const o of [rain, snow]) {
    o.geometry.boundingSphere = sphere
    o.geometry.boundingBox = box
    o.geometry.setDrawRange(0, 0)
    o.visible = false
    group.add(o)
  }

  const arcMap = rainbowTexture()
  const arc = new Mesh(rainbowArc(WEATHER_FX.rainbow.width), new MeshBasicMaterial({ map: arcMap, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, opacity: 0 }))
  arc.name = 'rainbow'
  arc.visible = false
  group.add(arc)
  // opposite the sun, on the ground
  const anti = { x: -SUN[0] / Math.hypot(SUN[0], SUN[2]), z: -SUN[2] / Math.hypot(SUN[0], SUN[2]) }

  const stats: WeatherStats = { rain: 0, snow: 0, rainbow: 0, ms: 0, mean: 0, median: 0, most: 0, frames: 0 }
  const times: number[] = []
  /** the weather's clock (seconds), each fall's phase kept apart from it so the shader's numbers stay small */
  const clock = { t: 0 }
  let last: { look: WeatherLook; camera: Camera; most: number; pixels: number } | null = null

  /** Everything from the look, the camera and the clock: no step per drop. */
  const aim = (look: WeatherLook, camera: Camera, most: number, pixels: number) => {
    const c = camera.position
    // the box's middle ahead of you, the way you look on the ground (the camera looks down its −z)
    const m = camera.matrixWorld.elements
    const fl = Math.hypot(m[8], m[10]) || 1
    const ax = c.x - (m[8] / fl) * WEATHER_FX.ahead
    const az = c.z - (m[10] / fl) * WEATHER_FX.ahead
    for (const [u, speed, wind] of [
      [rainU, R.speed, R.wind],
      [snowU, S.speed, S.wind],
    ] as const) {
      const fallTime = WEATHER_FX.high / speed
      u.uPhase.value = (clock.t / fallTime) % 1
      const w = look.wind * wind
      // as far as the wind takes it over its whole fall, and the box's middle upwind by half of it
      u.uDrift.value.set(WIND_DIR.x * w * fallTime, WIND_DIR.z * w * fallTime)
      u.uCentre.value.set(ax - u.uDrift.value.x / 2, 0, az - u.uDrift.value.y / 2)
    }
    const w = look.wind * R.wind
    rainU.uFallDir.value.set(WIND_DIR.x * w, -R.speed, WIND_DIR.z * w).normalize()
    snowU.uTime.value = clock.t % 1000
    // a flake's size in pixels: its metres times the drawing buffer's height over the view's height a metre away
    const fov = (camera as Camera & { fov?: number }).fov ?? 50
    snowU.uScale.value = pixels / (2 * Math.tan((fov * Math.PI) / 360))
    // as many as the tier draws at the full, times how far the weather is in: the first so many seeds
    const nRain = Math.min(WEATHER_FX.room, Math.round(most * Math.max(0, Math.min(1, look.rain))))
    const nSnow = Math.min(WEATHER_FX.room, Math.round(most * S.share * Math.max(0, Math.min(1, look.snow))))
    rain.geometry.setDrawRange(0, nRain * 6)
    snow.geometry.setDrawRange(0, nSnow)
    rain.visible = nRain > 0
    snow.visible = nSnow > 0
    stats.rain = nRain
    stats.snow = nSnow
    const half = (WEATHER_FX.box / 2) * Math.SQRT2
    const off = Math.max(Math.hypot(rainU.uCentre.value.x - c.x, rainU.uCentre.value.z - c.z), Math.hypot(snowU.uCentre.value.x - c.x, snowU.uCentre.value.z - c.z))
    sphere.center.set(c.x, WEATHER_FX.high / 2, c.z)
    sphere.radius = Math.hypot(half + off, WEATHER_FX.high / 2)
    box.min.set(c.x - half - off, 0, c.z - half - off)
    box.max.set(c.x + half + off, WEATHER_FX.high, c.z + half + off)
    // the rainbow: opposite the sun, far off and upright, its foot below the horizon
    const k = Math.max(0, Math.min(1, look.rainbow))
    arc.visible = k > 0
    stats.rainbow = k
    if (k > 0) {
      const F = WEATHER_FX.rainbow
      const r = F.far * F.radius
      arc.position.set(c.x + anti.x * F.far, -r * F.low, c.z + anti.z * F.far)
      arc.rotation.set(0, Math.atan2(-anti.x, -anti.z), 0)
      arc.scale.setScalar(r)
      ;(arc.material as MeshBasicMaterial).opacity = F.bright * k
    }
  }
  return {
    stats,
    update(look, camera, dt, most, pixels) {
      const t0 = performance.now()
      clock.t += Math.max(0, dt)
      last = { look, camera, most, pixels }
      aim(look, camera, most, pixels)
      const ms = performance.now() - t0
      stats.ms = ms
      stats.frames++
      times.push(ms)
      if (times.length > 120) times.shift()
      stats.mean = times.reduce((a, b) => a + b, 0) / times.length
      stats.most = Math.max(...times)
      stats.median = [...times].sort((a, b) => a - b)[times.length >> 1]
    },
    settle(seconds) {
      clock.t += Math.max(0, seconds)
      if (last) aim(last.look, last.camera, last.most, last.pixels)
    },
    clear() {
      clock.t = 0
    },
    async warm(gl, camera, target) {
      // drawn once with nothing in them, so their shaders are compiled
      const was = [rain.visible, snow.visible, arc.visible]
      rain.visible = snow.visible = arc.visible = true
      try {
        await gl.compileAsync(group, camera, target)
      } finally {
        ;[rain.visible, snow.visible, arc.visible] = was
      }
    },
    dispose() {
      scene.remove(group)
      for (const o of [rain, snow]) {
        o.geometry.boundingSphere = null
        o.geometry.boundingBox = null
        o.geometry.dispose()
        ;(o.material as ShaderMaterial).dispose()
      }
      arc.geometry.dispose()
      arcMap.dispose()
      ;(arc.material as MeshBasicMaterial).dispose()
    },
  }
}
