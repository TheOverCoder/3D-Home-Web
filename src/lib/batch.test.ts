import { BoxGeometry, DirectionalLight, DoubleSide, Frustum, Group, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Vector3, type BufferGeometry, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { batchStatic } from './batch'

// The static batch (src/lib/batch.ts): what never moves merged by look and quarter, and with `sunAsOne` (the farm) what
// casts drawn into the sun's map merged further — one mesh for each quarter and side drawn, whatever its looks, drawn
// only into shadow maps — with the same triangles; a part taken out of the merge (a gate swinging) taken out of the sun's
// mesh too; the originals back, the sun's meshes gone. Without it (the house) each look casts on its own, as it was.

/** A shed of many colours in one quarter (each colour a merged mesh of its own), a two-sided sign beside it, and a post
 *  in the next quarter; the shed's door a part of its own. */
function yard() {
  const root = new Group()
  const add = (o: Object3D, parent: Object3D = root) => {
    parent.add(o)
    return o
  }
  const box = (colour: string, x: number, z: number, size = 0.4) => {
    const m = new Mesh(new BoxGeometry(size, size, size), new MeshStandardMaterial({ color: colour }))
    m.position.set(x, size / 2, z)
    m.castShadow = true
    return m
  }
  for (const [i, c] of ['#7a5a3c', '#d8342a', '#e8792a', '#f0cf4a', '#7cb84a'].entries()) add(box(c, -9 + i * 0.3, 11))
  const sign = new Mesh(new PlaneGeometry(0.8, 0.4), new MeshStandardMaterial({ color: '#c9ccce', side: DoubleSide }))
  sign.position.set(-8, 1.2, 10)
  sign.castShadow = true
  add(sign)
  const door = add(new Group())
  door.userData.part = 'door'
  add(box('#7a5a3c', -9.5, 11.6, 0.3), door)
  add(box('#7a5a3c', 6, 11))
  // seen, casting nothing
  add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: '#ffffff' })))
  root.updateMatrixWorld(true)
  return root
}

const casters = (root: Object3D) => root.children.filter((o) => (o as Mesh).isMesh && o.visible && (o as Mesh).castShadow) as Mesh[]
const triangles = (meshes: Mesh[]) => meshes.reduce((n, m) => n + m.geometry.getAttribute('position').count / 3, 0)

/** The triangles of non-indexed meshes in their root's frame, as sorted keys (the same set drawn twice reads the same). */
function shape(meshes: Mesh[]) {
  const out: string[] = []
  const v = new Vector3()
  for (const m of meshes) {
    const pos = (m.geometry as BufferGeometry).getAttribute('position')
    for (let i = 0; i < pos.count; i += 3) {
      const k: string[] = []
      for (let j = 0; j < 3; j++)
        k.push(
          v
            .fromBufferAttribute(pos, i + j)
            .toArray()
            .map((n) => n.toFixed(4))
            .join(','),
        )
      out.push(k.join(' '))
    }
  }
  return out.sort()
}

describe('the static batch in the sun', () => {
  it("draws what casts into the sun's map from one mesh a quarter and side, with the same triangles, and the merged meshes cast nothing", () => {
    const root = yard()
    const b = batchStatic(root, { sunAsOne: true })
    const merged = root.children.filter((o) => o.name === 'static-batch') as Mesh[]
    const suns = root.children.filter((o) => o.name === 'static-batch-sun') as Mesh[]
    // five colours and a door in the shed's quarter, a sign, a post in the next: as many merged meshes as looks in each
    expect(merged.filter((m) => m.visible).length).toBe(8)
    // in the sun: the shed's quarter one-sided, its sign two-sided, and the post's quarter
    expect(suns.length).toBe(3)
    expect(casters(root).every((m) => m.userData.shadowOnly)).toBe(true)
    const casting = merged.filter((m) => (m.material as MeshStandardMaterial).color.getHexString() !== 'ffffff')
    expect(shape(suns)).toEqual(shape(casting))
    expect(triangles(suns)).toBe(triangles(casting))
    // drawn only into shadow maps: a light's frustum meets them, a camera looking at them never
    const light = new DirectionalLight()
    light.position.set(12, 9, 10)
    light.updateMatrixWorld(true)
    light.shadow.camera.left = light.shadow.camera.bottom = -20
    light.shadow.camera.right = light.shadow.camera.top = 20
    light.shadow.camera.updateProjectionMatrix()
    light.shadow.updateMatrices(light)
    const camera = new PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(-2, 2, 20)
    camera.lookAt(-2, 0, 10)
    camera.updateMatrixWorld(true)
    const seen = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    for (const s of suns) {
      expect(s.intersectsFrustum(light.shadow.getFrustum())).toBe(true)
      expect(s.intersectsFrustum(seen)).toBe(false)
    }
    b.dispose()
    expect(root.children.some((o) => o.name.startsWith('static-batch'))).toBe(false)
  })

  it('a part taken out of the merge is taken out of the sun’s mesh too, and put back', () => {
    const root = yard()
    const b = batchStatic(root, { sunAsOne: true })
    const suns = () => root.children.filter((o) => o.name === 'static-batch-sun') as Mesh[]
    const before = shape(suns())
    const door = root.children.find((o) => o.userData.part === 'door')!.children[0] as Mesh
    b.exclude(new Set(['door']))
    // the door drawn on its own (and casting on its own); in the sun's meshes its triangles are folded to nothing
    expect(door.visible).toBe(true)
    expect(door.castShadow).toBe(true)
    const folded = shape(suns()).filter((t) => t !== '0.0000,0.0000,0.0000 0.0000,0.0000,0.0000 0.0000,0.0000,0.0000')
    expect(folded.length).toBe(before.length - door.geometry.index!.count / 3)
    b.exclude(new Set())
    expect(shape(suns())).toEqual(before)
    b.dispose()
  })

  it('without sunAsOne (the house, where the sun leaves things out room by room) each merged look casts on its own', () => {
    const root = yard()
    const b = batchStatic(root)
    expect(root.children.some((o) => o.name === 'static-batch-sun')).toBe(false)
    const merged = root.children.filter((o) => o.name === 'static-batch') as Mesh[]
    expect(merged.filter((m) => m.castShadow).length).toBe(7)
    b.dispose()
  })

  it("the originals shown again: the sun's meshes are hidden with the merged ones", () => {
    const root = yard()
    const b = batchStatic(root, { sunAsOne: true })
    b.setMerged(false)
    for (const o of root.children) if (o.name.startsWith('static-batch')) expect(o.visible).toBe(false)
    b.setMerged(true)
    for (const o of root.children) if (o.name === 'static-batch-sun') expect(o.visible).toBe(true)
    b.dispose()
  })
})
