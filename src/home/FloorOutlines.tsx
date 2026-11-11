import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Euler, InstancedBufferAttribute, InstancedBufferGeometry, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3, Vector4, type Camera } from 'three'
import type { Rect } from '../farm/layout'

/** One rectangle on the floor: a soft fill and a crisp edge (src/farm/EditMode.tsx's Outline, drawn here in bulk). */
export interface FloorRect {
  /** what it outlines (a piece's id): the order rectangles were first shown in is kept for ties, as three keeps it */
  key: string
  r: Rect
  color: string
  fill: number
  edge: number
  y: number
}

const PART = new PlaneGeometry(2, 2) // a unit square's corners at ±1: times each part's half size
const FLAT = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0))
const ONE = new Vector3(1, 1, 1)
const at = new Vector3()
const model = new Matrix4()
const modelView = new Matrix4()
const projScreen = new Matrix4()
const v4 = new Vector4()
const colour = new Color()

interface Part {
  /** the order three would draw it in among parts as far away: when its mesh was made (rectangle, then fill or bar) */
  seq: number
  x: number
  y: number
  z: number
  hw: number
  hd: number
  r: number
  g: number
  b: number
  a: number
  /** its distance in clip space, as three sorts transparent meshes */
  depth: number
}

/** A material that draws each part as MeshBasicMaterial draws a plane of its own: the same corners (±half size), the
 *  same model-view matrix (worked out in double precision, as three does for a mesh), the same colour and opacity. */
function partMaterial() {
  const m = new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false })
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute mat4 partModelView;\nattribute vec2 partHalf;\nattribute vec4 partColour;\nflat varying vec4 vPartColour;')
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position.xy * partHalf, 0.0 );\nvPartColour = partColour;')
      .replace('#include <project_vertex>', 'vec4 mvPosition = partModelView * vec4( transformed, 1.0 );\ngl_Position = projectionMatrix * mvPosition;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nflat varying vec4 vPartColour;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vPartColour;')
  }
  m.customProgramCacheKey = () => 'floor-outline-part'
  return m
}

/** Hidden in the scene from the start, so the loading screen's warm-up (src/scene/Warmup.tsx) compiles the parts'
 *  shader: decorating never waits for it. */
export const outlinesWarmup = new Mesh(PART, partMaterial())
outlinesWarmup.visible = false
outlinesWarmup.frustumCulled = false

class Layer {
  geometry = new InstancedBufferGeometry()
  mesh: Mesh
  parts: Part[] = []
  private size = 0
  constructor(renderOrder: number) {
    this.geometry.index = PART.index
    this.geometry.setAttribute('position', PART.getAttribute('position'))
    this.mesh = new Mesh(this.geometry, partMaterial())
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this.grow(16)
  }
  private grow(n: number) {
    this.size = n
    this.geometry.setAttribute('partModelView', new InstancedBufferAttribute(new Float32Array(n * 16), 16))
    this.geometry.setAttribute('partHalf', new InstancedBufferAttribute(new Float32Array(n * 2), 2))
    this.geometry.setAttribute('partColour', new InstancedBufferAttribute(new Float32Array(n * 4), 4))
  }
  /** Sorts the parts as three sorts transparent meshes (far first, then the older), and writes them for `camera`. */
  write(camera: Camera) {
    const parts = this.parts
    if (parts.length > this.size) this.grow(Math.max(parts.length, this.size * 2))
    for (const p of parts) {
      // three: the bounding sphere's centre (the plane's middle) through the mesh's world matrix, then the camera's
      model.compose(at.set(p.x, p.y, p.z), FLAT, ONE)
      p.depth = v4.set(0, 0, 0, 1).applyMatrix4(model).applyMatrix4(projScreen).z
    }
    parts.sort((a, b) => (a.depth !== b.depth ? b.depth - a.depth : a.seq - b.seq))
    const mv = this.geometry.getAttribute('partModelView') as InstancedBufferAttribute
    const half = this.geometry.getAttribute('partHalf') as InstancedBufferAttribute
    const col = this.geometry.getAttribute('partColour') as InstancedBufferAttribute
    const M = mv.array as Float32Array
    const Hf = half.array as Float32Array
    const C = col.array as Float32Array
    parts.forEach((p, i) => {
      model.compose(at.set(p.x, p.y, p.z), FLAT, ONE)
      modelView.multiplyMatrices(camera.matrixWorldInverse, model)
      M.set(modelView.elements, i * 16)
      Hf[i * 2] = p.hw
      Hf[i * 2 + 1] = p.hd
      C[i * 4] = p.r
      C[i * 4 + 1] = p.g
      C[i * 4 + 2] = p.b
      C[i * 4 + 3] = p.a
    })
    mv.needsUpdate = half.needsUpdate = col.needsUpdate = true
    this.geometry.instanceCount = parts.length
  }
  dispose() {
    this.geometry.dispose()
    ;(this.mesh.material as MeshBasicMaterial).dispose()
  }
}

