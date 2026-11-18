import { describe, expect, it } from 'vitest'
import { APPS, appById } from './apps'

// The computer's apps as rows (./apps.ts): the three of decision 09's, each with a view of its own, its tabs named once.

describe("the computer's apps", () => {
  it('are the Market, the Planner and the Sales book, in that order, each drawing a view of its own', () => {
    expect(APPS.map((a) => a.name)).toEqual(['Market', 'Planner', 'Sales book'])
    expect(APPS.map((a) => a.view)).toEqual(['market', 'plan', 'book'])
    expect(APPS.map((a) => a.tabs.map((t) => t.name))).toEqual([
      ['Prices', 'Index'],
      ['Asked', 'Beds', 'Machines'],
      ['Days', 'Goods'],
    ])
  })

  it('each has an id, a picture and tabs of its own, found by its id', () => {
    const ids = APPS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of APPS) {
      expect(appById(a.id)).toBe(a)
      expect(a.pic).toMatch(/^[a-z]+(-[a-z]+)*$/)
      expect(a.tabs.length).toBeGreaterThan(0)
      expect(new Set(a.tabs.map((t) => t.id)).size).toBe(a.tabs.length)
    }
    expect(new Set(APPS.map((a) => a.pic)).size).toBe(APPS.length)
    expect(appById('mail')).toBeUndefined()
  })
})
