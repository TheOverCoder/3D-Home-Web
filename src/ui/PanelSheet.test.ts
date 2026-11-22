// @vitest-environment happy-dom
import { act, createElement as h, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, MotionGlobalConfig, usePresence } from 'motion/react'
import { describe, expect, it } from 'vitest'
import { PanelSheet } from './PanelSheet'

// The panel sheet (./PanelSheet.tsx) brought back before it had gone: the settings closed by Esc, and opened again by
// the next Esc while the sheet was still on its way out (AnimatePresence keeps the same sheet for the same key). It
// must come in again and stay, its buttons there (06's "Copy diagnostics" lost its button this way on a slow night).

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// motion's own animations on happy-dom's frames (its stand-in for the browser's never finishes), each at once
delete (Element.prototype as { animate?: unknown }).animate
MotionGlobalConfig.instantAnimations = true

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)))

/** Holds the sheet's exit until let go: a slow frame, when AnimatePresence has not taken it away yet. */
let release: (() => void) | null = null
function Holder() {
  const [present, safeToRemove] = usePresence()
  useEffect(() => {
    if (!present) release = safeToRemove
  }, [present, safeToRemove])
  return null
}

function mount() {
  const host: { setOpen: (o: boolean) => void } = { setOpen: () => {} }
  let closes = 0
  function Host() {
    const [open, so] = useState(true)
    useEffect(() => {
      host.setOpen = so
    }, [so])
    return h(
      AnimatePresence,
      null,
      open &&
        h(PanelSheet, {
          key: 'settings',
          label: 'Settings',
          title: 'Settings',
          pic: '',
          side: true,
          onClose: () => {
            closes++
            so(false)
          },
          children: [h(Holder, { key: 'hold' }), h('button', { key: 'b', id: 'copy-report' }, 'Copy')],
        }),
    )
  }
  const el = document.createElement('div')
  document.body.append(el)
  const root = createRoot(el)
  act(() => root.render(h(Host)))
  return {
    open: (o: boolean) => act(() => host.setOpen(o)),
    esc: () => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))),
    closes: () => closes,
    button: () => !!el.querySelector('#copy-report'),
    leaving: () => !!el.querySelector('.ps-leaving'),
    done: () => act(() => root.unmount()),
  }
}

describe('a sheet brought back before it had gone', () => {
  it('Esc sends it out, the game closes it, and it is opened again during its exit: it comes in and stays', async () => {
    release = null
    const t = mount()
    await wait(300)
    t.esc()
    await wait(30)
    expect(t.leaving()).toBe(true)
    // the game closes the settings itself (a test's ready(), or Esc in the game), and the next Esc opens them again
    // while the sheet is still going out (its exit held here, as a slow frame holds it)
    t.open(false)
    await wait(30)
    t.open(true)
    await wait(500)
    const r = release as (() => void) | null
    if (r) act(() => r())
    await wait(300)
    expect(t.leaving()).toBe(false)
    expect(t.button()).toBe(true)
    expect(t.closes()).toBe(0)
    t.done()
  })
})
