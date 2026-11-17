import { animate, m, useDragControls, useIsPresent, useMotionValue, useTransform, type PanInfo, type Variants } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useSideways } from './sheetMode'
import { SPRING } from './motion'
import './SwipeSheet.css'

// A panel's sheet that moves (the level's card; the design lab's boards show the same): in on the sheet's spring from
// the bottom (upright) or the right (sideways), its blocks after it one by one (`STAGGER` on the panel, `ITEM` on each
// block), out the same way when its host lets it go (AnimatePresence), and a finger's swipe down (sideways: to the
// right) closes it. While it goes out it takes no touch and is no longer a dialog: the next press goes to what is under
// it at once. It keeps the game's panel classes (.farm-backdrop, .farm-panel), so a panel's own CSS holds.

export { useSideways } from './sheetMode'

const away = (wide: boolean) => (wide ? { x: '104%', y: 0 } : { x: 0, y: '104%' })
const SHEET: Variants = {
  hidden: away,
  show: { x: 0, y: 0, transition: SPRING.sheet },
  // going out is quicker than coming in
  out: (wide: boolean) => ({ ...away(wide), transition: { ...SPRING.sheet, stiffness: 520 } }),
}
const PANEL: Variants = { show: { transition: { delayChildren: 0.06, staggerChildren: 0.045 } } }

/** How far (px) or how fast (px/s) a swipe must go for the sheet to close; short of it, it springs back. */
const FAR = 110
const FAST = 450

/**
 * `name`: the panel's own class (on the backdrop, so its rules read `.name .farm-panel …`). `scrolls`: the sheet holds
 * a part that scrolls (marked `data-scroll`, itself the scroller): a swipe that starts there scrolls it, and only one
 * that starts anywhere else (the grabber, the title) moves the sheet.
 */
export function SwipeSheet({ name, label, top, scrolls = false, onClose, children }: { name: string; label: string; top?: boolean; scrolls?: boolean; onClose: () => void; children: ReactNode }) {
  const wide = useSideways()
  const here = useIsPresent()
  const controls = useDragControls()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = panel.current
    if (!el) return
    // the sheet itself takes the focus (Tab goes on to its buttons; Esc closes it)
    el.focus({ preventScroll: true })
    // a swipe that starts on a picture moves the sheet, never drags the picture away (a mouse would)
    const keep = (e: DragEvent) => e.preventDefault()
    el.addEventListener('dragstart', keep)
    return () => el.removeEventListener('dragstart', keep)
  }, [])
  // how far the finger has pulled the sheet towards its way out; the shade lifts with it
  const pull = useMotionValue(0)
  const shade = useTransform(pull, [0, 360], [1, 0.15])
  // a swipe that began on a button is not a press of it
  const swiped = useRef(false)
  const outside = useRef(false)
  const letGo = (_: unknown, i: PanInfo) => {
    const far = wide ? i.offset.x : i.offset.y
    const fast = wide ? i.velocity.x : i.velocity.y
    if (far > FAR || (far > 24 && fast > FAST)) {
      // on its way with the finger's speed; the sheet's way out takes it the rest
      animate(pull, far + 240, { ...SPRING.sheet, velocity: fast })
      onClose()
    } else animate(pull, 0, SPRING.pop)
  }
  return (
    <div
      className={`farm-backdrop swipe${scrolls ? ' scrolls' : ''}${here ? '' : ' leaving'} ${name}`}
      // a touch outside closes it, but only one that began outside: a press that began on the sheet and ended outside it
      // (the sheet grew shorter under the finger) is not a touch outside
      onPointerDown={(e) => (outside.current = !(e.target as Element).closest('.swipe-box'))}
      onClick={(e) => here && outside.current && !(e.target as Element).closest('.swipe-box') && onClose()}
    >
      <m.div className="swipe-shade" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }} transition={{ duration: 0.22 }}>
        <m.span style={{ opacity: shade }} />
      </m.div>
      <m.div className="swipe-box" custom={wide} variants={SHEET} initial="hidden" animate="show" exit="out">
        <m.div
          className={`farm-panel${top ? ' top' : ''}`}
          role={here ? 'dialog' : undefined}
          aria-modal={here ? true : undefined}
          aria-label={here ? label : undefined}
          aria-hidden={here ? undefined : true}
          tabIndex={-1}
          ref={panel}
          variants={PANEL}
          drag={wide ? 'x' : 'y'}
          dragListener={!scrolls}
          dragControls={controls}
          onPointerDown={scrolls ? (e) => !(e.target as Element).closest('[data-scroll]') && controls.start(e) : undefined}
          dragConstraints={wide ? { left: 0 } : { top: 0 }}
          dragElastic={0.06}
          dragMomentum={false}
          style={wide ? { x: pull } : { y: pull }}
          onPointerDownCapture={() => (swiped.current = false)}
          onDragStart={() => (swiped.current = true)}
          onDragEnd={letGo}
          onClickCapture={(e) => {
            if (!swiped.current) return
            e.stopPropagation()
            e.preventDefault()
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <i className="swipe-grab" aria-hidden="true" />
          {children}
        </m.div>
      </m.div>
    </div>
  )
}
