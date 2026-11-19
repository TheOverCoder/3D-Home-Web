// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { useDragDrop } from './drag'

// The machine panel's press (./drag.ts): a press that says what its tap does (a recipe's card) counts as it is let go,
// once, even when its click lands elsewhere (the card rose into place under the finger as the panel came in: the flake
// update-v1 saw on 32-machine-queue); a press that became a drag is a drop, never a tap.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface Seen {
  taps: number
  clicks: number
  drops: number
}

let root: Root | null = null
afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ''
})

/** A card with the panel's wiring: its tap through the press, its click only when the press did not do it. */
function mount(): { seen: Seen; card: HTMLButtonElement } {
  const seen: Seen = { taps: 0, clicks: 0, drops: 0 }
  function Card() {
    const drag = useDragDrop<string>({ onOver: () => {}, onDrop: () => (seen.drops++, null) })
    return createElement(
      'button',
      {
        id: 'card',
        onPointerDown: (e: Parameters<typeof drag.press>[0]) => drag.press(e, 'cake', { src: '', axis: 'none', tap: () => seen.taps++ }),
        onClick: () => !drag.wasDrag() && (seen.taps++, seen.clicks++),
      },
      'Lemon cake',
    )
  }
  const host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root!.render(createElement(Card)))
  return { seen, card: document.getElementById('card') as HTMLButtonElement }
}

const pointer = (type: string, at: { x: number; y: number }) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: at.x, clientY: at.y })

describe("a recipe card's press", () => {
  it('a tap counts as it is let go, and its click does not count it again', () => {
    const { seen, card } = mount()
    act(() => {
      card.dispatchEvent(pointer('pointerdown', { x: 20, y: 20 }))
      card.dispatchEvent(pointer('pointerup', { x: 20, y: 20 }))
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(seen).toEqual({ taps: 1, clicks: 0, drops: 0 })
  })

  it('let go after the card moved from under the finger (no click on it): still one tap', () => {
    const { seen, card } = mount()
    act(() => {
      card.dispatchEvent(pointer('pointerdown', { x: 20, y: 20 }))
      document.body.dispatchEvent(pointer('pointerup', { x: 20, y: 20 }))
    })
    expect(seen.taps).toBe(1)
  })

  it('a press that became a drag is a drop, never a tap', () => {
    const { seen, card } = mount()
    // (the page has nothing laid out to find under the carried picture)
    document.elementsFromPoint = () => []
    act(() => {
      card.dispatchEvent(pointer('pointerdown', { x: 20, y: 20 }))
      window.dispatchEvent(pointer('pointermove', { x: 60, y: 20 }))
      window.dispatchEvent(pointer('pointerup', { x: 60, y: 20 }))
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(seen).toEqual({ taps: 0, clicks: 0, drops: 1 })
  })

  it('a click with no press before it (a key, Enter or Space) is a tap', () => {
    const { seen, card } = mount()
    act(() => {
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    })
    expect(seen).toEqual({ taps: 1, clicks: 1, drops: 0 })
  })
})
