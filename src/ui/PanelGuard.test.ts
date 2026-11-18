// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { useHome } from '../store'
import { DIDNT_OPEN, LAYER_TRIES, PanelGuard, guardHooks } from './PanelGuard'

// A panel that throws closes, and the game plays on (./PanelGuard.tsx): drawn with React itself, as the game is.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let el: HTMLElement
let errors: MockInstance<typeof console.error>
/** Whether the line at the gate's panel has a bug, and how many times the HUD was drawn. */
let broken = true
let hudBroken = false
let hudDrawn = 0

function Buyers() {
  if (broken) throw new Error('a bug in the buyers')
  return h('section', { id: 'buyers' }, 'Buyers')
}
function Hud() {
  hudDrawn++
  if (hudBroken) throw new Error('a bug in the HUD')
  return h('nav', { id: 'hud' })
}
function Game() {
  const panel = useHome((s) => s.panel)
  return h(
    'main',
    null,
    h('canvas', { id: 'scene' }),
    h(PanelGuard, { name: 'hud', layer: true, children: h(Hud) }),
    h(PanelGuard, { name: panel?.kind ?? '', children: panel?.kind === 'queue' ? h(Buyers) : null }),
  )
}

const $ = (id: string) => el.querySelector(`#${id}`)
const reported = () => errors.mock.calls.map((c) => String(c[0])).filter((t) => t.startsWith('[3d-home]'))

beforeEach(() => {
  broken = true
  hudBroken = false
  hudDrawn = 0
  useHome.setState({ panel: null, toast: null, view: 'first', settingsOpen: false })
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  act(() => root.render(h(Game)))
})
afterEach(() => {
  act(() => root.unmount())
  el.remove()
  errors.mockRestore()
})

describe('a panel that throws', () => {
  it('closes with a word, the rest of the page drawn on, and the error said with its name', () => {
    act(() => useHome.getState().openPanel({ kind: 'queue' }))
    expect(useHome.getState().panel).toBeNull()
    expect(useHome.getState().toast?.text).toBe(DIDNT_OPEN)
    expect($('buyers')).toBeNull()
    expect($('scene')).not.toBeNull()
    expect($('hud')).not.toBeNull()
    expect(reported()).toEqual(['[3d-home] "queue" failed and was closed: Error: a bug in the buyers'])
  })

  it('opens again from fresh the next time', () => {
    act(() => useHome.getState().openPanel({ kind: 'queue' }))
    broken = false
    act(() => useHome.getState().openPanel({ kind: 'queue' }))
    expect(useHome.getState().panel?.kind).toBe('queue')
    expect($('buyers')?.textContent).toBe('Buyers')
  })

  it('closes what it holds: its own close when it has one', () => {
    act(() => root.render(h(PanelGuard, { name: 'settings', close: () => useHome.getState().setSettingsOpen(false), children: h(Buyers) })))
    expect(useHome.getState().toast?.text).toBe(DIDNT_OPEN)
    expect(reported()).toEqual(['[3d-home] "settings" failed and was closed: Error: a bug in the buyers'])
  })
})

describe('a layer that throws', () => {
  it('is left out with no word, nothing closed, and drawn again once what is over the game changes', () => {
    act(() => useHome.getState().openPanel({ kind: 'level' }))
    hudBroken = true
    act(() => guardHooks.fail('hud'))
    expect($('hud')).toBeNull()
    expect(useHome.getState().panel?.kind).toBe('level')
    expect(useHome.getState().toast).toBeNull()
    expect(reported()).toEqual(['[3d-home] "hud" failed and was left out: Error: [test] a fault in "hud"'])
    // still broken: left out again at the next change; then mended, drawn again at the one after
    act(() => useHome.getState().closePanel())
    expect($('hud')).toBeNull()
    hudBroken = false
    act(() => useHome.getState().setView('third'))
    expect($('hud')).not.toBeNull()
  })

  it('is drawn again a few times a page at most: one that fails every time stays out', () => {
    hudBroken = true
    act(() => guardHooks.fail('hud'))
    const changes = ['third', 'first', 'third', 'first', 'third'] as const
    for (const v of changes) act(() => useHome.getState().setView(v))
    const drawnOut = hudDrawn
    expect(reported()).toHaveLength(1 + LAYER_TRIES)
    act(() => useHome.getState().setView('first'))
    expect(hudDrawn).toBe(drawnOut)
    expect($('hud')).toBeNull()
    expect($('scene')).not.toBeNull()
  })
})

describe('a layer that fails now and then', () => {
  it('counts its tries from nothing each time it draws whole again', () => {
    for (let k = 0; k <= LAYER_TRIES + 1; k++) {
      act(() => guardHooks.fail('hud'))
      expect($('hud')).toBeNull()
      act(() => useHome.getState().setView(k % 2 ? 'first' : 'third'))
      expect($('hud')).not.toBeNull()
    }
    expect(reported()).toHaveLength(LAYER_TRIES + 2)
  })
})

describe('a fault armed for a test', () => {
  it('throws in its guard once, as that panel opens; then the panel works', () => {
    broken = false
    act(() => guardHooks.fail('queue'))
    expect(reported()).toEqual([])
    act(() => useHome.getState().openPanel({ kind: 'queue' }))
    expect(useHome.getState().panel).toBeNull()
    expect(reported()).toEqual(['[3d-home] "queue" failed and was closed: Error: [test] a fault in "queue"'])
    act(() => useHome.getState().openPanel({ kind: 'queue' }))
    expect($('buyers')).not.toBeNull()
  })
})
