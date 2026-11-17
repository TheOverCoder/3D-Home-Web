import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

// The top middle of the screen as one column (styles.css: .top-stack): under the farm's chips when everything shows,
// at the very top with only the compass. What stands there — the compass, a toast, the level-up show, the first hint
// and a new farm's next step (src/farm/FirstSteps.tsx) — each goes in its slot, one under another in this order, and
// the column puts it in its place: never an
// offset from another element, so no two of them can ever cover each other however many rows the chips take.
// Something new up there is a slot here, in its place in the order. With everything shown outdoors, the compass's slot
// stands in the dashboard's hole between its wings (src/farm/TopDash.tsx keeps the hole and says where, Compass.css
// puts it there), and the column's other slots stand under the whole dashboard.

const ORDER = { compass: 1, toast: 2, level: 3, hint: 4, steps: 5 } as const
export type TopSlotName = keyof typeof ORDER

let column: HTMLElement | null = null
/** The column, made the first time something is put in it (so a slot is never rendered before it exists). */
function stack(): HTMLElement {
  if (!column) {
    column = document.createElement('div')
    column.className = 'top-stack'
    document.body.appendChild(column)
  }
  return column
}

/** Something shown at the top middle, in its place in the column. */
export function TopSlot({ name, children }: { name: TopSlotName; children: ReactNode }) {
  return createPortal(
    <div className={`top-slot top-slot-${name}`} style={{ order: ORDER[name] }}>
      {children}
    </div>,
    stack(),
  )
}