/**
 * The decorate mode's outlines on the floor, every one in two draws (all the fills, then all the edges) where a mesh
 * each made five per piece: drawn exactly as those meshes were — the same corners and model-view matrices, the same
 * colours, in the same order (three sorts transparent meshes far to near, the older first among equals), so not a
 * pixel changes. Over everything (no depth test), above the rest of the see-through things (group order 20), as the
 * single outlines are (src/farm/EditMode.tsx).
 */
export function FloorOutlines({ rects }: { rects: FloorRect[] }) {
  const s = useMemo(() => ({ fills: new Layer(20), bars: new Layer(21), seq: new Map<string, number>(), next: 0, rects: null as FloorRect[] | null, view: new Float64Array(32) }), [])
  useEffect(() => () => (s.fills.dispose(), s.bars.dispose()), [s])
  // after the camera has moved for this frame and before it is drawn (the effects draw at priority 1); only when the
  // rectangles or the camera changed
  useFrame(({ camera }) => {
    camera.updateMatrixWorld()
    const changed = s.rects !== rects
    if (changed) {
      s.rects = rects
      // when each rectangle was first shown: kept while it stays, as a mesh of its own keeps its id
      const keys = new Set(rects.map((r) => r.key))
      for (const k of s.seq.keys()) if (!keys.has(k)) s.seq.delete(k)
      for (const r of rects) if (!s.seq.has(r.key)) s.seq.set(r.key, s.next++)
      s.fills.parts = []
      s.bars.parts = []
      for (const { key, r, color, fill, edge, y } of rects) {
        const seq = s.seq.get(key)! * 5
        const w = r.maxX - r.minX
        const d = r.maxZ - r.minZ
        const cx = (r.minX + r.maxX) / 2
        const cz = (r.minZ + r.maxZ) / 2
        colour.set(color)
        const part = (n: number, x: number, py: number, z: number, pw: number, pd: number, a: number): Part => ({
          seq: seq + n,
          x,
          y: py,
          z,
          hw: pw / 2,
          hd: pd / 2,
          r: colour.r,
          g: colour.g,
          b: colour.b,
          a,
          depth: 0,
        })
        s.fills.parts.push(part(0, cx, y, cz, w, d, fill))
        s.bars.parts.push(
          part(1, cx, y + 0.01, r.minZ + edge / 2, w, edge, 0.95),
          part(2, cx, y + 0.01, r.maxZ - edge / 2, w, edge, 0.95),
          part(3, r.minX + edge / 2, y + 0.01, cz, edge, d - edge * 2, 0.95),
          part(4, r.maxX - edge / 2, y + 0.01, cz, edge, d - edge * 2, 0.95),
        )
      }
    }
    const P = camera.projectionMatrix.elements
    const V = camera.matrixWorldInverse.elements
    let moved = false
    for (let i = 0; i < 16; i++) {
      if (s.view[i] !== P[i] || s.view[16 + i] !== V[i]) moved = true
      s.view[i] = P[i]
      s.view[16 + i] = V[i]
    }
    if (!changed && !moved) return
    projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    s.fills.write(camera)
    s.bars.write(camera)
  }, 0.5)
  return (
    <group renderOrder={20}>
      <primitive object={s.fills.mesh} />
      <primitive object={s.bars.mesh} />
    </group>
  )
}
