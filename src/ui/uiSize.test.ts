import { describe, expect, it } from 'vitest'
import { MIN_SIDE, UI_SIZES, uiScale } from './uiSize'
import { uiSizeOf } from '../settings'

// The interface's size (./uiSize.ts): what the player picks, capped by the screen so it keeps the room it was laid out
// for; medium is the game as drawn, everywhere.

describe('the interface size', () => {
  it('is the size picked on a screen with room for it', () => {
    for (const pick of Object.keys(UI_SIZES) as (keyof typeof UI_SIZES)[]) expect(uiScale(pick, 1280, 800)).toBe(UI_SIZES[pick])
    expect(UI_SIZES.medium).toBe(1)
    expect(UI_SIZES.small).toBeLessThan(1)
    expect(UI_SIZES.larger).toBeGreaterThan(UI_SIZES.large)
  })

  it('grows on a phone only as far as leaves MIN_SIDE px on its short side, upright or sideways', () => {
    // a 390 px phone: 390 / 350 = 1.114
    expect(uiScale('larger', 390, 844)).toBeCloseTo(390 / MIN_SIDE, 3)
    expect(uiScale('larger', 844, 390)).toBeCloseTo(390 / MIN_SIDE, 3)
    expect(uiScale('large', 390, 844)).toBeCloseTo(390 / MIN_SIDE, 3)
    // a 360 px phone: medium and larger alike stay at least the game as drawn
    expect(uiScale('medium', 360, 780)).toBe(1)
    expect(uiScale('larger', 340, 700)).toBe(1)
    // smaller always fits
    expect(uiScale('small', 360, 780)).toBe(UI_SIZES.small)
  })

  it('reads a saved size, or medium for anything else', () => {
    expect(uiSizeOf('large')).toBe('large')
    expect(uiSizeOf('huge')).toBe('medium')
    expect(uiSizeOf(undefined)).toBe('medium')
  })
})
