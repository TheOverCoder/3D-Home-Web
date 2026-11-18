import { BoxGeometry, Color, DirectionalLight, Frustum, Group, InstancedMesh, Matrix4, PerspectiveCamera, Quaternion, Raycaster, SphereGeometry, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { Parts, liveParts, type ModelTest } from './parts'
import { copiesMade, lodReady } from './lod'
import { sunCopies } from './sun'

// A crowd draws only the models the view can see (the drawing pass, src/lib/visibility): each model — everything put
// after one `at` — is tested once by its box, its parts drawn whole or not at all, in the order they were put, with
// their own colours; a part that casts a shadow is left out like the others, its shadow drawn by a mesh of its own that
// holds every model put and is drawn only into shadow maps; and `cull(null)` draws everything again.

const ROW = [-20, -10, 0, 10, 20]

function herd(models = ROW) {
  const parts = new Parts({
    body: { geometry: new BoxGeometry(1, 0.6, 1.6), max: 64 },
    leg: { geometry: new BoxGeometry(0.15, 0.6, 0.15), max: 256 },
    pole: { geometry: new BoxGeometry(0.1, 2, 0.1), max: 64, castShadow: true },
  })
  const colour = new Color()
  parts.begin()
  models.forEach((x, i) => {
    parts.at(x, 0, 0, i * 0.3)
    parts.put('body', 0, 0.9, 0, 0, 0, 0, 1, colour.setRGB(i / 10, 0.5, 1))
    for (const [lx, lz] of [
      [-0.35, -0.6],
      [0.35, -0.6],
      [-0.35, 0.6],
      [0.35, 0.6],
    ])
      parts.put('leg', lx, 0.3, lz, 0.1 * i, 0, 0, 1, colour.setRGB(1, i / 10, 0))
    parts.put('pole', 0, 1, -1)
  })
  parts.end()
  return parts
}

/** The models whose box reaches into x ∈ [-5, 5], and how many times it was asked. */
function band() {
  const asked: number[][] = []
  const test: ModelTest = (minX, minY, minZ, maxX, maxY, maxZ) => {
    asked.push([minX, minY, minZ, maxX, maxY, maxZ])
    return maxX >= -5 && minX <= 5
  }
  return { test, asked }
}

/** The mesh that draws a casting part into shadow maps (every model put). */
const casterOf = (parts: Parts, part: string) => parts.group.getObjectByName(`${parts.group.name}-${part}-sun`) as InstancedMesh

const matrices = (parts: Parts, part: string) => Array.from(parts.meshes[part].instanceMatrix.array.slice(0, parts.meshes[part].count * 16))
const colours = (parts: Parts, part: string) => Array.from(parts.meshes[part].instanceColor!.array.slice(0, parts.meshes[part].count * 3))

describe('a crowd drawn model by model', () => {
  it('tests each model once and draws only the parts of those seen, in order, with their colours', () => {
    const all = herd()
    const full = { body: matrices(all, 'body'), leg: matrices(all, 'leg'), bodyColour: colours(all, 'body'), legColour: colours(all, 'leg') }
    const { test, asked } = band()
    all.cull(test)
    // one test per model, not per part (a model here is six parts)
    expect(asked.length).toBe(ROW.length)
    expect(all.culledModels).toBe(4)
    // the middle one (x = 0, the third put) is drawn: its body and its four legs, exactly as they were put
    expect(all.meshes.body.count).toBe(1)
    expect(all.meshes.leg.count).toBe(4)
    expect(matrices(all, 'body')).toEqual(full.body.slice(2 * 16, 3 * 16))
    expect(matrices(all, 'leg')).toEqual(full.leg.slice(8 * 16, 12 * 16))
    expect(colours(all, 'body')).toEqual(full.bodyColour.slice(2 * 3, 3 * 3))
    expect(colours(all, 'leg')).toEqual(full.legColour.slice(8 * 3, 12 * 3))
    // a caster is left out like the rest: its shadow is a mesh of its own, every model put, whatever the view
    expect(all.meshes.pole.count).toBe(1)
    expect(all.meshes.pole.castShadow).toBe(false)
    const sun = casterOf(all, 'pole')
    expect(sun.castShadow).toBe(true)
    expect(sun.count).toBe(ROW.length)
    expect(all.drawnInstances).toBe(1 + 4 + 1)
    // every model's box holds its parts: the body (1.6 long, turned) and the legs under it
    const box = asked[2]
    expect(box[0]).toBeLessThanOrEqual(-0.8)
    expect(box[1]).toBeLessThanOrEqual(0)
    expect(box[4]).toBeGreaterThanOrEqual(2)
    // everything again: in the order put
    all.cull(null)
    expect(all.meshes.body.count).toBe(ROW.length)
    expect(matrices(all, 'body')).toEqual(full.body)
    expect(matrices(all, 'leg')).toEqual(full.leg)
    expect(colours(all, 'leg')).toEqual(full.legColour)
  })

  it('every model left out: no instance drawn, the mesh still there for a ray', () => {
    const all = herd()
    all.cull(() => false)
    expect(all.meshes.body.count).toBe(0)
    expect(all.meshes.leg.count).toBe(0)
    expect(all.meshes.body.visible).toBe(true)
    expect(all.meshes.pole.count).toBe(0)
    expect(casterOf(all, 'pole').count).toBe(ROW.length)
    all.cull(() => true)
    expect(all.meshes.body.count).toBe(ROW.length)
  })

  it('tests the model where its group stands now (a pen moved in the edit mode)', () => {
    const all = herd()
    all.group.position.set(10, 0, 0)
    all.group.updateMatrixWorld(true)
    const { test } = band()
    all.cull(test)
    // the model put at x = -10 now stands at 0, the one at -20 at -10
    expect(all.meshes.body.count).toBe(1)
    expect(Array.from(all.meshes.body.instanceMatrix.array.slice(12, 13))).toEqual([-10])
  })

  it('hands nothing new over while the same models are seen', () => {
    const all = herd()
    const { test } = band()
    all.cull(test)
    const version = all.meshes.leg.instanceMatrix.version
    all.cull(test)
    expect(all.meshes.leg.instanceMatrix.version).toBe(version)
    // a new frame put: handed over again
    all.end()
    all.cull(test)
    expect(all.meshes.leg.instanceMatrix.version).toBeGreaterThan(version)
  })

  it('uses the same arrays every time (nothing is allocated per frame)', () => {
    const all = herd()
    const attr = all.meshes.leg.instanceMatrix
    const array = attr.array
    const { test } = band()
    for (let i = 0; i < 3; i++) {
      all.cull(test)
      all.cull(null)
    }
    expect(all.meshes.leg.instanceMatrix).toBe(attr)
    expect(all.meshes.leg.instanceMatrix.array).toBe(array)
  })

  it('a ray meets every model put, whether or not the view draws it', () => {
    const all = herd()
    all.group.updateMatrixWorld(true)
    all.cull(band().test)
    const hits = new Raycaster(new Vector3(20, 0.9, 10), new Vector3(0, 0, -1)).intersectObject(all.group, true)
    expect(hits.some((h) => h.object === all.meshes.body && h.instanceId === 4)).toBe(true)
    // and the meshes still draw only what was seen
    expect(all.meshes.body.count).toBe(1)
  })

  it('more models than ever before: room for them, and each still tested once', () => {
    const many = Array.from({ length: 40 }, (_, i) => -100 + i * 5)
    const all = herd(many)
    const { test, asked } = band()
    all.cull(test)
    expect(asked.length).toBe(40)
    // x = -5, 0 and 5 (their boxes reach into the band)
    expect(all.meshes.body.count).toBe(3)
  })

  it('parts put before any `at` make one model', () => {
    const parts = new Parts({ leaf: { geometry: new BoxGeometry(0.1, 0.1, 0.1), max: 8 } })
    parts.begin()
    parts.putMatrix('leaf', new Matrix4().makeTranslation(0, 0, 0))
    parts.putMatrix('leaf', new Matrix4().makeTranslation(30, 0, 0))
    parts.end()
    const { test, asked } = band()
    parts.cull(test)
    expect(asked.length).toBe(1)
    expect(parts.meshes.leaf.count).toBe(2)
  })

  it("a caster's shadow mesh is drawn only into shadow maps: a light's shadow pass meets it, a camera never, a ray never", () => {
    const all = herd()
    all.group.updateMatrixWorld(true)
    const sun = casterOf(all, 'pole')
    const light = new DirectionalLight()
    light.position.set(10, 20, 10)
    light.updateMatrixWorld(true)
    light.shadow.camera.left = light.shadow.camera.bottom = -40
    light.shadow.camera.right = light.shadow.camera.top = 40
    light.shadow.updateMatrices(light)
    expect(sun.intersectsFrustum(light.shadow.getFrustum())).toBe(true)
    // a camera looking straight at it
    const camera = new PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(0, 1, 30)
    camera.lookAt(0, 1, 0)
    camera.updateMatrixWorld(true)
    const seen = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    expect(all.meshes.pole.intersectsFrustum(seen)).toBe(true)
    expect(sun.intersectsFrustum(seen)).toBe(false)
    const hits = new Raycaster(new Vector3(0, 1, 30), new Vector3(0, 0, -1)).intersectObject(sun)
    expect(hits).toEqual([])
  })

  it("a caster's instances go to the sun's copy that keeps their shadow to the texel at their size, whatever the camera", async () => {
    const parts = new Parts({ ball: { geometry: new SphereGeometry(0.4, 64, 32), max: 8, castShadow: true } }, 'balls')
    // its copies for the sun, made in idle time once the simplifier has loaded
    await lodReady()
    await copiesMade()
    parts.begin()
    parts.at(-3, 0, 0)
    parts.put('ball', 0, 1, 0)
    parts.at(3, 0, 0)
    parts.put('ball', 0, 1, 0, 0, 0, 0, 3)
    parts.end()
    parts.group.updateMatrixWorld(true)
    const casters = parts.group.children.filter((o) => o.userData.shadowOnly) as InstancedMesh[]
    const held = () => casters.map((m) => [m.name, m.count, Array.from(m.instanceMatrix.array.slice(0, m.count * 16))])
    // both cast, from two meshes: the one drawn as built from a copy, the one three times its size finer (or whole)
    expect(casters.reduce((n, m) => n + m.count, 0)).toBe(2)
    const big = casters.find((m) => m.count > 0 && m.instanceMatrix.array[0] > 2)!
    const small = casters.find((m) => m.count > 0 && Math.abs(m.instanceMatrix.array[0] - 1) < 1e-6)!
    expect(small).not.toBe(big)
    expect(small.geometry.index!.count).toBeLessThan(big.geometry.index!.count)
    expect(small.name).not.toBe('balls-ball-sun')
    // the camera anywhere, near or far, culling or not: the sun's meshes hold the same
    const before = held()
    for (const x of [0, 50, 500]) {
      parts.cull(() => x < 100, { x, y: 1.6, z: 0, pixels: 600 })
      expect(held()).toEqual(before)
    }
    // switched off: every instance whole
    sunCopies.on = false
    try {
      parts.cull(null, null)
      expect(casterOf(parts, 'ball').count).toBe(2)
      expect(casters.filter((m) => m !== casterOf(parts, 'ball')).every((m) => m.count === 0)).toBe(true)
    } finally {
      sunCopies.on = true
      parts.cull(null, null)
    }
    expect(held()).toEqual(before)
  })

  it('a model sized along each of its axes (a reaction’s stretch): its parts scaled so, its box grown by its largest; one size, as before', () => {
    const one = (scale?: number | Vector3) => {
      const parts = new Parts({ body: { geometry: new BoxGeometry(1, 0.6, 1.6), max: 4 }, pole: { geometry: new BoxGeometry(0.1, 2, 0.1), max: 4, castShadow: true } })
      parts.begin()
      if (scale === undefined) parts.at(3, 0, -2, 0.7)
      else parts.at(3, 0, -2, 0.7, scale)
      parts.put('body', 0, 0.9, 0)
      parts.put('pole', 0, 1, -1)
      parts.end()
      return parts
    }
    // at one size, a number or the same on every axis: the very matrices of before
    const before = one()
    for (const same of [1, new Vector3(1, 1, 1)]) {
      const now = one(same)
      for (const k of ['body', 'pole']) expect(matrices(now, k)).toEqual(matrices(before, k))
      expect(Array.from(casterOf(now, 'pole').instanceMatrix.array.slice(0, 16))).toEqual(Array.from(casterOf(before, 'pole').instanceMatrix.array.slice(0, 16)))
    }
    // at (1.2, 0.8, 1.2): the body stretched so about the model's own axes, the pole's shadow with it
    const stretch = new Vector3(1.2, 0.8, 1.2)
    const parts = one(stretch)
    const root = new Matrix4().compose(new Vector3(3, 0, -2), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.7), stretch)
    const body = root.clone().multiply(new Matrix4().makeTranslation(0, 0.9, 0))
    matrices(parts, 'body').forEach((v, i) => expect(v).toBeCloseTo(body.elements[i], 5))
    expect(Array.from(casterOf(parts, 'pole').instanceMatrix.array.slice(0, 16))).toEqual(matrices(parts, 'pole'))
    // its box: round the body where it is put, by its bounding sphere grown by the largest axis
    const body1 = new Parts({ body: { geometry: new BoxGeometry(1, 0.6, 1.6), max: 4 } })
    const boxOf = (scale: number | Vector3) => {
      body1.begin().at(3, 0, -2, 0.7, scale).put('body', 0, 0.9, 0)
      body1.end()
      const boxes: number[][] = []
      body1.cull((...box) => (boxes.push(box), true))
      return boxes
    }
    const g = new BoxGeometry(1, 0.6, 1.6)
    g.computeBoundingSphere()
    const radius = g.boundingSphere!.radius
    const grown = 1.2 * radius
    const [box] = boxOf(stretch)
    const want = [3 - grown, 0.9 * 0.8 - grown, -2 - grown, 3 + grown, 0.9 * 0.8 + grown, -2 + grown]
    want.forEach((v, i) => expect(box[i]).toBeCloseTo(v, 5))
    // the same at one size: its sphere where it stands, as big as it is
    const [plain] = boxOf(1)
    const at1 = [3 - radius, 0.9 - radius, -2 - radius, 3 + radius, 0.9 + radius, -2 + radius]
    at1.forEach((v, i) => expect(plain[i]).toBeCloseTo(v, 5))
  })

  it('is a live crowd while its group is in a scene', () => {
    const all = herd()
    const scene = new Group()
    scene.add(all.group)
    expect(liveParts.has(all as unknown as Parts)).toBe(true)
    scene.remove(all.group)
    expect(liveParts.has(all as unknown as Parts)).toBe(false)
  })
})
