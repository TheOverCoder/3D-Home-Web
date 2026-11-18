import {
  BackSide,
  BoxGeometry,
  DirectionalLight,
  DoubleSide,
  Frustum,
  FrontSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Side,
} from 'three'
import { describe, expect, it } from 'vitest'
import { Parts } from './parts'
import { copiesMade, lodReady } from './lod'
import { castAsOne, shadowOnly, shadowSideOf, sunCopies } from './sun'

// One sun mesh for many (castAsOne): every caster under a root drawn into the sun's map by one mesh of its own — the same
// triangles three would draw, each from the side it would, so not a texel changes — and each of them casting no more,
// until it is released.

const material = (side: Side) => new MeshStandardMaterial({ side })

/** The triangles a mesh draws into a shadow map, in world space, each as the side it is drawn from sees it: wound so
 *  that a triangle drawn from its back reads as the same triangle turned round, and a two-sided one both ways. Each
 *  a key of its corners (rounded, rotated to start at the least), counted. */
function drawn(meshes: Mesh[]): Map<string, number> {
  const out = new Map<string, number>()
  const p = [new Vector3(), new Vector3(), new Vector3()]
  const key = (a: Vector3, b: Vector3, c: Vector3) => {
    const s = [a, b, c].map((q) => `${q.x.toFixed(4)},${q.y.toFixed(4)},${q.z.toFixed(4)}`.replace(/-0\.0000/g, '0.0000'))
    const k = s.indexOf([...s].sort()[0])
    return [s[k], s[(k + 1) % 3], s[(k + 2) % 3]].join(' ')
  }
  const add = (k: string) => out.set(k, (out.get(k) ?? 0) + 1)
  for (const m of meshes) {
    m.updateWorldMatrix(true, false)
    const g = m.geometry
    const im = m as InstancedMesh
    const places = im.isInstancedMesh ? Array.from({ length: im.count }, (_, i) => im.getMatrixAt(i, new Matrix4()).premultiply(m.matrixWorld)) : [m.matrixWorld]
    // three turns a mesh's front face round when its own matrix mirrors it (not an instance's)
    const mirrored = m.matrixWorld.determinant() < 0
    const side = shadowSideOf(m.material as MeshStandardMaterial)
    const n = g.index ? g.index.count : g.attributes.position.count
    for (const place of places)
      for (let k = 0; k < n; k += 3) {
        for (let j = 0; j < 3; j++) p[j].fromBufferAttribute(g.attributes.position, g.index ? g.index.getX(k + j) : k + j).applyMatrix4(place)
        const front = key(p[0], p[1], p[2])
        const back = key(p[0], p[2], p[1])
        // the triangle as its front face reads in the world (its winding, turned for a mirror three makes up for)
        const [f, b] = mirrored ? [back, front] : [front, back]
        if (side === DoubleSide) {
          add(f)
          add(b)
        } else add(side === FrontSide ? f : b)
      }
  }
  return out
}

const sorted = (m: Map<string, number>) => [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1))

function lightFrustum() {
  const light = new DirectionalLight()
  light.position.set(12, 9, 10)
  light.updateMatrixWorld(true)
  light.shadow.camera.left = light.shadow.camera.bottom = -40
  light.shadow.camera.right = light.shadow.camera.top = 40
  light.shadow.camera.updateProjectionMatrix()
  light.shadow.updateMatrices(light)
  return light.shadow.getFrustum()
}

function cameraFrustum() {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100)
  camera.position.set(0, 2, 20)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  return new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
}

/** A building of three casters: walls (one-sided), a sign (two-sided) and a roof drawn from its inside (back-sided). */
function building() {
  const root = new Group()
  root.name = 'shop'
  root.position.set(3, 0, -2)
  root.rotation.y = 0.4
  const walls = new Mesh(new BoxGeometry(4, 3, 3, 3, 2, 2), material(FrontSide))
  walls.position.set(0, 1.5, 0)
  const sign = new Mesh(new PlaneGeometry(1.2, 0.5), material(DoubleSide))
  sign.position.set(0, 3.4, 1.6)
  const roof = new Mesh(new BoxGeometry(4.4, 0.2, 3.4), material(BackSide))
  roof.position.set(0, 3.1, 0)
  for (const m of [walls, sign, roof]) {
    m.castShadow = true
    root.add(m)
  }
  return { root, walls, sign, roof }
}

