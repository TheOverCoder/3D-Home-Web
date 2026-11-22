// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { keyFor, SLOT_KEY, startsOnFarm } from './saveKeys'

// Which farm the device opens, read by the page shell before the farm's code is there (src/lib/loader.ts: the house's
// furniture waits until play on a farm that opens on the farm's map).

afterEach(() => localStorage.clear())

describe('whether the farm this device opens starts on the farm', () => {
  it('a new device (nothing saved): yes', () => {
    expect(startsOnFarm()).toBe(true)
  })
  it('saved on the farm: yes; in the house: no', () => {
    localStorage.setItem(keyFor(1), JSON.stringify({ place: 'farm', coins: 5 }))
    expect(startsOnFarm()).toBe(true)
    localStorage.setItem(keyFor(1), JSON.stringify({ place: 'home', coins: 5 }))
    expect(startsOnFarm()).toBe(false)
  })
  it('the slot played last decides', () => {
    localStorage.setItem(keyFor(1), JSON.stringify({ place: 'farm' }))
    localStorage.setItem(keyFor(2), JSON.stringify({ place: 'home' }))
    localStorage.setItem(SLOT_KEY, '2')
    expect(startsOnFarm()).toBe(false)
    localStorage.setItem(SLOT_KEY, '3')
    expect(startsOnFarm()).toBe(true)
  })
  it('a save from before the two maps (no place), or one that cannot be read: not known, so no', () => {
    localStorage.setItem(keyFor(1), JSON.stringify({ coins: 5, apartment: { owned: true } }))
    expect(startsOnFarm()).toBe(false)
    localStorage.setItem(keyFor(1), '{broken')
    expect(startsOnFarm()).toBe(false)
  })
})
