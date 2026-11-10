import { beforeEach, describe, expect, it } from 'vitest'
import { makeProfile } from '../lib/profile'
import { coinsFx, coinsToFly, farmFx, takeFx } from './fx'

// what the game asks of the effects (src/fx/fx.ts): the rules that do not need a browser
describe('farm effects', () => {
  beforeEach(() => {
    takeFx()
  })

  it('a sale sends a few coins, more for a bigger one, never a swarm', () => {
    expect(coinsToFly(3)).toBe(3)
    expect(coinsToFly(12)).toBe(4)
    expect(coinsToFly(48)).toBe(7)
    expect(coinsToFly(500)).toBe(7)
  })

  it('what is asked waits for the next frame, in order, and is taken once', () => {
    farmFx('water', 1, 0.4, 2)
    farmFx('harvest', 1, 0.5, 2, { good: 'tomato' })
    coinsFx(5.6, 13.8, 12)
    const asked = takeFx()
    expect(asked.map((r) => r.kind)).toEqual(['water', 'harvest', 'coins'])
    expect(asked[1]).toMatchObject({ good: 'tomato', x: 1, z: 2 })
    expect(asked[2]).toMatchObject({ coins: 12, x: 5.6, z: 13.8 })
    expect(takeFx()).toEqual([])
  })

  it('every device draws the particles, the light graphics half of them', () => {
    expect(makeProfile('phone', false, false).particles).toBe(1)
    expect(makeProfile('desktop', false, false).particles).toBe(1)
    expect(makeProfile('phone', true, true).particles).toBe(0.5)
  })

  it('a pile of requests nobody plays keeps only the latest few', () => {
    for (let i = 0; i < 100; i++) farmFx('dust', i, 0, 0)
    const asked = takeFx()
    expect(asked.length).toBe(48)
    expect(asked[asked.length - 1].x).toBe(99)
  })
})
