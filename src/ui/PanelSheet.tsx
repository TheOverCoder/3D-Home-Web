import { m, useDragControls, type PanInfo } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from './glyphs'
import { ARRIVE, PRESS, SHEET, STAGGER, swipedAway } from './motion'
import { useSheetMode } from './sheetMode'

// The panel sheet (the base: CLAUDE.md, "Interface"): a sheet of paper from the screen's edge — from the bottom
// upright, on the right sideways, in the middle on a computer — with the panel's picture, a title of a few words, a row
// of chips and ✕ at its top, and its blocks coming in one after another (`ITEM` on each, from ./motion). A swipe of its
// top (down upright, right sideways), a touch on the shade, ✕ or Esc sends it out the way it came; then `onClose`. Esc
// leaves it be while something over it (a card, a good's bubble) is open: that goes first. Its classes are the machine
// panel's (src/styles.css, "the panel sheet"): the machine panel draws the same sheet with its own pages.

/** Whatever is open over a sheet (a card, a good's bubble) takes Esc before the sheet does. */
const above = () => !!document.querySelector('.farm-backdrop, .good-pop')

export function PanelSheet({
  label,
  title,
  pic,
  sub,
  className = '',
  near,
  closing = false,
  onClose,
  children,
}: {
  /** what a screen reader calls the sheet */
  label: string
  title: string
  /** the picture at its top (an image URL) */
  pic: string
  /** the row of chips under the title */
  sub?: ReactNode
  /** the panel's own class, on the root (its rules read `.name .mp-sheet …`) */
  className?: string
  /** what stands beside the sheet, outside it (the remote's tag of a panel opened from afar) */
  near?: ReactNode
  /** the panel asks it to go out (it then calls `onClose`) */
  closing?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const mode = useSheetMode()
  const [leaving, setLeaving] = useState(false)
  const out = leaving || closing
  const sheet = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || above()) return
      e.stopPropagation()
      setLeaving(true)
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [])
  const letGo = (_: unknown, i: PanInfo) => swipedAway(mode, i) && setLeaving(true)
  return (
    <div className={`mp-root mp-${mode} ps-root ${className}`}>
      <m.div className="mp-shade" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: out ? 0 : 1 }} transition={{ duration: out ? 0.18 : 0.24 }} onClick={() => setLeaving(true)} />
      <m.div
        ref={sheet}
        className="mp-sheet farm-panel ps-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        custom={mode}
        variants={SHEET}
        initial="hidden"
        animate={out ? 'out' : 'show'}
        onAnimationComplete={(d) => d === 'out' && onClose()}
        drag={mode === 'middle' ? false : mode === 'right' ? 'x' : 'y'}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={mode === 'right' ? { right: 0.9, left: 0 } : { bottom: 0.9, top: 0 }}
        dragMomentum={false}
        onDragEnd={letGo}
      >
        <header
          className="mp-head"
          onPointerDown={(e) => {
            if (mode !== 'middle' && !(e.target as Element).closest('button')) controls.start(e)
          }}
        >
          <i className="mp-grab" aria-hidden="true" />
          <m.img className="art mp-head-art" src={pic} alt="" {...ARRIVE} />
          <div className="mp-head-text">
            <h2>{title}</h2>
            {sub && <div className="mp-sub">{sub}</div>}
          </div>
          <m.button className="mp-round" onClick={() => setLeaving(true)} aria-label="Close (Esc)" {...PRESS}>
            <X weight="bold" />
          </m.button>
        </header>
        <m.div className="ps-body" initial="hidden" animate="show" variants={STAGGER}>
          {children}
        </m.div>
      </m.div>
      {near}
    </div>
  )
}
