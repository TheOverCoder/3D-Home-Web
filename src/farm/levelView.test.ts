import { describe, expect, it } from 'vitest'
import { levelView } from './levelView'

// The level card's view (./levelView.ts): the savings line (src/farm/economy.ts, nextSaving) rides along when the farm
// gives it, and is left out when it gives none (every big thing bought, or the lab's card without one).

describe("the level card's savings line", () => {
  it('carries the next big thing saved for, as given', () => {
    const saving = { id: 'market', name: 'Market', art: 'convenience-store' as const, have: 640, of: 1500 }
    expect(levelView(500, 1, undefined, { saving }).saving).toEqual(saving)
  })

  it('has none when none is given', () => {
    expect(levelView(500, 1).saving).toBeUndefined()
    expect(levelView(500, 1, undefined, { saving: null }).saving).toBeUndefined()
  })
})