describe('castAsOne', () => {
  it('draws the same triangles from the same sides as the casters did, with one mesh drawn only into shadow maps', () => {
    const { root, walls, sign, roof } = building()
    const before = drawn([walls, sign, roof])
    const one = castAsOne(root)
    expect(one.parent).toBe(root)
    expect(drawn([one])).toEqual(before)
    expect(sorted(drawn([one]))).toEqual(sorted(before))
    // the walls are most of it: the one mesh is drawn from their side, the sign both ways round, the roof turned
    expect(shadowSideOf(one.material as MeshStandardMaterial)).toBe(BackSide)
    const tris = (g: BufferGeometry) => g.index!.count / 3
    expect(tris(one.geometry)).toBe(tris(walls.geometry) + 2 * tris(sign.geometry) + tris(roof.geometry))
    // they cast no more; it does, into a light's shadow map and never a camera's view, and a ray meets nothing
    for (const m of [walls, sign, roof]) expect(m.castShadow).toBe(false)
    expect(one.castShadow).toBe(true)
    expect(one.userData.shadowOnly).toBe(true)
    root.updateMatrixWorld(true)
    expect(one.intersectsFrustum(lightFrustum())).toBe(true)
    expect(one.intersectsFrustum(cameraFrustum())).toBe(false)
  })

  it('takes in each instance where it stands, and a mirrored mesh wound as three draws it (its front face turned)', () => {
    const root = new Group()
    root.position.set(-5, 0, 4)
    root.scale.setScalar(1.5)
    const posts = new InstancedMesh(new BoxGeometry(0.2, 2, 0.2), material(FrontSide), 8)
    posts.count = 3
    for (let i = 0; i < 3; i++) posts.setMatrixAt(i, new Matrix4().makeRotationY(i * 0.7).setPosition(i * 1.5, 1, 0))
    const mirror = new Mesh(new BoxGeometry(1, 1, 2, 1, 1, 2), material(FrontSide))
    mirror.position.set(0, 0.5, 3)
    mirror.scale.set(-1, 1, 1)
    mirror.rotation.y = 0.3
    for (const m of [posts, mirror]) {
      m.castShadow = true
      root.add(m)
    }
    const before = drawn([posts, mirror])
    const one = castAsOne(root)
    expect(sorted(drawn([one]))).toEqual(sorted(before))
    expect(one.geometry.index!.count).toBe(3 * posts.geometry.index!.count + mirror.geometry.index!.count)
  })

  it('leaves alone what is hidden, what does not cast, and what is not drawn by its shape and side alone', () => {
    const { root, walls, sign, roof } = building()
    const hidden = new Mesh(new BoxGeometry(), material(FrontSide))
    hidden.castShadow = true
    hidden.visible = false
    const cutOut = new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ alphaTest: 0.5 }))
    cutOut.castShadow = true
    const seenOnly = new Mesh(new BoxGeometry(), material(FrontSide))
    root.add(hidden, cutOut, seenOnly)
    const before = drawn([walls, sign, roof])
    const one = castAsOne(root)
    expect(sorted(drawn([one]))).toEqual(sorted(before))
    expect(walls.castShadow).toBe(false)
    expect(hidden.castShadow).toBe(true)
    expect(cutOut.castShadow).toBe(true)
    expect(seenOnly.castShadow).toBe(false)
    expect(seenOnly.userData.castInto).toBeUndefined()
  })

  it('release() takes it away and lets everything it took in cast again', () => {
    const { root, walls, sign, roof } = building()
    const before = drawn([walls, sign, roof])
    const one = castAsOne(root)
    one.release()
    expect(one.parent).toBeNull()
    for (const m of [walls, sign, roof]) {
      expect(m.castShadow).toBe(true)
      expect(m.userData.castInto).toBeUndefined()
    }
    // and made again, it is the same
    const again = castAsOne(root)
    expect(sorted(drawn([again]))).toEqual(sorted(before))
    expect(root.children.filter((o) => o.userData.sunOne)).toEqual([again])
  })

  it('nothing casting under the root: a mesh that casts nothing, not added', () => {
    const root = new Group()
    root.add(new Mesh(new BoxGeometry(), material(FrontSide)))
    const one = castAsOne(root)
    expect(one.castShadow).toBe(false)
    expect(one.parent).toBeNull()
    one.release()
  })

  it("takes a crowd's sun meshes in whole, and the copies for the sun it makes later cast nothing", async () => {
    await lodReady()
    const parts = new Parts({ ball: { geometry: new SphereGeometry(0.4, 48, 24), max: 4, castShadow: true }, stand: { geometry: new BoxGeometry(0.1, 1, 0.1), max: 4, castShadow: true } }, 'balls')
    parts.begin()
    for (const x of [-2, 2]) {
      parts.at(x, 0, 0)
      parts.put('stand', 0, 0.5, 0)
      parts.put('ball', 0, 1.2, 0)
    }
    parts.end()
    const root = new Group()
    root.add(parts.group)
    const crowd = () => parts.group.children.filter((o) => o.userData.shadowOnly) as InstancedMesh[]
    const before = drawn(crowd().filter((m) => m.count > 0))
    const one = castAsOne(root)
    expect(sorted(drawn([one]))).toEqual(sorted(before))
    // the crowd's copies for the sun come in idle time: under the one mesh's root, none of them casts
    await copiesMade()
    expect(crowd().length).toBeGreaterThan(2)
    for (const m of crowd()) expect(m.castShadow, m.name).toBe(false)
    // the one mesh is drawn from its own copy for the sun, the whole shape while the copies are switched off
    const whole = one.userData.sunWhole as BufferGeometry
    expect(whole).toBeDefined()
    expect(one.geometry).not.toBe(whole)
    expect(one.geometry.index!.count).toBeLessThan(whole.index!.count)
    root.updateMatrixWorld(true)
    sunCopies.on = false
    try {
      one.intersectsFrustum(lightFrustum())
      expect(one.geometry).toBe(whole)
    } finally {
      sunCopies.on = true
    }
    one.intersectsFrustum(lightFrustum())
    expect(one.geometry).not.toBe(whole)
    // released, the crowd casts as it did, through its own sun meshes
    one.release()
    expect(crowd().every((m) => m.castShadow)).toBe(true)
  })

  it('a sun mesh made again for what castAsOne took in still casts nothing', () => {
    const { root, walls } = building()
    const caster = shadowOnly(new Mesh(walls.geometry, walls.material))
    root.add(caster)
    walls.castShadow = false
    const one = castAsOne(root)
    expect(caster.castShadow).toBe(false)
    shadowOnly(caster, walls.geometry, walls.geometry)
    expect(caster.castShadow).toBe(false)
    one.release()
    expect(caster.castShadow).toBe(true)
  })
})
