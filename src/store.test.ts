import { describe, expect, it } from 'vitest'
import { PANEL_KINDS } from './store'

// Every kind of panel is listed once, as one that opens (tests/e2e/39-panels opens each and measures it). The type holds
// that every kind of `Panel` is there; this holds that each is the kind it is filed under.

describe('the panels', () => {
  it('are each listed once, as the kind they are filed under', () => {
    const kinds = Object.keys(PANEL_KINDS)
    expect(kinds.length).toBeGreaterThanOrEqual(32)
    for (const [kind, panel] of Object.entries(PANEL_KINDS)) expect(panel.kind, kind).toBe(kind)
    expect(new Set(Object.values(PANEL_KINDS).map((p) => p.kind)).size).toBe(kinds.length)
  })
})
