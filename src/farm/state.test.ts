// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultHome, ROOM_WEIGHT, roomWeight, type HomePiece } from '../home/layout'
import { currentSlot, exportSlot, farm, importSlot, resetFarm, slotSummary } from './state'

// the save files a player downloads and loads again (src/ui/SavesPanel.tsx)
describe('farm saves', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFarm()
  })

  it('refuses what is not a save, with a reason', () => {
    expect(importSlot(2, 'not json')).toEqual({ ok: false, error: 'That file is not a save (it is not JSON).' })
    expect(importSlot(2, JSON.stringify({ kind: 'something else', save: {} }))).toEqual({ ok: false, error: 'That file is not a 3D Home farm save.' })
    expect(importSlot(2, JSON.stringify({ kind: '3d-home-farm-save', save: {} }))).toEqual({ ok: false, error: 'That save is empty.' })
    expect(slotSummary(2).exists).toBe(false)
  })

  it('a farm exported and imported into another slot keeps its coins and its house', () => {
    farm.coins = 1234
    farm.home = { ...farm.home, pieces: farm.home.pieces.map((p) => (p.id === 'pouf' ? { ...p, x: -1.5, z: 1.5 } : p)) }
    const file = exportSlot(1)
    expect(file.name).toMatch(/^3d-home-farm-1-\d{4}-\d\d-\d\d\.json$/)
    expect(importSlot(3, file.text)).toEqual({ ok: true })
    expect(slotSummary(3).coins).toBe(1234)
    const saved = JSON.parse(localStorage.getItem('3d-home:farm:v1:slot3')!)
    expect(saved.home.pieces.find((p: HomePiece) => p.id === 'pouf')).toMatchObject({ x: -1.5, z: 1.5 })
  })

  it('a save from before the room limit loads with what does not fit in storage', () => {
    expect(currentSlot()).toBe(1)
    const plants: HomePiece[] = [
      [-1.5, 1.5],
      [-1.0, 4.5],
      [-6.3, 1.6],
      [-2.0, 4.75],
    ].map(([x, z], i) => ({ id: `plant-tall-${i + 1}`, type: 'plant-tall', x, z, rot: 0 }))
    const file = JSON.parse(exportSlot(1).text)
    file.save.home = { pieces: [...defaultHome().pieces, ...plants], stored: [], next: 5 }
    expect(roomWeight(file.save.home, 'living')).toBeGreaterThan(ROOM_WEIGHT)
    // into the slot being played: the running farm takes it at once
    expect(importSlot(1, JSON.stringify(file))).toEqual({ ok: true })
    expect(roomWeight(farm.home, 'living')).toBeLessThanOrEqual(ROOM_WEIGHT)
    expect(farm.home.pieces.length + farm.home.stored.length).toBe(defaultHome().pieces.length + plants.length)
    expect(farm.home.stored.length).toBeGreaterThan(0)
  })
})
