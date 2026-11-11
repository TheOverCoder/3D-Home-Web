import { BoxGeometry, Color, Group, Matrix4, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { Parts, liveParts, type ModelTest } from './parts'

// A crowd draws only the models the view can see (the drawing pass, src/lib/visibility): each model — everything put
// after one `at` — is tested once by its box, its parts drawn whole or not at all, in the order they were put, with
// their own colours; parts that cast a shadow stay whole; and `cull(null)` draws everything again.

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
    // the shadow casters stay whole: the sun's shadow map is drawn from the same meshes
    expect(all.meshes.pole.count).toBe(ROW.length)
    expect(all.drawnInstances).toBe(1 + 4 + ROW.length)
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
    expect(all.meshes.pole.count).toBe(ROW.length)
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

  it('is a live crowd while its group is in a scene', () => {
    const all = herd()
    const scene = new Group()
    scene.add(all.group)
    expect(liveParts.has(all as unknown as Parts)).toBe(true)
    scene.remove(all.group)
    expect(liveParts.has(all as unknown as Parts)).toBe(false)
  })
})
