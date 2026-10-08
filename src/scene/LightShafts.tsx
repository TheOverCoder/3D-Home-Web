import { useMemo } from 'react'
import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Vector3 } from 'three'
import { SUN, WINDOWS, type WindowDef } from '../data/layout'
import { useHome } from '../store'
import { useSettings } from '../settings'

const T_HALF = 0.08 // half a wall thickness: shafts start on the inner face
const travel = new Vector3(-SUN[0], -SUN[1], -SUN[2]).normalize() // direction the sunlight moves

const vertex = /* glsl */ `
  attribute float aT;
  attribute float aU;
  varying float vT;
  varying float vU;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vT = aT;
    vU = aU;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vT;
  varying float vU;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    // faces seen head-on glow, silhouettes fade: a soft volume out of four flat sheets
    float facing = pow(abs(dot(normalize(vN), normalize(vView))), 2.2);
    // no hard outlines: each sheet dissolves towards its sides and where the beam meets the floor
    float sides = pow(sin(3.14159 * clamp(vU, 0.0, 1.0)), 0.7);
    float along = pow(1.0 - vT, 1.4);
    gl_FragColor = vec4(uColor, facing * sides * along * uIntensity);
  }
`

/** Sunlight leaving a window, as a translucent prism running down to the floor. */
function buildShaft(w: WindowDef): BufferGeometry | null {
  const n = w.at > 0 ? -1 : 1 // towards the inside of the house
  const normal = w.axis === 'x' ? new Vector3(0, 0, n) : new Vector3(n, 0, 0)
  if (travel.dot(normal) <= 0.05) return null // this window faces away from the sun

  const corner = (along: number, y: number) =>
    w.axis === 'x' ? new Vector3(along, y, w.at + n * T_HALF) : new Vector3(w.at + n * T_HALF, y, along)
  const lo = w.centre - w.width / 2
  const hi = w.centre + w.width / 2
  const top = [corner(lo, w.sill), corner(hi, w.sill), corner(hi, w.top), corner(lo, w.top)]
  const floor = top.map((p) => p.clone().addScaledVector(travel, p.y / -travel.y))
  const quad = (a: number, b: number) => [top[a], top[b], floor[b], top[a], floor[b], floor[a]]
  const ts = [0, 0, 1, 0, 1, 1]
  const us = [0, 1, 1, 0, 1, 0]
  const positions: number[] = []
  const t: number[] = []
  const u: number[] = []
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]] as const) {
    for (const p of quad(a, b)) positions.push(p.x, p.y, p.z)
    t.push(...ts)
    u.push(...us)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('aT', new Float32BufferAttribute(t, 1))
  g.setAttribute('aU', new Float32BufferAttribute(u, 1))
  g.computeVertexNormals()
  return g
}

/** Visible beams of sun through the windows that face it. Part of the "atmosphere" setting. */
export function LightShafts() {
  const haze = useSettings((s) => s.haze)
  const quality = useHome((s) => s.quality)
  const shafts = useMemo(() => WINDOWS.map((w) => ({ id: w.id, geometry: buildShaft(w) })).filter((s) => s.geometry), [])
  const uniforms = useMemo(() => ({ uColor: { value: new Vector3(1, 0.86, 0.62) }, uIntensity: { value: 0.16 } }), [])
  if (!haze || quality === 'low') return null
  return (
    <group renderOrder={5}>
      {shafts.map((s) => (
        <mesh key={s.id} geometry={s.geometry!} frustumCulled={false}>
          <shaderMaterial
            vertexShader={vertex}
            fragmentShader={fragment}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
