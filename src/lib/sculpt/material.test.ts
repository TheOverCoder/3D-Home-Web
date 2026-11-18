import { describe, expect, it } from 'vitest'
import { MeshStandardMaterial, ShaderLib, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three'
import { MOST_SHELTERS, ownSculptMaterial, sculptSeason, seasonal, setSculptSeason, setSculptShelters, type SculptMaterialOptions } from './material'

// The season's chunk in the materials (src/lib/sculpt/material.ts, update-v1/missions/10-seasons-weather.md F4): which
// materials take it, that it goes into three's own shaders where it means to (after the normal is known, before the
// light is worked out), and that the season is set on all of them at once by uniforms they share — spring being nothing
// at all.

/** A material's shaders as three would compile them (its onBeforeCompile run on the standard material's own). */
function compiled(m: MeshStandardMaterial) {
  const shader = {
    uniforms: { ...ShaderLib.standard.uniforms },
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  } as unknown as WebGLProgramParametersWithUniforms
  m.onBeforeCompile(shader, {} as WebGLRenderer)
  return shader
}

const SPRING = { cover: 0, foliage: { color: '#ffffff', far: '#ffffff', amount: 0 }, grass: '#ffffff' }

describe('which materials the season reaches', () => {
  it('what is built (a surface) and leaves (foliage); not what lives and moves, nor what is swept', () => {
    const has = (o: SculptMaterialOptions) => 'SCULPT_SEASON' in (ownSculptMaterial(o).defines ?? {})
    expect(has({ surface: { kind: 'shingle', size: 0.6 } })).toBe(true)
    expect(has({ surface: { kind: 'bark', size: 0.6 } })).toBe(true)
    expect(has({ detail: { scale: 3, bump: 0.1, shade: 0.1 }, foliage: true })).toBe(true)
    // a sheep's wool, a person's cloth, a crop, a bed's soil
    expect(has({ detail: { scale: 38, bump: 0.012, shade: 0.34 } })).toBe(false)
    expect(has({ roughness: 0.6 })).toBe(false)
    // leaves turn tree by tree: by their model's place, or by the place each vertex carries
    expect(ownSculptMaterial({ foliage: true }).defines).toMatchObject({ SEASON_FOLIAGE: '', SEASON_LEAF: '' })
    expect(ownSculptMaterial({ foliage: true }).defines).not.toHaveProperty('SEASON_LEAF_AT')
    expect(ownSculptMaterial({ foliage: 'placed' }).defines).toMatchObject({ SEASON_LEAF_AT: '' })
  })

  it('a plain material given the season: its defines kept, the leaves, the lawn, or no snow as asked', () => {
    const m = seasonal(new MeshStandardMaterial(), { grass: true })
    expect(m.defines).toMatchObject({ STANDARD: '', SCULPT_SEASON: '', SEASON_GRASS: '' })
    expect(seasonal(new MeshStandardMaterial(), { foliage: true }).defines).toHaveProperty('SEASON_FOLIAGE')
    expect(seasonal(new MeshStandardMaterial(), { cover: false }).defines).toHaveProperty('SEASON_BARE')
    expect(seasonal(new MeshStandardMaterial()).defines).not.toHaveProperty('SEASON_BARE')
    // a copy (a static batch's merged mesh) has it too, with its own options
    const copy = seasonal(new MeshStandardMaterial({ roughness: 0.7 }), { foliage: true }).clone()
    expect(copy.defines).toMatchObject({ STANDARD: '', SCULPT_SEASON: '', SEASON_FOLIAGE: '' })
    expect(copy.roughness).toBe(0.7)
    expect(compiled(copy).fragmentShader).toContain('seasonAt')
  })
})

describe('the chunk in the shaders', () => {
  it('a seasonal material: its uniforms, the noise, and the colours worked out before the light', () => {
    const s = compiled(seasonal(new MeshStandardMaterial(), { foliage: true }))
    for (const u of ['seasonCover', 'seasonFoliage', 'seasonFar', 'seasonGrass', 'seasonShelter', 'seasonShelterTop', 'seasonShelters']) expect(s.uniforms, u).toHaveProperty(u)
    expect(s.fragmentShader).toContain('uniform vec4 seasonShelter[ 8 ]')
    expect(s.fragmentShader.indexOf('seasonAt = cameraPosition')).toBeGreaterThan(s.fragmentShader.indexOf('#include <normal_fragment_maps>'))
    expect(s.fragmentShader.indexOf('seasonAt = cameraPosition')).toBeLessThan(s.fragmentShader.indexOf('#include <lights_physical_fragment>'))
    expect(s.vertexShader).toContain('leafPlace')
  })

  it('a kit material with a surface and one of leaves get it; one without, its shaders as they were', () => {
    expect(compiled(ownSculptMaterial({ surface: { kind: 'stone', size: 0.54 } })).fragmentShader).toContain('seasonAt')
    const leaves = compiled(ownSculptMaterial({ detail: { scale: 3, bump: 0.12, shade: 0.1 }, foliage: 'placed' }))
    expect(leaves.vertexShader).toContain('attribute vec3 leafAt')
    expect(compiled(ownSculptMaterial({ roughness: 0.55 })).fragmentShader).not.toContain('seasonAt')
  })
})

describe('the season set on every material at once', () => {
  it('spring is nothing: no snow, the leaves as they are, the lawn white', () => {
    setSculptSeason(SPRING)
    const s = sculptSeason()
    expect(s.cover).toBe(0)
    expect(s.foliage[3]).toBe(0)
    expect(s.grass).toEqual([1, 1, 1])
  })

  it('winter: snow and the turn within 0–1, colours in the shader’s (linear) colours', () => {
    setSculptSeason({ cover: 3, foliage: { color: '#808080', far: '#808080', amount: -1 }, grass: '#f2f5fa' })
    const s = sculptSeason()
    expect(s.cover).toBe(1)
    expect(s.foliage[3]).toBe(0)
    // sRGB 0x80 is about 0.216 in linear
    expect(s.foliage[0]).toBeCloseTo(0.2159, 3)
    setSculptSeason(SPRING)
  })

  it('the roofs: as many as the shader holds, the rest left out', () => {
    const roof = (i: number) => ({ x0: i, x1: i + 1, z0: 0, z1: 1, top: 3 })
    setSculptShelters([roof(0), roof(1)])
    expect(sculptSeason().shelters).toBe(2)
    setSculptShelters(Array.from({ length: MOST_SHELTERS + 3 }, (_, i) => roof(i)))
    expect(sculptSeason().shelters).toBe(MOST_SHELTERS)
    setSculptShelters([])
    expect(sculptSeason().shelters).toBe(0)
  })
})
